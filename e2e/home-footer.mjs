// node e2e/home-footer.mjs http://127.0.0.1:4186 (or https://94api.dev)
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const base = new URL(process.argv[2] || 'http://127.0.0.1:4186')
const local = ['127.0.0.1', 'localhost'].includes(base.hostname)
assert(local || base.origin === 'https://94api.dev')
const languages = { en: 'English', vi: 'Tiếng Việt', fr: 'Français', ru: 'Русский', ja: '日本語', zhCN: '简体中文', zhTW: '繁體中文' }
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
context.setDefaultTimeout(15000)
const page = await context.newPage()
const errors = []
page.on('pageerror', error => errors.push(error.message))
let cases = 0
try {
  await context.addCookies([{ name: 'vite-ui-theme', value: 'system', url: base.origin }])
  if (local) {
    await context.route(`${base.origin}/api/**`, route => {
      const path = new URL(route.request().url()).pathname
      if (path === '/api/user/auth/refresh') return route.fulfill({ status: 401, json: { success: false, code: 'AUTH_UNAUTHORIZED' } })
      let data = []
      if (path === '/api/status') data = { setup: true, system_name: '94API', logo: '/94api-logo-transparent.png', user_agreement_enabled: true, privacy_policy_enabled: true, custom_oauth_providers: [], announcements: [] }
      if (path === '/api/setup') data = { status: true }
      if (['/api/notice', '/api/home_page_content'].includes(path)) data = ''
      if (['/api/user-agreement', '/api/privacy-policy'].includes(path)) data = '# Legal document\nLocal navigation fixture.'
      return route.fulfill({ json: { success: true, data } })
    })
  }
  await page.goto(base.href)
  const frame = page.frameLocator('iframe[src^="/94api-theme/home.html"]')
  const footer = frame.getByRole('contentinfo')
  await footer.waitFor()
  await frame.locator('html[data-theme]').waitFor({ state: 'attached' })
  let current = 'en'
  for (const [language, label] of Object.entries(languages)) {
    const file = { zhCN: 'zh', zhTW: 'zh-TW' }[current] || current
    const copy = JSON.parse(readFileSync(new URL(`../web/src/i18n/locales/${file}.json`, import.meta.url), 'utf8')).translation
    await page.getByRole('button', { name: copy['Change language'], exact: true }).click()
    await page.getByRole('menuitem', { name: label, exact: true }).click()
    await frame.locator(`html[lang="${{ zhCN: 'zh-CN', zhTW: 'zh-TW' }[language] || language}"]`).waitFor({ state: 'attached' })
    current = language
    const translated = await frame.locator('body').evaluate((_, language) => [
      'Access AI models, manage API keys, and track usage in one place.',
      'Resources', 'Docs', 'Quick start', 'Models & pricing', 'Support', 'Terms of Use', 'Privacy Policy',
    ].map(key => window.API94_TRANSLATIONS[key][language]), language)
    for (const text of translated) assert((await footer.textContent()).includes(text), `${language}: ${text}`)
    assert.deepEqual(await footer.locator('nav a').evaluateAll(links => links.map(link => [link.getAttribute('href'), link.target])), [
      ['/docs', '_top'], ['/docs/quickstart', '_top'], ['/pricing', '_top'],
      ['mailto:support@94api.dev', '_top'], ['/user-agreement', '_top'], ['/privacy-policy', '_top'],
    ])
    assert((await footer.innerText()).includes('© 2023–2026 QuantumNous'))
    const attribution = footer.getByRole('link', { name: 'New API', exact: true })
    assert.equal(await attribution.getAttribute('href'), 'https://github.com/QuantumNous/new-api')
    assert.equal(await attribution.getAttribute('rel'), 'noopener noreferrer')
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 })
      for (const theme of ['light', 'dark']) {
        await page.emulateMedia({ colorScheme: theme })
        await frame.locator(`html[data-theme="${theme}"]`).waitFor({ state: 'attached' })
        await footer.scrollIntoViewIfNeeded()
        const layout = await footer.evaluate(footer => {
          const box = footer.getBoundingClientRect()
          const links = [...footer.querySelectorAll('nav a')]
          const images = [...footer.querySelectorAll('img')].filter(image => getComputedStyle(image).display !== 'none')
          return {
            pageFits: document.documentElement.scrollWidth <= innerWidth + 1,
            footerFits: footer.scrollWidth <= footer.clientWidth + 1,
            linksFit: links.every(link => { const rect = link.getBoundingClientRect(); return rect.left >= box.left && rect.right <= box.right && link.scrollWidth <= link.clientWidth + 1 }),
            touchTargets: links.every(link => link.getBoundingClientRect().height >= 44),
            oneLogo: images.length === 1 && images[0].complete && images[0].naturalWidth > 0,
            logo: images[0]?.getAttribute('src'),
          }
        })
        assert.deepEqual(layout, { pageFits: true, footerFits: true, linksFit: true, touchTargets: true, oneLogo: true, logo: `/94api-logo-wordmark-${theme}-v1.png` }, `${language}/${width}/${theme}`)
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true)
        if (process.env.SCREENSHOT_DIR && language === 'vi' && [320, 390, 1440].includes(width)) {
          await footer.screenshot({ path: resolve(process.env.SCREENSHOT_DIR, `home-footer-${language}-${width}-${theme}.png`) })
        }
        cases++
      }
    }
  }
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const path of ['/docs', '/docs/quickstart', '/user-agreement', '/privacy-policy']) {
      await page.goto(base.href)
      const link = footer.locator(`a[href="${path}"]`)
      await link.focus()
      await page.keyboard.press('Enter')
      await page.waitForURL(new URL(path, base).href)
      assert.equal(await page.locator('iframe[src^="/94api-theme/home.html"]').count(), 0)
      await page.getByRole('heading', { level: 1 }).first().waitFor()
    }
  }
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ origin: base.origin, fixtures: local, cases, locales: 7, themes: 2, widths: 5, keyboardNavigations: 8, pageErrors: 0 }))
} finally { await context.close(); await browser.close() }
