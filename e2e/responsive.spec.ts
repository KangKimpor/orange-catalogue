import { expect, test, type Locator, type Page } from "@playwright/test";
import { installFixtures, product } from "./fixtures";

// CSS viewports, not claims about physical display pixels or device model variants.
const viewports = [
  [320, 780],
  [360, 780],
  [375, 812],
  [390, 844],
  [393, 852],
  [402, 874],
  [414, 896],
  [420, 912],
  [430, 932],
  [440, 956],
  [393, 659],
  [402, 714],
  [440, 796],
  [780, 360],
  [844, 390],
  [956, 440],
  [734, 343],
  [500, 800],
  [600, 900],
  [720, 1024],
  [744, 1133],
  [768, 1024],
  [810, 1080],
  [820, 1180],
  [834, 1194],
  [834, 1210],
  [1024, 1366],
  [1032, 1376],
  [1133, 744],
  [1024, 768],
  [1080, 810],
  [1180, 820],
  [1194, 834],
  [1210, 834],
  [1366, 1024],
  [1376, 1032],
  [1280, 800],
  [1366, 768],
  [1440, 900],
  [1536, 960],
  [1920, 1080],
  [2560, 1440],
  [1440, 500],
  ...[
    359, 360, 361, 539, 540, 541, 639, 640, 641, 719, 720, 721, 819, 820, 821,
    849, 850, 851, 959, 960, 961, 1023, 1024, 1025, 1049, 1050, 1051, 1119,
    1120, 1121, 1199, 1200, 1201,
  ].map(width => [width, 900]),
];

async function settle(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );
}
async function contained(page: Page) {
  const result = await page.evaluate(() => {
    const width = window.innerWidth;
    const selectors =
      ".back-link,.detail-content button,.message-button,.model-search,.model-editor,.model-results > button,.admin-topbar,.admin-rail nav button,.security-card,.security-card input,.login-card,.login-card input,.login-card button,.import-workbench,.import-change-summary,.import-change-comparison,.import-source-details p";
    const outside = Array.from(
      document.querySelectorAll<HTMLElement>(selectors)
    )
      .filter(element => {
        const bounds = element.getBoundingClientRect();
        return bounds.width && (bounds.left < -1 || bounds.right > width + 1);
      })
      .map(element => ({
        element: element.className || element.tagName,
        left: element.getBoundingClientRect().left,
        right: element.getBoundingClientRect().right,
      }));
    const clipped = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".detail-content button,.message-button,.admin-rail nav button,.model-results button,.form-actions button,.login-card button"
      )
    )
      .filter(element => element.scrollWidth > element.clientWidth + 1)
      .map(element => element.textContent);
    return {
      width,
      documentWidth: document.documentElement.scrollWidth,
      outside,
      clipped,
    };
  });
  expect(result.documentWidth, JSON.stringify(result)).toBeLessThanOrEqual(
    result.width + 1
  );
  expect(result.outside, JSON.stringify(result)).toEqual([]);
  expect(result.clipped, JSON.stringify(result)).toEqual([]);
}
async function touchSize(locator: Locator) {
  for (const control of await locator.all()) {
    const bounds = await control.boundingBox();
    expect(bounds?.width).toBeGreaterThanOrEqual(43.9);
    expect(bounds?.height).toBeGreaterThanOrEqual(43.9);
  }
}

const routes = [
  { path: "/", ready: ".product-card:not(.product-card-skeleton)" },
  { path: "/product/fixture-piece", ready: ".detail-content" },
  { path: "/admin", ready: ".metric-grid" },
  { path: "/admin/items", ready: ".model-editor-heading" },
  { path: "/admin/photos", ready: ".model-editor-heading" },
  { path: "/admin/import", ready: ".import-workbench" },
  { path: "/admin/review-queue", ready: ".import-workbench" },
  { path: "/admin/security", ready: ".security-card" },
  { path: "/404", ready: ".page-state h1" },
  { path: "/unknown-route", ready: ".page-state h1" },
];
for (const route of routes)
  test(`route containment ${route.path}`, async ({ page }, info) => {
    test.setTimeout(60000);
    await installFixtures(page);
    await page.goto(route.path);
    await page.locator(route.ready).first().waitFor();
    for (const [width, height] of viewports) {
      await page.setViewportSize({ width, height });
      await settle(page);
      await contained(page);
      if ([390, 820, 1440].includes(width) && [844, 1180, 900].includes(height))
        await page.screenshot({
          path: info.outputPath(`${width}x${height}.png`),
        });
    }
  });

