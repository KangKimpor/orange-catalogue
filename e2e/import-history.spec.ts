import { expect, test, type Page } from "@playwright/test";
import { installFixtures } from "./fixtures";

async function contained(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  ).toBeLessThanOrEqual(1);
}
test("category bar is black and footer links retain the requested text and decoration", async ({
  page,
}) => {
  await installFixtures(page, { count: 1 });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Just In", exact: true })
  ).toHaveCSS("border-bottom-color", "rgb(0, 0, 0)");
  await expect(page.getByRole("button", { name: "Just In", exact: true })).toHaveCSS("border-bottom-width", "1px");
  const footer = page.locator(".store-footer");
  const admin = footer.getByRole("link", { name: "Admin", exact: true });
  await expect(admin).toHaveAttribute("href", "/admin");
  await expect(admin).toHaveCSS("text-decoration-line", "none");
  const order = footer.getByRole("link", {
    name: "Message us to order",
    exact: true,
  });
  await expect(order).toHaveAttribute("href", "https://m.me/OfficiallyDavit");
  await expect(footer).not.toContainText("Messenger");
});
for (const width of [320, 390, 820, 1440]) {
  test(`restore confirmation fits ${width}px, requires PIN, and moves the current marker`, async ({
    page,
  }) => {
    const calls = await installFixtures(page, { historyCount: 3 });
    await page.setViewportSize({ width, height: width > 600 ? 900 : 844 });
    await page.goto("/admin/import");
    const rows = page.locator(".import-history-list button");
    await rows.first().click();
    await expect(
      page.getByText("Current import", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Restore this import", exact: true })
    ).toHaveCount(0);
    await rows.nth(1).click();
    const restore = page.getByRole("button", {
      name: "Restore this import",
      exact: true,
    });
    await restore.click();
    const pin = page.getByLabel("Admin PIN", { exact: true });
    await expect(pin).toBeFocused();
    const confirm = page.getByRole("button", {
      name: "Confirm restore",
      exact: true,
    });
    await expect(confirm).toBeDisabled();
    expect(calls.some(call => call.path === "store.admin.restoreImport")).toBe(
      false
    );
    await contained(page);
    if (width < 600) await expect(pin).toHaveCSS("font-size", "16px");
    await pin.fill("wrong");
    await confirm.click();
    await expect(page.getByRole("alert")).toContainText(
      "Admin PIN is incorrect"
    );
    await expect(pin).toHaveValue("");
    await expect(pin).toBeFocused();
    await pin.fill("test");
    await confirm.click();
    await expect(page.getByText(/Import restored\. 36 POS/)).toBeVisible();
    await expect(
      page.getByText("Current import", { exact: true })
    ).toBeVisible();
    await expect(restore).toHaveCount(0);
    await expect(rows).toHaveCount(3);
    await expect(page.locator(".import-history-detail h3")).toBeFocused();
    await contained(page);
    await rows.first().click();
    await expect(
      page.getByRole("button", { name: "Restore this import", exact: true })
    ).toBeEnabled();
  });
}
test("deletion requires PIN, supports cancel, and refreshes retained history", async ({
  page,
}) => {
  const calls = await installFixtures(page, { historyCount: 2 });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/import");
  await page.locator(".import-history-list button").first().click();
  const remove = page.getByRole("button", {
    name: "Delete this import",
    exact: true,
  });
  await remove.click();
  await expect(
    page.getByRole("button", { name: "Confirm delete", exact: true })
  ).toBeDisabled();
  await page.getByLabel("Admin PIN", { exact: true }).fill("test");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(calls.some(call => call.path === "store.admin.removeImport")).toBe(
    false
  );
  await expect(remove).toBeFocused();
  await remove.click();
  const pin = page.getByLabel("Admin PIN", { exact: true });
  await expect(pin).toHaveValue("");
  await pin.fill("wrong");
  await page
    .getByRole("button", { name: "Confirm delete", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Admin PIN is incorrect");
  await expect(page.locator(".import-history-list button")).toHaveCount(2);
  await pin.fill("test");
  await page
    .getByRole("button", { name: "Confirm delete", exact: true })
    .click();
  await expect(
    page.getByText(/POS dataset deleted\. Rebuilt from 1/)
  ).toBeVisible();
  await expect(page.locator(".import-history-list button")).toHaveCount(1);
  await expect(page.locator("#import-history-heading")).toBeFocused();
  await contained(page);
});
test("restores lock competing actions while pending and expose server errors for retry", async ({
  page,
}) => {
  const errors: string[] = ["store.admin.restoreImport"];
  await installFixtures(page, { historyCount: 2, delay: 500, errors });
  await page.goto("/admin/import");
  await page.locator(".import-history-list button").nth(1).click();
  await page
    .getByRole("button", { name: "Restore this import", exact: true })
    .click();
  const pin = page.getByLabel("Admin PIN", { exact: true });
  await pin.fill("test");
  await page
    .getByRole("button", { name: "Confirm restore", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Restoring…", exact: true })
  ).toBeDisabled();
  await expect(
    page.locator(".import-history-list button").first()
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Delete this import", exact: true })
  ).toBeDisabled();
  await expect(page.locator(".import-file input")).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText(
    "temporarily unavailable"
  );
  errors.splice(0);
  await pin.fill("test");
  await page
    .getByRole("button", { name: "Confirm restore", exact: true })
    .click();
  await expect(page.getByText(/Import restored\./)).toBeVisible();
});
test("history stays usable while database restore setup is unavailable", async ({
  page,
}) => {
  await installFixtures(page, { historyCount: 2, restoreUnavailable: true });
  await page.goto("/admin/import");
  await page.locator(".import-history-list button").nth(1).click();
  await expect(
    page.getByRole("button", { name: "Restore this import", exact: true })
  ).toBeDisabled();
  await expect(
    page.getByText(
      "Restoring or deleting imports needs the import-history database update.",
      { exact: true }
    )
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Delete this import", exact: true })
  ).toHaveCount(0);
});
test("daily analytics display the reporting date without snapshot language", async ({
  page,
}) => {
  await installFixtures(page);
  await page.goto("/admin");
  const panel = page.getByRole("region", {
    name: "Daily Vercel Analytics storefront visitors",
  });
  await expect(panel).toContainText("Updated daily");
  await expect(panel).toContainText("today is in progress");
  await expect(panel.locator("strong")).toHaveText(["23", "15", "13"]);
  await expect(panel.locator(".visitor-chart li")).toHaveCount(7);
  await expect(panel).not.toContainText("Snapshot");
  for (const width of [320, 390, 820, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await contained(page);
  }
});
test("missing analytics configuration is honest about unavailable counts", async ({
  page,
}) => {
  await installFixtures(page, { analyticsConfigured: false });
  await page.goto("/admin");
  const panel = page.getByRole("region", {
    name: "Daily Vercel Analytics storefront visitors",
  });
  await expect(panel).toContainText(
    "needs a server-side Vercel Analytics connection"
  );
  await expect(panel.locator("strong")).toHaveCount(0);
});
test("analytics errors can retry without showing stale snapshot counts", async ({
  page,
}) => {
  const errors = ["store.admin.dailyVisitors"];
  await installFixtures(page, { errors });
  await page.goto("/admin");
  const panel = page.getByRole("region", {
    name: "Daily Vercel Analytics storefront visitors",
  });
  await expect(panel.getByRole("alert")).toBeVisible();
  errors.splice(0);
  await panel
    .getByRole("button", { name: "Refresh visitors", exact: true })
    .click();
  await expect(panel.locator("strong").first()).toHaveText("23");
});
