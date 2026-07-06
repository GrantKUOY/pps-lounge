import { test, expect } from "@playwright/test";

const viewports = [
  { name: "mobile-320", width: 320, height: 720 },
  { name: "mobile-375", width: 375, height: 812 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "tablet-768", width: 768, height: 900 },
  { name: "desktop-1024", width: 1024, height: 900 },
];

test("首頁使用 PPS Journal 搜尋優先外殼", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("PPS Journal", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", {
    name: "下一段旅程，從機場開始。",
  })).toBeVisible();
  await expect(page.getByLabel("搜尋機場")).toBeVisible();
  await expect(
    page.locator(".brand-mark, .beta, .results-section"),
  ).toHaveCount(0);
  const all = page.getByRole("button", { name: "全部" });
  const lounge = page.getByRole("button", { name: "貴賓室" });
  await expect(all).toHaveAttribute("aria-pressed", "true");
  await expect(lounge).toHaveAttribute("aria-pressed", "false");
  await lounge.click();
  await expect(lounge).toHaveAttribute("aria-pressed", "true");
  await expect(all).toHaveAttribute("aria-pressed", "false");

  await page.getByRole("button", { name: "進階篩選" }).click();
  await expect(page.getByLabel("據點類型")).toHaveValue("LOUNGE");
  await page.getByRole("button", { name: "套用篩選" }).click();
  await expect(lounge).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "進階篩選" }).click();
  await page.getByLabel("據點類型").selectOption("EAT");
  await page.getByRole("button", { name: "套用篩選" }).click();
  await expect(page.getByRole("button", { name: "餐飲" }))
    .toHaveAttribute("aria-pressed", "true");
  await expect(lounge).toHaveAttribute("aria-pressed", "false");
});

test("TPE 顯示 6 筆編輯式結果並可套用篩選", async ({ page }) => {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/");
  await page.getByLabel("搜尋機場").fill("TPE");
  await expect(page.locator("#overview-code")).toHaveText("TPE");
  await expect(page.locator("#overview-meta")).toContainText("6 個據點");
  await expect(page.locator(".result-row")).toHaveCount(6);
  await expect(page.locator(".result-card, .meta-box, .type-badge")).toHaveCount(0);

  await page.getByRole("button", { name: "餐飲" }).click();
  await expect(page.locator(".result-row")).toHaveCount(2);
  await expect(page.locator(".result-row").first()).toContainText("餐飲");

  await page.getByRole("button", { name: "全部" }).click();
  await page.getByRole("button", { name: "進階篩選" }).click();
  await page.getByLabel("設施").selectOption("Showers");
  await page.getByRole("button", { name: "套用篩選" }).click();
  await expect(page.locator("#results")).toContainText("淋浴");
  expect(errors).toEqual([]);
});

test("詳情採資料列、使用現行官方網址並回復焦點", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("搜尋機場").fill("TPE");
  const trigger = page.locator(".result-row").filter({
    hasText: "Oriental Club Lounge",
  }).getByRole("button", { name: "查看詳情" });
  await trigger.click();

  const detail = page.getByRole("dialog", {
    name: "Oriental Club Lounge 詳情",
  });
  await expect(detail).toBeVisible();
  await expect(page.getByRole("button", {
    name: "返回 TPE 的搜尋結果",
  })).toBeFocused();
  await expect(page.locator(".detail-fact")).toHaveCount(4);
  await expect(page.locator(".detail-section, .meta-box")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "開啟 Priority Pass 官方頁面" }),
  ).toHaveAttribute(
    "href",
    "https://www.prioritypass.com/en-GB/lounges/taiwan-region/taiwan-taoyuan-international/tpe9-oriental-club-lounge",
  );

  await page.getByRole("button", { name: "返回 TPE 的搜尋結果" }).click();
  await expect(detail).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await page.getByRole("button", { name: "關閉詳情" }).click();
  await expect(detail).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(detail).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("關閉進階篩選不套用草稿並還原控制值", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("搜尋機場").fill("TPE");
  await page.getByRole("button", { name: "貴賓室" }).click();
  await expect(page.locator(".result-row")).toHaveCount(4);

  await page.getByRole("button", { name: "進階篩選" }).click();
  const filters = page.getByRole("dialog", { name: "進階篩選" });
  await expect(filters).toBeVisible();
  await page.getByLabel("據點類型").selectOption("EAT");
  await page.getByRole("button", { name: "關閉篩選" }).click();

  await expect(filters).toBeHidden();
  await expect(page.locator(".result-row")).toHaveCount(4);
  await expect(page.getByRole("button", { name: "貴賓室" }))
    .toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "進階篩選" }).click();
  await expect(page.getByLabel("據點類型")).toHaveValue("LOUNGE");
});

