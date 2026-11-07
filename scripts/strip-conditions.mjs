// 一次性（可重跑）資料轉換：wave2 conditions 資料面移除。
//
// 對 data/lounges.json 每筆：以 scripts/excerpt.mjs 的 conditionsExcerpt
// 計算 conditions_excerpt 寫入新欄位，並刪除 conditions 全文欄位。
// 全文母本保留於 .baseline 正式站快照與 vault 的 PPS_LOUNGE.csv。
//
// 可重跑：已轉換的列沒有 conditions 時，保留既有 conditions_excerpt
// 原值不動（冪等），不會二次截斷或洗掉資料。
//
// 用法：node scripts/strip-conditions.mjs

import { readFile, writeFile } from "node:fs/promises";
import { conditionsExcerpt } from "./excerpt.mjs";

const DATA_PATH = "data/lounges.json";

const beforeText = await readFile(DATA_PATH, "utf8");
const rows = JSON.parse(beforeText);

let strippedRows = 0;
let excerptChars = 0;
let excerptNonNull = 0;
let removedChars = 0;

for (const row of rows) {
  if ("conditions" in row) {
    removedChars +=
      typeof row.conditions === "string" ? row.conditions.length : 0;
    row.conditions_excerpt = conditionsExcerpt(row.conditions);
    delete row.conditions;
    strippedRows += 1;
  }
  if (typeof row.conditions_excerpt === "string") {
    excerptNonNull += 1;
    excerptChars += row.conditions_excerpt.length;
  }
}

const afterText = `${JSON.stringify(rows)}\n`;
await writeFile(DATA_PATH, afterText, "utf8");

console.log(
  JSON.stringify(
    {
      rows: rows.length,
      strippedRows,
      removedConditionChars: removedChars,
      excerptNonNull,
      excerptChars,
      bytesBefore: Buffer.byteLength(beforeText),
      bytesAfter: Buffer.byteLength(afterText),
    },
    null,
    2,
  ),
);
