/**
 * Attribution Token — LP から LINE へ計測情報を運ぶための最小フォーマット。
 *
 * なぜ必要か:
 *   LINE の友だち追加URL（https://line.me/R/ti/p/@xxxx）は
 *   クエリパラメータを follow イベントへ渡せない。
 *   そのため LP 側の lead_id / gclid / utm_* は、何もしなければ 100% 失われる。
 *   → 利用者が最初に送るメッセージ本文へ短いトークンを載せて運ぶ。
 *
 * 設計上の約束:
 *   1. 載せてよいのは ALLOWED_KEYS だけ。それ以外は encode 時に捨てる。
 *      個人情報・入力値・自由テキストは絶対に載せない。
 *   2. トークンが無くても funnel は動く（attribution が空になるだけ）。
 *      = fail-open だが、失うのは計測だけで、利用者の相談は止まらない。
 *   3. 難読化であって暗号ではない。秘密情報を入れない。
 *
 * このファイルはブラウザ（ES5 / グローバル）と Node（テスト）の両方から読む。
 * 依存を持たせないこと。フォーマットの正本はこのファイル。
 */
(function (root) {
  "use strict";

  var PREFIX = "LCA1.";

  /** これ以外のキーは運ばない（ホワイトリスト方式） */
  var ALLOWED_KEYS = [
    "lead_id",
    "gclid",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "landing_variant",
  ];

  /** 1値あたりの上限。異常に長い値でメッセージを壊さない */
  var MAX_VALUE_LENGTH = 200;
  /** トークン全体の上限 */
  var MAX_TOKEN_LENGTH = 1200;

  function toBase64Url(str) {
    var b64;
    if (typeof btoa === "function") {
      // btoa は Latin-1 しか扱えないので UTF-8 をバイト列へ寄せてから渡す
      b64 = btoa(unescape(encodeURIComponent(str)));
    } else {
      b64 = Buffer.from(str, "utf8").toString("base64");
    }
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function fromBase64Url(token) {
    var b64 = token.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4 !== 0) b64 += "=";
    if (typeof atob === "function") {
      return decodeURIComponent(escape(atob(b64)));
    }
    return Buffer.from(b64, "base64").toString("utf8");
  }

  /**
   * attribution オブジェクト → トークン文字列。
   * 空要素しか無い場合は null を返す（意味の無いトークンを本文へ足さない）。
   */
  function encode(attribution) {
    if (!attribution || typeof attribution !== "object") return null;

    var picked = {};
    var has = false;
    for (var i = 0; i < ALLOWED_KEYS.length; i++) {
      var k = ALLOWED_KEYS[i];
      var v = attribution[k];
      if (v === undefined || v === null || v === "") continue;
      v = String(v);
      if (v.length > MAX_VALUE_LENGTH) v = v.slice(0, MAX_VALUE_LENGTH);
      picked[k] = v;
      has = true;
    }
    if (!has) return null;

    var token = PREFIX + toBase64Url(JSON.stringify(picked));
    if (token.length > MAX_TOKEN_LENGTH) return null;
    return token;
  }

  /**
   * 任意のテキストからトークンを1つ取り出して復号する。
   * 見つからない／壊れている場合は null（例外を投げない = 相談を止めない）。
   */
  function decode(text) {
    if (typeof text !== "string" || text.indexOf(PREFIX) === -1) return null;

    var m = text.match(/LCA1\.([A-Za-z0-9_-]+)/);
    if (!m) return null;
    if (m[0].length > MAX_TOKEN_LENGTH) return null;

    var json;
    try {
      json = fromBase64Url(m[1]);
    } catch (e) {
      return null;
    }

    var parsed;
    try {
      parsed = JSON.parse(json);
    } catch (e) {
      return null;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

    // 復号側でもホワイトリストを再適用する。
    // 送信側を信用しない（本文は利用者が自由に書き換えられるため）。
    var out = {};
    var found = false;
    for (var i = 0; i < ALLOWED_KEYS.length; i++) {
      var k = ALLOWED_KEYS[i];
      var v = parsed[k];
      if (typeof v !== "string" || v === "") continue;
      out[k] = v.length > MAX_VALUE_LENGTH ? v.slice(0, MAX_VALUE_LENGTH) : v;
      found = true;
    }
    return found ? out : null;
  }

  /** 本文からトークン部分を取り除く（ログ・保存前の掃除用） */
  function strip(text) {
    if (typeof text !== "string") return "";
    return text.replace(/LCA1\.[A-Za-z0-9_-]+/g, "").trim();
  }

  var api = {
    PREFIX: PREFIX,
    ALLOWED_KEYS: ALLOWED_KEYS,
    MAX_VALUE_LENGTH: MAX_VALUE_LENGTH,
    MAX_TOKEN_LENGTH: MAX_TOKEN_LENGTH,
    encode: encode,
    decode: decode,
    strip: strip,
  };

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.LP_ATTRIBUTION_TOKEN = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
