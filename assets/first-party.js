// 第一方實測接線：比對 data/first-party.json 的對照條目與資料列。
// 比對規則：airportCode 相同（不分大小寫），且 name 包含 nameMatch 關鍵字
// （不分大小寫子字串）。命中回傳該條目，未命中或輸入不完整回傳 null。
export function matchFirstParty(row, entries) {
  if (!row || !Array.isArray(entries)) return null;
  const code = String(row.airportCode ?? "").trim().toUpperCase();
  const name = String(row.name ?? "").toLowerCase();
  if (!code || !name) return null;
  return (
    entries.find((entry) => {
      const entryCode = String(entry?.airportCode ?? "").trim().toUpperCase();
      const keyword = String(entry?.nameMatch ?? "").trim().toLowerCase();
      return (
        entryCode !== "" &&
        keyword !== "" &&
        entryCode === code &&
        name.includes(keyword)
      );
    }) ?? null
  );
}
