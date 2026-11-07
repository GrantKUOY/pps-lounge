// conditions 短摘（節錄）產生邏輯：wave2 資料面收斂的單一真相來源。
//
// 公開資料（data/lounges.json 與其產生頁）只保留此短摘，不再包含
// conditions 英文全文；全文母本保留於 .baseline 正式站快照與
// vault 的 PPS_LOUNGE.csv，不進公開 repo 的資料檔。
//
// 規則：以 " - " 切段（與 assets/formatters.js 的 formatConditions 同），
// 由第一段起依序納入，直到再加一段會使總長超過上限（200 字元，含
// 連接符 " - " 的 3 字元）為止；至少納入第一段，第一段本身超限時
// 硬截至上限。回傳以 " - " 連接的字串（形狀與原 conditions 一致，
// 消費者可沿用 formatConditions 再切段顯示）；無有效內容時回傳 null。
// 純函式：不讀寫任何狀態，同輸入同輸出。

export const CONDITIONS_EXCERPT_LIMIT = 200;
const SEGMENT_SEPARATOR = " - ";

export function conditionsExcerpt(conditions) {
  if (typeof conditions !== "string") return null;
  const segments = conditions
    .split(/\s+-\s+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (!segments.length) return null;

  const first = segments[0];
  if (first.length > CONDITIONS_EXCERPT_LIMIT) {
    return first.slice(0, CONDITIONS_EXCERPT_LIMIT);
  }

  const picked = [first];
  let total = first.length;
  for (const segment of segments.slice(1)) {
    const nextTotal = total + SEGMENT_SEPARATOR.length + segment.length;
    if (nextTotal > CONDITIONS_EXCERPT_LIMIT) break;
    picked.push(segment);
    total = nextTotal;
  }
  return picked.join(SEGMENT_SEPARATOR);
}
