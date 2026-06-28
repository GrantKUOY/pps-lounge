# PPS Lounge v2

手機優先的 Priority Pass 全球機場據點中文查詢新版。

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
`pps-records.js` 中可唯一匹配的紀錄補齊，不會覆蓋既有網址或猜測重複紀錄：

```bash
npm run extract
npm run validate
```

預期結果：

```text
wrote 1754 rows; backfilled 17 URLs
validated 1754 rows across 752 airports
```

## 測試

```bash
npm test
npm run test:ui
```

- Unit tests：資料、搜尋、篩選、排序、分頁、中文格式化、HTML 跳脫、CSV 與 localStorage 降級。
- Playwright：TPE 核心流程、空狀態、載入失敗、44px 觸控目標、鍵盤操作及 320／375／768／1024px 響應式版面。

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

Tailscale 預覽只供本機與手機驗證，不是正式發布。
