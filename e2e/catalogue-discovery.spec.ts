import { expect, test } from "@playwright/test";
import { installFixtures, product } from "./fixtures";

test("search and variant filters persist through detail navigation and reset cleanly", async ({ page }) => {
  await installFixtures(page, { count: 4 });
  await page.goto("/?category=all");
  await page.getByLabel("Search pieces").fill("ZL 0041");
  await expect(page.locator(".product-card:not(.product-card-skeleton)")).toHaveCount(1);
  await page.getByText("Filters & sorting", { exact: false }).click();
  await page.getByRole("combobox", { name: "Size", exact: true }).selectOption("L");
  await page.getByLabel("In stock only").check();
  await expect(page.getByText("No pieces match.", { exact: false })).toBeVisible();
  await page.getByRole("combobox", { name: "Size", exact: true }).selectOption("M");
  await page.getByRole("combobox", { name: "Color", exact: true }).selectOption("Black");
  await page.getByLabel("Maximum price ($)", { exact: true }).fill("15");
  await expect(page.locator(".product-card:not(.product-card-skeleton)")).toHaveCount(0);
  await page.getByLabel("Maximum price ($)", { exact: true }).fill("20");
  await page.locator(".product-card-link").click();
  await expect(page.locator(".detail-content")).toBeVisible();
  await page.getByRole("link", { name: "Back to shop" }).click();
  await expect(page.getByLabel("Search pieces")).toHaveValue("ZL 0041");
  await page.reload();
  await expect(page.getByLabel("Search pieces")).toHaveValue("ZL 0041");
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.locator(".product-card:not(.product-card-skeleton)")).toHaveCount(4);
});

test("favorites can be saved, reloaded, opened and removed without creating an account", async ({ page }) => {
  await installFixtures(page, { count: 3 });
  await page.goto("/?category=tops&size=S");
  await page.getByRole("button", { name: `Save ${product.displayName} to favorites`, exact: true }).click();
  await page.getByRole("link", { name: "Favorites (1)", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your favorites" })).toBeVisible();
  await expect(page.getByRole("button", { name: "All pieces", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page).not.toHaveURL(/size=/);
  await expect(page.locator(".product-card:not(.product-card-skeleton)")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".product-card:not(.product-card-skeleton)")).toHaveCount(1);
  await page.locator(".product-card-link").click();
  await page.getByRole("button", { name: `Remove ${product.displayName} from favorites` }).click();
  await page.getByRole("link", { name: "Favorites", exact: true }).click();
  await expect(page.getByText("No favorites yet.", { exact: false })).toBeVisible();
});

test("corrupt or blocked device storage does not break browsing or saving for this visit", async ({ page }) => {
  await installFixtures(page, { count: 1 });
  await page.addInitScript(() => {
    localStorage.setItem("orange-favorites-v1", "{invalid");
    Storage.prototype.setItem = () => { throw new Error("Storage is blocked"); };
  });
  await page.goto("/");
  await page.getByRole("button", { name: `Save ${product.displayName} to favorites`, exact: true }).click();
  await expect(page.getByText("Your browser couldn’t save favorites.", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: "Favorites (1)", exact: true }).click();
  await expect(page.locator(".product-card:not(.product-card-skeleton)")).toHaveCount(1);
});

test("a sold-out option can be requested and handled privately in the admin queue", async ({ page }) => {
  const calls = await installFixtures(page, { admin: true, count: 1 });
  await page.goto("/product/fixture-piece");
  await page.getByRole("button", { name: "L Sold Out", exact: true }).click();
  await page.getByText("Request a restock update", { exact: true }).click();
  await page.getByLabel("Contact me by").selectOption("email");
  await page.getByLabel("Email address", { exact: true }).fill("customer@example.com");
  await expect(page.getByRole("button", { name: "Save restock request" })).toBeDisabled();
  await page.getByLabel("I agree to be contacted about this option.").check();
  await page.getByRole("button", { name: "Save restock request" }).click();
  await expect(page.getByText("Request saved for Black, size L.", { exact: false })).toBeVisible();
  expect(calls.find(call => call.path === "store.requestRestock")?.input).toMatchObject({ variantId: 102, contactType: "email", contact: "customer@example.com", consent: true });
  // A different option must have its own form and success state.
  await page.getByRole("button", { name: "M", exact: true }).click();
  await expect(page.getByText("Request a restock update", { exact: true })).toHaveCount(0);
  await page.goto("/admin/restock");
  await expect(page.getByRole("link", { name: "customer@example.com" })).toBeVisible();
  await page.getByRole("button", { name: "Mark contacted" }).click();
  await expect(page.getByText("No pending restock requests.")).toBeVisible();
  await page.getByLabel("Show requests").selectOption("contacted");
  await expect(page.getByRole("link", { name: "customer@example.com" })).toBeVisible();
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Delete request" }).click();
  await expect(page.getByText("No contacted restock requests.")).toBeVisible();
});

test("restock failures retain the contact information for retry", async ({ page }) => {
  await installFixtures(page, { count: 1, errors: ["store.requestRestock"] });
  await page.goto("/product/fixture-piece");
  await page.getByRole("button", { name: "L Sold Out", exact: true }).click();
  await page.getByText("Request a restock update", { exact: true }).click();
  await page.getByLabel("Phone number (include country code)").fill("+85512345678");
  await page.getByLabel("I agree to be contacted about this option.").check();
  await page.getByRole("button", { name: "Save restock request" }).click();
  await expect(page.locator(".restock-form [role=alert]")).toBeVisible();
  await expect(page.getByLabel("Phone number (include country code)")).toHaveValue("+85512345678");
});

test("expanded filters, restock forms and populated admin requests fit phone and desktop widths", async ({ page }, info) => {
  await installFixtures(page, { admin: true, count: 1 });
  const checkWidths = async (name: string) => {
    for (const width of [320, 390, 820, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
      if (width === 390) await page.screenshot({ path: info.outputPath(`${name}-phone.png`), fullPage: true });
    }
  };
  await page.goto("/");
  await page.getByText("Filters & sorting", { exact: false }).click();
  await checkWidths("filters");
  await page.goto("/product/fixture-piece");
  await page.getByRole("button", { name: "L Sold Out", exact: true }).click();
  await page.getByText("Request a restock update", { exact: true }).click();
  await checkWidths("restock-form");
  await page.getByLabel("Contact me by").selectOption("email");
  await page.getByLabel("Email address", { exact: true }).fill(`customer.${"long".repeat(10)}@example.com`);
  await page.getByLabel("I agree to be contacted about this option.").check();
  await page.getByRole("button", { name: "Save restock request" }).click();
  await expect(page.getByText("Request saved for Black, size L.", { exact: false })).toBeVisible();
  await page.goto("/admin/restock");
  await expect(page.locator(".restock-request-card")).toHaveCount(1);
  await checkWidths("restock-admin");
});
