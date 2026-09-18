// Read-only public UI verification; AUTH_DIST previews local assets against production APIs.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { resolve, sep } from 'node:path'
import { chromium } from 'playwright'

const require = createRequire(import.meta.url)
const origin = 'https://94api.dev'
const dist = process.env.AUTH_DIST && resolve(process.env.AUTH_DIST)
const locales = { en: 'en', vi: 'vi', fr: 'fr', ru: 'ru', ja: 'ja', zhCN: 'zh', zhTW: 'zh-TW' }
const browser = process.env.CDP_URL
  ? await chromium.connectOverCDP(process.env.CDP_URL)
  : await chromium.launch({ channel: 'msedge', headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await context.newPage()
const errors = []
page.on('pageerror', error => errors.push(error.message))
page.setDefaultTimeout(30000)
try {
  await context.addCookies([{ name: 'vite-ui-theme', value: 'system', url: origin, secure: true }])
  if (dist) {
    await context.route(`${origin}/**`, route => {
      const path = new URL(route.request().url()).pathname
      if (['/sign-in', '/sign-up', '/user-agreement', '/privacy-policy'].includes(path)) return route.fulfill({ path: resolve(dist, 'index.html') })
      if (path.startsWith('/static/')) {
        const file = resolve(dist, `.${path}`)
        assert(file.startsWith(`${dist}${sep}`))
        return route.fulfill({ path: file })
      }
      return route.continue()
    })
  }
  const status = await (await context.request.get(`${origin}/api/status`)).json()
  assert.equal(status.data.user_agreement_enabled, true)
  assert.equal(status.data.privacy_policy_enabled, true)
  assert.equal(status.data.turnstile_check, true)
  assert.equal(status.data.email_verification, true)
  await page.goto(`${origin}/sign-in`)
  for (const [language, file] of Object.entries(locales)) {
    const copy = require(`../web/src/i18n/locales/${file}.json`).translation
    await page.evaluate(value => localStorage.setItem('i18nextLng', value), language)
    for (const route of ['sign-in', 'sign-up']) {
      await page.setViewportSize({ width: 1440, height: 1000 })
      await page.goto(`${origin}/${route}`)
      const prefix = route === 'sign-in' ? 'By signing in' : 'By creating an account'
      const key = `${prefix}, you agree to the <agreement>User Agreement</agreement> and <privacy>Privacy Policy</privacy> of {{systemName}}.`
      const expected = copy[key].replaceAll(/<\/?(?:agreement|privacy)>/g, '').replaceAll('{{systemName}}', status.data.system_name)
      const notice = page.getByText(expected, { exact: true })
      await notice.waitFor()
      await page.locator('input[name="cf-turnstile-response"]').waitFor({ state: 'attached' })
      const google = page.getByRole('button', { name: /Google/ })
      if (route === 'sign-in') {
        assert.equal(await page.getByRole('checkbox').count(), 0)
        assert.equal(await google.isDisabled(), false)
        assert.equal(await page.locator('button[type="submit"]').isDisabled(), false)
      } else {
        const checkbox = page.getByRole('checkbox')
        assert.equal(await checkbox.isChecked(), false)
        assert.equal(await google.isDisabled(), true)
        assert.equal(await page.locator('button[type="submit"]').isDisabled(), true)
        await checkbox.focus()
        await page.keyboard.press('Space')
        assert.equal(await checkbox.isChecked(), true)
        assert.equal(await google.isDisabled(), false)
        await page.keyboard.press('Space')
        assert.equal(await google.isDisabled(), true)
      }
      for (const path of ['/user-agreement', '/privacy-policy']) {
        const link = notice.locator(`a[href="${path}"]`)
        assert.equal(await link.getAttribute('target'), '_blank')
        const opened = context.waitForEvent('page')
        await link.click()
        const documentPage = await opened
        await documentPage.locator('.prose-neutral a[href="mailto:support@94api.dev"]').first().waitFor()
        await documentPage.close()
      }
      for (const width of [320, 390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 1000 })
        for (const theme of ['light', 'dark']) {
          await page.emulateMedia({ colorScheme: theme })
          await page.waitForFunction(value => document.documentElement.classList.contains(value), theme)
          await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth + 1)
          await notice.scrollIntoViewIfNeeded()
          assert.equal(await notice.isVisible(), true)
          assert.equal(await notice.innerText(), expected)
        }
      }
      console.log(JSON.stringify({ route, language, localAssets: Boolean(dist), exactCopy: true, linksOpen: true, widths: [320,390,768,1024,1440], themes: ['light','dark'], overflow: false }))
    }
  }
  assert.deepEqual(errors, [])
} finally {
  await context.unrouteAll({ behavior: 'ignoreErrors' })
  await context.close()
  await browser.close()
}
