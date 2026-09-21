// node e2e/docs-browser.mjs http://127.0.0.1:4186 (or https://94api.dev)
// Public-layout fixtures are restricted to loopback; no live account/inference requests.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

import { DOCS_GUIDES, DOCS_REVIEW_DATE } from '../web/src/features/docs/data.ts'
import { GUIDE_CONTENT } from '../web/src/features/docs/guide-content.ts'
import { docsUi } from '../web/src/features/docs/translations.ts'

const base = new URL(process.argv[2] || 'http://127.0.0.1:4186')
const local = ['127.0.0.1', 'localhost'].includes(base.hostname)
assert(local || base.origin === 'https://94api.dev')
const languages = { en: 'en', vi: 'vi', fr: 'fr', ru: 'ru', ja: 'ja', zhCN: 'zh', zhTW: 'zh-TW' }
const widths = [320, 390, 768, 1024, 1440]
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'] })
context.setDefaultTimeout(15000)
const errors = []
const unexpected = new Set()
const page = await context.newPage()
page.on('pageerror', error => errors.push(error.message))
try {
  await context.addCookies([{ name: 'vite-ui-theme', value: 'system', url: base.origin }])
  if (local) await context.route(`${base.origin}/api/**`, route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/user/auth/refresh') return route.fulfill({ status: 401, json: { success: false, code: 'AUTH_UNAUTHORIZED' } })
    let data
    if (path === '/api/status') data = { setup: true, system_name: '94API', logo: '/94api-logo-transparent.png', custom_oauth_providers: [], HeaderNavModules: JSON.stringify({ home: true, pricing: true, docs: true }), announcements: [] }
    else if (path === '/api/setup') data = { status: true }
    else if (path === '/api/notice') data = ''
    else if (path === '/api/uptime/status') data = []
    else { unexpected.add(path); data = [] }
    return route.fulfill({ json: { success: true, data } })
  })
  await page.goto(new URL('/docs', base).href)
  for (const [language, file] of Object.entries(languages)) {
    const copy = JSON.parse(readFileSync(new URL(`../web/src/i18n/locales/${file}.json`, import.meta.url), 'utf8')).translation
    await page.evaluate(language => localStorage.setItem('i18nextLng', language), language)
    await page.goto(new URL('/docs', base).href)
    await page.getByRole('heading', { level: 1 }).waitFor()
    for (const guide of DOCS_GUIDES) assert.equal(await page.getByRole('heading', { level: 2, name: copy[guide.title], exact: true }).count(), 1)
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 })
      for (const theme of ['light', 'dark']) {
        await page.emulateMedia({ colorScheme: theme })
        await page.waitForFunction(theme => document.documentElement.classList.contains(theme), theme)
        const fits = await page.locator('.docs-shell').evaluate(shell => {
          const elements = [...shell.querySelectorAll('h1, h2, article, input')]
          return document.documentElement.scrollWidth <= innerWidth + 1 && elements.every(element => {
            const box = element.getBoundingClientRect()
            return box.left >= -1 && box.right <= innerWidth + 1 && element.scrollWidth <= element.clientWidth + 1
          })
        })
        assert.equal(fits, true, `index/${language}/${width}/${theme}`)
        if (process.env.SCREENSHOT_DIR && language === 'vi' && [320, 1440].includes(width)) {
          await page.screenshot({ path: resolve(process.env.SCREENSHOT_DIR, `docs-index-${width}-${theme}.png`) })
        }
      }
    }
    const search = page.getByRole('textbox', { name: docsUi(language, 'search'), exact: true })
    await search.fill(copy[DOCS_GUIDES.find(guide => guide.slug === 'codex').title])
    assert.equal(await page.locator('.docs-shell article').count(), 1)
    await search.fill('no-such-guide-94api')
    await page.getByText(docsUi(language, 'noResults'), { exact: true }).waitFor()
    await page.getByRole('button', { name: docsUi(language, 'clear'), exact: true }).click()
    assert.equal(await page.locator('.docs-shell article').count(), 8)
    await page.getByRole('button', { name: docsUi(language, 'copyBase'), exact: true }).click()
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'https://94api.dev/v1')
    await page.getByRole('link', { name: docsUi(language, 'view'), exact: true }).first().click()
    await page.waitForURL('**/docs/quickstart')
    for (const guide of DOCS_GUIDES) {
      assert.equal((await page.goto(new URL(`/docs/${guide.slug}`, base).href)).status(), 200)
      const main = page.locator('.docs-shell main')
      await main.getByRole('heading', { level: 1, name: copy[guide.title], exact: true }).waitFor()
      assert.equal(await main.getByText(copy[guide.description], { exact: true }).count(), 1)
      for (const section of GUIDE_CONTENT[guide.slug]) {
        const rendered = main.locator(`section[id="${section.id}"]`)
        assert.equal(await rendered.getByRole('heading', { level: 2 }).innerText(), copy[section.title])
        const text = [...section.paragraphs, ...(section.note ? [section.note] : [])].map(key => copy[key])
        assert.deepEqual(await rendered.locator('p').allTextContents(), text)
        assert.deepEqual(await rendered.locator('pre code').allTextContents(), (section.code ?? []).map(code => code.value))
      }
      const references = main.getByRole('region', { name: copy['Official references'] })
      assert.equal(await references.locator('time').getAttribute('datetime'), DOCS_REVIEW_DATE)
      for (const reference of guide.references) {
        const link = references.locator(`a[href="${reference.href}"]`)
        assert.equal(await link.getAttribute('target'), '_blank')
        assert.equal(await link.getAttribute('rel'), 'noopener noreferrer')
      }
      if (local && guide.slug === 'cc-switch') {
        await page.setViewportSize({ width: 320, height: 1000 })
        const protocols = main.locator('header dd').last()
        const original = await protocols.textContent()
        // The previously published multi-protocol value must not widen the mobile grid.
        await protocols.evaluate(element => { element.textContent = 'Responses API · Anthropic Messages · Gemini API' })
        assert.equal(await main.evaluate(main => main.scrollWidth <= main.clientWidth + 1), true, 'Long protocol metadata fits at 320px')
        await protocols.evaluate((element, text) => { element.textContent = text }, original)
      }
      for (const width of widths) {
        await page.setViewportSize({ width, height: 1000 })
        for (const theme of ['light', 'dark']) {
          await page.emulateMedia({ colorScheme: theme })
          await page.waitForFunction(theme => document.documentElement.classList.contains(theme), theme)
          const dimensions = await main.evaluate(main => ({ pageFits: document.documentElement.scrollWidth <= innerWidth + 1, mainFits: main.scrollWidth <= main.clientWidth + 1, headingsFit: [...main.querySelectorAll('h1, h2')].every(heading => heading.scrollWidth <= heading.clientWidth + 1), codeFits: [...main.querySelectorAll('pre')].every(pre => pre.getBoundingClientRect().right <= innerWidth + 1) }))
          assert.deepEqual(dimensions, { pageFits: true, mainFits: true, headingsFit: true, codeFits: true }, `${guide.slug}/${language}/${width}/${theme}`)
          await main.locator('#common-problems').scrollIntoViewIfNeeded()
          assert.equal(await main.locator('#common-problems').isVisible(), true)
          if (process.env.SCREENSHOT_DIR && language === 'vi' && ['quickstart', 'codex'].includes(guide.slug) && [320, 1440].includes(width)) {
            await main.getByRole('heading', { level: 1 }).scrollIntoViewIfNeeded()
            await page.screenshot({ path: resolve(process.env.SCREENSHOT_DIR, `docs-${guide.slug}-${width}-${theme}.png`) })
          }
        }
      }
      const firstCode = GUIDE_CONTENT[guide.slug].flatMap(section => section.code ?? [])[0]
      if (firstCode) {
        const copyButton = main.getByRole('button', { name: docsUi(language, 'copyCode'), exact: true }).first()
        await copyButton.focus()
        await page.keyboard.press('Enter')
        // Windows clipboard normalizes line endings to CRLF.
        assert.equal((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n'), firstCode.value)
      }
      if (guide.slug === 'quickstart') {
        await page.setViewportSize({ width: 320, height: 1000 })
        const browse = page.getByRole('button', { name: docsUi(language, 'browse'), exact: true })
        await browse.focus()
        await page.keyboard.press('Enter')
        const dialog = page.getByRole('dialog', { name: docsUi(language, 'setup'), exact: true })
        await dialog.waitFor()
        const close = dialog.getByRole('button', { name: docsUi(language, 'close'), exact: true })
        await close.focus()
        await page.keyboard.press('Shift+Tab')
        await page.waitForFunction(() => document.querySelector('[role="dialog"]')?.contains(document.activeElement))
        await page.keyboard.press('Escape')
        await dialog.waitFor({ state: 'hidden' })
        assert.equal(await browse.evaluate(button => button === document.activeElement), true)
        await browse.click()
        await close.click()
        await dialog.waitFor({ state: 'hidden' })
        await browse.click()
        await dialog.getByRole('link').filter({ hasText: copy[DOCS_GUIDES.find(guide => guide.slug === 'codex').title] }).click()
        await page.waitForURL('**/docs/codex')
        await dialog.waitFor({ state: 'hidden' })
      }
      console.log(JSON.stringify({ guide: guide.slug, language, widths, themes: ['light', 'dark'], completeProse: true, exactCopiedCode: true, overflow: false }))
    }
  }
  assert.deepEqual(errors, [])
  assert.deepEqual([...unexpected], [])
  console.log(JSON.stringify({ origin: base.origin, fixtures: local, guides: 8, languages: 7, responsiveCases: 560, indexCases: 70, pageErrors: 0, liveInference: false }))
} finally { await context.close(); await browser.close() }
