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
| conditions | — | **已移除（wave2）**：使用條件英文全文不再寫入產出，見下方「條件欄位（wave2 資料面收斂）」 |
| conditions_excerpt | `null` 或 string（≤ 200 字元） | 使用條件短摘，見下方「條件欄位（wave2 資料面收斂）」 |
| facilities | string[] | 設施原文清單 |
| terminal | string | 航廈 |
| url | string | Priority Pass 官方頁面（HTTPS） |
| isAsia / isEurope | boolean | 地區推導旗標 |
| searchText | string | 搜尋索引文字 |

## 條件欄位（wave2 資料面收斂）

`conditions` 英文全文**不再存在於產出資料**：公開站與 repo 的
`data/lounges.json` 只保留短摘，任何人下載資料都拿不到全文。
全文母本保留於正式站快照（`.baseline/index.production.html`）與
vault 的 `PPS_LOUNGE.csv`，需要核對原文時回母本查。

追加包：repo 根目錄的 `pps-records.js`（extract 管線的 supplemental
輸入，同時被 `map.html` 直接載入供 `pps-map.js` 顯示）比照收斂——
每筆紀錄的 `conditions` 全文已改為 `conditions_excerpt` 短摘
（轉換腳本 `scripts/strip-records-conditions.mjs`，可重跑）。
`pps-map.js` 的條件顯示改讀 `conditions_excerpt`；extract 的
identity key 對 supplemental 列改走 `conditions_excerpt` 分支，
與全文計算出的短摘一致，網址回填與查證欄位保留語意不變。
守門：`tests/data.test.mjs` 對 `pps-records.js` 全筆斷言無
`conditions` 欄位、`conditions_excerpt` 存在且 ≤ 200 字元。

註：兩份資料的 `searchText` 搜尋索引仍含小寫化後的條件片段文字
（與 wave2 主包對 `data/lounges.json` 的處理一致），屬搜尋索引
而非條件欄位本身；若日後要連索引一併收斂，需另案評估搜尋行為。

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| conditions_excerpt | `null` 或 string（≤ 200 字元） | 由 `scripts/excerpt.mjs` 的 `conditionsExcerpt` 自母本全文產生：以 ` - ` 切段，依序納入至總長不超過 200 字元（含連接符），第一段超限時硬截至 200 字元；無條件內容時為 `null`。前端呈現：熱門據點詳情與貴賓室靜態頁顯示此短摘並標示「節錄，完整條件以官網為準」，非熱門據點只指向官網。 |

守門：`npm run validate` 對任一筆出現非空 `conditions` 欄位、
缺 `conditions_excerpt`、或短摘超過 200 字元都會報錯；
`scripts/extract-live-data.mjs` 產出前會自動計算短摘並剝除全文，
重產不會把全文帶回來。

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
identity key（`airportCode`、`name`、`location`、`openingHours`，
加上條件欄位的短摘衍生值——有全文時以 `conditionsExcerpt` 計算、
舊產出則直接用其 `conditions_excerpt`，兩者一致）從**舊的**
`data/lounges.json` 保留每筆已填的
`last_verified`、`data_source`、`status_flag`，新列則補 `null`。
因此：

- 不要在未保留舊檔的情況下重產後直接覆蓋，否則人工查證結果會遺失。
- `manual-additions.json` 的新增列不需手寫此三欄，extract 時會自動補
  `null`；若新增列本身就是人工查證結果，直接在產出的 `lounges.json`
  裡回填三欄即可，下次重產會被保留。
- 重產後務必跑 `npm run validate` 與 `node --test tests/*.test.mjs`。
