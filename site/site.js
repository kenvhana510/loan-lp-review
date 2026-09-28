/**
 * restartlife.jp — サイト共通スクリプト（サービス／コラム／FAQ／運営者情報）
 *
 * 役割は 2 つだけ:
 *   1. LINE CTA のクリックで Google 広告の conversion を送ってから LINE へ遷移する
 *      （lp/numbered の Event snippet と同じ挙動。ページ表示では送らない）
 *   2. 画面下の追従 CTA を、少しスクロールしてから表示する
 *
 * conversion の送信先（send_to）はページ側が window.SITE_ADS に焼き込む
 * （正本は lp/omatome/config.js の GOOGLE_ADS。scripts/build-site.mjs が埋める）。
 * SITE_ADS が無い／gtag が読めない環境では計測せず、LINE への遷移だけを行う。
 */
(function () {
  "use strict";

  var ads = window.SITE_ADS || null;
  var SEND_TO = ads && ads.sendTo ? String(ads.sendTo) : "";
  var FALLBACK_MS = 2000;

  function isLineHref(href) {
    return /^https:\/\/(lin\.ee|line\.me)\//.test(href || "");
  }

  // 1 回のページ滞在で conversion は最初のクリック 1 回だけ
  var state = "idle";

  function reportAndGo(url) {
    var navigated = false;
    var go = function () {
      state = "done";
      if (!navigated) { navigated = true; window.location = url; }
    };
    var timer = setTimeout(go, FALLBACK_MS + 500);
    window.gtag("event", "conversion", {
      send_to: SEND_TO,
      event_callback: function () { clearTimeout(timer); go(); },
      event_timeout: FALLBACK_MS
    });
  }

  function onCtaClick(ev) {
    var a = ev.currentTarget;
    var url = a.getAttribute("href");
    if (!isLineHref(url)) return;
    if (!SEND_TO || typeof window.gtag !== "function") return; // 計測なし。既定の遷移に任せる

    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || ev.button !== 0) {
      if (state === "idle") { state = "done"; window.gtag("event", "conversion", { send_to: SEND_TO }); }
      return;
    }
    ev.preventDefault();
    if (state === "pending") return;
    if (state === "done") { window.location = url; return; }
    state = "pending";
    reportAndGo(url);
  }

  var ctas = document.querySelectorAll('a.line-cta[data-cta-type="line"]');
  for (var i = 0; i < ctas.length; i++) {
    if (ctas[i].getAttribute("data-ads-conversion") === "bound") continue;
    ctas[i].setAttribute("data-ads-conversion", "bound");
    ctas[i].addEventListener("click", onCtaClick);
  }

  // 追従 CTA: ヒーローを過ぎたら表示
  var sticky = document.querySelector(".sticky-cta");
  if (sticky) {
    var shown = false;
    var onScroll = function () {
      var y = window.scrollY || document.documentElement.scrollTop || 0;
      var next = y > 420;
      if (next !== shown) {
        shown = next;
        if (shown) sticky.classList.add("is-visible");
        else sticky.classList.remove("is-visible");
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }
})();
