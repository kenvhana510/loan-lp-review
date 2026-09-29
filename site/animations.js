/**
 * restartlife.jp トップページ — スクロール演出（2026-09-29 人間指示「スマホ向け高品質アニメーション実装指示書」）
 *
 * 方針:
 *   ・GSAP + ScrollTrigger（site/gsap.min.js / site/ScrollTrigger.min.js を同梱。CDN には依存しない）
 *   ・transform / opacity / clip-path だけを動かす（layout を動かさない → CLS 0）
 *   ・CSS 側で何も隠さない。初期状態は JS が付ける（JS が無い／読めない環境ではそのまま全部見える）
 *   ・prefers-reduced-motion: reduce では演出を行わない（FAQ の開閉だけ短いフェード）
 *   ・文章・CTA・計測（site.js）には触らない。CTA はロード直後から押せる
 */
(function () {
  "use strict";
  if (!window.gsap || !window.ScrollTrigger) return;          // ライブラリが無ければ何もしない（全部見える）
  if (!document.querySelector(".lph")) return;                 // トップページ以外では動かさない
  var gsap = window.gsap;
  var ScrollTrigger = window.ScrollTrigger;
  gsap.registerPlugin(ScrollTrigger);
  window.__animInit = true;
  // 本文先頭が付けた仮の透明状態（html.anim-pre）を引き継ぐ。GSAP が from() で自前の初期状態を付けるので class は外す
  gsap.set(".lph-hero__top, .lph-circles li", { opacity: 1 });
  document.documentElement.classList.remove("anim-pre");

  /* ---------- design tokens ---------- */
  var D = { fast: 0.5, base: 0.8, slow: 1.4, hero: 1.8 };
  var EASE = "power3.out";
  var EASE_SOFT = "power2.out";
  var START = "top 85%";        // 画面下から 15% の位置で発火
  var START_MID = "top 65%";

  function q(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function mark(el) { el.setAttribute("data-anim", "1"); return el; }
  function isMarked(el) { return el.getAttribute("data-anim") === "1"; }

  /* ---------- 共通 Reveal ---------- */
  function reveal(targets, opts) {
    opts = opts || {};
    var list = Array.isArray(targets) ? targets : [targets];
    list = list.filter(function (el) { return el && !isMarked(el); });
    if (!list.length) return;
    list.forEach(mark);
    return gsap.from(list, {
      opacity: 0,
      y: opts.y != null ? opts.y : 28,
      duration: opts.duration || D.base,
      ease: opts.ease || EASE,
      stagger: opts.stagger || 0,
      delay: opts.delay || 0,
      clearProps: "transform",
      scrollTrigger: { trigger: opts.trigger || list[0], start: opts.start || START, once: true }
    });
  }

  /* ---------- 画像 mask reveal（象徴的な演出） ---------- */
  function maskWrap(img) {
    if (img.parentNode && img.parentNode.classList.contains("lph-mask")) return img.parentNode;
    var w = document.createElement("div");
    w.className = "lph-mask";
    var cs = window.getComputedStyle(img);
    if (cs.borderRadius && cs.borderRadius !== "0px") w.style.borderRadius = cs.borderRadius;
    if (cs.marginTop && cs.marginTop !== "0px") { w.style.marginTop = cs.marginTop; img.style.marginTop = "0"; }
    img.parentNode.insertBefore(w, img);
    w.appendChild(img);
    return w;
  }
  function maskReveal(wrapper, img, opts) {
    opts = opts || {};
    if (isMarked(wrapper)) return;
    mark(wrapper);
    var tl = gsap.timeline({ scrollTrigger: { trigger: wrapper, start: opts.start || START, once: true } });
    tl.fromTo(wrapper, { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: opts.duration || 1.1, ease: "power3.inOut" }, 0)
      .fromTo(img, { scale: 1.06 }, { scale: 1, duration: (opts.duration || 1.1) + 0.5, ease: EASE_SOFT, clearProps: "transform" }, 0);
    return tl;
  }

  /* ---------- 見出しの共通ルール: 小見出し → 見出し → 本文 ---------- */
  function sectionTitles(root) {
    q(".lph-section", root).forEach(function (sec) {
      var wrap = sec.querySelector(".wrap") || sec;
      var label = wrap.querySelector(":scope > .lph-label");
      var h2 = wrap.querySelector(":scope > .lph-h2");
      var body = wrap.querySelector(":scope > .lph-body");
      var items = [label, h2, body].filter(Boolean);
      if (!items.length) return;
      reveal(items, { trigger: items[0], stagger: 0.12, y: 24 });
    });
  }

  /* ---------- スクロール進捗バー（2px） ---------- */
  function progressBar() {
    var bar = document.createElement("div");
    bar.className = "lph-progress";
    bar.setAttribute("aria-hidden", "true");
    document.body.appendChild(bar);
    gsap.set(bar, { scaleX: 0, transformOrigin: "0 50%" });
    gsap.to(bar, { scaleX: 1, ease: "none", scrollTrigger: { trigger: document.documentElement, start: "top top", end: "bottom bottom", scrub: 0.3 } });
  }

  /* ---------- 追従 CTA: 最終 CTA の付近では隠す（法的文章・ボタンを隠さない） ---------- */
  function stickyNearEnd() {
    var sticky = document.querySelector(".sticky-cta");
    var last = document.querySelector(".lph-cta-final");
    if (!sticky || !last) return;
    ScrollTrigger.create({
      trigger: last, start: "top 80%", end: "bottom top",
      onEnter: function () { sticky.classList.add("is-hidden"); },
      onLeaveBack: function () { sticky.classList.remove("is-hidden"); }
    });
  }

  /* ---------- FAQ: 開閉だけ滑らかに（構造は <details> のまま） ---------- */
  function faq(reduced) {
    q(".faq details").forEach(function (d) {
      var s = d.querySelector("summary");
      var a = d.querySelector(".faq__a");
      if (!s || !a) return;
      s.addEventListener("click", function (ev) {
        ev.preventDefault();
        if (gsap.isTweening(a)) return;
        if (!d.open) {
          d.open = true;
          if (reduced) { gsap.fromTo(a, { opacity: 0 }, { opacity: 1, duration: 0.2 }); return; }
          gsap.fromTo(a, { height: 0, opacity: 0, overflow: "hidden" }, { height: "auto", opacity: 1, duration: 0.38, ease: EASE_SOFT, clearProps: "height,overflow" });
        } else {
          if (reduced) { d.open = false; return; }
          gsap.to(a, { height: 0, opacity: 0, overflow: "hidden", duration: 0.3, ease: "power2.in",
            onComplete: function () { d.open = false; gsap.set(a, { clearProps: "all" }); } });
        }
      });
    });
  }

  /* ================= 各セクション ================= */

  function initHero(mobile) {
    var hero = document.querySelector(".lph-hero");
    if (!hero) return;
    var img = hero.querySelector(".lph-hero__img");
    var chip = hero.querySelector(".lph-chip");
    var t1 = hero.querySelector(".lph-hero__t1");
    var t2 = hero.querySelector(".lph-hero__t2");
    var t3 = hero.querySelector(".lph-hero__t3");
    var circles = q(".lph-circles li", hero);

    // Sequence 1〜4（ロード直後。CTA は別要素で常に押せる）
    var tl = gsap.timeline({ defaults: { ease: EASE } });
    if (img) tl.fromTo(img, { scale: 1.08 }, { scale: 1.04, duration: D.hero, ease: EASE_SOFT }, 0);
    if (chip) tl.from(chip, { opacity: 0, y: 14, duration: D.base }, 0.15);
    if (t1) tl.from(t1, { opacity: 0, y: 18, filter: "blur(3px)", duration: D.base, clearProps: "filter" }, 0.35);
    if (t2) tl.from(t2, { opacity: 0, y: 22, filter: "blur(3px)", duration: D.base + 0.2, clearProps: "filter" }, 0.5);
    if (t3) tl.from(t3, { opacity: 0, y: 16, filter: "blur(3px)", duration: D.base, clearProps: "filter" }, 0.7);
    if (circles.length) tl.from(circles, { opacity: 0, y: 16, scale: 0.94, duration: D.base, stagger: 0.12, clearProps: "transform" }, 0.95);

    // FV 背景だけの疑似パララックス（スマホは小さく）。scale 1.04 の余白の範囲で動かす
    if (img) {
      gsap.to(img, { y: mobile ? -20 : -40, ease: "none",
        scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: 0.4 } });
    }

    // スクロール誘導（細い縦線の中を光が流れる）。スクロール開始でフェードアウト
    var ind = document.createElement("div");
    ind.className = "lph-scrollhint";
    ind.setAttribute("aria-hidden", "true");
    ind.innerHTML = '<span class="lph-scrollhint__line"><i></i></span>';
    hero.appendChild(ind);
    tl.from(ind, { opacity: 0, duration: D.base }, 1.3);
    ScrollTrigger.create({ start: 40, onEnter: function () { gsap.to(ind, { opacity: 0, duration: 0.4, overwrite: true }); },
      onLeaveBack: function () { gsap.to(ind, { opacity: 1, duration: 0.4, overwrite: true }); } });
  }

  function initBand() {
    var band = document.querySelector(".lph-band");
    if (!band) return;
    var pills = q(".lph-band__pills span, .lph-band__pills i", band);
    var lead = band.querySelector(".lph-band__lead");
    var badges = band.querySelector(".lph-badges");
    var tl = gsap.timeline({ scrollTrigger: { trigger: band, start: "top 80%", once: true } });
    if (pills.length) tl.from(pills, { opacity: 0, y: 14, duration: D.fast, ease: EASE, stagger: 0.08, clearProps: "transform" }, 0);
    if (lead) tl.from(lead, { opacity: 0, y: 18, duration: D.base, ease: EASE, clearProps: "transform" }, 0.25);
    if (badges) tl.from(badges, { opacity: 0, y: 16, duration: D.base, ease: EASE, clearProps: "transform" }, 0.45);
    [lead, badges].concat(pills).forEach(function (el) { if (el) mark(el); });
  }

  // 相談バナー（各セクションの合間）と写真バナー CTA: 入ったときだけ軽く
  function initCTABanners() {
    q(".lph-consult, .lph-ctamid").forEach(function (sec) {
      var text = sec.querySelector(".lph-consult__text, .lph-ctamid__text");
      var head = sec.querySelector(".lph-consult__head");
      var btn = sec.querySelector(".line-cta");
      var tl = gsap.timeline({ scrollTrigger: { trigger: sec, start: "top 78%", once: true } });
      if (text) tl.from(text, { opacity: 0, y: 22, duration: D.base, ease: EASE, clearProps: "transform" }, 0);
      if (head) tl.from(head, { opacity: 0, y: 16, duration: D.base, ease: EASE, clearProps: "transform" }, 0.15);
      if (btn) tl.from(btn, { opacity: 0, y: 12, scale: 0.98, duration: D.base, ease: EASE, clearProps: "transform" }, 0.3);
      [text, head, btn].forEach(function (el) { if (el) mark(el); });
      var bg = sec.querySelector(".lph-consult__bg, .lph-ctamid__img");
      if (bg) gsap.fromTo(bg, { scale: 1.06 }, { scale: 1, ease: "none", scrollTrigger: { trigger: sec, start: "top bottom", end: "bottom top", scrub: 0.6 } });
    });
  }

  // 「こんなことで困っていませんか？」: 下から順番に。最後に人物画像
  function initProblem() {
    q(".lph-check").forEach(function (ul) {
      reveal(q("li", ul), { trigger: ul, stagger: 0.09, y: 24 });
    });
  }

  // 写真（.lph-figure / .lph-illust / .lph-choice / .lph-reason__photo）: mask reveal
  function initImageReveals() {
    q(".lph-figure").forEach(function (fig) {
      var img = fig.querySelector(".lph-figure__img");
      var cap = fig.querySelector(".lph-figure__cap");
      if (img) maskReveal(fig, img, { start: "top 80%" });
      if (cap) reveal(cap, { trigger: fig, y: 14, delay: 0.5, start: "top 80%" });
    });
    q(".lph-illust, .lph-choice, .lph-reason__photo, .lph-case__avatar").forEach(function (img) {
      if (img.classList.contains("lph-case__avatar")) return;
      var w = maskWrap(img);
      maskReveal(w, img);
    });
  }

  // 「住宅ローンを活用してできること」01/02/03
  function initSolution() {
    q(".lph-num li").forEach(function (li, i) {
      var n = li.querySelector(".lph-num__i");
      var body = li.querySelector("div");
      mark(li);
      var tl = gsap.timeline({ scrollTrigger: { trigger: li, start: START, once: true } });
      tl.from(li, { opacity: 0, y: 30, duration: D.base, ease: EASE, clearProps: "transform" }, 0);
      if (n) tl.fromTo(n, { opacity: 0.15, scale: 1.12 }, { opacity: 1, scale: 1, duration: D.base, ease: EASE, clearProps: "transform" }, 0.15);
      if (body) tl.from(body, { opacity: 0, duration: D.base, ease: EASE_SOFT }, 0.25);
    });
    q(".note").forEach(function (n) { reveal(n, { y: 16 }); });
  }

  // 「ご相談のあとに変わること」: Before → After を少し強めに。画面外に出ても消さない
  function initBenefits(mobile) {
    q(".lph-benefits").forEach(function (grid) {
      var cards = q(".lph-benefit", grid);
      cards.forEach(mark);
      if (mobile) {
        cards.forEach(function (c) {
          gsap.fromTo(c, { opacity: 0.4, scale: 0.97 }, { opacity: 1, scale: 1, duration: D.base, ease: EASE, clearProps: "transform",
            scrollTrigger: { trigger: c, start: "top 62%", once: true } });
        });
      } else {
        gsap.fromTo(cards, { opacity: 0.4, scale: 0.97 }, { opacity: 1, scale: 1, duration: D.base, ease: EASE, stagger: 0.12, clearProps: "transform",
          scrollTrigger: { trigger: grid, start: START_MID, once: true } });
      }
    });
    q(".lph-fine").forEach(function (f) { if (!isMarked(f)) { mark(f); gsap.from(f, { opacity: 0, duration: D.base, scrollTrigger: { trigger: f, start: "top 92%", once: true } }); } });
  }

  // 「こんな方のための窓口です」01〜06: 連続表示 ＋ 薄い縦ラインがスクロールで伸びる
  function initTarget() {
    q(".lph-target").forEach(function (ul) {
      ul.classList.add("lph-line");
      gsap.fromTo(ul, { "--line": 0 }, { "--line": 1, ease: "none", scrollTrigger: { trigger: ul, start: "top 70%", end: "bottom 60%", scrub: 0.5 } });
      reveal(q("li", ul), { trigger: ul, stagger: 0.08, y: 20, start: "top 80%" });
    });
  }

  // 運営者紹介: 信頼のセクション。写真は円形 reveal、氏名は fade + y、本文はブロック単位
  function initProfile() {
    var img = document.querySelector(".lph-profile__img");
    var body = document.querySelector(".lph-profile__body");
    var text = document.querySelector(".lph-profile__text");
    if (img) {
      mark(img);
      gsap.fromTo(img, { clipPath: "circle(0% at 50% 50%)", scale: 1.08 }, { clipPath: "circle(50% at 50% 50%)", scale: 1, duration: 1.1, ease: "power3.inOut", clearProps: "transform",
        scrollTrigger: { trigger: img, start: START, once: true } });
    }
    if (body) reveal(q(":scope > *", body), { trigger: body, stagger: 0.1, y: 14, delay: 0.2 });
    if (text) reveal(text, { y: 20 });
  }

  // 「この窓口の姿勢」: 背景にごく弱い parallax。見出しは静かに浮かぶ
  function initMessage(mobile) {
    var sec = document.querySelector(".lph-message");
    if (!sec) return;
    var bg = sec.querySelector(".lph-message__bg");
    if (bg) gsap.fromTo(bg, { y: mobile ? 14 : 30 }, { y: mobile ? -14 : -30, ease: "none", scrollTrigger: { trigger: sec, start: "top bottom", end: "bottom top", scrub: 0.6 } });
    var h2 = sec.querySelector(".lph-h2");
    if (h2 && !isMarked(h2)) { mark(h2); gsap.from(h2, { opacity: 0, y: 12, duration: D.slow, ease: EASE_SOFT, clearProps: "transform", scrollTrigger: { trigger: h2, start: START, once: true } }); }
    var quote = sec.querySelector(".lph-quote");
    if (quote) reveal(quote, { y: 22 });
  }

  // ご相談の想定例: カード 1 → カード 2 と下から
  function initCases() {
    q(".lph-case").forEach(function (c) { reveal(c, { y: 32 }); });
  }

  // 特徴 1〜4: 非常に弱い rotateX で少しだけ立体感
  function initReasons() {
    q(".lph-reasons").forEach(function (grid) {
      var cards = q(".lph-reason", grid);
      cards.forEach(mark);
      gsap.from(cards, { opacity: 0, y: 30, rotateX: 3, transformPerspective: 900, transformOrigin: "50% 100%", duration: D.base, ease: EASE, stagger: 0.12, clearProps: "transform",
        scrollTrigger: { trigger: grid, start: START, once: true } });
    });
  }

  // サービスの流れ STEP 1〜4: 縦のタイムライン。ラインがスクロールで伸び、到達した STEP から番号 → タイトル → 本文
  function initTimeline() {
    q(".lph-flow").forEach(function (ol) {
      ol.classList.add("lph-line");
      gsap.fromTo(ol, { "--line": 0 }, { "--line": 1, ease: "none", scrollTrigger: { trigger: ol, start: "top 68%", end: "bottom 62%", scrub: 0.5 } });
      q("li", ol).forEach(function (li) {
        mark(li);
        var tl = gsap.timeline({ scrollTrigger: { trigger: li, start: "top 74%", once: true } });
        tl.from(li, { opacity: 0, y: 24, duration: D.base, ease: EASE, clearProps: "transform" }, 0);
        var b = li.querySelector("b"), h = li.querySelector("h3"), p = li.querySelector("p");
        if (b) tl.from(b, { opacity: 0, x: -8, duration: D.fast, ease: EASE, clearProps: "transform" }, 0.1);
        if (h) tl.from(h, { opacity: 0, y: 10, duration: D.fast, ease: EASE, clearProps: "transform" }, 0.22);
        if (p) tl.from(p, { opacity: 0, duration: D.base, ease: EASE_SOFT }, 0.34);
      });
    });
  }

  // 無料でできること / 費用 / FAQ / 関連リンク: 弱め
  function initMinor() {
    q(".lph-gifts").forEach(function (ul) { reveal(q("li", ul), { trigger: ul, stagger: 0.08, y: 20 }); });
    q(".lph-price").forEach(function (p) { reveal(p, { y: 20 }); });
    q(".faq").forEach(function (f) { if (!isMarked(f)) { mark(f); gsap.from(f, { opacity: 0, y: 14, duration: D.base, ease: EASE_SOFT, clearProps: "transform", scrollTrigger: { trigger: f, start: "top 88%", once: true } }); } });
    q(".lph-more, .related").forEach(function (el) { reveal(el, { y: 12, start: "top 92%" }); });
    q(".lph-story").forEach(function (s) { reveal(s, { y: 22 }); });
    q(".lph-illust--dark").forEach(function () {});
  }

  // 最終 CTA: クライマックス。行ごとに 0.12 秒差 → 補足 → LINE ボタン。背景はごくゆっくり
  function initFinalCTA() {
    var sec = document.querySelector(".lph-cta-final");
    if (!sec) return;
    var bg = sec.querySelector(".lph-cta-final__bg");
    if (bg) gsap.fromTo(bg, { scale: 1.08 }, { scale: 1, ease: "none", scrollTrigger: { trigger: sec, start: "top bottom", end: "bottom top", scrub: 0.8 } });
    var box = sec.querySelector(".lph-ctabox");
    if (!box) return;
    var t1 = box.querySelector(".lph-ctabox__t1");
    var t2 = box.querySelector(".lph-ctabox__t2");
    var sub = box.querySelector(".lph-ctabox__sub");
    var btn = box.querySelector(".line-cta");
    // 行単位（<br> 区切り）で span に分ける。文章は変えない
    var lines = [];
    if (t2) {
      var parts = t2.innerHTML.split(/<br\s*\/?>/i);
      t2.innerHTML = parts.map(function (s) { return '<span class="lph-line-in">' + s + "</span>"; }).join("<br>");
      lines = q(".lph-line-in", t2);
    }
    mark(box);
    var tl = gsap.timeline({ scrollTrigger: { trigger: box, start: "top 78%", once: true } });
    tl.from(box, { opacity: 0, y: 24, duration: D.base, ease: EASE, clearProps: "transform" }, 0);
    if (t1) tl.from(t1, { opacity: 0, y: 12, duration: D.base, ease: EASE, clearProps: "transform" }, 0.15);
    if (lines.length) tl.from(lines, { opacity: 0, y: 14, duration: D.base, ease: EASE, stagger: 0.13, clearProps: "transform" }, 0.3);
    if (sub) tl.from(sub, { opacity: 0, y: 10, duration: D.base, ease: EASE, clearProps: "transform" }, 0.65);
    if (btn) tl.from(btn, { opacity: 0, y: 12, scale: 0.98, duration: D.base, ease: EASE, clearProps: "transform" }, 0.8);
  }

  /* ================= 起動 ================= */
  var mm = gsap.matchMedia();
  mm.add({ mobile: "(max-width: 767px)", desktop: "(min-width: 768px)", reduce: "(prefers-reduced-motion: reduce)", noReduce: "(prefers-reduced-motion: no-preference)" }, function (ctx) {
    var c = ctx.conditions;
    if (c.reduce) { faq(true); return; }      // 減速指定: 演出なし（FAQ は短いフェードだけ）
    var mobile = !!c.mobile;
    progressBar();
    initHero(mobile);
    initBand();
    initCTABanners();
    sectionTitles(document);
    initProblem();
    initImageReveals();
    initSolution();
    initBenefits(mobile);
    initTarget();
    initProfile();
    initMessage(mobile);
    initCases();
    initReasons();
    initTimeline();
    initMinor();
    initFinalCTA();
    stickyNearEnd();
    faq(false);
    // 画像の遅延読み込みで高さが変わったら位置を取り直す
    q("img[loading=lazy]").forEach(function (img) { img.addEventListener("load", function () { ScrollTrigger.refresh(); }, { once: true }); });
    window.addEventListener("load", function () { ScrollTrigger.refresh(); });
  });
})();
