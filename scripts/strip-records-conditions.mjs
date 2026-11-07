// 一次性（可重跑）資料轉換：wave2 conditions 資料面移除（追加包）。
//
// 對 pps-records.js 每筆紀錄：以 scripts/excerpt.mjs 的 conditionsExcerpt
// 計算 conditions_excerpt 寫入新欄位，並刪除 conditions 全文欄位。
// pps-records.js 是公開 repo 內的檔案，且被 map.html 直接載入供
// pps-map.js 顯示據點條件，也作為 extract 管線的 supplemental 輸入
// （identity key 比對與官方網址回填）；轉換後 identity key 改走
// conditions_excerpt 分支，與全文計算出的短摘一致，管線語意不變。
// 全文母本保留於 .baseline 正式站快照與 vault 的 PPS_LOUNGE.csv。
//
// 可重跑：已轉換的紀錄沒有 conditions 時，保留既有 conditions_excerpt
// 原值不動（冪等）。PPS_RECORDS_META 與檔案前後綴文字原樣保留。
//
// 用法：node scripts/strip-records-conditions.mjs

import { readFile, writeFile } from "node:fs/promises";
import { conditionsExcerpt } from "./excerpt.mjs";

const DATA_PATH = "pps-records.js";
const PAYLOAD_PATTERN =
  /^(window\.PPS_RECORDS = )(\[[\s\S]*?\]);(\s*window\.PPS_RECORDS_META[\s\S]*)$/;

const beforeText = await readFile(DATA_PATH, "utf8");
const match = beforeText.match(PAYLOAD_PATTERN);
if (!match) {
  throw new Error("pps-records.js payload not found");
}
const [, prefix, rowsJson, suffix] = match;
const rows = JSON.parse(rowsJson);

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

const afterText = `${prefix}${JSON.stringify(rows)};${suffix}`;
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
