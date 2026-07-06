# PPS Lounge v2

手機優先的 Priority Pass 全球機場據點中文查詢新版，採 PPS Aviation Journal 視覺方向：像一本懂機場的旅行編輯誌，也像一件可靠的搜尋工具。

## 隔離說明

- 分支：`redesign-v2`
- 基準：`origin/main` commit `46e8c3d`
- 正式網站 `https://pps-lounge.vercel.app/` 未修改
- 未經 Grant 核准，不得 push、merge 或部署 Vercel Preview／Production

## 本機啟動

```bash
npm install
python3 -m http.server 4173
```

瀏覽器開啟 `http://127.0.0.1:4173/`。

本網站使用 ES modules 與 JSON fetch，不能以 `file://` 直接開啟。

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

- Unit tests：資料、TPE 6 筆、KEF 兩筆餐飲、官方網址保留、搜尋、篩選、排序、分頁、中文格式化、HTML 跳脫、安全官方 URL、CSV 與 localStorage 降級。
- Playwright：PPS Journal 搜尋外殼、TPE 6 筆核心流程、餐飲／貴賓室快速篩選、詳情資料列與焦點回復、篩選取消還原、空狀態、載入失敗、44px 觸控目標、鍵盤操作、reduced-motion 分頁、390px 首屏、6 倍 CPU 效能 Gate，以及 320／375／390／768／1024px 無水平溢出。

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
