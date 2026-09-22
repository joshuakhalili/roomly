import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const property = "20000000-0000-4000-8000-000000000001";
const root = `/manage/properties/${property}`;
function screenName(route: string) {
  const last = route.split("/").filter(Boolean).at(-1) || "landing";
  return last === property
    ? "overview"
    : last.startsWith("70000000-")
      ? "repair-detail"
      : last;
}
async function login(page: Page, name: string) {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: new RegExp(`^${name} `) }).click();
  await expect(page).not.toHaveURL(/sign-in/);
}
async function axe(page: Page) {
  await expect(
    page.locator("main h1").filter({ hasNotText: "Opening your home" }).first(),
  ).toBeVisible();
  for (const region of await page
    .locator(
      ".resident-header, .essential-list, .today, .preview-sheet, .dialog-overlay, .guide-body, .answer",
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
test("resident home, grounded answer, unknown, emergency, offline retry and all primary resident routes", async ({
  page,
}) => {
  await login(page, "Maya");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Maya");
  await axe(page);
  await page.screenshot({
    path: "docs/screenshots/resident-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "When are the bins collected?" })
    .click();
  await expect(page.locator(".answer")).toContainText("Tuesday");
  await expect(
    page.getByRole("link", { name: "Bins", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Your question", { exact: true })
    .fill("Is there a swimming pool?");
  await page.getByRole("button", { name: "Ask your question" }).click();
  await expect(page.locator(".answer")).toContainText(
    "do not have a checked source",
  );
  await page.getByLabel("Your question", { exact: true }).fill("I smell gas");
  await page.getByRole("button", { name: "Ask your question" }).click();
  await expect(
    page.getByRole("link", { name: "Call 999", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Your question", { exact: true })
    .fill("provider-error");
  await page.getByRole("button", { name: "Ask your question" }).click();
  await expect(page.locator(".answer")).toContainText(
    "temporarily unavailable",
  );
  for (const route of [
    "/home/guide",
    "/home/ask",
    "/home/repairs",
    "/home/repairs/new",
    "/home/repairs/70000000-0000-4000-8000-000000000001",
  ]) {
    await page.goto(route);
    await axe(page);
    await page.screenshot({
      path: `docs/screenshots/ui-${screenName(route)}.png`,
      fullPage: true,
    });
  }
  await page.goto("/home/ask");
  await page
    .getByRole("button", { name: "When are the bins collected?" })
    .click();
  await expect(page.locator(".answer")).toBeVisible();
  await page.context().setOffline(true);
  await expect(page.locator(".offline-banner")).toContainText("offline");
  await page.context().setOffline(false);
  await expect(page.getByText("You’re offline.")).not.toBeVisible();
});
test("manager onboarding persists and resumes, reviews suggestions and publishes first home", async ({
  page,
}) => {
  await login(page, "New manager");
  await page.getByRole("button", { name: "Let’s begin" }).click();
  await page.getByLabel("Organisation name").fill("Test Welcome Homes");
  await page.getByLabel("Your display name").fill("Alex");
  await expect(
    page.getByRole("status").filter({ hasText: "Saved" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Organisation name")).toHaveValue(
    "Test Welcome Homes",
  );
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  for (const [label, value] of [
    ["Property name", "Garden House"],
    ["Street address", "20 Example Road"],
    ["City", "Cambridge"],
    ["Postcode", "CB1 2AB"],
  ])
    await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Room or unit name").fill("Room A");
  await page.getByLabel("Manager phone", { exact: true }).fill("07700 900111");
  await page.getByLabel("Home emergency phone").fill("07700 900112");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByLabel("Home notes")
    .fill(
      "Bins are collected on Tuesday.\nQuiet hours start at 22:00.\nGuests should ring the bell.",
    );
  await page.getByRole("button", { name: "Prepare suggestions" }).click();
  await expect(page.getByText(/3 awaiting review/)).toBeVisible();
  await page.getByRole("button", { name: "Accept original" }).first().click();
  await page
    .getByLabel("Suggested text")
    .first()
    .fill("Quiet hours are 22:00–08:00.");
  await page
    .getByRole("button", { name: "Apply edited version" })
    .first()
    .click();
  await page.getByRole("button", { name: "Skip", exact: true }).first().click();
  await axe(page);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Publish and create invitation" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your home is published." }),
  ).toBeVisible();
  await expect(page.getByLabel("First invitation")).toHaveValue(/\/invite\//);
  await page.getByRole("button", { name: "Go to manager overview" }).click();
  await expect(page).toHaveURL("/manage");
});
test("invite create/revoke/replacement, single claim, three-language onboarding to permanent Home", async ({
  page,
  browser,
}) => {
  await login(page, "Elena");
  await page.goto(root + "/invites");
  await page.getByRole("button", { name: "Create invitation" }).click();
  const first = await page.getByLabel("Private invitation link").inputValue();
  await page
    .getByRole("button", { name: "Revoke", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("button", { name: "Copy invitation link" }),
  ).not.toBeVisible();
  await expect(page.getByLabel("Private invitation link")).not.toBeVisible();
  const guest = await (await browser.newContext()).newPage();
  await guest.goto(first);
  await expect(guest.getByRole("heading")).toContainText("new invitation");
  await page.getByRole("button", { name: "Create invitation" }).click();
  await expect(page.getByLabel("Private invitation link")).not.toHaveValue(
    first,
  );
  const link = await page.getByLabel("Private invitation link").inputValue();
  await guest.goto(link);
  await expect(guest.locator("body")).not.toContainText("Willow Lane");
  await expect(guest.locator("body")).not.toContainText("07700");
  await axe(guest);
  await guest.getByRole("link", { name: "Join this home" }).click();
  await guest.getByRole("button", { name: /^New resident / }).click();
  await guest.getByRole("button", { name: "Join this home" }).click();
  await expect(guest).toHaveURL(/onboarding\/resident/);
  await axe(guest);
  for (const [locale, text] of [
    ["zh-CN", "你的地址"],
    ["tr-TR", "Adresiniz"],
    ["en-GB", "Your address"],
  ]) {
    await guest.getByLabel("What should we call you?").fill("Sam");
    await guest.getByLabel("Preferred language").selectOption(locale);
    await guest.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(guest.getByText(text, { exact: true })).toBeVisible();
    if (locale !== "en-GB")
      await guest.getByRole("button", { name: "Back", exact: true }).click();
  }
  await guest.getByRole("button", { name: "Continue", exact: true }).click();
  await guest.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(guest.locator("main [role=alert]")).toContainText("acknowledge");
  await guest.getByRole("checkbox").click();
  await expect(guest.getByRole("checkbox")).toBeChecked();
  await axe(guest);
  await guest.getByRole("button", { name: "Continue", exact: true }).click();
  await guest
    .getByRole("button", { name: "Save your address", exact: true })
    .click();
  await guest.getByRole("button", { name: "Continue", exact: true }).click();
  await guest.getByRole("button", { name: "Go to Roomly Home" }).click();
  await expect(guest).toHaveURL("/home");
  await expect(guest.getByRole("heading", { level: 1 })).toContainText("Sam");
  await guest.reload();
  await expect(guest).toHaveURL("/home");
  await guest.goto(link);
  await expect(guest.getByRole("heading")).toContainText("new invitation");
  await guest.close();
});
test("autosave, preview keyboard trap, publish isolation, undo, reorder and manager axe routes", async ({
  page,
  browser,
}) => {
  await login(page, "Elena");
  await page.goto(root + "/content");
  const bins = page.locator(".editor-block").filter({
    has: page.getByRole("button", { name: "Archive Bins", exact: true }),
  });
  await bins.locator(".editor-fields > summary").focus();
  await page.keyboard.press("Enter");
  await bins
    .getByRole("textbox", { name: "Content", exact: true })
    .fill(
      "Recycling is collected on Friday. Put the blue bin out Thursday evening.",
    );
  await expect(bins.getByRole("status")).toContainText("Saved");
  const resident = await (await browser.newContext()).newPage();
  await login(resident, "Maya");
  await resident.goto("/home/guide");
  await resident.getByText("Bins", { exact: true }).click();
  await expect(
    resident.locator(".guide-body").filter({ hasText: "Put recycling" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Resident preview" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await axe(page);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Resident preview" }).first(),
  ).toBeFocused();
  await page.getByRole("button", { name: "Review and publish" }).click();
  await page.getByRole("button", { name: "Publish to residents" }).click();
  await expect(
    page.getByText("Published. Residents now see this version."),
  ).toBeVisible();
  await resident.reload();
  await resident.getByText("Bins", { exact: true }).click();
  await expect(
    resident
      .locator(".guide-body")
      .filter({ hasText: "Recycling is collected on Friday." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Archive Post and deliveries", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Archive Post and deliveries",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Move Post and deliveries up", exact: true })
    .click();
  await expect(page.getByText("Post and deliveries moved up")).toBeVisible();
  for (const route of [
    "/manage",
    root,
    root + "/content",
    root + "/invites",
    root + "/questions",
    root + "/maintenance",
    root + "/settings",
  ]) {
    await page.goto(route);
    await axe(page);
    await page.screenshot({
      path: `docs/screenshots/ui-${screenName(route)}.png`,
      fullPage: true,
    });
  }
  await resident.close();
});
test("repair attachment, explicit confirmation, manager update and private resident timeline", async ({
  page,
  browser,
}) => {
  await login(page, "Maya");
  await page.goto("/home/repairs/new");
  await page.getByLabel("Short title").fill("Bathroom leak E2E");
  await page.getByLabel("What’s happening?").fill("I smell gas");
  await expect(
    page.getByRole("link", { name: "Call 999", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("What’s happening?")
    .fill("The bathroom sink is dripping under the pipe.");
  await page.getByLabel("Where in your home?").fill("Bathroom");
  await page.getByLabel("When are you available?").fill("Monday after 16:00");
  await page.getByLabel("Photo or document").setInputFiles({
    name: "repair.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\nDemo repair attachment\n%%EOF"),
  });
  await page.getByRole("button", { name: "Review repair report" }).click();
  await expect(
    page.getByRole("heading", { name: "Review before sending" }),
  ).toBeVisible();
  await expect(page.getByText("repair.pdf · attached")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry attachment upload" }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Confirm and submit repair" }).click();
  await expect(page).toHaveURL(/home\/repairs\/[0-9a-f-]{36}$/);
  const url = page.url();
  await expect(page.getByRole("link", { name: "repair.pdf" })).toBeVisible();
  const manager = await (await browser.newContext()).newPage();
  await login(manager, "Elena");
  await manager.goto(root + "/maintenance");
  await manager.getByText("Bathroom leak E2E", { exact: true }).click();
  const detail = manager
    .locator("details")
    .filter({ hasText: "Bathroom leak E2E" });
  await detail.getByLabel("Next status").selectOption("acknowledged");
  await detail
    .getByLabel("Update note")
    .fill("I have received the report and will contact you.");
  await detail.getByRole("button", { name: "Save status update" }).click();
  await expect(
    detail.getByText("Update added to the repair timeline"),
  ).toBeVisible();
  await page.goto(url);
  await expect(
    page.getByText("I have received the report and will contact you."),
  ).toBeVisible();
  await axe(page);
  await manager.close();
});
test("320px layout, reduced motion, long translated content and keyboard navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await login(page, "Maya");
  await page.getByLabel("Content language").selectOption("tr-TR");
  await expect(page.getByText("Adresiniz", { exact: true })).toBeVisible();
  await axe(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "docs/screenshots/resident-mobile.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Guide", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/home/guide");
  await axe(page);
  await page.setViewportSize({ width: 640, height: 500 });
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("public routes, unauthenticated requests and cross-role command denial", async ({
  page,
}) => {
  for (const route of ["/", "/sign-in", "/invite/invalid-token"]) {
    await page.goto(route);
    await axe(page);
    await page.screenshot({
      path: `docs/screenshots/ui-${screenName(route)}.png`,
      fullPage: true,
    });
  }
  const unauth = await page.request.post("/api/command", {
    headers: { Origin: "http://127.0.0.1:3100" },
    data: {
      operation: "createInvite",
      input: { roomId: "30000000-0000-4000-8000-000000000001" },
    },
  });
  expect(unauth.status()).toBe(401);
  await login(page, "Maya");
  const denied = await page.request.post("/api/command", {
    headers: { Origin: "http://127.0.0.1:3100" },
    data: {
      operation: "createInvite",
      input: { roomId: "30000000-0000-4000-8000-000000000001" },
    },
  });
  expect(denied.status()).toBe(403);
  const csrf = await page.request.post("/api/command", {
    headers: { Origin: "https://other.example" },
    data: {
      operation: "askRoomly",
      input: {
        roomId: "30000000-0000-4000-8000-000000000001",
        question: "bins",
      },
    },
  });
  expect(csrf.status()).toBe(403);
});

test("guide discovery, cited section navigation, repair filters and private invite copying", async ({
  page,
  context,
}) => {
  await login(page, "Maya");
  await page.goto("/home/guide");
  await page.getByLabel("Content language").selectOption("en-GB");
  await page
    .getByRole("searchbox", { name: "Search your guide" })
    .fill("zzzznotfound");
  await expect(page.getByText("Nothing here matches yet.")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.getByRole("button", { name: "Essentials", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Essentials", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".guide-sections")).not.toContainText("Guests");
  await page.getByRole("button", { name: "Everything", exact: true }).click();
  await page.getByRole("searchbox", { name: "Search your guide" }).fill("Bins");
  await expect(page.locator(".guide-sections details")).toHaveCount(1);
  await page.goto("/home/guide#50000000-0000-4000-8000-000000000006");
  await expect(
    page.locator('[id="50000000-0000-4000-8000-000000000006"]'),
  ).toHaveAttribute("open", "");
  await page.goto("/home/repairs");
  await page.getByRole("button", { name: "Resolved", exact: true }).click();
  await expect(
    page.getByText("Kitchen tap dripping", { exact: true }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expect(
    page.getByText("Kitchen tap dripping", { exact: true }),
  ).toBeVisible();
  await login(page, "Elena");
  await page.goto(root + "/invites");
  await page
    .getByRole("button", { name: "Create invitation", exact: true })
    .click();
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Copy invitation link" }).click();
  await expect(
    page.getByText("Invitation link copied", { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    await page.getByLabel("Private invitation link").inputValue(),
  );
  for (const route of [
    root,
    root + "/content",
    root + "/invites",
    root + "/questions",
    root + "/maintenance",
    root + "/settings",
  ]) {
    await page.setViewportSize({ width: 320, height: 760 });
    await page.goto(route);
    await axe(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `docs/screenshots/mobile-${screenName(route)}.png`,
      fullPage: true,
    });
  }
});

test("multiple-home residents keep their selected home through onboarding, navigation and repairs", async ({
  page,
}) => {
  await login(page, "Elena");
  async function run(operation: string, input: object) {
    const response = await page.request.post("/api/command", {
      headers: { origin: "http://127.0.0.1:3100" },
      data: { operation, input },
    });
    const result = await response.json();
    expect(result.ok, JSON.stringify(result.error)).toBe(true);
    return result.data;
  }
  const room = await run("createRoom", {
    propertyId: property,
    name: "Courtyard room",
    capacity: 3,
    managerName: "Elena",
    managerPhone: "07700 900123",
    emergencyPhone: "07700 900124",
    locales: ["en-GB"],
  });
  for (const [key, kind, title, body] of [
    [
      "address",
      "essential",
      "Courtyard address",
      "22 Example Street, Cambridge",
    ],
    ["manager", "essential", "Courtyard manager", "Elena · 07700 900123"],
    [
      "emergency",
      "safety",
      "Courtyard emergency",
      "For immediate danger call 999.",
    ],
    [
      "access",
      "access",
      "Courtyard access",
      "Arrange key handover with Elena.",
    ],
    [
      "repairs",
      "resource",
      "Courtyard repairs",
      "Report repairs using Roomly.",
    ],
  ])
    await run("createContentBlock", {
      roomId: room.id,
      key,
      kind,
      title,
      body,
      visibility: "member",
      data: { key },
    });
  await run("publishContentChanges", { roomId: room.id });
  const invitation = await run("createInvite", { roomId: room.id });
  await login(page, "Maya");
  const claim = await run("claimInvite", { rawToken: invitation.token });
  await page.goto(`/onboarding/resident/${claim.membershipId}`);
  for (let step = 2; step < 6; step++)
    await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Go to Roomly Home" }).click();
  await expect(page).toHaveURL(`/home?room=${room.id}`);
  const nav = page.getByRole("navigation", { name: "Resident navigation" });
  await nav.getByRole("link", { name: "Guide", exact: true }).click();
  await expect(page).toHaveURL(`/home/guide?room=${room.id}`);
  await expect(
    page.getByText("Courtyard address", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Wi-Fi", { exact: true })).not.toBeVisible();
  await nav.getByRole("link", { name: "Ask", exact: true }).click();
  await expect(page).toHaveURL(`/home/ask?room=${room.id}`);
  await nav.getByRole("link", { name: "Repairs", exact: true }).click();
  await page
    .getByRole("link", { name: "Report a repair", exact: true })
    .click();
  await expect(page).toHaveURL(`/home/repairs/new?room=${room.id}`);
  await page.getByLabel("Short title").fill("Courtyard tap");
  await page.getByLabel("What’s happening?").fill("The tap drips slowly.");
  await page.getByLabel("Where in your home?").fill("Kitchen");
  await page.getByLabel("When are you available?").fill("Monday morning");
  await page.getByRole("button", { name: "Review repair report" }).click();
  await page.getByRole("button", { name: "Confirm and submit repair" }).click();
  await expect(page).toHaveURL(
    new RegExp(`/home/repairs/[0-9a-f-]+\\?room=${room.id}$`),
  );
  await expect(
    page.getByRole("heading", { name: "Courtyard tap", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "All repairs", exact: true }).click();
  await expect(page).toHaveURL(`/home/repairs?room=${room.id}`);
  await nav.getByRole("link", { name: "Home", exact: true }).click();
  await page
    .getByLabel("Choose your home")
    .selectOption("30000000-0000-4000-8000-000000000001");
  await nav.getByRole("link", { name: "Guide", exact: true }).click();
  await expect(page.getByText("Wi-Fi", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Courtyard address", { exact: true }),
  ).not.toBeVisible();
});
