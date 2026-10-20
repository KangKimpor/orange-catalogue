import { expect, test } from "@playwright/test";
import { installFixtures } from "./fixtures";

test("sales analysis opens from navigation, shows estimates, and filters variant details", async ({
  page,
}) => {
  const calls = await installFixtures(page);
  await page.goto("/admin");
  await page
    .getByRole("button", { name: /Sales analysis: Item performance/ })
    .click();
  await expect(page).toHaveURL(/\/admin\/sales$/);
  await expect(
    page.getByRole("heading", { name: "See what’s moving" })
  ).toBeVisible();
  await expect(page.getByText("$77.94", { exact: true }).first()).toBeVisible();
  await page.locator(".sales-table summary").click();
  await expect(page.getByText("Black · M", { exact: true })).toBeVisible();
  await page.getByLabel("Find an item", { exact: true }).fill("cream");
  await expect(page.locator(".sales-table tbody tr")).toHaveCount(1);
  await page.getByLabel("Find an item", { exact: true }).fill("unknown");
  await expect(
    page.getByText("No matching items. Try another code, color, or size.")
  ).toBeVisible();
  await page.getByLabel("Find an item", { exact: true }).fill("");
  await page.getByLabel("Import to analyse").selectOption("1");
  await expect
    .poll(() =>
      calls.some(
        call =>
          call.path === "store.admin.salesAnalysis" && call.input.importId === 1
      )
    )
    .toBe(true);
  for (const width of [320, 390, 820, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1
      )
    ).toBe(true);
    if (width === 390) await page.screenshot({ path: "test-results/sales-analysis-mobile.png", fullPage: true });
  }
  await page.screenshot({
    path: "test-results/sales-analysis-desktop.png",
    fullPage: true,
  });
});

for (const status of ["needs_imports", "missing_source"] as const) {
  test(`sales analysis explains ${status} without fabricated totals`, async ({
    page,
  }) => {
    await installFixtures(page, { salesStatus: status });
    await page.goto("/admin/sales");
    await expect(
      page.getByText(
        status === "needs_imports"
          ? "Two imports tell the story"
          : /do not have complete POS source data/
      )
    ).toBeVisible();
    await expect(page.locator(".sales-view .metric-grid")).toHaveCount(0);
  });
}

test("sales query errors retry through the refresh control", async ({
  page,
}) => {
  const errors = ["store.admin.salesAnalysis"];
  await installFixtures(page, { errors });
  await page.goto("/admin/sales");
  await expect(page.getByRole("alert")).toBeVisible();
  errors.splice(0);
  await page.getByRole("button", { name: "Refresh analysis" }).click();
  await expect(page.locator(".sales-table tbody tr")).toHaveCount(1);
});

test("visitor counts refresh while the admin remains open", async ({
  page,
}) => {
  const calls = await installFixtures(page);
  await page.clock.install();
  await page.goto("/admin");
  await expect(page.locator(".visitor-chart li")).toHaveCount(7);
  const initial = calls.filter(
    call => call.path === "store.admin.dailyVisitors"
  ).length;
  await page.clock.fastForward(5 * 60 * 1000);
  await expect
    .poll(
      () =>
        calls.filter(call => call.path === "store.admin.dailyVisitors").length
    )
    .toBeGreaterThan(initial);
  await page.screenshot({
    path: "test-results/daily-visitors.png",
    fullPage: true,
  });
});
