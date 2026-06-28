export const CSV_HEADERS = [
  "country",
  "city",
  "airportCode",
  "airportName",
  "type",
  "typeLabel",
  "name",
  "location",
  "openingHours",
  "conditions",
  "facilities",
  "url",
];

const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export function toCsv(rows) {
  if (!rows.length) throw new Error("no rows to export");
  const body = rows.map((row) =>
    CSV_HEADERS.map((key) =>
      quote(key === "facilities" ? row.facilities.join(" | ") : row[key]),
    ).join(","),
  );
  return [CSV_HEADERS.join(","), ...body].join("\r\n");
}

export function downloadCsv(rows, filename = "pps_lounge_filtered.csv") {
  const blob = new Blob([toCsv(rows)], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
