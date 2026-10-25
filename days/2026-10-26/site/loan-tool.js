/* 借入可能額・返済負担率シミュレーターの画面（/tools/kariire-kanougaku/）。計算は loan-calc.js（window.LoanCalc）。
   入力はブラウザの外へ送らない。 */
(function () {
  "use strict";
  var C = window.LoanCalc;
  var root = document.getElementById("lt");
  if (!C || !root) return;
  var out = document.getElementById("lt-result");
  var cta = document.getElementById("lt-cta");
  var $ = function (id) { return document.getElementById(id); };
  var fmt = function (n) { return Math.round(n).toLocaleString("ja-JP"); };
  var man = function (yen) { return fmt(yen / 10000); };
  var pct = function (r) { return (Math.round(r * 1000) / 10).toFixed(1); };
  function val(id) {
    var el = $(id); if (!el) return 0;
    var s = String(el.value).replace(/[０-９．]/g, function (c) { return c === "．" ? "." : String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }).replace(/[,，、 　円万%％]/g, "");
    var n = Number(s);
    return isFinite(n) && n > 0 ? n : 0;
  }
  var EXISTING = ["lt-car", "lt-card", "lt-revo", "lt-sho", "lt-other"];

  function syncYears() {
    var age = val("lt-age");
    var y = $("lt-years");
    if (!age) return;
    var m = C.maxYears(age);
    if (m > 0 && (val("lt-years") === 0 || val("lt-years") > m)) y.value = m;
    $("lt-years-note").textContent = m > 0 ? "完済 80 歳までなら最長 " + m + " 年" : "完済 80 歳までに組める期間がありません";
  }

  function calc() {
    var existing = 0;
    for (var i = 0; i < EXISTING.length; i++) existing += val(EXISTING[i]);
    var r = C.calc({
      incomeMan: val("lt-income"), partnerMan: val("lt-partner"), rate: Number($("lt-rate").value), years: val("lt-years") || 35,
      ratio: $("lt-ratio").value, existing: existing, wantMan: val("lt-want"), realRate: val("lt-real")
    });
    if (!(r.income > 0)) { out.innerHTML = '<p class="lt-warn">年収を入れてください。</p>'; out.hidden = false; return; }
    var h = '<div class="lt-card">' +
      '<p class="lt-card__k">借入可能額の目安</p>' +
      '<p class="lt-card__big"><span>' + man(r.kanou) + "</span> 万円</p>" +
      '<p class="lt-card__sub">年収 ' + man(r.income) + " 万円・返済負担率の上限 " + Math.round(r.ratio * 100) + "%・計算用の金利 " + r.rate + "%・" + r.years + " 年で計算（年収の約 " + (Math.round(r.baisu * 10) / 10) + " 倍）</p>";
    var rows = [
      ["住宅ローンを含む月々の返済の上限", fmt(r.maxMonthly) + " 円"],
      ["いまのお借入れの月々の返済", fmt(r.existing) + " 円"],
      ["住宅ローンに回せる月々の返済", fmt(r.availMonthly) + " 円"]
    ];
    if (r.kanouMonthlyReal) rows.push(["実際の金利 " + val("lt-real") + "% で借りた場合の月々の返済", "約 " + fmt(r.kanouMonthlyReal) + " 円"]);
    h += '<table class="lt-detail">' + rows.map(function (x) { return "<tr><th>" + x[0] + "</th><td>" + x[1] + "</td></tr>"; }).join("") + "</table>";
    if (r.existing > 0) {
      h += '<div class="lt-impact"><p class="lt-impact__k">いまのお借入れの影響</p>' +
        "<p>月 " + fmt(r.existing) + " 円の返済があることで、借入可能額の目安が <b>" + man(r.diff) + " 万円</b>少なくなっています（お借入れの返済が無い場合は " + man(r.kanouFree) + " 万円）。いまのお借入れだけで、年収に対する返済の割合は " + pct(r.currentRatio) + "% です。</p></div>";
    }
    if (r.want) {
      var ok = r.wantOk;
      h += '<div class="lt-want ' + (ok ? "is-ok" : "is-ng") + '"><p class="lt-impact__k">希望の借入額 ' + man(r.want) + " 万円の場合</p>" +
        "<p>返済負担率は <b>" + pct(r.wantRatio) + "%</b>（上限 " + Math.round(r.ratio * 100) + "%）で、" + (ok ? "上限の範囲に収まります。" : "上限を超えます。") +
        (r.existing > 0 ? "お借入れの返済が無ければ " + pct(r.wantRatioFree) + "% です。" : "") +
        (r.wantMonthlyReal ? "実際の金利での月々の返済は約 " + fmt(r.wantMonthlyReal) + " 円です。" : "") + "</p></div>";
    }
    h += "</div>";
    out.innerHTML = h;
    out.hidden = false;
    if (cta) cta.hidden = !(r.existing > 0 || (r.want && !r.wantOk));
    if (typeof window.gtag === "function") window.gtag("event", "loan_tool_calc", { has_existing: r.existing > 0 ? 1 : 0 });
    out.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  root.addEventListener("click", function (e) {
    if (e.target.id === "lt-calc") calc();
    var q = e.target.closest("[data-rate]");
    if (q) { $("lt-rate").value = q.getAttribute("data-rate"); }
  });
  root.addEventListener("change", function (e) { if (e.target.id === "lt-age") syncYears(); });
  root.addEventListener("keydown", function (e) { if (e.key === "Enter" && e.target.tagName === "INPUT") { e.preventDefault(); if (e.target.id === "lt-age") syncYears(); calc(); } });
})();