test("continuous resize retains both nested staff layouts and gallery controls", async ({
  page,
}) => {
  test.setTimeout(60000);
  await installFixtures(page);
  for (const route of ["/admin/items", "/product/fixture-piece"]) {
    await page.goto(route);
    await page
      .locator(
        route.includes("admin") ? ".model-editor-heading" : ".detail-content"
      )
      .waitFor();
    for (let width = 320; width <= 2000; width += 23) {
      await page.setViewportSize({ width, height: 740 });
      await settle(page);
      await contained(page);
    }
  }
});

test("grid, detail, and staff columns follow measured content constraints", async ({
  page,
}) => {
  await installFixtures(page);
  await page.goto("/");
  await page.locator(".product-card").first().waitFor();
  for (const [width, columns] of [
    [320, 1],
    [360, 2],
    [719, 2],
    [720, 3],
    [1199, 3],
    [1200, 4],
    [2560, 4],
  ]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page
        .locator(".product-grid")
        .evaluate(
          element =>
            getComputedStyle(element).gridTemplateColumns.split(" ").length
        )
    ).toBe(columns);
  }
  await page.goto("/product/fixture-piece");
  await page.locator(".detail-content").waitFor();
  for (const [width, columns] of [
    [959, 1],
    [960, 2],
    [1440, 2],
  ]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page
        .locator(".product-page")
        .evaluate(
          element =>
            getComputedStyle(element).gridTemplateColumns.split(" ").length
        )
    ).toBe(columns);
  }
  await page.goto("/admin/items");
  await page.locator(".model-editor-heading").waitFor();
  for (const width of [820, 1120, 1280, 1440, 1920, 2560]) {
    await page.setViewportSize({ width, height: 900 });
    await settle(page);
    const sizes = await page.evaluate(() => {
      const workspace =
        document.querySelector<HTMLElement>(".admin-workspace")!;
      const editor = document.querySelector<HTMLElement>(".model-editor")!;
      const contentWidth = (element: HTMLElement) =>
        element.clientWidth -
        parseFloat(getComputedStyle(element).paddingLeft) -
        parseFloat(getComputedStyle(element).paddingRight);
      return {
        workspace: contentWidth(workspace),
        editor: contentWidth(editor),
        outer: getComputedStyle(
          document.querySelector(".model-layout")!
        ).gridTemplateColumns.split(" ").length,
        inner: getComputedStyle(
          document.querySelector(".catalogue-editor-workflow")!
        ).gridTemplateColumns.split(" ").length,
      };
    });
    expect(sizes.outer).toBe(sizes.workspace >= 960 ? 2 : 1);
    expect(sizes.inner).toBe(sizes.editor >= 720 ? 2 : 1);
  }
});

test("desktop ordering action stays near the gallery and images retain full garment framing", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installFixtures(page, { count: 1 });
  await page.goto("/product/fixture-piece");
  await page.locator(".message-button").waitFor();
  expect(
    await page
      .locator(".gallery-slide img")
      .first()
      .evaluate(element => getComputedStyle(element).objectFit)
  ).toBe("contain");
  const action = await page.locator(".message-button").boundingBox();
  // Long 12-color fixture deliberately needs more space than ordinary items, but is never trapped.
  expect(action!.y).toBeLessThan(1500);
  const frame = await page.locator(".gallery-main").boundingBox();
  const arrow = await page.locator(".gallery-arrow-next").boundingBox();
  expect(
    Math.abs(arrow!.y + arrow!.height / 2 - (frame!.y + frame!.height / 2))
  ).toBeLessThan(1);
  expect(
    await page
      .locator(".gallery-main")
      .evaluate(element => getComputedStyle(element).touchAction)
  ).toBe("pan-y");
});

