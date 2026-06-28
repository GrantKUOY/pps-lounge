import { mkdir, readFile, writeFile } from "node:fs/promises";

const source = process.argv[2];

if (!source) {
  throw new Error("usage: node scripts/extract-live-data.mjs <html>");
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

await mkdir("data", { recursive: true });
await writeFile("data/lounges.json", `${JSON.stringify(rows)}\n`, "utf8");
console.log(`wrote ${rows.length} rows`);
