import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const paths = [
  "/",
  "/blog",
  "/changelog",
  "/contact-us",
  "/privacy-policy",
  "/terms-of-use",
  "/blog/property-management-software-for-small-landlords",
  "/blog/hmo-management-software-guide",
  "/blog/inventory-checklist-deposit-disputes",
  "/blog/spreadsheets-vs-property-management-software",
  "/blog/rent-tracking-software-for-landlords",
  "/blog/choosing-property-management-software",
  "/404",
];
for (const width of [1440, 390, 320])
  test(`Website routes, assets and accessibility at ${width}px`, async ({
    page,
    request,
  }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const path of paths) {
      const response = await page.goto(path, { waitUntil: "networkidle" });
      expect(response?.status(), path).toBe(path === "/404" ? 404 : 200);
      await expect(page.locator("h1:visible").first()).toBeVisible();
      // Scroll in viewport-sized increments: the template reveals child layers separately.
      await page
        .locator("img")
        .evaluateAll((es) =>
          es.forEach((e) => e.setAttribute("loading", "eager")),
        );
      const height = await page.evaluate(() => document.body.scrollHeight);
      for (let y = 0; y < height; y += 850) {
        await page.evaluate((y) => window.scrollTo(0, y), y);
        await page.waitForTimeout(70);
      }
      await page.waitForTimeout(400);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        path,
      ).toBe(true);
      await expect
        .poll(
          async () =>
            page
              .locator("img:visible")
              .evaluateAll((es) =>
                es
                  .filter(
                    (e) =>
                      !(e as HTMLImageElement).complete ||
                      !(e as HTMLImageElement).naturalWidth,
                  )
                  .map((e) => e.getAttribute("src")),
              ),
          { message: path, timeout: 10000 },
        )
        .toEqual([]);
      await expect(page.locator("body")).not.toContainText(
        /\bdemo\b|fictional|portfolio project/i,
      );
      const audit = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        audit.violations
          .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
          .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
        path,
      ).toEqual([]);
      if (path === "/") {
        await page.screenshot({
          path: `docs/images/website-${width}.png`,
          fullPage: true,
        });
      }
    }
    expect((await request.get("/definitely-not-a-roomly-page")).status()).toBe(
      404,
    );
    expect(errors).toEqual([]);
  });
test("Homepage pricing, FAQ, login destination and keyboard access", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.keyboard.press("Tab");
  await expect(page.getByText("Skip to content")).toBeFocused();
  const yearly = page.getByRole("button", { name: "Yearly", exact: true });
  await yearly.scrollIntoViewIfNeeded();
  await yearly.focus();
  await page.keyboard.press("Enter");
  await expect(yearly).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("£290", { exact: true })).toBeVisible();
  await expect(page.getByText("£1,490", { exact: true })).toBeVisible();
  const monthly = page.getByRole("button", { name: "Monthly", exact: true });
  await monthly.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("£29", { exact: true })).toBeVisible();
  const faq = page.getByText("Who is Roomly designed for?", { exact: true });
  await faq.scrollIntoViewIfNeeded();
  await faq.click();
  await expect(
    page.getByText(/Small UK letting operations/i).first(),
  ).toBeVisible();
  for (const link of await page
    .getByRole("link", { name: "Log in", exact: true })
    .all())
    await expect(link).toHaveAttribute(
      "href",
      "https://roomly-kappa.vercel.app/en/login",
    );
  for (const link of await page
    .getByRole("link", { name: "Request access", exact: false })
    .all())
    await expect(link).toHaveAttribute(
      "href",
      /^mailto:.*subject=Roomly%20access$/,
    );
  await page.getByRole("link", { name: "Guides", exact: true }).first().click();
  await expect(page).toHaveURL(/\/blog$/);
  await expect(page.locator("h1:visible")).toBeVisible();
});
