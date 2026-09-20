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
context.setDefaultTimeout(30000)
const page = await context.newPage()
const errors = []
page.on('pageerror', error => errors.push(error.message))
page.setDefaultTimeout(30000)

async function checkGoogleAppearance(google, theme, hovered = false) {
  const background = theme === 'dark'
    ? (hovered ? 'rgb(242, 242, 242)' : 'rgb(255, 255, 255)')
    : (hovered ? 'rgb(37, 37, 38)' : 'rgb(19, 19, 20)')
  try {
    // Turnstile can recenter the form while its resized widget loads.
    for (let attempt = 0; attempt < 3; attempt++) {
      if (hovered) await google.hover()
      await page.waitForFunction(({ background, hovered }) => {
        const button = [...document.querySelectorAll('form button')].find(button => button.textContent.includes('Google'))
        return button && (getComputedStyle(button).backgroundColor === background || (hovered && !button.matches(':hover')))
      }, { background, hovered })
      if (!hovered || await google.evaluate(button => button.matches(':hover'))) break
    }
  } catch (error) {
    console.log(JSON.stringify({ expectedBackground: background, actual: await google.evaluate(button => ({ background: getComputedStyle(button).backgroundColor, color: getComputedStyle(button).color, hovered: button.matches(':hover'), disabled: button.disabled, rect: button.getBoundingClientRect().toJSON() })) }))
    if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: resolve(process.env.SCREENSHOT_DIR, 'google-appearance-failure.png') })
    throw error
  }
  const visual = await google.evaluate(button => {
    const style = getComputedStyle(button)
    const rect = button.getBoundingClientRect()
    const icon = button.querySelector('svg')
    const logo = icon.getBoundingClientRect()
    const label = button.lastElementChild
    return {
      color: style.color, background: style.backgroundColor,
      shadow: style.boxShadow, focusVisible: button.matches(':focus-visible'),
      height: rect.height, width: rect.width, formWidth: button.closest('form').getBoundingClientRect().width,
      radius: style.borderRadius, logo: [logo.width, logo.height],
      logoHidden: icon.getAttribute('aria-hidden'),
      colors: [...new Set([...icon.querySelectorAll('path')].map(path => path.getAttribute('fill')))],
      textFits: label.scrollWidth <= label.clientWidth + 1,
    }
  })
  assert.equal(visual.background, background)
  assert.equal(visual.color, theme === 'dark' ? 'rgb(31, 31, 31)' : 'rgb(227, 227, 227)')
  const luminance = color => color.match(/\d+/g).slice(0, 3).map(value => {
    const channel = Number(value) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)
  const levels = [luminance(visual.color), luminance(visual.background)]
  assert((Math.max(...levels) + 0.05) / (Math.min(...levels) + 0.05) >= 4.5)
  assert(visual.height >= 48)
  assert(Math.abs(visual.width - visual.formWidth) < 1)
  assert.equal(visual.radius, '8px')
  assert.deepEqual(visual.logo, [20, 20])
  assert.equal(visual.logoHidden, 'true')
  assert.equal(visual.colors.length, 4)
  assert(visual.textFits)
  return visual
}

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
    if (process.env.AUTH_LANGUAGES && !process.env.AUTH_LANGUAGES.split(',').includes(language)) continue
    const copy = require(`../web/src/i18n/locales/${file}.json`).translation
    await page.evaluate(value => localStorage.setItem('i18nextLng', value), language)
    for (const route of ['sign-in', 'sign-up']) {
      if (process.env.AUTH_ROUTES && !process.env.AUTH_ROUTES.split(',').includes(route)) continue
      console.log(JSON.stringify({ checking: route, language }))
      await page.setViewportSize({ width: 1440, height: 1000 })
      await page.goto(`${origin}/${route}`)
      const prefix = route === 'sign-in' ? 'By signing in' : 'By creating an account'
      const key = `${prefix}, you agree to the <agreement>User Agreement</agreement> and <privacy>Privacy Policy</privacy> of {{systemName}}.`
      const expected = copy[key].replaceAll(/<\/?(?:agreement|privacy)>/g, '').replaceAll('{{systemName}}', status.data.system_name)
      const notice = page.getByText(expected, { exact: true })
      await notice.waitFor()
      await page.locator('input[name="cf-turnstile-response"]').waitFor({ state: 'attached' })
      const google = page.getByRole('button', { name: /Google/ })
      const googleLabel = route === 'sign-up'
        ? copy['Sign up with Google']
        : copy['Continue with {{name}}'].replace('{{name}}', 'Google')
      assert.equal(await google.innerText(), googleLabel)
      assert.equal(await page.getByRole('checkbox').count(), 0)
      assert.equal(await google.isDisabled(), false)
      if (route === 'sign-in') {
        assert.equal(await page.locator('button[type="submit"]').isDisabled(), false)
      } else {
        assert(await google.evaluate(button => Boolean(button.compareDocumentPosition(document.querySelector('input[name="username"]')) & Node.DOCUMENT_POSITION_FOLLOWING)))
        const token = await page.locator('input[name="cf-turnstile-response"]').inputValue()
        assert.equal(await page.locator('button[type="submit"]').isDisabled(), !token)
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
      await page.bringToFront()
      for (const width of [320, 390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 1000 })
        for (const theme of ['light', 'dark']) {
          if (process.env.AUTH_TRACE) console.log(JSON.stringify({ route, language, width, theme }))
          await page.emulateMedia({ colorScheme: theme })
          await page.waitForFunction(value => document.documentElement.classList.contains(value), theme)
          await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth + 1)
          await google.scrollIntoViewIfNeeded()
          await google.evaluate(button => button.blur())
          await page.mouse.move(0, 0)
          const resting = await checkGoogleAppearance(google, theme)
          await checkGoogleAppearance(google, theme, true)
          await page.mouse.move(0, 0)
          await google.focus()
          await page.keyboard.press('Tab')
          await page.keyboard.press('Shift+Tab')
          const focused = await checkGoogleAppearance(google, theme)
          assert(focused.focusVisible)
          assert.notEqual(focused.shadow, resting.shadow)
          await google.evaluate(button => button.blur())
          if (process.env.SCREENSHOT_DIR && language === 'vi' && [320, 1440].includes(width)) {
            await page.screenshot({ path: resolve(process.env.SCREENSHOT_DIR, `google-${route}-${width}-${theme}.png`) })
          }
          if (route === 'sign-up') {
            assert(await google.evaluate(button => button.getBoundingClientRect().bottom <= document.querySelector('input[name="username"]').getBoundingClientRect().top))
          }
          await notice.scrollIntoViewIfNeeded()
          assert.equal(await notice.isVisible(), true)
          assert.equal(await notice.innerText(), expected)
        }
      }
      console.log(JSON.stringify({ route, language, localAssets: Boolean(dist), exactCopy: true, linksOpen: true, googleContrast: 'AA', logo: true, hover: true, keyboardFocus: true, widths: [320,390,768,1024,1440], themes: ['light','dark'], overflow: false }))
    }
  }
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ checksPassed: true, pageErrors: 0 }))
} finally {
  if (process.env.AUTH_TRACE) console.log('Closing test context')
  await context.close()
  if (process.env.AUTH_TRACE) console.log('Closing test browser')
  await browser.close()
  if (process.env.AUTH_TRACE) console.log('Browser cleanup complete')
}
