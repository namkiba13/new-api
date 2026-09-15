import assert from 'node:assert/strict'
import { resolve, sep } from 'node:path'

import { chromium } from 'playwright'

// CDP_URL=http://127.0.0.1:9231 node e2e/captcha-resize.mjs
// CAPTCHA_DIST=web/dist previews local assets against the real public API/CAPTCHA.
const origin = 'https://94api.dev'
const routes = (
  process.env.CAPTCHA_ROUTES || 'sign-up,sign-in,forgot-password'
).split(',')
const languages = (
  process.env.CAPTCHA_LANGUAGES || 'vi,en,fr,ru,ja,zhCN,zhTW'
).split(',')
const dist = process.env.CAPTCHA_DIST && resolve(process.env.CAPTCHA_DIST)
const browser = process.env.CDP_URL
  ? await chromium.connectOverCDP(process.env.CDP_URL)
  : await chromium.launch({ channel: 'msedge', headless: true })
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
})
const page = await context.newPage()
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
page.setDefaultTimeout(30000)

try {
  await context.addCookies([
    {
      name: 'vite-ui-theme',
      value: 'system',
      url: origin,
      secure: true,
      sameSite: 'Lax',
    },
  ])
  if (dist) {
    await context.route(`${origin}/**`, (route) => {
      const pathname = new URL(route.request().url()).pathname
      if (routes.some((name) => pathname === `/${name}`)) {
        return route.fulfill({ path: resolve(dist, 'index.html') })
      }
      if (pathname.startsWith('/static/')) {
        const file = resolve(dist, `.${pathname}`)
        assert.ok(file.startsWith(`${dist}${sep}`))
        return route.fulfill({ path: file })
      }
      return route.continue()
    })
  }
  await page.goto(`${origin}/${routes[0]}`)
  for (const language of languages) {
    await page.evaluate(
      (value) => localStorage.setItem('i18nextLng', value),
      language
    )
    for (const route of routes) {
      await page.setViewportSize({ width: 1440, height: 1000 })
      assert.equal((await page.goto(`${origin}/${route}`)).status(), 200)
      const input = page.locator('input[name="cf-turnstile-response"]')
      await input.waitFor({ state: 'attached' })
      let previous
      for (const width of [1440, 320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 1000 })
        for (const theme of ['light', 'dark']) {
          await page.emulateMedia({ colorScheme: theme })
          await page.waitForFunction(
            (theme) => document.documentElement.classList.contains(theme),
            theme
          )
          await page.waitForFunction(
            () => {
              const input = document.querySelector(
                'input[name="cf-turnstile-response"]'
              )
              const widget =
                input?.previousElementSibling?.getBoundingClientRect()
              const host = input?.parentElement?.getBoundingClientRect()
              if (
                !widget ||
                !host ||
                document.documentElement.scrollWidth > innerWidth + 1
              ) {
                return false
              }
              return host.width < 300
                ? widget.width < 200 && widget.height >= 140
                : widget.width >= 300 &&
                    widget.height >= 60 &&
                    widget.height < 100
            },
            undefined,
            { timeout: 15000 }
          )
          const metrics = await input.evaluate((element) => {
            const widget =
              element.previousElementSibling.getBoundingClientRect()
            const host = element.parentElement.getBoundingClientRect()
            return {
              id: element.id,
              compact: widget.width < 200,
              fits:
                widget.left >= host.left - 1 && widget.right <= host.right + 1,
              centered:
                Math.abs(
                  widget.left + widget.width / 2 - host.left - host.width / 2
                ) < 2,
            }
          })
          assert.equal(metrics.fits, true)
          assert.equal(metrics.centered, true)
          if (previous?.compact === metrics.compact) {
            assert.equal(metrics.id, previous.id)
          }
          const field = page
            .locator('input[name="username"], input[name="email"]')
            .first()
          await field.fill(
            route === 'forgot-password' ? 'layout@example.com' : 'layout-check'
          )
          assert.equal(await input.getAttribute('id'), metrics.id)
          await field.fill('')
          if (
            process.env.CAPTCHA_SCREENSHOTS &&
            language === 'vi' &&
            [320, 1440].includes(width)
          ) {
            await page.screenshot({
              path: resolve(
                process.env.CAPTCHA_SCREENSHOTS,
                `captcha-${dist ? 'local' : 'live'}-${route}-${width}-${theme}.png`
              ),
              fullPage: true,
            })
          }
          previous = metrics
        }
      }
      console.log(
        JSON.stringify({
          route,
          language,
          localAssets: Boolean(dist),
          widths: [1440, 320, 390, 768, 1440],
          themes: ['light', 'dark'],
          fits: true,
          centered: true,
          stableWhileTyping: true,
        })
      )
    }
  }
  assert.deepEqual(errors, [])
} finally {
  await context.unrouteAll({ behavior: 'ignoreErrors' })
  await context.close()
  await browser.close()
}
