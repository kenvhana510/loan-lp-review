/**
 * おまとめ住宅ローン LP — 計測レイヤー
 *
 * 設計原則（既存正本 GA4_EVENT_TAXONOMY.md を踏襲）:
 *   - 呼び出し側は常に track(name, params) を呼ぶ。GA4/console の切替は本ファイル内に閉じる
 *   - 実測定IDが未設定なら console.debug へフォールバックし、コードは変更しない
 *   - attribution（UTM/GCLID）はファーストタッチで保存し、全イベントに自動付与する
 *
 * イベント: lp_view / scroll_25 / scroll_50 / scroll_75 / scroll_90 /
 *           line_cta_click / case_study_cta_click / faq_open / privacy_click / law_click
 */
(function (global) {
  "use strict";

  var config = global.LP_CONFIG || {};
  var STORAGE_KEY = "lp_attribution";
  var UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

  function isConfigured(value) {
    return !!value && value.indexOf("REPLACE_ME") === -1;
  }

  // ---------- attribution ----------

  function uuid() {
    // crypto.randomUUID が使えない環境向けのフォールバックを含む
    if (global.crypto && typeof global.crypto.randomUUID === "function") {
      return global.crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function safeStorage() {
    // プライベートブラウジング等で localStorage が例外を投げる環境がある
    try {
      var k = "__lp_probe__";
      global.localStorage.setItem(k, "1");
      global.localStorage.removeItem(k);
      return global.localStorage;
    } catch (e) {
      return null;
    }
  }

  var store = safeStorage();

  function readAttribution() {
    if (!store) return null;
    try {
      var raw = store.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * ファーストタッチ帰属。初回訪問時のみ保存し、以後は上書きしない。
   * 「広告クリック → 離脱 → 後日 自然流入で再訪 → CV」でも
   * 広告の貢献を失わないため。
   */
  function initAttribution() {
    var existing = readAttribution();
    var cur = new URLSearchParams(global.location.search);

    if (existing && existing.lead_id) {
      // ⚠️ **「空の非広告タッチ」が実クリックを恒久的に排除していた。**
      //    `lead_id` の有無だけで早期 return していたため、自然流入・直接・
      //    自前プレビューで先に着地したブラウザは gclid が "" のまま固定され、
      //    その後どんな広告クリックが来ても補完されなかった（独立レビュー28回目 HIGH）。
      //    primary CV（handoff_ready）は **offline_gclid でしか取り込めない**ので、
      //    そのリードは成果として Ads へ戻せず、Smart Bidding が学習できない。
      //
      //    ⚠️ ファーストタッチ方針は変えない。`lead_id` と `first_landing_at` は不変。
      //    **保存済みが空で、いま値がある場合だけ**後追いで埋める。
      //    広告クリック同士の上書き（CLICK_A → CLICK_B）は従来どおり行わない。
      //    ⚠️ **1レコードが2つの流入元を主張しないようにする。**
      //       キーごとに空欄を埋めると、`gclid` だけが後のタッチから入り、
      //       `utm_*` は前のタッチのまま残る。実測では Google Ads がキャンペーンB に
      //       オフラインCVを付け、自社のUTM集計は同じリードをキャンペーンA に付ける、
      //       という**矛盾した2つの根拠**が1レコード内にできた（29回目 MEDIUM）。
      //       → 補完は**タッチ単位でまとめて**行う。`gclid` を採用するなら
      //         同じタッチの `utm_*` も採用する（記録は常に1つのタッチを表す）。
      var filled = false;
      var curGclid = cur.get("gclid") || "";
      if (!existing.gclid && curGclid) {
        //    ⚠️ **既知の値を消さない。** Google Ads は自動タグのみが既定なので、
        //       広告クリックに utm_* が付かないことが通常系である。
        //       無条件に代入すると、メルマガ等で先に着地した既存の utm_* が
        //       **空文字で消える**（最も分析価値の高い層の流入元だけが失われる。
        //       独立レビュー30回目 MEDIUM）。
        //       → 前のタッチの値は `first_touch_utm_*` へ退避してから入れ替える。
        existing.gclid = curGclid;
        for (var i = 0; i < UTM_KEYS.length; i++) {
          var uk = UTM_KEYS[i];
          if (existing[uk]) existing["first_touch_" + uk] = existing[uk];
          existing[uk] = cur.get(uk) || "";
        }
        filled = true;
      } else if (!existing.gclid) {
        // 広告クリックが無いタッチでは、空欄の utm_* だけを補う
        for (var j = 0; j < UTM_KEYS.length; j++) {
          var k2 = UTM_KEYS[j];
          var v2 = cur.get(k2) || "";
          if (!existing[k2] && v2) { existing[k2] = v2; filled = true; }
        }
      }
      if (filled) {
        existing.attribution_backfilled_at = new Date().toISOString();
        if (store) {
          try { store.setItem(STORAGE_KEY, JSON.stringify(existing)); }
          catch (e) { /* 保存できなくても計測自体は継続する */ }
        }
      }
      return existing;
    }

    var params = cur;
    var data = {
      lead_id: uuid(),
      gclid: params.get("gclid") || "",
      first_landing_at: new Date().toISOString(),
      landing_variant: config.PAGE_VARIANT || "unknown",
    };
    UTM_KEYS.forEach(function (k) {
      data[k] = params.get(k) || "";
    });

    if (store) {
      try {
        store.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (e) {
        /* 保存できなくても計測自体は継続する */
      }
    }
    return data;
  }

  var attribution = initAttribution();

  // ---------- GA4 ----------

  function loadGA4() {
    var id = config.GA_MEASUREMENT_ID;
    if (!isConfigured(id)) return;

    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + id;
    document.head.appendChild(s);

    global.dataLayer = global.dataLayer || [];
    function gtag() {
      global.dataLayer.push(arguments);
    }
    global.gtag = gtag;
    gtag("js", new Date());
    gtag("config", id);
  }

  /**
   * @param {object} [opts]
   * @param {boolean} [opts.beacon]
   *   遷移直前に撃つイベントは true。sendBeacon で送らせ、
   *   ページ離脱で握り潰されるのを防ぐ（CTA クリックの取りこぼし対策）。
   */
  function track(name, params, opts) {
    var payload = Object.assign(
      { page_variant: config.PAGE_VARIANT || "unknown" },
      attribution,
      params || {}
    );
    if (opts && opts.beacon) payload.transport_type = "beacon";

    if (typeof global.gtag === "function") {
      global.gtag("event", name, payload);
    } else {
      // 実測定ID未設定時のフォールバック。実装を変えずに疎通確認できる
      console.debug("[track]", name, payload);
    }
  }

  // ---------- scroll depth ----------

  function bindScrollDepth() {
    if (!config.FEATURES || !config.FEATURES.SCROLL_DEPTH) return;

    var thresholds = [25, 50, 75, 90];
    var fired = {};

    function onScroll() {
      var doc = document.documentElement;
      var scrollable = doc.scrollHeight - global.innerHeight;
      if (scrollable <= 0) return;
      var pct = ((global.scrollY || doc.scrollTop) / scrollable) * 100;

      thresholds.forEach(function (t) {
        if (!fired[t] && pct >= t) {
          fired[t] = true;
          track("scroll_" + t);
        }
      });

      if (thresholds.every(function (t) { return fired[t]; })) {
        global.removeEventListener("scroll", onScroll);
      }
    }

    global.addEventListener("scroll", onScroll, { passive: true });
    onScroll(); // 画面が短くて初期表示で既に到達済みのケース
  }

  // ---------- CTA ----------

  /**
   * LINE CTA。LINE_FRIEND_URL が未設定（PENDING）の間は
   * 遷移させず、計測イベントのみ発火する = 安全停止。
   */
  /**
   * LINE への遷移先を組み立てる（PHASE 6.0）。
   *
   * 既定は oaMessage 方式。友だち追加URL（/ti/p/）は本文を持てず、
   * follow イベントに lead_id / gclid / utm_* を渡す手段が無いため、
   * そのままでは attribution が 100% 失われる。
   *
   * 未設定（REPLACE_ME）のときは null を返す = 遷移させない安全停止を維持する。
   * フォーマットの正本は tracking/attribution-token.js。
   */
  function buildLineHref() {
    var mode = config.LINE_ENTRY_MODE || "friend_add";

    if (mode === "oa_message") {
      var basicId = config.LINE_BASIC_ID;
      if (!isConfigured(basicId)) return null;
      var id = basicId.charAt(0) === "@" ? basicId : "@" + basicId;

      var greeting = config.LINE_ENTRY_GREETING || "相談を希望します";
      var tokenApi = global.LP_ATTRIBUTION_TOKEN;
      var t = tokenApi ? tokenApi.encode(attribution) : null;
      var body = t ? greeting + "\n" + t : greeting;

      return (
        "https://line.me/R/oaMessage/" +
        encodeURIComponent(id) +
        "/?" +
        encodeURIComponent(body)
      );
    }

    var url = config.LINE_FRIEND_URL;
    return isConfigured(url) ? url : null;
  }

  function bindCtaTracking() {
    var href = buildLineHref();
    var ready = href !== null;

    document.querySelectorAll('[data-cta-type="line"]').forEach(function (el) {
      if (ready) el.setAttribute("href", href);

      el.addEventListener("click", function (ev) {
        var position = el.getAttribute("data-cta-position") || "unknown";
        var eventName =
          position === "case-study" ? "case_study_cta_click" : "line_cta_click";

        track(
          eventName,
          {
            cta_position: position,
            cta_id: el.getAttribute("data-cta-id") || "unknown",
          },
          // 遷移で送信が中断されないように beacon で送る
          { beacon: ready }
        );

        if (!ready) {
          ev.preventDefault(); // LINE未設定時は遷移しない
        }
      });
    });
  }

  /**
   * CTA の露出（impression）。
   *
   * クリックしか取れないと「CTA が見られていないのか、見られたが刺さらないのか」を
   * 区別できず、位置ごとの改善判断ができない。
   * 露出を取ることで CTA位置別の CTR（cta_click / cta_view）が出せるようになる。
   *
   * 一度見えたら以後は撃たない（同一セッションでの重複計上を避ける）。
   * IntersectionObserver が無い環境では**何もしない**（計測のために表示を壊さない）。
   */
  function bindCtaImpressions() {
    if (!config.FEATURES || !config.FEATURES.CTA_IMPRESSION) return;
    if (typeof global.IntersectionObserver !== "function") return;

    var seen = {};

    var observer = new global.IntersectionObserver(
      function (entries) {
        for (var i = 0; i < entries.length; i++) {
          var entry = entries[i];
          if (!entry.isIntersecting) continue;

          var el = entry.target;
          var position = el.getAttribute("data-cta-position") || "unknown";
          if (seen[position]) {
            observer.unobserve(el);
            continue;
          }
          seen[position] = true;

          track("cta_view", {
            cta_position: position,
            cta_id: el.getAttribute("data-cta-id") || "unknown",
          });
          observer.unobserve(el);
        }
      },
      // 半分見えたら「見た」とみなす。端に1px掠めただけを露出に数えない
      { threshold: 0.5 }
    );

    document.querySelectorAll('[data-cta-type="line"]').forEach(function (el) {
      observer.observe(el);
    });
  }

  function bindFaqTracking() {
    document.querySelectorAll("details[data-faq-id]").forEach(function (el) {
      el.addEventListener("toggle", function () {
        if (el.open) {
          track("faq_open", { faq_id: el.getAttribute("data-faq-id") });
        }
      });
    });
  }

  function bindLegalTracking() {
    var map = { privacy: "privacy_click", law: "law_click" };
    document.querySelectorAll("[data-legal-link]").forEach(function (el) {
      var name = map[el.getAttribute("data-legal-link")];
      if (!name) return;
      el.addEventListener("click", function () {
        track(name);
      });
    });
  }

  // ---------- claims / entity gate ----------

  /**
   * CLAIMS_MODE="production" のとき、証拠が確認できていない claim を DOM から除去する。
   * "dev" のときは黄色枠で可視化し、人間が目視確認できるようにする。
   * docs/claims-register.md が唯一の正本。
   */
  function applyGate(attr, mode) {
    var pending = document.querySelectorAll("[" + attr + '="pending"]');
    // ⚠️ ここで文字列の完全一致比較を使ってはならない。
    //    applyOperatorDisclosure 側は isProductionMode()（trim + 小文字化）で判定するため、
    //    ENTITY_MODE=" production " のとき「実値は描画されるのに仮表示も残る」という
    //    最悪のハイブリッドになる（Critic が実測で再現）。**判定は必ず1つに揃える。**
    if (isProductionMode(mode)) {
      pending.forEach(function (el) {
        el.parentNode.removeChild(el);
      });
    } else {
      document.body.classList.add(
        attr === "data-claim-status" ? "is-claims-dev" : "is-entity-dev"
      );
    }
  }

  // ---------- 運営者情報（F-6 必須開示） ----------

  /**
   * OPERATOR の必須項目。1つでも欠けたら「不完全」とみなす。
   * 追加するときは docs/operator-information-intake.md の表と必ず揃えること。
   */
  // ⚠️ **2主体構成**（2026-09-03 に人間が決定）。
  //    ADVERTISER_* は広告主（ユーザー本人）、それ以外は役務提供者（中央住地）。
  //    住所・電話・メールは主体ごとに別の値である。混ぜないこと。
  var OPERATOR_FIELDS = [
    "ADVERTISER_NAME",
    "ADVERTISER_ADDRESS",
    "ADVERTISER_PHONE",
    "ADVERTISER_EMAIL",
    "BUSINESS_HOURS",
    "PROVIDER_NAME",
    "ADDRESS",
    "REPRESENTATIVE",
    "PHONE",
    "EMAIL",
    "LICENSE_NUMBER",
    "LICENSE_AUTHORITY",
  ];

  /**
   * 実値として扱ってはいけない語（部分一致）。
   * ⚠️ **正本は line/operator-rules.mjs**。ブラウザ側は import できないため写経している。
   *    片方だけ変更しないこと。両者が同じ判定を返すことは
   *    tests/verify-lp-measurement.mjs の同値テストで機械検証している。
   */
  var OPERATOR_REJECT = [
    "REPLACE_ME", "TBD", "TODO", "todo",
    "未定", "未確定", "未記入", "不明", "調整中", "確認中", "検討中",
    // 43回目に配信物の禁止語にした語は、値側でも止める（独立レビュー44回目 HIGH）
    "準備中", "docs/",
    "記載",
    "example.com", "example.jp", "example.co.jp", "test@", "sample",
    "ダミー", "dummy", "xxx", "XXX", "〇〇", "○○", "△△", "――",
  ];

  /** 値そのものが実質空とみなせるもの（完全一致）。 */
  var OPERATOR_REJECT_EXACT = ["-", "‐", "—", "ー", "―", "n/a", "N/A", "なし", "・"];

  /** 免許・登録が不要だと確認済みであることを明示する宣言（line/operator-rules.mjs と同一） */
  var NO_LICENSE_TOKEN = "NOT_REQUIRED_CONFIRMED";
  /** 宣言トークンを使ってよい項目。これ以外で書かれたら実値として扱わない */
  var NO_LICENSE_ALLOWED_FIELDS = ["LICENSE_NUMBER", "LICENSE_AUTHORITY"];

  var DUMMY_PHONE_DIGITS = [
    "0120000000", "0000000000", "00000000000",
    "0300000000", "1234567890", "09012345678",
  ];

  /**
   * 文字数を **コードポイント単位** で数える。
   * rules 側は [...v].length を使うため、v.length（UTF-16 単位）だと
   * サロゲートペア（"𠮷" 等）で判定がずれ、片方だけ緩い非対称になる。
   */
  function cpLength(v) {
    var n = 0;
    for (var i = 0; i < v.length; i++) {
      var c = v.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff && i + 1 < v.length) i++;
      n++;
    }
    return n;
  }

  /** 項目ごとの形式検証。null なら合格。 */
  var OPERATOR_FORMAT = {
    EMAIL: function (v) {
      return /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/.test(v) ? null : "email";
    },
    PHONE: function (v) {
      var d = v.replace(/\D/g, "");
      if (d.length < 10) return "phone_short";
      for (var i = 0; i < DUMMY_PHONE_DIGITS.length; i++) {
        if (DUMMY_PHONE_DIGITS[i] === d) return "phone_dummy";
      }
      if (/^(\d)\1+$/.test(d)) return "phone_repeat";
      return null;
    },
    ADDRESS: function (v) {
      if (!/[都道府県]/.test(v)) return "address_no_pref";
      if (cpLength(v) < 8) return "address_short";
      return null;
    },
    LICENSE_NUMBER: function (v) {
      // ⚠️ **正本（line/operator-rules.mjs の FORMAT.LICENSE_NUMBER）と同じ規則にする。**
      //    49回目に正本だけを厳格化し、**同じラウンドでこのファイルも触っていたのに
      //    規則の写経だけ更新漏れ**していた（独立レビュー50回目 HIGH）。
      //    そのため「千葉県知事 12448」という番号の断片が、
      //    ゲートでは止まるのに**描画経路では今も出る**状態だった。
      return v === NO_LICENSE_TOKEN
        || (/第\s*[0-9０-９A-Za-zＡ-Ｚａ-ｚ\-－ー,，]+\s*[号號]/.test(v) && /[0-9０-９]/.test(v))
        ? null : "license_no_digit";
    },
    LICENSE_AUTHORITY: function (v) {
      return v === NO_LICENSE_TOKEN || /(知事|大臣|国土交通|財務局|財務(支)?局長|長官)/.test(v)
        ? null : "license_authority";
    },
    REPRESENTATIVE: function (v) { return cpLength(v) >= 2 ? null : "short"; },
    ADVERTISER_NAME: function (v) { return cpLength(v) >= 2 ? null : "short"; },
    PROVIDER_NAME: function (v) { return cpLength(v) >= 2 ? null : "short"; },
    // 広告主側は役務提供者側と同じ規則。正本は line/operator-rules.mjs
    ADVERTISER_ADDRESS: function (v) { return OPERATOR_FORMAT.ADDRESS(v); },
    ADVERTISER_PHONE: function (v) { return OPERATOR_FORMAT.PHONE(v); },
    ADVERTISER_EMAIL: function (v) { return OPERATOR_FORMAT.EMAIL(v); },
    BUSINESS_HOURS: function (v) { return cpLength(v) >= 4 ? null : "hours_short"; },
  };

  function operatorValue(key) {
    var op = config.OPERATOR;
    if (!op || typeof op !== "object") return null;
    // 継承値を実値として受理しない
    if (!Object.prototype.hasOwnProperty.call(op, key)) return null;
    var v = op[key];
    if (typeof v !== "string") return null;
    v = v.trim();
    if (!v) return null;
    // 宣言トークンは免許・登録の2項目専用。他項目で書かれたら実値にしない
    if (v === NO_LICENSE_TOKEN) {
      for (var t = 0; t < NO_LICENSE_ALLOWED_FIELDS.length; t++) {
        if (NO_LICENSE_ALLOWED_FIELDS[t] === key) return v;
      }
      return null;
    }
    for (var i = 0; i < OPERATOR_REJECT_EXACT.length; i++) {
      if (OPERATOR_REJECT_EXACT[i] === v) return null;
    }
    for (var j = 0; j < OPERATOR_REJECT.length; j++) {
      if (v.indexOf(OPERATOR_REJECT[j]) !== -1) return null;
    }
    var fmt = OPERATOR_FORMAT[key];
    if (fmt && fmt(v) !== null) return null;
    return v;
  }

  /**
   * 全項目が実値で埋まっているときだけ true。
   * **肯定形で判定する。** 「欠けていなければ true」と書くと、
   * OPERATOR ごと存在しない場合に素通りする（同種の穴を過去に作っている）。
   */
  function operatorComplete() {
    for (var i = 0; i < OPERATOR_FIELDS.length; i++) {
      if (operatorValue(OPERATOR_FIELDS[i]) === null) return false;
    }
    return true;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function operatorRow(label, value) {
    return "<dt>" + escapeHtml(label) + "</dt><dd>" + escapeHtml(value) + "</dd>";
  }

  /**
   * 必須開示を出せない状態であることを、**見える形と機械が読める形の両方**で残す。
   * body クラスだけだと誰も読まない死んだ信号になる（実際にそう指摘された）。
   */
  function markEntityMissing(reason) {
    // ⚠️ この関数は catch の中からも呼ばれる。ここで例外を投げると boot が止まり、
    //    仮表示が残ったまま計測も全滅する。**何があっても投げない。**
    try {
      document.body.classList.add("is-entity-missing");
      document.body.setAttribute("data-entity-missing", reason);
    } catch (e) {
      /* body に触れない環境。次の console.error だけでも残す */
    }
    try {
      if (console && console.error) {
        console.error(
          "[LP] " + reason + "。この状態で公開すると必須開示（F-6）を満たしません。" +
            " docs/operator-information-intake.md を参照"
        );
      }
    } catch (e2) {
      /* 何もできない */
    }
  }

  /**
   * ENTITY_MODE="production" のときの運営者情報の扱い。
   *
   * 従来は pending 枠を DOM から除去するだけだった。
   * しかしそれでは **確定した運営者情報を表示する経路が存在せず**、
   * 値が揃っても F-6（事業の物理的住所の開示）を満たせない。
   *
   * したがって production では次の2択にする。
   *   OPERATOR が完全   → 実値を描画し data-entity-status="confirmed" にする
   *   OPERATOR が不完全 → 枠を除去し（未確認値は絶対に表示しない）、
   *                       is-entity-missing を立てて公開前チェックが検出できるようにする
   *
   * dev では従来どおり applyGate 側で黄色枠を出す。ここでは何もしない。
   */
  /**
   * 前後の空白・大文字小文字だけ吸収する。
   * "Production" を production 扱いにするのは「未確認値を隠す」方向であり安全側。
   * それ以外の値（"prod" 等）は production とみなさない。
   */
  function isProductionMode(mode) {
    return typeof mode === "string" && mode.trim().toLowerCase() === "production";
  }

  /**
   * 免許・登録の行を作る。
   *
   * ⚠️ **宣言トークンをそのまま読者に見せない。** `NOT_REQUIRED_CONFIRMED` は
   *    「宅建業免許は不要と人間が確認した」ことを表す内部トークンであり、
   *    そのまま連結していたため、法定開示に
   *    `免許・登録  NOT_REQUIRED_CONFIRMED NOT_REQUIRED_CONFIRMED` と出る経路があった
   *    （独立レビュー45回目 LOW）。日本語へ写像してから描く。
   */
  //    ⚠️ **判定は line/operator-rules.mjs の licenseLine() が正本。**
  //       ここはブラウザ用の写経であり、同値であることを
  //       tests/verify-lp-measurement.mjs が機械検証する。
  //       45回目の初版は **OR** で書いており、片方だけトークンの矛盾入力で
  //       「該当ありません（免許を要しない業務）」という**虚偽の法定開示**を出した
  //       （独立レビュー46回目 MEDIUM）。両方トークンのときだけ、が正しい。
  function licenseLine() {
    var a = operatorValue("LICENSE_AUTHORITY");
    var n = operatorValue("LICENSE_NUMBER");
    a = typeof a === "string" ? a.trim() : "";
    n = typeof n === "string" ? n.trim() : "";
    // ⚠️ **理由を握り潰さない。** 戻り値を文字列|null にしていたため、
    //    描けなかった理由が呼び出し側で分からず、
    //    `markEntityMissing()` が「片方だけ NOT_REQUIRED_CONFIRMED」という
    //    **存在しない原因**を固定文で表示していた（独立レビュー48回目 LOW）。
    //    赤帯が出ている＝広告が動いている状態なので、誤診断は復旧を遅らせる。
    if (a === "" || n === "") {
      return { ok: false, text: null, reason: "免許行政庁または免許番号が空です" };
    }
    var aTok = a === NO_LICENSE_TOKEN;
    var nTok = n === NO_LICENSE_TOKEN;
    if (aTok && nTok) {
      return { ok: true, text: "該当ありません（宅地建物取引業の免許を要しない業務）", reason: null };
    }
    if (aTok !== nTok) {
      return {
        ok: false, text: null,
        reason: "免許番号と免許行政庁の片方だけが「" + NO_LICENSE_TOKEN + "」です"
          + "（免許が要るのか要らないのかが定まりません）",
      };
    }
    // 免許番号は行政庁名を含むのが通例。連結すると二重に出る（包含は双方向に見る）
    var strip = function (v) { return v.replace(/[\s　]/g, "").replace(/(免許|許可|登録)$/, ""); };
    var an = strip(a);
    var nn = strip(n);
    if (nn.indexOf(an) !== -1 || an.indexOf(nn) !== -1) {
      return { ok: true, text: n.length >= a.length ? n : a, reason: null };
    }
    // 制度上の委任関係（内閣総理大臣 / 金融庁長官 → 財務局長名義）は不一致ではない。
    // 判定は「番号が財務局長名義で**始まる**」ことに限り、描画は番号単独（51回目 MEDIUM/LOW）
    if (/^(内閣総理大臣|金融庁長官)$/.test(a) && /^(関東|近畿|東海|北陸|中国|四国|九州|東北|北海道|福岡)財務(支)?局長|^沖縄総合事務局長/.test(n)) {
      return { ok: true, text: n, reason: null };
    }
    // 番号が「別の行政庁」を名乗っているなら描かない（47回目 MEDIUM）
    // 委任側で認める語とガードの語を揃える（53回目 MEDIUM）
    var other = /(知事|大臣|財務(支)?局長|総合事務局長|長官)/.exec(n);
    if (other) {
      return {
        ok: false, text: null,
        reason: "免許番号が名乗る行政庁（" + other[1] + "）と LICENSE_AUTHORITY「" + a + "」が一致しません",
      };
    }
    return { ok: true, text: a + " " + n, reason: null };
  }

  function applyOperatorDisclosure(mode) {
    if (!isProductionMode(mode)) return false;

    // ⚠️ data-entity-status="pending" は複数ある（枠・コピーライト）。
    //    DOM 順に依存しないよう、描画先は専用属性で一意に特定する。
    var slot = document.querySelector('[data-entity-slot="operator"]');
    if (!slot) {
      // 枠ごと消えている＝必須開示を出す先が無い。無反応にせず必ず検出可能にする。
      markEntityMissing("運営者情報の描画先（data-entity-slot=\"operator\"）が見つかりません");
      return false;
    }

    if (!operatorComplete()) {
      markEntityMissing("運営者情報が未確定です");
      return false;
    }

    // ⚠️ 免許の記載が定まらないなら**何も描かない**（fail-closed）。
    //    ここで描いてしまうと「免許を要しない業務」という虚偽の法定開示になる。
    var license = licenseLine();
    if (!license.ok) {
      markEntityMissing("免許・登録の記載が定まりません: " + license.reason);
      return false;
    }

    // ⚠️ status を先に confirmed にすると、innerHTML 代入が例外を投げたときに
    //    「confirmed だが中身は仮表示のまま」になり、直後の applyGate も除去できない。
    //    **描画に成功してから状態を進める。**
    var html =
      "<p class=\"entity-confirmed__label\">運営者情報</p><dl>" +
      operatorRow("広告主", operatorValue("ADVERTISER_NAME")) +
      operatorRow("広告主 所在地", operatorValue("ADVERTISER_ADDRESS")) +
      operatorRow("広告主 電話", operatorValue("ADVERTISER_PHONE")) +
      operatorRow("広告主 メール", operatorValue("ADVERTISER_EMAIL")) +
      operatorRow("受付時間", operatorValue("BUSINESS_HOURS")) +
      operatorRow("役務提供者", operatorValue("PROVIDER_NAME")) +
      operatorRow("代表者", operatorValue("REPRESENTATIVE")) +
      operatorRow("所在地", operatorValue("ADDRESS")) +
      operatorRow("免許・登録", license.text) +
      operatorRow("電話", operatorValue("PHONE")) +
      operatorRow("メール", operatorValue("EMAIL")) +
      "</dl>";
    slot.innerHTML = html;
    slot.setAttribute("data-entity-status", "confirmed");
    slot.setAttribute("class", "entity-confirmed");

    // 著作権表示。確定した広告主名で描き直す。
    // ここを描かないと production で行ごと除去され、フッターから著作権表示が消える。
    var copy = document.querySelector('[data-entity-slot="copyright"]');
    if (copy) {
      copy.innerHTML =
        "&copy; " + new Date().getFullYear() + " " +
        escapeHtml(operatorValue("ADVERTISER_NAME"));
      copy.setAttribute("data-entity-status", "confirmed");
    }
    return true;
  }

  // ---------- sticky CTA ----------

  function applyStickyFlag() {
    var sticky = document.querySelector("[data-sticky-cta]");
    if (!sticky) return;
    if (!config.FEATURES || !config.FEATURES.STICKY_CTA) {
      sticky.parentNode.removeChild(sticky);
    }
  }

  // ---------- boot ----------

  document.addEventListener("DOMContentLoaded", function () {
    loadGA4();
    applyGate("data-claim-status", config.CLAIMS_MODE);
    // 先に実値の描画を試みる。成功した枠は status が "confirmed" になるため、
    // 直後の applyGate では pending にマッチせず除去されない。
    // 失敗した場合は pending のまま残り、applyGate が除去する（fail-closed）。
    //
    // ⚠️ ここで例外を投げると以降の applyGate / CTA計測 / lp_view がすべて止まり、
    //    **未確認の枠が本番に残ったまま計測も全滅する**。必ず握って先へ進める。
    try {
      applyOperatorDisclosure(config.ENTITY_MODE);
    } catch (e) {
      markEntityMissing("運営者情報の描画中に例外が発生しました");
    }
    applyGate("data-entity-status", config.ENTITY_MODE);
    applyStickyFlag();
    bindCtaTracking();
    bindCtaImpressions();
    bindFaqTracking();
    bindLegalTracking();
    bindScrollDepth();
    track("lp_view");
  });

  // テスト・デバッグ用に最小限だけ公開する
  global.LP_TRACKING = {
    track: track,
    attribution: attribution,
    buildLineHref: buildLineHref,
  };
})(window);
