// 貴賓室頁 slug 產生規則（W4 深連結產生器與 tests/pages.test.mjs 共用）。
//
// 規則：
//   base = {機場代碼小寫}-{name slug}
//   name slug：小寫、非 [a-z0-9] 字元一律轉連字號、修剪頭尾連字號。
//   base 超過 60 字元，或發生碰撞時，附加 djb2(name + location) 的
//   6 碼十六進位後綴（base 先截斷至放得下後綴）；碰撞仍未解時依序
//   加入 terminal、url、openingHours、conditions_excerpt 重新雜湊，
//   最後手段為序號後綴。同一份資料重跑必定產生完全相同的結果。
//   註：條件欄位原為 conditions 全文，wave2 資料面移除後改用短摘
//   conditions_excerpt；實測全 1,754 筆無一走到 level 3，改用短摘
//   不改變任何既有 slug。

export const MAX_SLUG_LENGTH = 60;
const HASH_LENGTH = 6;

export function djb2Hex(value) {
  let hash = 5381;
  const text = String(value ?? "");
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0").slice(0, HASH_LENGTH);
}

export function slugifyName(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function baseLoungeSlug(row) {
  const code = String(row?.airportCode ?? "").toLowerCase();
  const name = slugifyName(row?.name);
  return name ? `${code}-${name}` : code;
}

function hashInput(row, level) {
  const parts = [row?.name ?? "", row?.location ?? ""];
  if (level >= 1) parts.push(row?.terminal ?? "");
  if (level >= 2) parts.push(row?.url ?? "");
  if (level >= 3) parts.push(row?.openingHours ?? "", row?.conditions_excerpt ?? "");
  return parts.join("|");
}

function appendHash(base, row, level) {
  const hash = djb2Hex(hashInput(row, level));
  const room = MAX_SLUG_LENGTH - HASH_LENGTH - 1;
  const trimmed = base.slice(0, room).replace(/-+$/g, "");
  return `${trimmed}-${hash}`;
}

function duplicateIndexes(slugs) {
  const counts = new Map();
  for (const slug of slugs) counts.set(slug, (counts.get(slug) ?? 0) + 1);
  const dup = new Set();
  slugs.forEach((slug, index) => {
    if (counts.get(slug) > 1) dup.add(index);
  });
  return dup;
}

// 回傳與 rows 同序的 slug 陣列，保證全域唯一且穩定。
export function buildLoungeSlugs(rows) {
  const bases = rows.map((row) => baseLoungeSlug(row));
  const slugs = bases.map((base, index) =>
    base.length > MAX_SLUG_LENGTH ? appendHash(base, rows[index], 0) : base,
  );

  for (let level = 0; level <= 3; level += 1) {
    const dup = duplicateIndexes(slugs);
    if (!dup.size) break;
    for (const index of dup) {
      slugs[index] = appendHash(bases[index], rows[index], level);
    }
  }

  // 最後手段：序號後綴（僅在資料幾乎完全重複時才會用到）。
  const seen = new Map();
  return slugs.map((slug, index) => {
    const count = (seen.get(slug) ?? 0) + 1;
    seen.set(slug, count);
    if (count === 1) return slug;
    let candidate = `${slug}-${count}`;
    while (seen.has(candidate)) candidate = `${candidate}-x${index}`;
    seen.set(candidate, 1);
    return candidate;
  });
}
