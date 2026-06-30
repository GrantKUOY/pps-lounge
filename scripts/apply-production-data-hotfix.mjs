import { readFile, writeFile } from "node:fs/promises";

const htmlPath = "index.html";
const recordsPath = "pps-records.js";
const csvPath = "PPS_LOUNGE.csv";
const additionsPath = "data/manual-additions.json";
const removalsPath = "data/manual-removals.json";

const identityFields = [
  "airportCode",
  "name",
  "location",
  "openingHours",
  "conditions",
];
const identityKey = (row) =>
  identityFields.map((field) => row[field] ?? "").join("\0");

function canonicalizeTpeUrl(url) {
  if (!url) return "";
  return url
    .replace(
      "https://my.prioritypass.com/en-GB/lounges/taiwan/",
      "https://www.prioritypass.com/en-GB/lounges/taiwan-region/",
    );
}

function rowSlug(row) {
  if (!row.url) return "";
  return new URL(row.url).pathname.split("/").at(-1);
}

function addMissingRows(rows, additions) {
  const seen = new Set(rows.map(identityKey));
  for (const row of additions) {
    const key = identityKey(row);
    if (seen.has(key)) continue;
    rows.push(row);
    seen.add(key);
  }
}

function splitCsvRecords(csv) {
  const records = [];
  let start = 0;
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    if (csv[index] === '"') {
      if (inQuotes && csv[index + 1] === '"') {
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (csv[index] === "\n" && !inQuotes) {
      records.push(csv.slice(start, index + 1));
      start = index + 1;
    }
  }

  if (start < csv.length) records.push(csv.slice(start));
  return records;
}

function computeMeta(rows) {
  const typeCounts = {};
  for (const row of rows) {
    typeCounts[row.type] = (typeCounts[row.type] ?? 0) + 1;
  }
  return {
    recordCount: rows.length,
    countryCount: new Set(rows.map((row) => row.country)).size,
    cityCount: new Set(rows.map((row) => row.city)).size,
    airportCount: new Set(rows.map((row) => row.airportCode)).size,
    typeCounts,
  };
}

function csvValue(value) {
  const text = Array.isArray(value) ? value.join("\n") : String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csvRow(row) {
  const slug = new URL(row.url).pathname.split("/").at(-1);
  return [
    row.country,
    row.airportCode,
    row.type,
    row.name,
    row.location,
    row.openingHours,
    row.url,
    row.conditions,
    row.facilities,
    slug,
    row.airportName,
    row.terminal || "Unknown",
    row.city,
  ].map(csvValue).join(",");
}

const additions = JSON.parse(await readFile(additionsPath, "utf8"));
if (!Array.isArray(additions) || additions.length === 0) {
  throw new Error("manual additions must be a non-empty array");
}
const removals = JSON.parse(await readFile(removalsPath, "utf8"));
if (!Array.isArray(removals) || removals.length === 0) {
  throw new Error("manual removals must be a non-empty array");
}
const removalSlugs = new Set(removals.map((row) => row.slug));

const recordsSource = await readFile(recordsPath, "utf8");
const recordsMatch = recordsSource.match(
  /^window\.PPS_RECORDS = (\[[\s\S]*?\]);\s*window\.PPS_RECORDS_META/,
);
if (!recordsMatch) throw new Error("pps-records.js payload not found");

const originalCanonicalRows = JSON.parse(recordsMatch[1]);
const originalCanonicalByIdentity = new Map(
  originalCanonicalRows.map((row) => [identityKey(row), row]),
);
const canonicalRows = originalCanonicalRows.filter(
  (row) => !removalSlugs.has(rowSlug(row)),
);
for (const row of canonicalRows) {
  if (row.airportCode === "TPE") row.url = canonicalizeTpeUrl(row.url);
}
addMissingRows(canonicalRows, additions);

const recordsOutput =
  `window.PPS_RECORDS = ${JSON.stringify(canonicalRows)};\n` +
  `window.PPS_RECORDS_META = ${JSON.stringify(computeMeta(canonicalRows))};\n`;
await writeFile(recordsPath, recordsOutput, "utf8");

const canonicalByIdentity = new Map(
  canonicalRows.map((row) => [identityKey(row), row]),
);
const html = await readFile(htmlPath, "utf8");
const htmlMatch = html.match(
  /const records = (\[[\s\S]*?\]);\s*const topFacilities/,
);
if (!htmlMatch) throw new Error("index.html records payload not found");

const htmlRows = JSON.parse(htmlMatch[1]).filter((row) => {
  const originalCanonical = originalCanonicalByIdentity.get(identityKey(row));
  return !originalCanonical || !removalSlugs.has(rowSlug(originalCanonical));
});
for (const row of htmlRows) {
  if (row.airportCode !== "TPE") continue;
  const canonical = canonicalByIdentity.get(identityKey(row));
  if (!canonical?.url) {
    throw new Error(`TPE URL match failed for ${row.name}`);
  }
  row.url = canonical.url;
}
addMissingRows(htmlRows, additions);
await writeFile(
  htmlPath,
  html.replace(htmlMatch[1], JSON.stringify(htmlRows)),
  "utf8",
);

let csv = await readFile(csvPath, "utf8");
const removalCsvPrefixes = new Set(
  removals.map(
    (row) => `${row.country ?? "Taiwan"},${row.airportCode},${row.type},${row.name},`,
  ),
);
csv = splitCsvRecords(csv)
  .filter(
    (record) =>
      ![...removalCsvPrefixes].some((prefix) => record.startsWith(prefix)),
  )
  .join("");
csv = csv.replaceAll(
  "https://my.prioritypass.com/en-GB/lounges/taiwan/taiwan-taoyuan-international/tpe",
  "https://www.prioritypass.com/en-GB/lounges/taiwan-region/taiwan-taoyuan-international/tpe",
);
for (const row of additions) {
  if (csv.includes(`\n${row.country},${row.airportCode},${row.type},${row.name},`)) {
    continue;
  }
  csv = `${csv.trimEnd()}\n${csvRow(row)}\n`;
}
await writeFile(csvPath, csv, "utf8");

console.log(
  `updated ${canonicalRows.length} records; TPE URLs=${canonicalRows.filter((row) => row.airportCode === "TPE").length}; additions=${additions.length}; removals=${removals.length}`,
);
