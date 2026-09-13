import assert from "node:assert/strict";
import { chromium } from "playwright";

// Run against the real Home route, or the static document before building.
const url = process.argv[2] || "https://94api.dev";

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  try {
    for (const width of [320, 390, 768, 1024, 1440]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        permissions: ["clipboard-read", "clipboard-write"],
      });
      try {
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        assert.equal((await page.goto(url)).status(), 200);
        const embedded = !url.endsWith(".html");
        if (embedded) await page.locator('iframe[src="/94api-theme/index.html"]').waitFor();
        const frame = embedded
          ? await page.locator('iframe[src="/94api-theme/index.html"]').contentFrame()
          : page;
        await frame.locator("h1").waitFor();
        assert.match(await frame.locator("h1").innerText(), /Every AI model/);
        for (const protocol of ["Responses", "Chat", "Claude", "Gemini"]) {
          const tab = frame.getByRole("tab", { name: protocol, exact: true });
          await tab.focus();
          await page.keyboard.press("Enter");
          assert.equal(await tab.getAttribute("aria-selected"), "true");
          assert.match(await frame.locator("#request-code").innerText(), /https:\/\/94api\.dev\//);
          const metrics = await frame.locator("body").evaluate(() => ({
            width: innerWidth,
            scrollWidth: document.documentElement.scrollWidth,
          }));
          assert(
            metrics.scrollWidth <= metrics.width,
            `${width}px ${protocol}: horizontal overflow ${JSON.stringify(metrics)}`,
          );
        }
        await page.keyboard.press("Home");
        assert.equal(
          await frame
            .getByRole("tab", { name: "Responses", exact: true })
            .getAttribute("aria-selected"),
          "true",
        );
        await frame.getByRole("button", { name: "Copy request" }).click();
        await frame
          .locator(".copy-button")
          .filter({ hasText: /^Copied$/ })
          .waitFor();
        assert.equal(await frame.locator(".copy-button").innerText(), "Copied");
        const clipboard = await page.evaluate(() => navigator.clipboard.readText());
        assert.match(clipboard, /https:\/\/94api\.dev\/v1\/responses/);
        assert.match(clipboard, /Content-Type: application\/json/);
        await page.evaluate(() => navigator.clipboard.writeText(""));
        if (width <= 980) {
          const menu = frame.getByRole("button", { name: /Menu/ });
          await menu.click();
          assert.equal(await menu.getAttribute("aria-expanded"), "true");
          await page.keyboard.press("Escape");
          assert.equal(await menu.getAttribute("aria-expanded"), "false");
          await menu.click();
          await frame.locator('#primary-nav a[href="#features"]').click();
          assert.equal(await menu.getAttribute("aria-expanded"), "false");
        }
        for (const section of ["#features", "#workflow", ".cta", ".footer"]) {
          await frame.locator(section).scrollIntoViewIfNeeded();
          if (section !== ".footer") await frame.locator(`${section}.visible`).waitFor();
          await frame
            .locator(section)
            .evaluate((element) =>
              Promise.all(element.getAnimations().map((animation) => animation.finished)),
            );
          assert.equal(
            await frame.locator(section).evaluate((element) => getComputedStyle(element).opacity),
            "1",
          );
        }
        const links = await frame
          .locator('a[href^="/"]')
          .evaluateAll((elements) =>
            elements.map((a) => ({ href: a.getAttribute("href"), target: a.target })),
          );
        assert(links.length > 0);
        for (const link of links) {
          assert.equal(link.target, "_top", `${link.href} must leave the embedded homepage`);
          assert(!["/login", "/status", "/terms"].includes(link.href));
        }
        await frame.locator("h1").scrollIntoViewIfNeeded();
        if (process.env.SCREENSHOT_DIR) {
          await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/94api-theme-${width}.png` });
          if (width === 1440) {
            await frame.locator("#features").scrollIntoViewIfNeeded();
            await page.screenshot({
              path: `${process.env.SCREENSHOT_DIR}/94api-theme-features.png`,
            });
          }
        }
        if (embedded) {
          await frame.locator('.hero-actions a[href="/keys"]').click();
          await page.waitForURL(/\/(sign-in|keys)/);
          assert.equal(await page.locator('iframe[src="/94api-theme/index.html"]').count(), 0);
          assert.equal(
            await page
              .locator("body")
              .evaluate(() => document.documentElement.scrollWidth > innerWidth),
            false,
          );
        }
        assert.deepEqual(errors, []);
        console.log(JSON.stringify({ width, passed: true, embedded }));
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
