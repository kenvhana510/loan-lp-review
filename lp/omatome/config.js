/**
 * おまとめ住宅ローン LP — 設定ファイル
 *
 * 本番公開前に必ず確認すること:
 *   1. LINE_FRIEND_URL   … 本番の友だち追加URL（未設定の間はCTAが遷移しない安全停止状態）
 *   2. GA_MEASUREMENT_ID … GA4測定ID（未設定の間は計測タグを読み込まず console.debug へフォールバック）
 *   3. CLAIMS_MODE       … "production" にすると未検証claim(data-claim-status="pending")がDOMから除去される
 *   4. ENTITY_MODE       … "production" にすると事業主体の仮情報がDOMから除去される
 *
 * 絶対ルール: 実IDは本ファイル以外にハードコードしない。
 */
window.LP_CONFIG = {
  // ---- LINE ----
  // LINE_FLOW_STATUS=PENDING（docs/line-pending.md 参照）
  //
  // ⚠️ 実IDの投入は Google Ads Gate PASS 後。ここが REPLACE_ME の間は CTA が遷移しない。
  //    webhook が active=true のため、先に実IDを入れると Gate 前に実ユーザーが到達しうる。
  LINE_FRIEND_URL: "",

  // LINE_ENTRY_MODE（PHASE 6.0）
  //   "oa_message"  … トーク画面を開いて本文を下書きする。
  //                   本文に attribution トークンを載せられるため **計測が繋がる**（既定）
  //   "friend_add"  … 従来の友だち追加URL。パラメータを webhook へ渡せず attribution は失われる
  LINE_ENTRY_MODE: "oa_message",
  LINE_BASIC_ID: "",
  LINE_ENTRY_GREETING: "相談を希望します",

  // ---- 計測 ----
  GA_MEASUREMENT_ID: "",

  // ---- 運営者情報（F-6 必須開示 / docs/operator-information-intake.md） ----
  //
  // ⚠️ **推測で埋めない。** 受領した実値だけを入れる。
  //    1つでも REPLACE_ME が残っている間は、ENTITY_MODE="production" にしても
  //    運営者情報は表示されない（未確認値を公開しないための fail-closed）。
  //    全項目が埋まったときだけ、production で実値が描画される。
  //
  //    投入前に必ず: node scripts/verify-production-values.mjs
  //    ⚠️ **2主体構成である**（2026-09-03 に人間が決定）。
  //       広告主（ADVERTISER_*）と役務提供者（それ以外）は**別の主体**であり、
  //       法定表示ページには**両方を併記する**。値を混ぜないこと。
  //         広告主       = ユーザー本人（Gate #1 案A）
  //         役務提供者   = 株式会社中央住地（宅建業免許はこちらのもの）
  OPERATOR: {
    // ---- 広告主（ADVERTISER_ENTITY / Gate #1 = USER_SELF） ----
    ADVERTISER_NAME: "本間 謙太郎",       // 広告主（2026-09-03 人間確定）
    ADVERTISER_ADDRESS: "愛知県高浜市神明町8-2-4",    // 広告主の所在地（2026-09-09 人間確定）
    ADVERTISER_PHONE: "09015655891",      // 広告主の電話番号（2026-09-09 人間確定）
    ADVERTISER_EMAIL: "info@legacraft.com",      // 広告主のメールアドレス（2026-09-09 人間確定）
    // ⚠️ 受付時間は**広告主のもの**である。顧客が最初に連絡するのは広告主だから。
    //    役務提供者の受付時間は本LPに表示しないので、受け取る必要が無い。
    BUSINESS_HOURS: "17:00〜20:00",        // 広告主の受付時間（2026-09-09 人間確定）

    // ---- 役務提供者（SERVICE_PROVIDER_ENTITY） ----
    //      出典: 先輩LP https://ykry52.com/revivelife/law.html（2026-09-03 取得）
    PROVIDER_NAME: "株式会社中央住地",
    REPRESENTATIVE: "鈴木 元治",
    ADDRESS: "〒275-0014 千葉県習志野市大久保4-12-25",
    PHONE: "090-9227-3379",
    EMAIL: "kbking1204@gmail.com",
    // ⚠️ この免許番号は千葉県・東京都の公的DBで照会できなかった記録がある
    //    （docs/operator-information-intake.md §2-8 / docs/compliance-gate.md）。
    //    有効であること自体は人間確認済み。番号の掲載は 2026-09-03 に人間が
    //    「先輩LP通りに投入する」と決定。**照会できなかった事実は未解消のまま残る。**
    LICENSE_NUMBER: "千葉県知事免許（7）第12448号",
    LICENSE_AUTHORITY: "千葉県知事",
  },

  // ---- 表示ゲート ----
  // "dev"        … 未検証claimを黄色枠 + [CONFIRM_REQUIRED] ラベル付きで可視化（人間の目視確認用）
  // "production" … 未検証claimをDOMから完全に除去（本番公開時は必ずこちら）
  CLAIMS_MODE: "production",
  ENTITY_MODE: "production",

  // ---- Feature flags ----
  FEATURES: {
    STICKY_CTA: true,   // モバイル下部固定CTA
    SCROLL_DEPTH: true, // scroll_25/50/75/90 計測
    CTA_IMPRESSION: true, // CTA露出(cta_view)計測。位置別CTRの分母になる
  },

  // ---- バリアント識別（A/Bテスト用） ----
  PAGE_VARIANT: "omatome_v1",
};

/**
 * レビュー用の一方向オーバーライド。
 * `?claims=production` を付けると本番と同じ厳格モード（未検証claimをDOMから除去）で確認できる。
 * 逆方向（production → dev）への切り替えは実装しない。
 * URLパラメータで表示規制を緩められると、未確認claimが公開されうるため。
 */
if (window.location.search.indexOf("claims=production") !== -1) {
  window.LP_CONFIG.CLAIMS_MODE = "production";
  window.LP_CONFIG.ENTITY_MODE = "production";
}

/* ---- レビュー公開ビルド（Google ポリシー確認用） ----
 * 相談受付を停止した状態で公開している。
 * LINE と GA は空にしてあるため、遷移も計測も行われない。
 * このブロックは dist-review/ にしか存在しない（ソースの config.js は無変更）。
 */
window.LP_CONFIG.REVIEW_MODE = true;
