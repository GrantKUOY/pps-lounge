export const normalize = (value) =>
  String(value ?? "").normalize("NFKC").trim().toLocaleLowerCase();

const asiaCountries = new Set([
  "Armenia", "Azerbaijan", "Bahrain", "Bangladesh", "Brunei Darussalam",
  "Cambodia", "China", "Georgia", "Hong Kong", "India", "Indonesia",
  "Israel", "Japan", "Jordan", "Kazakhstan", "Korea", "Kuwait",
  "Laos", "Lebanon", "Macau", "Malaysia", "Maldives", "Mongolia",
  "Myanmar", "Nepal", "Oman", "Pakistan", "Philippines", "Qatar",
  "Saudi Arabia", "Singapore", "Sri Lanka", "Taiwan", "Thailand",
  "Turkey", "United Arab Emirates", "Uzbekistan", "Vietnam",
]);

const europeCountries = new Set([
  "Albania", "Austria", "Belgium", "Bosnia and Herzegovina", "Bulgaria",
  "Croatia", "Cyprus", "Czech Republic", "Denmark", "Estonia", "Finland",
  "France", "Germany", "Greece", "Hungary", "Iceland", "Ireland", "Italy",
  "Latvia", "Lithuania", "Luxembourg", "Malta", "Montenegro",
  "Netherlands", "Norway", "Poland", "Portugal", "Romania", "Serbia",
  "Slovakia", "Slovenia", "Spain", "Sweden", "Switzerland",
  "United Kingdom",
]);

export function regionForRecord(row) {
  if (row.region) return row.region;
  if (row.isAsia === true || asiaCountries.has(row.country)) return "asia";
  if (row.isEurope === true || europeCountries.has(row.country)) return "europe";
  return "";
}

export function createSearchIndex(rows) {
  return rows.map((row, index) => ({
    ...row,
    region: regionForRecord(row),
    _searchOrder: index,
    _searchCode: normalize(row.airportCode),
    _searchText: normalize(
      [
        row.airportCode,
        row.airportName,
        row.city,
        row.country,
        row.name,
        row.location,
        row.terminal,
        row.typeLabel,
        row.searchText,
        ...(row.facilities ?? []),
      ].join(" "),
    ),
  }));
}

export function searchRecords(rows, query) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [...rows];
  if (/^[a-z0-9]{3}$/.test(normalizedQuery)) {
    const exactAirport = rows.filter(
      (row) => row._searchCode === normalizedQuery,
    );
    if (exactAirport.length) return exactAirport;
  }

  return rows
    .map((row) => {
      let rank = Number.POSITIVE_INFINITY;
      if (row._searchCode === normalizedQuery) rank = 0;
      else if (row._searchCode.startsWith(normalizedQuery)) rank = 1;
      else if (row._searchText.includes(normalizedQuery)) rank = 2;
      return { row, rank };
    })
    .filter(({ rank }) => Number.isFinite(rank))
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        a.row.airportCode.localeCompare(b.row.airportCode, "en") ||
        a.row._searchOrder - b.row._searchOrder,
    )
    .map(({ row }) => row);
}

export function filterRecords(rows, filters = {}) {
  return rows.filter(
    (row) =>
      (!filters.region || row.region === filters.region || (
        filters.region === "asia" && row.isAsia === true
      ) || (
        filters.region === "europe" && row.isEurope === true
      )) &&
      (!filters.country || row.country === filters.country) &&
      (!filters.city || row.city === filters.city) &&
      (!filters.type || row.type === filters.type) &&
      (!filters.facility || row.facilities.includes(filters.facility)),
  );
}

export function sortRecords(rows, sort = "relevance") {
  if (sort === "relevance") return [...rows];

  const selectors = {
    airportCode: (row) => row.airportCode,
    city: (row) => `${row.country} ${row.city} ${row.airportCode}`,
    country: (row) => `${row.country} ${row.city} ${row.airportCode}`,
    name: (row) => row.name,
  };
  const select = selectors[sort] ?? selectors.airportCode;

  return [...rows].sort((a, b) =>
    normalize(select(a)).localeCompare(normalize(select(b)), "en", {
      sensitivity: "base",
    }),
  );
}

export function paginate(rows, page = 1, pageSize = 24) {
  const safePageSize = Math.max(1, Number(pageSize) || 24);
  const totalItems = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);
  const startIndex = (safePage - 1) * safePageSize;
  const endIndex = Math.min(startIndex + safePageSize, totalItems);

  return {
    page: safePage,
    pageSize: safePageSize,
    totalPages,
    totalItems,
    start: totalItems ? startIndex + 1 : 0,
    end: endIndex,
    rows: rows.slice(startIndex, endIndex),
  };
}
