import { mkdir, readFile, writeFile } from "node:fs/promises";

const source = process.argv[2];
const supplementalSource = process.argv[3];

if (!source || !supplementalSource) {
  throw new Error(
    "usage: node scripts/extract-live-data.mjs <html> <pps-records.js>",
  );
}

const html = await readFile(source, "utf8");
const match = html.match(
  /const records = (\[[\s\S]*?\]);\s*const topFacilities/,
);

if (!match) {
  throw new Error("records payload not found");
}

const rows = JSON.parse(match[1]);

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

await mkdir("data", { recursive: true });
await writeFile("data/lounges.json", `${JSON.stringify(rows)}\n`, "utf8");
console.log(`wrote ${rows.length} rows; backfilled ${backfilledUrls} URLs`);
