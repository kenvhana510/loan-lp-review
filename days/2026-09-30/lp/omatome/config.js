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
  LINE_FRIEND_URL: "https://lin.ee/wIjLMkF",

  // LINE_ENTRY_MODE（PHASE 6.0）
  //   "oa_message"  … トーク画面を開いて本文を下書きする。
  //                   本文に attribution トークンを載せられるため **計測が繋がる**（既定）
  //   "friend_add"  … 従来の友だち追加URL。パラメータを webhook へ渡せず attribution は失われる
  LINE_ENTRY_MODE: "oa_message",
  LINE_BASIC_ID: "",
  LINE_ENTRY_GREETING: "相談を希望します",

  // ---- 計測 ----
  GA_MEASUREMENT_ID: "",

  // ---- Google 広告 コンバージョン計測（2026-09-14 人間指示） ----
  //   番号付き画像LP（scripts/build-numbered-lp.mjs）の <head> に Google タグとして焼き込む。
  //   コンバージョン「LINE相談ボタンクリック」は LINE CTA のクリック時**だけ**送る（ページ表示では送らない）。
  //   ラベルは Google が発行した Event snippet の値をそのまま使う。
  //   2026-09-19: 新アカウントへ移行し、旧アカウントの ID とラベルは廃止した。
  //   ID とラベルは**必ず同じアカウントの組**にする（ID だけ替えると send_to が
  //   存在しないラベルを指し、conversion が無言で失われる）。旧値は本ファイルに残さない
  //   （配信対象のため、廃止した ID が公開物に文字列として残らないようにする）。
  //   ⚠️ 広告の配信開始・課金開始はこの設定では起きない（タグの設置と計測だけ）。
  GOOGLE_ADS: {
    CONVERSION_ID: "AW-18458618505",
    LINE_CTA_CLICK_LABEL: "Yi50CJ3hpv0cEInV4OFE",
    // 2026-09-28 人間決定: restartlife.jp 専用の GA4 プロパティ（556155085 / ストリーム 15856261278）。
    //   Google タグ（gtag.js）と同じ <head> で gtag('config', GA4_ID) を送る。LINE CTA クリックは
    //   イベント line_cta_click として送る（キーイベント）。上の GA_MEASUREMENT_ID（旧LP の tracking.js 用）
    //   とは別のキーであり、Gate の「GA_MEASUREMENT_ID 未投入」判定には触れない。
    GA4_ID: "G-49D1Z94ELS",
  },

  // ---- Meta 広告 ピクセル（2026-09-29 準備。docs/meta-ads-plan.md） ----
  //   REPLACE_ME の間はピクセルのコードを一切出力しない（fail-closed）。15〜16 桁の数字だけを有効とする。
  //   有効なときは Google タグと同じページ（LP 本体＋サイトページ。法定表示・stub には置かない）に
  //   ベースコード（PageView）を置き、LINE CTA クリック時だけ標準イベント "Lead" を送る。
  //   ⚠️ 広告の配信開始・課金開始はこの設定では起きない（タグの設置と計測だけ）。
  //   値は Meta イベントマネージャで発行されたデータセット ID（ピクセル ID）を人間が投入する。
  META_PIXEL: {
    PIXEL_ID: "REPLACE_ME",
  },

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
  //         役務提供者   = LINE 取次ぎ先の宅建業者（免許はこちらのもの。2026-09-28 人間決定: 配信物では値を空にする）
  // 屋号（2026-09-28 人間決定）。法定表示・運営者情報・Copyright の名義。屋号の正本はここだけ
  TRADE_NAME: "restartlife",

  OPERATOR: {
    // ---- 広告主（ADVERTISER_ENTITY / Gate #1 = USER_SELF） ----
    ADVERTISER_NAME: "本間 謙太郎",       // 広告主（2026-09-03 人間確定）
    ADVERTISER_ADDRESS: "愛知県高浜市神明町8-2-4",    // 広告主の所在地（2026-09-09 人間確定）
    ADVERTISER_PHONE: "090-1565-5891",    // 広告主の電話番号（2026-09-09 人間確定。表記は 2026-09-11 人間指示のハイフン区切り）
    ADVERTISER_EMAIL: "info@restartlife.jp",     // 広告主のメールアドレス（2026-09-19 人間指示で legacraft.jp → restartlife.jp に変更）
    // ⚠️ 受付時間は**広告主のもの**である。顧客が最初に連絡するのは広告主だから。
    //    役務提供者の受付時間は本LPに表示しないので、受け取る必要が無い。
    BUSINESS_HOURS: "",        // 広告主の受付時間（2026-09-09 人間確定）

    // ---- 役務提供者（SERVICE_PROVIDER_ENTITY） ----
    PROVIDER_NAME: "",
    REPRESENTATIVE: "",
    ADDRESS: "",
    PHONE: "",
    EMAIL: "",
    // ⚠️ この免許番号は千葉県・東京都の公的DBで照会できなかった記録がある
    //    （docs/operator-information-intake.md §2-8 / docs/compliance-gate.md）。
    //    有効であること自体は人間確認済み。番号の掲載は 2026-09-03 に人間が
    //    「先輩LP通りに投入する」と決定。**照会できなかった事実は未解消のまま残る。**
    LICENSE_NUMBER: "",
    LICENSE_AUTHORITY: "",
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

/* ---- レビュー公開ビルド（Google 広告開始前） ----
 * LINE 友だち追加URLは人間承認値（2026-09-11 PHASE 78）。LINE_BASIC_ID と GA4 は空（未投入）。
 * Google 広告 conversion タグ（GOOGLE_ADS）は 2026-09-14 人間指示で LP 本体に設置（LINE CTA クリック時のみ送信）。
 * 旧LP（このページ）は公開終了し、/lp/ への中継 stub になっている。
 * このブロックは dist-review/ にしか存在しない（ソースの config.js は無変更）。
 */
window.LP_CONFIG.REVIEW_MODE = true;
