import { mkdir, readFile, writeFile } from "node:fs/promises";

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

const identityFields = [
  "airportCode",
  "name",
  "location",
  "openingHours",
  "conditions",
];
const identityKey = (row) =>
  identityFields.map((field) => row[field] ?? "").join("\0");
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

await mkdir("data", { recursive: true });
await writeFile("data/lounges.json", `${JSON.stringify(rows)}\n`, "utf8");
console.log(
  `wrote ${rows.length} rows; backfilled ${backfilledUrls} URLs; removed ${removedRows}; added ${addedRows} manually verified rows`,
);