test("gallery, color, size, availability, price and Messenger remain synchronized", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installFixtures(page, { count: 1 });
  await page.goto("/product/fixture-piece");
  const size = page.getByRole("group", { name: "Size", exact: true });
  await expect(
    size.getByRole("button", { name: "S", exact: true })
  ).toHaveAttribute("aria-pressed", "true");
  const order = page.locator(".message-button");
  expect(decodeURIComponent((await order.getAttribute("href"))!)).toContain(
    "POS-0-S-immutable"
  );
  await size.getByRole("button", { name: "M", exact: true }).click();
  await expect(page.locator(".detail-price")).toHaveText("$19.50");
  expect(decodeURIComponent((await order.getAttribute("href"))!)).toContain(
    "Size: M"
  );
  await size.getByRole("button", { name: "L Sold Out" }).click();
  await expect(order).toHaveAttribute("aria-disabled", "true");
  await expect(order).not.toHaveAttribute("href");
  await page
    .getByRole("group", { name: "Color", exact: true })
    .getByRole("button", { name: "Cream", exact: true })
    .click();
  await expect(
    size.getByRole("button", { name: "S", exact: true })
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".gallery-slide img").first()).toHaveAttribute(
    "src",
    /shared=1/
  );
  expect(decodeURIComponent((await order.getAttribute("href"))!)).toContain(
    "POS-1-S-immutable"
  );
  expect(decodeURIComponent((await order.getAttribute("href"))!)).toContain(
    "Color: Cream"
  );
  expect(await order.getAttribute("href")).toMatch(
    /^https:\/\/m.me\/OfficiallyDavit\?text=/
  );
  await page
    .getByRole("group", { name: "Color", exact: true })
    .getByRole("button", { name: "Black", exact: true })
    .click();
  await page.locator(".gallery-main").focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("button", { name: "View photo 2 of 3" })
  ).toHaveAttribute("aria-current", "true");
  await page.keyboard.press("ArrowLeft");
  await expect(
    page.getByRole("button", { name: "View photo 1 of 3" })
  ).toHaveAttribute("aria-current", "true");
  await touchSize(
    page.locator(
      ".gallery-arrow,.gallery-photo-pips button,.choice,.size-choice,.message-button,.back-link"
    )
  );
});

test("vertical drags and pointer cancellation do not change photos", async ({
  page,
}) => {
  await installFixtures(page, { count: 1 });
  await page.goto("/product/fixture-piece");
  const gallery = page.locator(".gallery-main");
  await gallery.waitFor();
  // Real mouse movement exercises pointer capture; touch pan-y has a separate native-engine limit.
  const bounds = (await gallery.boundingBox())!;
  await page.mouse.move(bounds.x + 220, bounds.y + 100);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 150, bounds.y + 200);
  await page.mouse.up();
  await expect(
    page.getByRole("button", { name: "View photo 1 of 3" })
  ).toHaveAttribute("aria-current", "true");
  await page.mouse.move(bounds.x + 220, bounds.y + 100);
  await page.mouse.down();
  await gallery.dispatchEvent("pointercancel", { pointerId: 1 });
  await page.mouse.move(bounds.x + 150, bounds.y + 110);
  await page.mouse.up();
  await expect(
    page.getByRole("button", { name: "View photo 1 of 3" })
  ).toHaveAttribute("aria-current", "true");
  await page.mouse.move(bounds.x + 220, bounds.y + 100);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 150, bounds.y + 110);
  await page.mouse.up();
  await expect(
    page.getByRole("button", { name: "View photo 2 of 3" })
  ).toHaveAttribute("aria-current", "true");
});

