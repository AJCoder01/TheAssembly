import { expect, test } from "@playwright/test";

const readyUrl = "/?loader=100";
const heroUrl = "/?entry=silent";

test("01 booting renders only the entry stage and locks the main experience", async ({
  page,
}) => {
  await page.goto("/?loader=0");
  await expect(page.locator(".experience")).toHaveAttribute(
    "data-experience-state",
    "booting",
  );
  await expect(page.locator(".entry-shell")).toBeVisible();
  await expect(page.locator("main")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator("main")).toHaveAttribute("inert", "");
});

test("02 navigation is absent while the entry is booting or ready", async ({
  page,
}) => {
  await page.goto(readyUrl);
  await expect(page.locator(".site-nav")).toHaveCount(0);
  await expect(page.locator(".route-nav")).toHaveCount(0);
});

test("03 project titles and motifs are visually hidden during entry", async ({
  page,
}) => {
  await page.goto(readyUrl);
  await expect(page.locator("#selected-work")).toBeHidden();
  await expect(page.locator(".stage-motif").first()).toBeHidden();
  await expect(page.getByRole("heading", { name: "Rewind", exact: true })).toBeHidden();
});

test("04 the ready loader owns exactly one visible media object", async ({
  page,
}) => {
  await page.goto(readyUrl);
  await expect(page.locator("img:visible")).toHaveCount(1);
  await expect(page.locator(".editorial-media")).toBeVisible();
  await expect(page.getByLabel("Loading progress")).toContainText("100");
});

test("05 entry controls disable immediately and the transition runs once", async ({
  page,
}) => {
  await page.goto(readyUrl);
  const silent = page.locator(".entry-actions button").nth(1);
  await silent.click();
  await expect(silent).toBeDisabled();
  await expect(page.locator(".experience")).toHaveAttribute(
    "data-experience-state",
    "entering",
  );
  await expect(page.locator(".experience")).toHaveAttribute(
    "data-experience-state",
    "hero",
  );
  await expect(page.locator(".entry-shell")).toHaveCount(0);
});

test("06 loader unmounts completely in the stable hero", async ({ page }) => {
  await page.goto(heroUrl);
  await expect(page.locator(".experience")).toHaveAttribute(
    "data-experience-state",
    "hero",
  );
  await expect(page.locator(".entry-shell")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Enter/ })).toHaveCount(0);
});

test("07 stable hero clearly states identity and role", async ({ page }) => {
  await page.goto(heroUrl);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("AyushJha");
  await expect(page.locator(".hero-role")).toHaveText(
    "Product builder and developer",
  );
  await expect(page.locator(".hero-scroll")).toHaveText("Scroll to explore");
});

test("08 the first project remains below the initial hero viewport", async ({
  page,
}) => {
  await page.goto(heroUrl);
  const hero = await page.locator(".editorial-stage").boundingBox();
  const work = await page.locator("#selected-work").boundingBox();
  expect(hero).not.toBeNull();
  expect(work).not.toBeNull();
  expect(work!.y).toBeGreaterThanOrEqual(hero!.height * 1.7);
  await expect(page.locator(".prologue-handoff")).toHaveCSS("opacity", "0");
});

test("09 Rewind title is withheld through the first half of the prologue", async ({
  page,
}) => {
  await page.goto("/?entry=silent&scroll=50");
  await expect(page.locator(".prologue-count")).toBeVisible();
  await expect(page.locator(".prologue-handoff")).toHaveCSS("opacity", "0");
});

test("10 Rewind is introduced only at the late prologue handoff", async ({
  page,
}) => {
  await page.goto("/?entry=silent&scroll=90");
  await expect(page.locator(".prologue-handoff")).toBeVisible();
  await expect(page.locator(".prologue-handoff strong")).toHaveText("Rewind");
  await expect(page.locator(".site-nav")).toBeVisible();
});

test("11 the desktop project stage mounts only the active project", async ({
  page,
}) => {
  await page.goto("/?entry=silent&y=1900");
  await expect(page.locator(".stage-project")).toHaveCount(1);
  await expect(page.locator(".stage-project--rewind")).toHaveCount(1);
  await expect(page.locator(".stage-project--toc-oracle")).toHaveCount(0);
  await expect(page.locator(".stage-project--asim-tracker")).toHaveCount(0);
});

