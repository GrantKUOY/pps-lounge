# data/lounges.json 欄位說明

`data/lounges.json` 是前端查詢的正式資料（1,754 筆），由
`scripts/extract-live-data.mjs` 產生：來源為正式站 HTML 快照
（`.baseline/index.production.html`，未納入 repo）內嵌的 records 陣列，
輔以 `pps-records.js` 回填官方網址，再套用 `manual-removals.json` 下架
與 `manual-additions.json` 人工新增。因此管線無法只靠 repo 完整重現，
欄位異動以本檔案為準。

## 既有欄位（來自正式站快照）

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| country | string | 國家（英文） |
| city | string | 城市（英文） |
| airportCode | string | IATA 三碼 |
| airportName | string | 機場英文名 |
| type | string | `LOUNGE` 或 `EAT` |
| typeLabel | string | 類型中文標籤 |
| name | string | 據點名稱 |
| location | string | 位置原文 |
| openingHours | string | 營業時間原文 |
| conditions | string | 使用條件英文原文 |
| facilities | string[] | 設施原文清單 |
| terminal | string | 航廈 |
| url | string | Priority Pass 官方頁面（HTTPS） |
| isAsia / isEurope | boolean | 地區推導旗標 |
| searchText | string | 搜尋索引文字 |

## 查證三欄骨架（wave1 W2 新增）

此三欄**不來自**正式站快照或 `pps-records.js`，是本站人工查證流程的
紀錄欄位。每筆都必須存在此三欄，缺欄會使 `npm run validate` 失敗。

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| last_verified | `null` 或 `"YYYY-MM-DD"` | 本筆最近一次逐筆查證日期。`null`＝尚未逐筆查證，前端呈現「本筆資料未逐筆查證，請以官網為準」；有日期時呈現「資料查證：YYYY-MM」，距今逾 180 天加註「（待複核）」（見 `assets/formatters.js` 的 `verifiedLabel`）。 |
| data_source | `null` 或非空字串 | 資料來源標記（例如 `official-site`、`field-visit`、`traveler-report`），`null`＝僅來自正式站快照，未標記來源。 |
| status_flag | `null`、`"ok"`、`"pending"`、`"closed"` | 本筆查證狀態：`ok`＝已確認正常、`pending`＝待確認、`closed`＝已確認歇業/退出。`null`＝未進入查證流程。 |

注意用語分工：本檔案的 `last_verified` 是「查證日期」（有人對過官網）；
`data/meta.json` 的 `dataUpdatedAt` 是「整理日期」（資料批次匯入時間，
頁尾呈現），兩者不可混用。

## 重新產生資料時的保留規則（重要）

執行 `npm run extract` 重新產生 `lounges.json` 時，extract 腳本會以
identity key（`airportCode`、`name`、`location`、`openingHours`、
`conditions` 組合）從**舊的** `data/lounges.json` 保留每筆已填的
`last_verified`、`data_source`、`status_flag`，新列則補 `null`。
因此：

- 不要在未保留舊檔的情況下重產後直接覆蓋，否則人工查證結果會遺失。
- `manual-additions.json` 的新增列不需手寫此三欄，extract 時會自動補
  `null`；若新增列本身就是人工查證結果，直接在產出的 `lounges.json`
  裡回填三欄即可，下次重產會被保留。
- 重產後務必跑 `npm run validate` 與 `node --test tests/*.test.mjs`。
