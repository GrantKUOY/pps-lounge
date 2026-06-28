const STORAGE_KEY = "pps-lounge-v2-recent";
const MAX_RECENT = 5;

const defaultStorage = () => globalThis.localStorage;

export function readRecent(storage = defaultStorage()) {
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((value) => typeof value === "string").slice(0, MAX_RECENT)
      : [];
  } catch {
    return [];
  }
}

export function writeRecent(values, storage = defaultStorage()) {
  try {
    const unique = [];
    for (const value of values) {
      const normalized = String(value ?? "").trim().toUpperCase();
      if (normalized && !unique.includes(normalized)) unique.push(normalized);
      if (unique.length === MAX_RECENT) break;
    }
    storage.setItem(STORAGE_KEY, JSON.stringify(unique));
    return true;
  } catch {
    return false;
  }
}
