import assert from 'node:assert/strict'

import { chromium } from 'playwright'

const base = process.argv[2] || 'https://94api.dev'
const requestedWidths = process.argv.slice(3).map(Number)
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  for (const width of requestedWidths.length
    ? requestedWidths
    : [320, 390, 1440]) {
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        colorScheme: theme,
        locale: 'en',
      })
      try {
        const page = await context.newPage()
        const errors = []
        page.on('pageerror', (error) => errors.push(error.message))
        for (const route of ['/', '/docs', '/sign-in', '/sign-up']) {
          assert.equal(
            (await page.goto(new URL(route, base).href)).status(),
            200
          )
          if (route === '/') {
            await page.locator('.api94-home-frame').waitFor()
          }
          const images = page.locator(
            `img[src="/94api-logo-wordmark-${theme}-v1.png"]`
          )
          await images.first().waitFor()
          const metrics = await images.first().evaluate(async (image) => {
            await image.decode()
            await Promise.all(
              image
                .closest('a')
                .getAnimations({ subtree: true })
                .map((animation) => animation.finished)
            )
            const rect = image.getBoundingClientRect()
            const label = image.closest('a')
            const visibleLabels = [
              ...label.querySelectorAll('span, h1'),
            ].filter((element) => {
              const bounds = element.getBoundingClientRect()
              return (
                bounds.width > 1 &&
                bounds.height > 1 &&
                element.textContent.trim()
              )
            })
            return {
              width: rect.width,
              height: rect.height,
              naturalRatio: image.naturalWidth / image.naturalHeight,
              fit: getComputedStyle(image).objectFit,
              duplicateLabels: visibleLabels.length,
              overflow: document.documentElement.scrollWidth > innerWidth,
              favicon: document
                .querySelector('link[rel="icon"]')
                ?.getAttribute('href'),
            }
          })
          assert(
            metrics.width >= 90 && metrics.height >= 27,
            JSON.stringify(metrics)
          )
          assert(
            Math.abs(metrics.width / metrics.height - metrics.naturalRatio) <
              0.1
          )
          assert.equal(metrics.fit, 'contain')
          assert.equal(metrics.duplicateLabels, 0)
          assert.equal(metrics.overflow, false)
          assert.equal(metrics.favicon, '/94api-logo-mark-v1.png')
          if (route === '/docs') {
            const footer = page.locator('footer img')
            assert.equal(
              await footer.getAttribute('src'),
              `/94api-logo-wordmark-${theme}-v1.png`
            )
            assert((await footer.boundingBox()).width >= 90)
          }
          if (
            process.env.SCREENSHOT_DIR &&
            (route === '/' || route === '/sign-in')
          ) {
            await page.screenshot({
              path: `${process.env.SCREENSHOT_DIR}/94api-logo-${theme}-${width}-${route === '/' ? 'home' : 'login'}.png`,
            })
          }
        }
        assert.deepEqual(errors, [])
        console.log(JSON.stringify({ width, theme, routes: 4, passed: true }))
      } finally {
        await context.close()
      }
    }
  }
} finally {
  await browser.close()
}