test("12 project motifs never coexist in the active desktop stage", async ({
  page,
}) => {
  await page.goto("/?entry=silent&y=3000");
  await expect(page.locator(".work-stage .stage-motif")).toHaveCount(1);
  await expect(page.locator(".work-stage .stage-motif--oracle")).toBeVisible();
  await expect(page.locator(".work-stage .stage-motif--rewind")).toHaveCount(0);
  await expect(page.locator(".work-stage .stage-motif--asim")).toHaveCount(0);
});

test("13 mobile loader keeps identity, media, and controls in separate bands", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(readyUrl);
  const identity = await page.locator(".entry-identity").boundingBox();
  const media = await page.locator(".editorial-media").boundingBox();
  const actions = await page.locator(".entry-actions").boundingBox();
  expect(identity).not.toBeNull();
  expect(media).not.toBeNull();
  expect(actions).not.toBeNull();
  expect(identity!.y + identity!.height).toBeLessThan(media!.y);
  expect(media!.y + media!.height).toBeLessThan(actions!.y);
});

test("14 mobile hero orders name, media, role, and scroll without overlap", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(heroUrl);
  const name = await page.locator(".hero-name").boundingBox();
  const media = await page.locator(".editorial-media").boundingBox();
  const role = await page.locator(".hero-role").boundingBox();
  const scroll = await page.locator(".hero-scroll").boundingBox();
  for (const box of [name, media, role, scroll]) expect(box).not.toBeNull();
  expect(name!.y + name!.height).toBeLessThan(media!.y);
  expect(media!.y + media!.height).toBeLessThan(role!.y);
  expect(role!.y + role!.height).toBeLessThan(scroll!.y);
});

test("15 ending composition and copy remain intact", async ({ page }) => {
  await page.goto(heroUrl);
  await page.locator("#contact-title").scrollIntoViewIfNeeded();
  await expect(page.locator(".contact-ending__upper")).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );
  await expect(page.locator(".contact-ending__lower")).toHaveCSS(
    "background-color",
    "rgb(9, 9, 8)",
  );
  await expect(page.locator("#contact-title")).toHaveText("Let’s build something.");
  await expect(page.locator(".contact-strip span")).toHaveCount(6);
  await expect(page.locator(".contact-links a")).toHaveCount(3);
});

test("16 browser back restores the project scroll position", async ({ page }) => {
  await page.goto("/?entry=silent&y=1900");
  await page.getByRole("link", { name: "View project" }).first().click();
  await expect(page).toHaveURL(/\/work\/rewind$/);
  await page.goBack();
  await expect(page).toHaveURL(/\?entry=silent&y=1900$/);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(1500);
});

test("17 opening and project traversal produce no console or hydration errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(readyUrl);
  await page.getByRole("button", { name: "Enter silent" }).click();
  await expect(page.locator(".experience")).toHaveAttribute(
    "data-experience-state",
    "hero",
  );
  await page.goto("/?entry=silent&y=4200");
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

test("18 the complete experience has no horizontal overflow at 320px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  for (const url of [readyUrl, heroUrl, "/?entry=silent&y=3000"]) {
    await page.goto(url);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  }
});

test("19 reduced motion remains usable and reveals exploration controls on scroll", async ({
  page,
}) => {
  await page.goto("/?entry=silent&motion=reduce");
  await expect(page.locator(".experience")).toHaveAttribute(
    "data-experience-state",
    "hero",
  );
  await page.mouse.wheel(0, 160);
  await expect(page.locator(".experience")).toHaveAttribute(
    "data-experience-state",
    "exploring",
  );
  await expect(page.locator(".site-nav")).toBeVisible();
});

test("20 sound is hidden in the hero and its exploring popover closes clearly", async ({
  page,
}) => {
  await page.goto(readyUrl);
  await page.getByRole("button", { name: "Enter silent" }).click();
  await expect(page.locator(".experience")).toHaveAttribute(
    "data-experience-state",
    "hero",
  );
  await expect(page.locator(".sound-dock")).toBeHidden();
  await page.goto("/?entry=silent&y=1900");
  await expect(page.locator(".sound-dock")).toBeVisible();
  await page.getByRole("button", { name: "Open sound options and music credit" }).click();
  await expect(page.locator(".sound-panel")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".sound-panel")).toHaveCount(0);
});
