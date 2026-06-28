import { test, expect } from "@playwright/test";

const viewports = [
  { name: "mobile-320", width: 320, height: 720 },
  { name: "mobile-375", width: 375, height: 812 },
  { name: "tablet-768", width: 768, height: 900 },
  { name: "desktop-1024", width: 1024, height: 900 },
];

test("TPE 搜尋、進階篩選與詳情流程", async ({ page }) => {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/");
  await expect(page.getByLabel("搜尋機場")).toBeEnabled();
  await page.getByLabel("搜尋機場").fill("TPE");
  await expect(page.locator("#results")).toContainText("TPE");

  await page.getByRole("button", { name: "進階篩選" }).click();
  await expect(page.locator("#filters")).toBeVisible();
  await page.getByLabel("設施").selectOption("Showers");
  await page.getByRole("button", { name: "套用篩選" }).click();
  await expect(page.locator("#results")).toContainText("淋浴");

  await page.locator(".result-card").first().getByRole("button", {
    name: "查看詳情",
  }).click();
  await expect(page.locator("#detail")).toBeVisible();
  await expect(page.locator("#detail")).toContainText("原始英文");
  expect(errors).toEqual([]);
});

test("無結果時提供清除操作", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("搜尋機場").fill("ZZZZ-NOT-FOUND");
  await expect(page.locator("#empty-state")).toBeVisible();
  await page.locator("#empty-state").getByRole("button", {
    name: "清除篩選",
  }).click();
  await expect(page.locator(".result-card").first()).toBeVisible();
});

test("資料載入失敗時提供重試操作", async ({ page }) => {
  await page.route("**/data/lounges.json", (route) =>
    route.fulfill({ status: 503, body: "unavailable" }),
  );
  await page.goto("/");
  await expect(page.locator("#error-state")).toBeVisible();
  await expect(page.getByRole("button", { name: "重新載入資料" })).toBeVisible();
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
