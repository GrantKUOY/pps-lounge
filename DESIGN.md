# PPS Aviation Journal Design System

## Design thesis

像一本懂機場的旅行刊物，也像一件可靠的隨身工具。

## Source of truth

本文件是 PPS Lounge 的最高視覺依據。外部 Apple、Clean、frontend-design
或 web-design-guidelines 只能協助實作與檢查，不得覆蓋本文件的品牌 tokens、
字體角色、資訊架構與禁止模式。

## Tokens

| Token | Value | Role |
|---|---|---|
| `--paper` | `#F3EFE5` | 主畫布 |
| `--paper-raised` | `#FAF7EF` | 必須區分層級時使用 |
| `--ink` | `#202522` | 主文字與線條 |
| `--ink-muted` | `#65645E` | 次要資料 |
| `--oxblood` | `#8F2639` | 唯一品牌互動色 |
| `--rule` | `#B8B0A1` | 分隔線 |
| `--error` | `#A32D24` | 錯誤 |
| `--success` | `#35624A` | 成功或可用 |

## Typography

- 場所名稱與編輯標題：`Noto Serif TC`, `Source Han Serif TC`, `Georgia`, serif。
- 操作、資料與正文：`Noto Sans TC`, system-ui, sans-serif。
- 機場代碼：無襯線粗體、緊字距，只用於真實機場導航。
- 襯線字不得用於按鈕、表單、密集資料與長條件。

## Layout

- 搜尋優先；390 × 844px 搜尋後首屏看得到第一筆結果。
- 品牌序言最多兩行，不使用巨型 Hero 或自動收合動畫。
- 結果採細線分隔清單，不採卡片牆。
- 詳情採資料列，不採卡片套卡片。
- 主要層級依靠字級、間距與細線。

## Components

- Search：120ms debounce，輸入時不得重建篩選選項。
- Overview：機場代碼、機場名稱、結果數及航廈數。
- Quick filters：只保留全部、貴賓室、餐飲與進階篩選入口。
- Result row：航廈／類型、名稱、位置、時間、最多三項重要設施。
- Detail：位置、營業時間、設施、條件、原文、安全 HTTPS 官方連結。
- Dialog：只在浮層使用低對比陰影；關閉後焦點回到觸發元件。

## Prohibited patterns

- Apple Action Blue。
- 裝飾漸層與玻璃擬態。
- 巨型置中 Hero。
- 卡片牆與卡片套卡片。
- 大量膠囊標籤。
- 非浮層陰影。
- 虛構期號、假引言或無資料意義的編輯裝飾。

## Quality gates

- WCAG 2.2 AA。
- 可見按鈕、輸入與 select 至少 44px。
- 320、375、390、768、1024px 無水平溢出。
- 6 倍 CPU 降速時，自最後一次輸入至結果可見小於 250ms。
- 快速輸入 `T → TP → TPE` 只渲染一次。
- 支援鍵盤、`focus-visible`、`aria-live` 與 `reduced-motion`。
