import test from "node:test";
import assert from "node:assert/strict";

import {
  CACHE_URLS,
  shouldHandleNavigation,
  shouldRuntimeCache,
} from "../assets/pwa-config.js";

test("PWA 預快取只包含公開靜態資源", () => {
  assert.ok(CACHE_URLS.includes("./"));
  assert.ok(CACHE_URLS.includes("data/lounges.json"));
  assert.equal(CACHE_URLS.some((url) => url.includes("admin")), false);
  assert.equal(CACHE_URLS.some((url) => url.startsWith("api/")), false);
});

test("service worker 不處理 admin 與 API navigation", () => {
  assert.equal(shouldHandleNavigation(new URL("https://example.com/")), true);
  assert.equal(shouldHandleNavigation(new URL("https://example.com/admin.html")), false);
  assert.equal(shouldHandleNavigation(new URL("https://example.com/admin")), false);
  assert.equal(shouldHandleNavigation(new URL("https://example.com/api/admin-reports")), false);
});

test("runtime cache 不快取私密 API 與非 GET 請求", () => {
  assert.equal(
    shouldRuntimeCache(new Request("https://example.com/data/lounges.json")),
    true,
  );
  assert.equal(
    shouldRuntimeCache(new Request("https://example.com/api/reports")),
    false,
  );
  assert.equal(
    shouldRuntimeCache(new Request("https://example.com/admin.html")),
    false,
  );
  assert.equal(
    shouldRuntimeCache(new Request("https://example.com/data/lounges.json", { method: "POST" })),
    false,
  );
});
