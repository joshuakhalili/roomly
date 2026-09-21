import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import articles from "../../site/src/data/articles.json";

const paths = [
  "/",
  "/blog",
  "/contact-us",
  "/changelog",
  "/privacy-policy",
  "/terms-of-use",
  ...articles.map((a) => `/blog/${a.slug}`),
  "/404",
];
for (const width of [1440, 390, 320]) {
  test(`public routes, images, links and accessibility at ${width}px`, async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const links = new Set<string>();
    for (const path of paths) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(path === "/404" ? 404 : 200);
      await page.evaluate(() => document.fonts.ready);
      for (const img of await page.locator("img").all()) {
        await img.scrollIntoViewIfNeeded();
        await expect
          .poll(() =>
            img.evaluate(
              (el) =>
                el instanceof HTMLImageElement &&
                el.complete &&
                el.naturalWidth > 0,
            ),
          )
          .toBe(true);
      }
      for (const section of await page.locator("[data-reveal]").all()) {
        await section.scrollIntoViewIfNeeded();
        await expect(section).toHaveCSS("opacity", "1");
      }
      await page.evaluate(() =>
        window.scrollTo({ top: 0, behavior: "instant" }),
      );
      await page.waitForFunction(() =>
        document
          .getAnimations()
          .every((animation) => animation.playState === "finished"),
      );
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("body")).not.toContainText(
        /\bdemo\b|portfolio project|prototype/i,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        path,
      ).toBe(true);
      const missingImages = await page
        .locator("img")
        .evaluateAll((images) =>
          images
            .filter(
              (img) =>
                img instanceof HTMLImageElement &&
                (!img.complete || img.naturalWidth === 0),
            )
            .map((img) => img.getAttribute("src")),
        );
      expect(missingImages, path).toEqual([]);
      const audit = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(
        audit.violations.filter((v) =>
          ["serious", "critical"].includes(v.impact ?? ""),
        ),
        path,
      ).toEqual([]);
      for (const href of await page
        .locator("a[href]")
        .evaluateAll((anchors) =>
          anchors.map((a) => a.getAttribute("href")!),
        )) {
        if (href.startsWith("/")) links.add(href.split("#")[0] || "/");
      }
    }
    for (const href of links)
      expect((await request.get(href)).ok(), href).toBe(true);
    expect(errors).toEqual([]);
  });
}

test("keyboard navigation, contact intent, FAQ and reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByText("Skip to content")).toBeFocused();
  const menu = page.locator(".mobile-menu summary");
  await menu.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("navigation", { name: "Mobile navigation" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Log in", exact: false }).first(),
  ).toHaveAttribute("href", "https://roomly-kappa.vercel.app/en/login");
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  await expect(page.locator(".mobile-menu")).not.toHaveAttribute("open");
  const faq = page
    .locator(".faq summary")
    .filter({ hasText: "Who is Roomly for?" });
  await faq.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("Roomly is built for people managing shared houses", {
      exact: false,
    }),
  ).toBeVisible();
  expect(
    await page
      .locator(".hero-photo")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  for (const link of await page
    .getByRole("link", { name: /Request access/i })
    .all()) {
    await expect(link).toHaveAttribute(
      "href",
      /^mailto:.*subject=Roomly%20access$/,
    );
  }
  await page.screenshot({
    path: "docs/images/website-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "docs/images/website-desktop.png",
    fullPage: true,
  });
});
