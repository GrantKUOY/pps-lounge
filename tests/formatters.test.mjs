import test from "node:test";
import assert from "node:assert/strict";
import {
  escapeHtml,
  formatConditions,
  formatFacility,
  formatOpeningHours,
  formatTerminal,
  safeExternalUrl,
  verifiedLabel,
} from "../assets/formatters.js";

test("HTML 特殊字元會完整跳脫", () => {
  assert.equal(
    escapeHtml('<script data-x="1">x & y</script>'),
    "&lt;script data-x=&quot;1&quot;&gt;x &amp; y&lt;/script&gt;",
  );
});

test("常見設施、航廈與營業時間轉為繁體中文", () => {
  assert.equal(formatFacility("Showers"), "淋浴間");
  assert.equal(formatTerminal("Terminal 1"), "第 1 航廈");
  assert.equal(formatOpeningHours("24 hours daily"), "每日 24 小時營業");
});

test("常見使用條件轉為繁體中文", () => {
  assert.equal(
    formatConditions(
      "Maximum 3 hour stay - Children under 2 years are admitted free",
    ),
    "最長可停留 3 小時\n2 歲以下兒童可免費入場",
  );
});

const NOW = new Date("2026-07-07T12:00:00Z");

test("verifiedLabel：近期查證顯示資料查證年月", () => {
  assert.equal(
    verifiedLabel({ last_verified: "2026-06-15" }, NOW),
    "資料查證：2026-06",
  );
});

test("verifiedLabel：查證逾 180 天加註待複核", () => {
  assert.equal(
    verifiedLabel({ last_verified: "2025-12-01" }, NOW),
    "資料查證：2025-12（待複核）",
  );
});

test("verifiedLabel：恰滿 180 天不加註待複核", () => {
  assert.equal(
    verifiedLabel({ last_verified: "2026-01-08" }, NOW),
    "資料查證：2026-01",
  );
});

test("verifiedLabel：無查證日顯示未逐筆查證", () => {
  assert.equal(
    verifiedLabel({ last_verified: null }, NOW),
    "本筆資料未逐筆查證，請以官網為準",
  );
  assert.equal(verifiedLabel({}, NOW), "本筆資料未逐筆查證，請以官網為準");
});

test("verifiedLabel：無效日期格式視為未查證", () => {
  assert.equal(
    verifiedLabel({ last_verified: "2026-02-30" }, NOW),
    "本筆資料未逐筆查證，請以官網為準",
  );
  assert.equal(
    verifiedLabel({ last_verified: "2026/06/15" }, NOW),
    "本筆資料未逐筆查證，請以官網為準",
  );
});

test("官方連結只接受 HTTPS", () => {
  assert.equal(
    safeExternalUrl("https://www.prioritypass.com/lounges/test"),
    "https://www.prioritypass.com/lounges/test",
  );
  assert.equal(safeExternalUrl("javascript:alert(1)"), "");
  assert.equal(safeExternalUrl("http://example.com"), "");
});
