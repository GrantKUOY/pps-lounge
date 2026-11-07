import { mkdir, readFile, writeFile } from "node:fs/promises";
import { conditionsExcerpt } from "./excerpt.mjs";

const source = process.argv[2];
const supplementalSource = process.argv[3];
const manualAdditionsSource = process.argv[4];
const manualRemovalsSource = process.argv[5];

if (
  !source ||
  !supplementalSource ||
  !manualAdditionsSource ||
  !manualRemovalsSource
) {
  throw new Error(
    "usage: node scripts/extract-live-data.mjs <html> <pps-records.js> <manual-additions.json> <manual-removals.json>",
  );
}

const html = await readFile(source, "utf8");
const match = html.match(
  /const records = (\[[\s\S]*?\]);\s*const topFacilities/,
);

if (!match) {
  throw new Error("records payload not found");
}

let rows = JSON.parse(match[1]);

if (rows.length !== 1754) {
  throw new Error(`expected 1754 rows, got ${rows.length}`);
}

const supplementalText = await readFile(supplementalSource, "utf8");
const supplementalMatch = supplementalText.match(
  /^window\.PPS_RECORDS = (\[[\s\S]*?\]);\s*window\.PPS_RECORDS_META/,
);

if (!supplementalMatch) {
  throw new Error("supplemental PPS_RECORDS payload not found");
}

const supplementalRows = JSON.parse(supplementalMatch[1]);
if (supplementalRows.length !== rows.length) {
  throw new Error(
    `supplemental row count mismatch: expected ${rows.length}, got ${supplementalRows.length}`,
  );
}

// identity key 的條件欄位改用短摘衍生值（wave2）：產出資料已不含
// conditions 全文，舊產出列只有 conditions_excerpt；快照列與
// pps-records.js 列有全文。以全文計算出的 excerpt 與舊產出的欄位值
// 一致，三種來源才能組出相同 key，查證欄位保留與 URL 回填不失效。
const identityFields = [
  "airportCode",
  "name",
  "location",
  "openingHours",
];
const identityKey = (row) =>
  [
    ...identityFields.map((field) => row[field] ?? ""),
    row.conditions != null
      ? (conditionsExcerpt(row.conditions) ?? "")
      : (row.conditions_excerpt ?? ""),
  ].join("\0");
const supplementalByIdentity = new Map();

for (const row of supplementalRows) {
  const key = identityKey(row);
  supplementalByIdentity.set(key, [
    ...(supplementalByIdentity.get(key) ?? []),
    row,
  ]);
}

let backfilledUrls = 0;
for (const row of rows) {
  if (row.url) continue;
  const candidates = supplementalByIdentity.get(identityKey(row)) ?? [];
  if (candidates.length === 1 && candidates[0].url) {
    row.url = candidates[0].url;
    backfilledUrls += 1;
  }
}

function canonicalizeOfficialUrl(url) {
  return String(url ?? "").replace(
    "https://my.prioritypass.com/en-GB/lounges/taiwan/",
    "https://www.prioritypass.com/en-GB/lounges/taiwan-region/",
  );
}

function rowSlug(row) {
  if (!row.url) return "";
  return new URL(row.url).pathname.split("/").at(-1);
}

for (const row of rows) {
  if (row.airportCode === "TPE") {
    row.url = canonicalizeOfficialUrl(row.url);
  }
}

const manualRemovals = JSON.parse(
  await readFile(manualRemovalsSource, "utf8"),
);
if (!Array.isArray(manualRemovals)) {
  throw new Error("manual removals must be an array");
}
const removalFields = [
  "airportCode",
  "type",
  "name",
  "slug",
  "source",
  "reason",
];
const removalSlugs = new Set();
for (const removal of manualRemovals) {
  for (const field of removalFields) {
    if (typeof removal[field] !== "string" || !removal[field].trim()) {
      throw new Error(`manual removal ${field} must be a non-empty string`);
    }
  }
  if (removalSlugs.has(removal.slug)) {
    throw new Error(`duplicate manual removal slug: ${removal.slug}`);
  }
  const matches = rows.filter(
    (row) =>
      rowSlug(row) === removal.slug &&
      row.airportCode === removal.airportCode &&
      row.type === removal.type &&
      row.name === removal.name,
  );
  if (matches.length !== 1) {
    throw new Error(
      `manual removal ${removal.slug} must match exactly one row, got ${matches.length}`,
    );
  }
  removalSlugs.add(removal.slug);
}
const originalCount = rows.length;
rows = rows.filter((row) => !removalSlugs.has(rowSlug(row)));
const removedRows = originalCount - rows.length;

const manualAdditions = JSON.parse(
  await readFile(manualAdditionsSource, "utf8"),
);
if (!Array.isArray(manualAdditions)) {
  throw new Error("manual additions must be an array");
}

const existingIdentities = new Set(rows.map(identityKey));
let addedRows = 0;
for (const row of manualAdditions) {
  const key = identityKey(row);
  if (existingIdentities.has(key)) continue;
  rows.push(row);
  existingIdentities.add(key);
  addedRows += 1;
}

// 查證三欄骨架（語意見 data/SCHEMA.md）：正式站快照與 pps-records.js
// 都不含查證資訊，重新產生資料時必須從既有 data/lounges.json 以
// identity key 保留已填的 last_verified / data_source / status_flag，
// 其餘列一律補 null，確保重產不會掉欄或洗掉人工查證結果。
const verificationFields = ["last_verified", "data_source", "status_flag"];
const previousByIdentity = new Map();
try {
  const previousRows = JSON.parse(
    await readFile("data/lounges.json", "utf8"),
  );
  for (const previous of previousRows) {
    previousByIdentity.set(identityKey(previous), previous);
  }
} catch {
  // 尚無既有產出（首次產生）時全部補 null。
}
let preservedVerifiedRows = 0;
for (const row of rows) {
  const previous = previousByIdentity.get(identityKey(row));
  for (const field of verificationFields) {
    row[field] = previous?.[field] ?? row[field] ?? null;
  }
  if (verificationFields.some((field) => row[field] !== null)) {
    preservedVerifiedRows += 1;
  }
}

// wave2 資料面收斂：產出只保留 conditions 短摘（conditions_excerpt，
// 上限 200 字元，規則見 scripts/excerpt.mjs），不含英文全文，確保
// 日後重產不會把全文帶回公開資料。全文母本保留於 .baseline 正式站
// 快照與 vault 的 PPS_LOUNGE.csv，需要核對原文時回母本查。
for (const row of rows) {
  if ("conditions" in row) {
    row.conditions_excerpt = conditionsExcerpt(row.conditions);
    delete row.conditions;
  }
}

await mkdir("data", { recursive: true });
await writeFile("data/lounges.json", `${JSON.stringify(rows)}\n`, "utf8");
console.log(
  `wrote ${rows.length} rows; backfilled ${backfilledUrls} URLs; removed ${removedRows}; added ${addedRows} manually verified rows; preserved verification fields on ${preservedVerifiedRows} rows`,
);
