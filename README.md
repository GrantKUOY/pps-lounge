# PPS Lounge v2.1

手機優先的 Priority Pass 全球機場據點中文查詢網站。v2.1 在 PPS Aviation Journal 視覺方向上加入 Community Data Points、A+ 待審投稿流程、輕量 PWA 與亞洲／歐洲地區捷徑。

## 隔離說明

- 分支：`feature/v2.1-community-pwa`
- 基準：v2 production launch commit `72c2851`
- 正式網站 `https://pps-lounge.vercel.app/` 未直接修改
- 未經 Grant 核准，不得 push、merge 或部署 Vercel Preview／Production

## 本機啟動

```bash
npm install
python3 -m http.server 4173
```

瀏覽器開啟 `http://127.0.0.1:4173/`。

本網站使用 ES modules 與 JSON fetch，不能以 `file://` 直接開啟。

Playwright UI 測試使用獨立 port `4276`，避免誤連到其他 worktree 的既有 HTTP server。

## Community Data Points

v2.1 新增每間 lounge 的旅客回報區塊與投稿表單：

- 投稿預設 `pending`，不會自動公開。
- 投稿者必填暱稱與 email；前台只顯示暱稱。
- 照片最多 5 張，只接受 JPEG、PNG、WebP。
- 未設定後端時，前台會顯示「旅客回報後端尚未設定」，不影響官方資料查詢。
- `/admin.html` 提供審核頁；未提供正確管理 token 時，API 不會回傳投稿資料。

### 必要環境變數

以下變數設定於 Vercel / Supabase，不可提交到 repo：

```text
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
PPS_ADMIN_TOKEN
PPS_REVIEW_EMAIL
PPS_ADMIN_URL
RESEND_API_KEY
PPS_REVIEW_FROM
PPS_REPORT_MAX_PHOTO_SIZE
```

`SUPABASE_URL` 與 `SUPABASE_ANON_KEY` 會由 `api/community-config` 回傳給前端使用；service role key 只允許 serverless API 使用。

### Supabase

資料表與 Storage bucket 規劃在：

```text
supabase/migrations/20260711_lounge_reports.sql
```

核心安全要求：

- 公開查詢只能讀取 `approved` 投稿。
- 匿名使用者只能建立 `pending` 投稿。
- `email`、`admin_note`、`reviewed_by` 不得出現在前台 DOM。
- `lounge-report-photos` bucket 預設 private，避免未審核照片被公開列目錄。

### Email 通知

`api/notify-report` 使用 Resend。若 `RESEND_API_KEY` 或 `PPS_REVIEW_EMAIL` 未設定，API 會回傳 skipped，不阻斷 pending 投稿保存。

## PWA

v2.1 加入輕量 PWA：

- `manifest.webmanifest`
- `sw.js`
- `offline.html`
- `icons/icon-192.svg`
- `icons/icon-512.svg`

Service worker 只快取公開靜態資源與公開 JSON；不快取 `/admin`、`api/*`、pending/rejected 投稿或管理資料。離線時可以開啟已快取首頁並查詢已快取 lounge 資料；投稿與照片上傳需恢復網路。

## 地區捷徑

v2.1 補回 v1 使用者熟悉的地區入口，但不恢復 `asiaOnly` / `europeOnly` 雙 boolean。現在使用單一 `filters.region`：

- 亞洲（含中東）
- 歐洲

地區可與類型、國家、城市、設施篩選疊加。

## 資料

正式資料由執行基準頁面抽出；若基準頁面的官方網址為空，抽取程式會以
`pps-records.js` 中可唯一匹配的紀錄補齊，不會覆蓋既有網址或猜測重複紀錄。
經 Priority Pass 官網人工確認、但基準資料尚未收錄的據點，維護於
`data/manual-additions.json`，抽取時依相同識別鍵去重後加入。Priority Pass
官方已下架或不再列於機場清單的據點，維護於 `data/manual-removals.json`，
抽取時以精確鍵移除並保留稽核來源。

```bash
npm run extract
npm run validate
```

預期結果：

```text
wrote 1754 rows; backfilled 17 URLs; removed 1; added 1 manually verified rows
validated 1754 rows across 752 airports
```

目前資料 Gate：

- 總筆數固定為 1,754 筆。
- TPE 只保留 Priority Pass 官方現列 6 筆，並使用 `taiwan-region` 現行網址。
- KEF 同時包含 Jomfruin 與 Elda。
- 人工新增／下架資料必須可稽核，不得以推測補值。

## 視覺規範

新版採 PPS Aviation Journal：高級旅行編輯誌排版與搜尋優先工具。
所有視覺修改先讀取根目錄 `DESIGN.md`；外部 skill 不得覆蓋專案
tokens、字體角色、資訊架構或禁止模式。

關鍵限制：

- 不使用巨型 Hero、裝飾漸層、玻璃擬態、卡片牆、卡片套卡片、大量膠囊標籤或 Apple Action Blue。
- 搜尋優先；品牌序言最多兩行。
- 結果採細線分隔清單；詳情採資料列。
- 支援鍵盤、焦點回復、`aria-live`、44px 觸控目標與 reduced-motion。

## 效能 Gate

- 搜尋 debounce：120ms。
- 390 × 844px 搜尋後首屏可見第一筆結果。
- 6 倍 CPU 降速時，快速輸入只渲染一次且 250ms 內可見。

## 測試

```bash
npm test
npm run test:ui
```

- Unit tests：資料、TPE 6 筆、KEF 兩筆餐飲、官方網址保留、搜尋、地區篩選、投稿驗證、公開資料淨化、PWA cache allowlist、排序、分頁、中文格式化、HTML 跳脫、安全官方 URL、CSV 與 localStorage 降級。
- Playwright：PPS Journal 搜尋外殼、TPE 6 筆核心流程、餐飲／貴賓室快速篩選、亞洲地區捷徑、投稿表單入口、PWA manifest、詳情資料列與焦點回復、篩選取消還原、空狀態、載入失敗、44px 觸控目標、鍵盤操作、reduced-motion 分頁、390px 首屏、6 倍 CPU 效能 Gate，以及 320／375／390／768／1024px 無水平溢出。

## Tailscale 預覽

先在 WSL 啟動 HTTP server：

```bash
python3 -m http.server 4173
```

再由 Windows Tailscale 建立 tailnet 內代理：

```powershell
tailscale serve --yes --bg --http=4174 4173
```

停止代理：

```powershell
tailscale serve --yes --http=4174 off
```

Tailscale 預覽只供本機與手機驗證，不是正式發布。Grant 使用實體 iPhone Safari 完成搜尋、篩選、詳情與官方連結流程前，`redesign-v2` 不得發布。
