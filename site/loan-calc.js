/**
 * 住宅ローンの借入可能額・返済負担率の目安（/tools/kariire-kanougaku/）。ブラウザとビルド（早見表）で同じ式を使う。
 *
 * ・借入可能額 = 「年収 × 返済負担率の上限 ÷ 12 − いまのお借入れの月々の返済」を、計算用の金利・返済期間の元利均等返済で割り戻した額。
 * ・返済負担率の上限は、指定がなければ年収 400 万円未満 30%・400 万円以上 35%（フラット 35 の基準）。
 * ・結果は 10 万円単位で切り捨て。金融機関ごとの基準は公開されておらず、実際の判断は金融機関が行う（画面に書く）。
 */
(function (root) {
  "use strict";

  function pmt(principal, ratePct, years) {
    var n = Math.round(years * 12);
    if (!(principal > 0) || !(n > 0)) return 0;
    var i = ratePct / 100 / 12;
    if (i === 0) return principal / n;
    return principal * i / (1 - Math.pow(1 + i, -n));
  }

  function pv(monthly, ratePct, years) {
    var n = Math.round(years * 12);
    if (!(monthly > 0) || !(n > 0)) return 0;
    var i = ratePct / 100 / 12;
    if (i === 0) return monthly * n;
    return monthly * (1 - Math.pow(1 + i, -n)) / i;
  }

  function autoRatio(income) { return income < 4000000 ? 0.30 : 0.35; }
  var floor10 = function (x) { return Math.max(0, Math.floor(x / 100000) * 100000); };
  var num = function (v) { var n = Number(v); return isFinite(n) && n > 0 ? n : 0; };

  /**
   * in: { incomeMan, partnerMan, rate（計算用の金利 %）, years, ratio（"auto" または 0.25 など）,
   *       existing（いまのお借入れの月々の返済の合計・円）, wantMan（希望の借入額・万円）, realRate（実際の金利 %） }
   */
  function calc(i) {
    var income = (num(i.incomeMan) + num(i.partnerMan)) * 10000;
    var ratio = i.ratio === "auto" || i.ratio == null || i.ratio === "" ? autoRatio(income) : Number(i.ratio);
    var rate = num(i.rate), years = num(i.years) || 35, existing = num(i.existing);
    var maxMonthly = income * ratio / 12;
    var avail = Math.max(0, maxMonthly - existing);
    var kanou = floor10(pv(avail, rate, years));
    var kanouFree = floor10(pv(maxMonthly, rate, years));
    var out = {
      income: income, ratio: ratio, rate: rate, years: years, existing: existing,
      maxMonthly: Math.floor(maxMonthly), availMonthly: Math.floor(avail),
      kanou: kanou, kanouFree: kanouFree, diff: kanouFree - kanou,
      currentRatio: income > 0 ? existing * 12 / income : 0,
      baisu: income > 0 ? kanou / income : 0
    };
    var real = num(i.realRate);
    if (real > 0 && kanou > 0) out.kanouMonthlyReal = Math.round(pmt(kanou, real, years));
    var want = num(i.wantMan) * 10000;
    if (want > 0 && income > 0) {
      var wantMonthlyCalc = pmt(want, rate, years);
      out.want = want;
      out.wantRatio = (wantMonthlyCalc + existing) * 12 / income;
      out.wantRatioFree = wantMonthlyCalc * 12 / income;
      out.wantOk = out.wantRatio <= ratio + 1e-9;
      out.wantMonthlyCalc = Math.round(wantMonthlyCalc);
      if (real > 0) out.wantMonthlyReal = Math.round(pmt(want, real, years));
    }
    return out;
  }

  /** 年齢から返済期間の上限（完済 80 歳まで・最長 35 年） */
  function maxYears(age) {
    var a = num(age);
    if (!a) return 35;
    return Math.max(0, Math.min(35, 80 - Math.ceil(a)));
  }

  var api = { calc: calc, pmt: pmt, pv: pv, autoRatio: autoRatio, maxYears: maxYears };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.LoanCalc = api;
})(this);
