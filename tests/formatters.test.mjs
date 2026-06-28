import test from "node:test";
import assert from "node:assert/strict";
import {
  escapeHtml,
  formatConditions,
  formatFacility,
  formatOpeningHours,
  formatTerminal,
  safeExternalUrl,
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

test("官方連結只接受 HTTPS", () => {
  assert.equal(
    safeExternalUrl("https://www.prioritypass.com/lounges/test"),
    "https://www.prioritypass.com/lounges/test",
  );
  assert.equal(safeExternalUrl("javascript:alert(1)"), "");
  assert.equal(safeExternalUrl("http://example.com"), "");
});
