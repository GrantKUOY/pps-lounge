import { escapeHtml } from "./formatters.js";

// PP 計畫主表（data/plans.json）與差異提示帶。
// 設計原則（會議定案）：提示只陳述「計畫規則」本身，不對單一據點下
// 入場結論；僅參加提示的計畫（participates_in_hints）才會在詳情出現。
// 玉山 U.First 非 PP 會籍、覆蓋網絡不同，participates_in_hints=false，
// 只在計畫比較頁作對照，詳情永遠不出提示帶。

export const PLAN_STORAGE_KEY = "pps-plan";

export const ASPECT_LABELS = {
  dining: "餐飲與非貴賓室體驗",
  guests: "賓客",
  enrollment: "使用方式",
  exclusions: "注意事項",
};

export function readSelectedPlanId(storage = globalThis.localStorage) {
  try {
    return storage?.getItem(PLAN_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function writeSelectedPlanId(planId, storage = globalThis.localStorage) {
  try {
    if (planId) storage?.setItem(PLAN_STORAGE_KEY, planId);
    else storage?.removeItem(PLAN_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

let plansCache = null;

// 載入計畫主表；失敗或格式不符時回傳空陣列，不丟錯（提示屬增強功能）。
export function loadPlans(url = "data/plans.json") {
  if (!plansCache) {
    plansCache = fetch(url, { cache: "no-cache" })
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => (Array.isArray(data) ? data : []))
      .catch(() => []);
  }
  return plansCache;
}

// 回傳要在此據點詳情顯示的差異條目：
// display=detail 一律顯示；display=detail_dining 只在非 LOUNGE 據點顯示。
export function planHints(plan, loungeType) {
  if (!plan || plan.participates_in_hints !== true) return [];
  const differences = Array.isArray(plan.differences) ? plan.differences : [];
  return differences.filter(
    (diff) =>
      diff.display === "detail" ||
      (diff.display === "detail_dining" && loungeType !== "LOUNGE"),
  );
}

// 產出琥珀色提示帶 HTML；無命中條目或計畫不參加提示時回傳 null。
export function renderPlanBand(plan, loungeType, { plansUrl = "plans.html" } = {}) {
  const hints = planHints(plan, loungeType);
  if (!hints.length) return null;
  const items = hints
    .map(
      (diff) =>
        `<li><strong>${escapeHtml(ASPECT_LABELS[diff.aspect] ?? "計畫規則")}</strong>：${escapeHtml(diff.summary_zh)}</li>`,
    )
    .join("");
  const verifiedMonth = String(plan.verified_at ?? "").slice(0, 7);
  return `<aside class="plan-band" aria-label="你的 PP 計畫規則提示">
    <p class="plan-band-title">你的計畫：${escapeHtml(plan.name)}</p>
    <ul class="plan-band-list">${items}</ul>
    <p class="plan-band-note">計畫規則核對：${escapeHtml(verifiedMonth)}・以發卡行官方說明為準　<a href="${escapeHtml(plansUrl)}">看計畫比較</a></p>
  </aside>`;
}