for (const state of ["onePhoto", "noMedia", "noSizes", "soldOut"] as const)
  test(`product state ${state}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await installFixtures(page, { [state]: true, count: 1 });
    await page.goto("/product/fixture-piece");
    await page.locator(".detail-content").waitFor();
    await contained(page);
    if (state === "onePhoto" || state === "noMedia")
      await expect(page.locator(".gallery-arrow")).toHaveCount(0);
    if (state === "noMedia")
      await expect(page.locator(".gallery-placeholder")).toBeVisible();
    if (state === "noSizes") {
      await expect(
        page.getByRole("group", { name: "Size", exact: true })
      ).toHaveCount(0);
      expect(
        decodeURIComponent(
          (await page.locator(".message-button").getAttribute("href"))!
        )
      ).not.toContain("Size:");
    }
    if (state === "soldOut")
      await expect(page.locator(".message-button")).toHaveAttribute(
        "aria-disabled",
        "true"
      );
  });

test("failed photos preserve card and gallery geometry", async ({ page }) => {
  await installFixtures(page, { count: 1 });
  await page.route("**/fixture-photo.jpg*", route => route.abort());
  await page.goto("/");
  await expect(page.locator(".product-image .image-fallback")).toBeVisible();
  const frame = (await page.locator(".product-image").boundingBox())!;
  expect(frame.width / frame.height).toBeCloseTo(0.8, 2);
  await page.goto("/product/fixture-piece");
  await expect(
    page.locator(".gallery-slide .image-fallback").first()
  ).toBeVisible();
  await contained(page);
});

for (const path of [
  "/",
  "/product/fixture-piece",
  "/admin/items",
  "/admin/import",
  "/admin/security",
])
  test(`larger text and 200% layout zoom ${path}`, async ({ page }) => {
    await installFixtures(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(path);
    await page
      .locator(
        path.includes("product")
          ? ".detail-content"
          : path.includes("items")
            ? ".model-editor-heading"
            : path.includes("import")
              ? ".import-workbench"
              : path.includes("security")
                ? ".security-card"
                : ".product-card"
      )
      .first()
      .waitFor();
    await page.addStyleTag({ content: "html { font-size: 24px; }" });
    await contained(page);
    await page.addStyleTag({
      content: "html { font-size: 16px; } body { zoom: 2; }",
    });
    await contained(page);
  });

test("category links normalize legacy and invalid values and restore catalogue scroll", async ({
  page,
}) => {
  await installFixtures(page);
  await page.goto("/?category=pants");
  await expect(page).toHaveURL(/category=legwear/);
  await expect(
    page.getByRole("button", { name: "Legwear", exact: true })
  ).toHaveAttribute("aria-pressed", "true");
  await page.goto("/?category=unknown");
  await expect(page).toHaveURL(/category=just-in/);
  await page.getByRole("button", { name: "Tops", exact: true }).click();
  await page.locator(".product-card").nth(30).scrollIntoViewIfNeeded();
  await page.locator(".product-card").nth(30).click();
  const position = await page.evaluate(
    () =>
      JSON.parse(sessionStorage.getItem("orange-storefront-return-position")!)
        .scrollY
  );
  await page.locator(".back-link").click();
  await expect(page).toHaveURL(/category=tops/);
  await expect
    .poll(() => page.evaluate(() => scrollY))
    .toBeCloseTo(position, 0);
});

test("loading, error, empty, missing-product states have distinct recoverable feedback", async ({
  page,
}) => {
  await installFixtures(page, { count: 0, delay: 300 });
  await page.goto("/");
  await expect(page.getByText("Loading pieces…")).toBeVisible();
  await expect(
    page.getByText("No pieces are available in this category yet.")
  ).toBeVisible();
  await page.goto("/product/missing");
  await expect(
    page.getByRole("heading", { name: "Product not found", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Return to shop" })
  ).toBeVisible();
});
for (const [path, error, expected] of [
  ["/", "store.catalogue.list", "Retry catalogue"],
  ["/product/fixture-piece", "store.catalogue.getBySlug", "Retry product"],
  ["/admin", "store.admin.session", "Retry access check"],
  ["/admin/items", "store.admin.overview", "Retry catalogue information"],
  ["/admin/import", "store.admin.importHistory", "Retry history"],
])
  test(`request failure ${error}`, async ({ page }) => {
    await installFixtures(page, { errors: [error] });
    await page.goto(path);
    await expect(
      page.getByRole("button", { name: expected, exact: true })
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByText("No pieces are available in this category yet.")
    ).toHaveCount(0);
    await expect(page.getByText("No import history yet.")).toHaveCount(0);
  });

test("staff navigation is labelled, selected, touch-sized and signs out", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installFixtures(page);
  await page.goto("/admin");
  const nav = page.getByRole("navigation", { name: "Admin workspaces" });
  await nav.getByRole("button", { name: /Catalogue editor/ }).click();
  await expect(
    nav.getByRole("button", { name: /Catalogue editor/ })
  ).toHaveAttribute("aria-current", "page");
  for (const button of await nav.getByRole("button").all())
    await expect(button.locator("span")).toBeVisible();
  await touchSize(nav.getByRole("button"));
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Store workspace" })
  ).toBeVisible();
});

test("search count, full identifiers, empty results and selected editor remain readable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await installFixtures(page);
  await page.goto("/admin/photos");
  const search = page.getByLabel(
    "Find an item by cleaned code or website name"
  );
  await search.fill("ZL 0041");
  await expect(page.locator("#item-result-count")).toHaveText("1 shown");
  await expect(page.locator(".model-results button")).toHaveCount(1);
  await search.fill("VERY-LONG");
  await page.locator(".model-results button").click();
  await expect(page.locator(".model-editor-heading h3")).toHaveText(
    "ZL-VERY-LONG-IDENTIFIER-012345678901234567890123456789"
  );
  await expect(page.locator(".model-editor-heading h3")).toBeFocused();
  await contained(page);
  await search.fill("does-not-exist");
  await expect(page.locator(".picker-empty")).toHaveText(
    "No matching items. Try another code or website name."
  );
  await expect(page.locator("#item-result-count")).toHaveText("0 shown");
  await expect(page.locator(".batch-photo-panel")).toBeHidden();
  await expect(page.locator(".archive-reuse-panel")).toHaveCount(0);
});

test("catalogue save, upload selection, progress, failure and success use real feedback", async ({
  page,
}) => {
  const calls = await installFixtures(page, { count: 1, delay: 200 });
  await page.goto("/admin/items");
  await page
    .getByLabel("Website item name", { exact: true })
    .fill("Edited fixture name");
  await page.getByRole("button", { name: "Save item details" }).click();
  await expect(
    page.getByText("Item details saved.", { exact: true })
  ).toBeVisible();
  expect(
    calls.find(call => call.path === "store.admin.updateProduct")?.input
      .displayName
  ).toBe("Edited fixture name");
  const file = page.locator(".upload-dropzone input");
  await file.focus();
  expect(
    await page
      .locator(".upload-dropzone")
      .evaluate(element => getComputedStyle(element).outlineStyle)
  ).toBe("solid");
  await file.setInputFiles({
    name: "invalid.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("bad"),
  });
  await expect(page.locator(".photo-upload-feedback")).toHaveClass(/is-error/);
  await file.setInputFiles("e2e/fixtures/catalogue-photo.jpg");
  await expect(
    page.getByRole("button", { name: "Remove selected", exact: true })
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Upload for Black", exact: true })
    .click();
  await expect(
    page.getByRole("progressbar", { name: "Photo upload progress" })
  ).toBeVisible();
  await expect(page.getByText("Photo saved", { exact: true })).toBeVisible();
  const registration = calls.find(
    call => call.path === "store.admin.registerMedia"
  );
  expect(registration?.input.variantId).toBe(product.colors[0].variants[0].id);
  expect(registration?.input.colorTag).toBe("Black");
});

test("imports show full-width stages, expanded source details and persistent removal success", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installFixtures(page);
  await page.goto("/admin/review-queue");
  await page.locator(".import-file input").setInputFiles({
    name: "fixture-long-export-name.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from("fixture intercepted at the API boundary"),
  });
  await page
    .getByRole("button", { name: "Preview all POS changes", exact: true })
    .click();
  await expect(
    page.locator(".import-stage-tracker li[aria-current=step]")
  ).toHaveText(/Confirm changes/);
  await page.locator(".preview-card .import-change-summary").click();
  await page.locator(".preview-card .import-source-details summary").click();
  await expect(
    page.locator(".preview-card .import-source-details p")
  ).toContainText("POS-IMMUTABLE-LONG-IDENTIFIER");
  await contained(page);
  await page.locator(".import-history-list button").first().click();
  await page.locator(".import-history-detail .import-change-summary").click();
  await page
    .locator(".import-history-detail .import-source-details summary")
    .click();
  await contained(page);
  page.on("dialog", dialog => dialog.accept());
  await page
    .getByRole("button", { name: "Remove this POS dataset", exact: true })
    .click();
  await expect(
    page.getByText(/POS dataset removed\. Rebuilt from/)
  ).toBeVisible();
});

test("invalid imports explain source rows and cannot apply", async ({
  page,
}) => {
  await installFixtures(page, { invalidImport: true });
  await page.goto("/admin/import");
  await page.locator(".import-file input").setInputFiles({
    name: "invalid.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from("fixture"),
  });
  await page
    .getByRole("button", { name: "Preview all POS changes", exact: true })
    .click();
  await expect(
    page.getByText("Row 12: Price or Stock Qty. is not numeric.")
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm and apply this import" })
  ).toBeDisabled();
});

test("logged-out aliases, login failures and short keyboard-height forms retain actions", async ({
  page,
}) => {
  await installFixtures(page, { admin: false });
  for (const path of [
    "/admin",
    "/admin/items",
    "/admin/photos",
    "/admin/import",
    "/admin/review-queue",
    "/admin/security",
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "Store workspace" })
    ).toBeVisible();
    for (const [width, height] of [
      [320, 780],
      [390, 400],
      [820, 500],
      [1440, 500],
    ]) {
      await page.setViewportSize({ width, height });
      await contained(page);
      expect(
        await page
          .getByLabel("Password", { exact: true })
          .evaluate(element => parseFloat(getComputedStyle(element).fontSize))
      ).toBeGreaterThanOrEqual(16);
    }
  }
  await page.getByLabel("Password", { exact: true }).fill("wrong");
  await page.getByRole("button", { name: "Open workspace" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Unable to sign in with those credentials."
  );
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true"
  );
});

test("security reports error and success without changing the owner password policy", async ({
  page,
}) => {
  await installFixtures(page);
  await page.setViewportSize({ width: 390, height: 400 });
  await page.goto("/admin/security");
  await page.getByLabel("Current password", { exact: true }).fill("wrong");
  await page.getByLabel("New password", { exact: true }).fill("test");
  await expect(
    page.getByLabel("New password", { exact: true })
  ).toHaveAttribute("minlength", "4");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.locator("#password-error")).toBeVisible();
  await page.getByLabel("Current password", { exact: true }).fill("test");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(
    page.getByText("Password updated. Your secure session has been renewed.")
  ).toBeVisible();
  await contained(page);
});

test("focus, muted text, essential boundaries and destructive hover retain contrast", async ({
  page,
}) => {
  await installFixtures(page);
  await page.goto("/admin/items");
  await page.locator(".model-editor-heading").waitFor();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" })
  ).toBeFocused();
  const colors = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return Object.fromEntries(
      [
        "--aw-muted",
        "--control-line",
        "--selected-line",
        "--focus",
        "--danger",
        "--danger-hover",
      ].map(name => [name, style.getPropertyValue(name).trim()])
    );
  });
  function contrast(hex: string) {
    const channels = hex
      .slice(1)
      .match(/../g)!
      .map(channel => parseInt(channel, 16) / 255)
      .map(value =>
        value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
      );
    const luminance =
      channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    return 1.05 / (luminance + 0.05);
  }
  expect(contrast(colors["--aw-muted"])).toBeGreaterThanOrEqual(4.5);
  for (const name of ["--control-line", "--selected-line", "--focus"])
    expect(contrast(colors[name])).toBeGreaterThanOrEqual(3);
  for (const name of ["--danger", "--danger-hover"])
    expect(contrast(colors[name])).toBeGreaterThanOrEqual(4.5);
  const danger = page.getByRole("button", {
    name: "Delete this item",
    exact: true,
  });
  await danger.hover();
  await expect(danger).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(danger).toHaveCSS("background-color", "rgb(150, 51, 45)");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/product/fixture-piece");
  await page.locator(".gallery-slides").waitFor();
  await expect(page.locator(".gallery-slides")).toHaveCSS(
    "transition-duration",
    "0s"
  );
});

for (const count of [0, 1, 320])
  test(`catalogue density ${count} items`, async ({ page }) => {
    test.setTimeout(45000);
    await installFixtures(page, { count });
    for (const route of ["/", "/admin/items"]) {
      await page.goto(route);
      await page
        .locator(route === "/" ? ".catalogue-intro" : ".model-picker")
        .waitFor();
      if (route === "/admin/items")
        await expect(page.locator("#item-result-count")).toHaveText(
          `${count} shown`
        );
      else
        await expect(
          page.locator(".product-card:not(.product-card-skeleton)")
        ).toHaveCount(count);
      for (const [width, height] of [
        [390, 844],
        [820, 1180],
        [1440, 900],
      ]) {
        await page.setViewportSize({ width, height });
        await contained(page);
      }
    }
  });

test("enlarged phone text wraps workspace names and long choices", async ({
  page,
}) => {
  await installFixtures(page, { count: 1 });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of [
    "/admin/items",
    "/product/fixture-piece",
    "/admin/security",
  ]) {
    await page.goto(route);
    await page
      .locator(
        route.includes("product")
          ? ".detail-content"
          : route.includes("items")
            ? ".model-editor-heading"
            : ".security-card"
      )
      .waitFor();
    await page.addStyleTag({ content: "html { font-size: 32px; }" });
    await contained(page);
  }
});

test.describe("touch emulation", () => {
  test.use({
    isMobile: true,
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });
  test("phone taps select colors and advance the gallery", async ({ page }) => {
    await installFixtures(page, { count: 1 });
    await page.goto("/product/fixture-piece");
    const cream = page
      .getByRole("group", { name: "Color", exact: true })
      .getByRole("button", { name: "Cream", exact: true });
    await cream.scrollIntoViewIfNeeded();
    let bounds = (await cream.boundingBox())!;
    await page.touchscreen.tap(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2
    );
    await expect(cream).toHaveAttribute("aria-pressed", "true");
    const black = page
      .getByRole("group", { name: "Color", exact: true })
      .getByRole("button", { name: "Black", exact: true });
    bounds = (await black.boundingBox())!;
    await page.touchscreen.tap(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2
    );
    const next = page.getByRole("button", { name: "Next photo", exact: true });
    await next.scrollIntoViewIfNeeded();
    bounds = (await next.boundingBox())!;
    await page.touchscreen.tap(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2
    );
    await expect(
      page.getByRole("button", { name: "View photo 2 of 3" })
    ).toHaveAttribute("aria-current", "true");
  });
});

test("unexpected rendering failures show a readable production recovery screen", async ({
  page,
}) => {
  await installFixtures(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.route("**/api/trpc/store.catalogue.getBySlug**", route =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify([
        { result: { data: { json: { id: 1, colors: null } } } },
      ]),
    })
  );
  await page.goto("/product/fixture-piece");
  await expect(
    page.getByRole("heading", { name: "We couldn’t open this page." })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Reload Page" })).toBeVisible();
  await expect(page.getByText("Error details", { exact: true })).toHaveCount(0);
  await contained(page);
});

for (const failure of [false, true])
  test(`import apply pending and ${failure ? "failed" : "completed"} feedback`, async ({
    page,
  }) => {
    const calls = await installFixtures(page, {
      delay: 300,
      errors: failure ? ["store.admin.applyImport"] : [],
    });
    await page.goto("/admin/import");
    await page
      .locator(".import-file input")
      .setInputFiles({
        name: "fixture-apply.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        buffer: Buffer.from("isolated fixture"),
      });
    await page
      .getByRole("button", { name: "Preview all POS changes", exact: true })
      .click();
    const apply = page.getByRole("button", {
      name: "Confirm and apply this import",
      exact: true,
    });
    await expect(apply).toBeEnabled();
    await apply.click();
    await expect(
      page.locator(".import-stage-tracker li[aria-current=step]")
    ).toHaveText(/Apply import/);
    await expect(
      page.getByRole("button", {
        name: "Applying verified changes…",
        exact: true,
      })
    ).toBeDisabled();
    if (failure) {
      await expect(page.locator(".import-feedback")).toHaveClass(/is-error/);
      await expect(
        page.getByRole("button", {
          name: "Confirm and apply this import",
          exact: true,
        })
      ).toBeEnabled();
    } else {
      await expect(page.locator(".import-feedback")).toHaveClass(/is-success/);
      await expect(page.locator(".import-feedback")).toContainText(
        "Import complete: 1 price and quantity change."
      );
      await expect(
        page.locator(".import-stage-tracker li.is-complete")
      ).toHaveCount(4);
      await expect(page.locator(".import-history-detail h3")).toHaveText(
        "fixture-apply.xlsx"
      );
    }
    const request = calls.find(
      call => call.path === "store.admin.applyImport"
    )!;
    expect(request.input.importId).toBe(99);
    expect(request.input.filename).toBe("fixture-apply.xlsx");
    expect(request.input.base64).toBe(
      Buffer.from("isolated fixture").toString("base64")
    );
    await contained(page);
  });