test("無結果時提供清除操作", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("搜尋機場").fill("ZZZZ-NOT-FOUND");
  await expect(page.locator("#empty-state")).toBeVisible();
  await page.locator("#empty-state").getByRole("button", {
    name: "清除篩選",
  }).click();
  await expect(page.locator(".result-row").first()).toBeVisible();
});

test("分頁切換不產生執行期錯誤", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/");
  await expect(page.locator(".result-row").first()).toBeVisible();
  await page.getByRole("button", { name: "下一頁" }).click();
  await expect(page.locator("#page-info")).toHaveText(/第 2 \//);
  expect(errors).toEqual([]);
});

test("資料載入失敗時提供重試操作", async ({ page }) => {
  await page.route("**/data/lounges.json", (route) =>
    route.fulfill({ status: 503, body: "unavailable" }),
  );
  await page.goto("/");
  await expect(page.locator("#error-state")).toBeVisible();
  await expect(page.getByRole("button", { name: "重新載入資料" })).toBeVisible();
});

test("手機主要互動元件高度至少 44px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await expect(page.getByLabel("搜尋機場")).toBeEnabled();
  const undersized = await page.locator("button:visible, input:visible, select:visible").evaluateAll(
    (elements) =>
      elements
        .map((element) => ({
          label:
            element.getAttribute("aria-label") ||
            element.textContent?.trim() ||
            element.id,
          height: element.getBoundingClientRect().height,
        }))
        .filter(({ height }) => height < 44),
  );
  expect(undersized).toEqual([]);
});

test("鍵盤可完成搜尋並開關進階篩選", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("搜尋機場").focus();
  await page.keyboard.type("TPE");
  await page.keyboard.press("Enter");
  await expect(page.locator("#overview-code")).toHaveText("TPE");
  await page.getByRole("button", { name: "進階篩選" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#filters")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#filters")).toBeHidden();
});

test("reduced-motion 啟用時分頁不使用平滑捲動", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    window.__scrollBehaviors = [];
    Element.prototype.scrollIntoView = function scrollIntoView(options) {
      window.__scrollBehaviors.push(options?.behavior ?? null);
    };
  });

  await page.goto("/");
  await expect(page.getByRole("button", { name: "下一頁" })).toBeEnabled();
  await page.getByRole("button", { name: "下一頁" }).click();

  await expect.poll(() => page.evaluate(() => window.__scrollBehaviors)).toEqual([
    "auto",
  ]);
});

test("390px 搜尋後首屏可見第一筆結果", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByLabel("搜尋機場").fill("TPE");
  await page.getByText("Oriental Club Lounge").waitFor({ state: "visible" });
  const box = await page
    .locator(".result-row", { hasText: "Oriental Club Lounge" })
    .boundingBox();
  expect(box).not.toBeNull();
  expect(box.y).toBeLessThan(844);
});

test("6 倍 CPU 降速快速輸入只渲染一次且 250ms 內可見", async ({
  page,
  context,
}) => {
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByLabel("搜尋機場")).toBeEnabled();

  const result = await page.evaluate(async () => {
    const input = document.querySelector("#search");
    const results = document.querySelector("#results");
    let mutations = 0;
    const observer = new MutationObserver(() => { mutations += 1; });
    observer.observe(results, { childList: true });
    let lastInputAt = 0;

    for (const [index, value] of ["T", "TP", "TPE"].entries()) {
      input.value = value;
      if (index === 2) lastInputAt = performance.now();
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 40));
    }

    while (!results.textContent.includes("Oriental Club Lounge")) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      if (performance.now() - lastInputAt > 1000) break;
    }
    observer.disconnect();
    return { elapsed: performance.now() - lastInputAt, mutations };
  });

  expect(result.mutations).toBe(1);
  expect(result.elapsed).toBeLessThan(250);
});

for (const viewport of viewports) {
  test(`${viewport.name} 無水平溢出`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByLabel("搜尋機場")).toBeEnabled();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
  });
}
