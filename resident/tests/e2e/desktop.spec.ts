import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const root = "/manage/properties/20000000-0000-4000-8000-000000000001";
const sizes = [
  { width: 1024, height: 640 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];
async function login(page: Page, identity: string) {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: new RegExp(`^${identity} `) }).click();
  await expect(page).not.toHaveURL(/sign-in/);
}
async function ready(page: Page) {
  await expect(
    page.locator("main h1").filter({ hasNotText: "Opening your home" }).first(),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}
async function layout(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  const clipped = await page
    .locator(
      "main button, main input, main textarea, main select, main summary",
    )
    .evaluateAll((nodes) =>
      nodes
        .filter((node) => node.checkVisibility())
        .filter((node) => {
          const rect = node.getBoundingClientRect();
          return rect.left < -1 || rect.right > innerWidth + 1;
        })
        .map(
          (node) => node.textContent?.slice(0, 60) || node.getAttribute("name"),
        ),
    );
  expect(clipped).toEqual([]);
}
async function accessibility(page: Page) {
  for (const region of await page
    .locator(
      ".resident-header, .essential-list, .today, .suggestion-body, .guide-body, .answer",
    )
    .all()) {
    if (await region.isVisible())
      await expect(region).toHaveCSS("opacity", "1");
  }
  const result = await new AxeBuilder({ page }).analyze();
  expect(
    result.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact || ""),
    ),
  ).toEqual([]);
}
async function audit(page: Page, routes: string[], prefix: string) {
  for (const route of routes) {
    await page.goto(route);
    await ready(page);
    for (const size of sizes) {
      await page.setViewportSize(size);
      await layout(page);
      if (size.width === 1440) {
        await accessibility(page);
        const name =
          route === root ? "overview" : route.split("/").pop() || "landing";
        await page.screenshot({
          path: `docs/screenshots/desktop-${prefix}-${name}.png`,
        });
      }
    }
  }
}

test("desktop public entry and manager onboarding fit laptop and wide monitors", async ({
  page,
}) => {
  await audit(page, ["/", "/sign-in", "/invite/invalid-token"], "entry");
  await login(page, "New manager");
  await audit(page, ["/onboarding/manager"], "setup");
});

test("every resident screen fits desktop widths with readable controls", async ({
  page,
}) => {
  await login(page, "Maya");
  await audit(
    page,
    [
      "/home",
      "/home/guide",
      "/home/ask",
      "/home/repairs",
      "/home/repairs/new",
      "/home/repairs/70000000-0000-4000-8000-000000000001",
    ],
    "resident",
  );
  await page.goto("/home/guide");
  await ready(page);
  await page.locator(".guide-sections details > summary").first().click();
  await layout(page);
  await page.setViewportSize({ width: 720, height: 450 });
  // A 1440 × 900 desktop at 200% browser zoom has a 720 × 450 CSS viewport.
  await layout(page);
  await page.getByRole("link", { name: "Ask", exact: true }).click();
  await expect(page.getByLabel("Your question", { exact: true })).toBeVisible();
});

test("every manager screen fits desktop widths and overview counts navigate", async ({
  page,
}) => {
  await login(page, "Elena");
  await audit(
    page,
    [
      "/manage",
      root,
      `${root}/content`,
      `${root}/invites`,
      `${root}/questions`,
      `${root}/maintenance`,
      `${root}/settings`,
    ],
    "manager",
  );
  await page.goto(root);
  await page.getByRole("link", { name: /Published guide sections/ }).click();
  await expect(page).toHaveURL(`${root}/content`);
  await page.goto(root);
  await page.getByRole("link", { name: /Questions to review/ }).click();
  await expect(page).toHaveURL(`${root}/questions`);
  await page.goto(root);
  await page.getByRole("link", { name: /Open repairs/ }).click();
  await expect(page).toHaveURL(`${root}/maintenance`);
  await page.locator("details.suggestion > summary").first().click();
  await layout(page);
  await accessibility(page);
});

test("desktop editor, preview and short-window navigation remain keyboard accessible", async ({
  page,
}) => {
  await login(page, "Elena");
  await page.setViewportSize({ width: 1024, height: 640 });
  await page.goto(`${root}/content`);
  await ready(page);
  await expect(
    page.locator(".editor-fields > summary").first(),
  ).toBeInViewport();
  await expect(page.getByLabel("Home notes")).not.toBeVisible();
  await page.getByRole("link", { name: /Roomly Assist.*to review/ }).click();
  await expect(page.getByLabel("Home notes")).toBeVisible();
  await page
    .getByLabel("Home notes")
    .fill("Keep this unfinished note while editing the guide.");
  await page.locator(".assist-disclosure > summary").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Home notes")).not.toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Home notes")).toHaveValue(
    "Keep this unfinished note while editing the guide.",
  );
  await page.locator(".assist-disclosure > summary").click();
  await page.locator(".editor-fields > summary").first().focus();
  await page.keyboard.press("Enter");
  await layout(page);
  await page.getByRole("button", { name: "Add block", exact: true }).click();
  await layout(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Resident preview" }).first().click();
  await expect(page.getByRole("dialog")).toBeInViewport();
  await page.keyboard.press("Tab");
  expect(
    await page
      .getByRole("dialog")
      .evaluate((node) => node.contains(document.activeElement)),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Resident preview" }).first(),
  ).toBeFocused();
  await page.setViewportSize({ width: 900, height: 500 });
  const account = page.getByRole("link", { name: "Account", exact: true });
  await account.focus();
  await expect(account).toBeInViewport();
  const sidebar = await page.locator(".sidebar").boundingBox();
  expect(sidebar!.height).toBeLessThanOrEqual(500);
  await page.getByRole("link", { name: "Settings", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  // Exercise long saved names without changing shared demo records.
  await page.locator(".home-label strong").evaluate((node) => {
    node.textContent = "CambridgeInternationalStudentResidence".repeat(3);
  });
  await page.locator(".sidebar-bottom strong").evaluate((node) => {
    node.textContent = "Elena Alexandra Konstantinopoulou";
  });
  expect(
    await page
      .locator(".sidebar")
      .evaluate((node) => node.scrollWidth <= node.clientWidth + 1),
  ).toBe(true);
  await account.focus();
  await expect(account).toBeInViewport();
  await page.setViewportSize({ width: 720, height: 450 });
  await layout(page);
  await accessibility(page);
});
