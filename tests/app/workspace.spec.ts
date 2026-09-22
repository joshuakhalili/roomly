import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
// Supply a short-lived storage state for an isolated review organisation.
// No credentials or mutations belong in this read-only release suite.
test.skip(
  !process.env.ROOMLY_REVIEW_AUTH,
  "Requires an authenticated review organisation",
);
for (const width of [1440, 390, 320])
  test(`management navigation and hierarchy at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const route of [
      "properties",
      "inventory",
      "rent",
      "tenants",
      "documents",
      "maintenance",
      "expenses",
      "analytics",
      "settings",
      "",
    ]) {
      await page.goto("/en/" + route, { waitUntil: "networkidle" });
      await expect(page.locator("main h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        route,
      ).toBe(true);
      const a = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        a.violations
          .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
          .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
        route,
      ).toEqual([]);
    }
    await page.goto("/en/properties");
    await page
      .getByRole("textbox", { name: "Search properties or address" })
      .fill("no-such-property-123456");
    await expect(page.getByRole("status")).toContainText("No matching results");
    await page
      .getByRole("textbox", { name: "Search properties or address" })
      .fill("");
    const property = page.locator(".directory-row").first();
    if (await property.count()) {
      await property.click();
      await page.getByRole("link", { name: "Utilities", exact: true }).click();
      await expect(page).toHaveURL(/view=utilities/);
      await page
        .locator("main")
        .getByRole("link", { name: "Documents", exact: true })
        .click();
      await expect(page).toHaveURL(/view=documents/);
    }
    if (width < 768) {
      await page.getByRole("button", { name: "More", exact: true }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page
        .getByRole("dialog")
        .getByRole("link", { name: "Inventory", exact: true })
        .click();
      await expect(page).toHaveURL(/\/inventory$/);
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
    expect(errors).toEqual([]);
  });
