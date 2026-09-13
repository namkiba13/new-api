import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { chromium } from 'playwright'

// Run against the real Home route, or the static document before building.
const url = process.argv[2] || 'https://94api.dev'
const languages = [
  ['vi', 'Tiếng Việt', 'Một điểm truy cập.'],
  ['fr', 'Français', 'Un seul point d’accès.'],
  ['ru', 'Русский', 'Единая точка доступа.'],
  ['ja', '日本語', 'ひとつのエンドポイント。'],
  ['zhCN', '简体中文', '一个端点。'],
  ['zhTW', '繁體中文', '一個端點。'],
  ['en', 'English', 'One endpoint.'],
]
const localeCopy = Object.fromEntries(
  languages.map(([lang]) => {
    const file = { zhCN: 'zh', zhTW: 'zh-TW' }[lang] || lang
    return [
      lang,
      JSON.parse(
        readFileSync(
          new URL(`../web/src/i18n/locales/${file}.json`, import.meta.url),
          'utf8'
        )
      ).translation,
    ]
  })
)

async function checkNativeTopbar(page, frame, width) {
  assert.equal(await page.locator('header:visible').count(), 1)
  assert.equal(await frame.locator('header:visible').count(), 0)
  let current = 'en'
  for (const [lang, label, heading] of languages) {
    await page
      .getByRole('button', {
        name: localeCopy[current]['Change language'],
        exact: true,
      })
      .click()
    const menu = page.getByRole('menu')
    await menu.waitFor()
    assert.equal(await menu.getByRole('menuitem').count(), 7)
    await menu.getByRole('menuitem', { name: label, exact: true }).click()
    await frame
      .locator(`html[lang="${{ zhCN: 'zh-CN', zhTW: 'zh-TW' }[lang] || lang}"]`)
      .waitFor({ state: 'attached' })
    assert((await frame.locator('h1').innerText()).includes(heading))
    assert.equal(
      (
        await page
          .locator('header .public-header-desktop a[href="/"]')
          .textContent()
      ).trim(),
      localeCopy[lang].Home
    )
    assert.equal(
      await page.evaluate(() => localStorage.getItem('i18nextLng')),
      lang
    )
    assert.equal(
      await frame
        .locator('body')
        .evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      `${width}px ${lang}: iframe overflow`
    )
    assert.equal(
      await page
        .locator('body')
        .evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      `${width}px ${lang}: page overflow`
    )
    if (lang === 'vi') {
      await page.reload()
      await frame.locator('html[lang="vi"]').waitFor({ state: 'attached' })
      await page
        .getByRole('button', {
          name: localeCopy.vi['Change language'],
          exact: true,
        })
        .waitFor()
      assert((await frame.locator('h1').innerText()).includes(heading))
    }
    current = lang
  }
  if (width < 1024) {
    const menu = page.getByRole('button', {
      name: 'Toggle navigation menu',
      exact: true,
    })
    await menu.click()
    await page
      .locator('.public-header-overlay:not([inert]) a[href="/pricing"]')
      .waitFor()
    assert.equal(
      await page
        .locator('.public-header-overlay:not([inert]) a[href="/pricing"]')
        .innerText(),
      localeCopy.en['Model Square']
    )
    await menu.click()
    await page
      .locator('.public-header-overlay[inert]')
      .waitFor({ state: 'attached' })
  }
  for (const theme of ['dark', 'light', 'system']) {
    await page.emulateMedia({ colorScheme: 'light' })
    await page
      .getByRole('button', { name: 'Toggle theme', exact: true })
      .click()
    await page
      .getByRole('menuitem', {
        name: theme[0].toUpperCase() + theme.slice(1),
        exact: true,
      })
      .click()
    const resolved = theme === 'system' ? 'light' : theme
    await page.locator(`html.${resolved}`).waitFor({ state: 'attached' })
    await frame
      .locator(`html[data-theme="${resolved}"]`)
      .waitFor({ state: 'attached' })
    assert.equal(
      (await page.context().cookies()).find(
        (cookie) => cookie.name === 'vite-ui-theme'
      )?.value,
      theme
    )
    await page.reload()
    await frame
      .locator(`html[data-theme="${resolved}"]`)
      .waitFor({ state: 'attached' })
    assert.equal(
      await page
        .locator('html')
        .evaluate((el) =>
          el.classList.contains(
            el.ownerDocument.querySelector('iframe').contentDocument
              .documentElement.dataset.theme
          )
        ),
      true
    )
    await frame.locator('.footer a[href="/pricing"]').click()
    await page.waitForURL('**/pricing')
    await page.locator(`html.${resolved}`).waitFor({ state: 'attached' })
    await page.locator('header a[href="/"]').first().click()
    await frame
      .locator(`html[data-theme="${resolved}"]`)
      .waitFor({ state: 'attached' })
    assert.equal(
      (await page.context().cookies()).find(
        (cookie) => cookie.name === 'vite-ui-theme'
      )?.value,
      theme
    )
    if (theme === 'system') {
      for (const system of ['dark', 'light']) {
        await page.emulateMedia({ colorScheme: system })
        await page.locator(`html.${system}`).waitFor({ state: 'attached' })
        await frame
          .locator(`html[data-theme="${system}"]`)
          .waitFor({ state: 'attached' })
      }
      assert.equal(
        (await page.context().cookies()).find(
          (cookie) => cookie.name === 'vite-ui-theme'
        )?.value,
        'system'
      )
    }
  }
  const notice = await (
    await page.request.get(new URL('/api/notice', url).href)
  ).json()
  const status = await (
    await page.request.get(new URL('/api/status', url).href)
  ).json()
  assert.equal(notice.success, true)
  assert.equal(status.success, true)
  const bell = page.getByRole('button', { name: 'Notifications', exact: true })
  await bell.click()
  const dialog = page.getByRole('dialog')
  await dialog.waitFor()
  assert.equal(await dialog.count(), 1)
  if (!notice.data?.trim()) {
    await dialog
      .getByText('No announcements at this time', { exact: true })
      .waitFor()
  }
  await dialog.getByRole('tab', { name: 'Timeline', exact: true }).click()
  if (
    !status.data.announcements_enabled ||
    !status.data.announcements?.length
  ) {
    await dialog.getByText('No system announcements', { exact: true }).waitFor()
  }
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await dialog.waitFor({ state: 'hidden' })
  const buttons = await page
    .locator('header button:visible, header a:visible')
    .evaluateAll((elements) =>
      elements.map((el) => getComputedStyle(el).borderRadius)
    )
  assert(buttons.every((radius) => radius === '0px'))
  assert.equal(
    await page
      .locator('body')
      .evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false
  )
}

;(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' })
  try {
    for (const width of [320, 390, 768, 1024, 1440]) {
      const context = await browser.newContext({
        locale: 'en',
        viewport: { width, height: 900 },
        permissions: ['clipboard-read', 'clipboard-write'],
      })
      try {
        const page = await context.newPage()
        const errors = []
        page.on('pageerror', (error) => errors.push(error.message))
        assert.equal((await page.goto(url)).status(), 200)
        const embedded = !url.endsWith('.html')
        if (embedded) {
          await page.locator('iframe[src^="/94api-theme/home.html"]').waitFor()
        }
        const frame = embedded
          ? await page
              .locator('iframe[src^="/94api-theme/home.html"]')
              .contentFrame()
          : page
        await frame.locator('h1').waitFor()
        await frame.locator('body').evaluate(
          () =>
            new Promise((resolve) => {
              if (document.readyState === 'complete') resolve()
              else window.addEventListener('load', resolve, { once: true })
            })
        )
        assert.match(await frame.locator('h1').innerText(), /Every AI model/)
        for (const protocol of ['Responses', 'Chat', 'Claude', 'Gemini']) {
          const tab = frame.getByRole('tab', { name: protocol, exact: true })
          await tab.focus()
          await page.keyboard.press('Enter')
          assert.equal(await tab.getAttribute('aria-selected'), 'true')
          assert.match(
            await frame.locator('#request-code').innerText(),
            /https:\/\/94api\.dev\//
          )
          const metrics = await frame.locator('body').evaluate(() => ({
            width: innerWidth,
            scrollWidth: document.documentElement.scrollWidth,
          }))
          assert(
            metrics.scrollWidth <= metrics.width,
            `${width}px ${protocol}: horizontal overflow ${JSON.stringify(metrics)}`
          )
        }
        await page.keyboard.press('Home')
        assert.equal(
          await frame
            .getByRole('tab', { name: 'Responses', exact: true })
            .getAttribute('aria-selected'),
          'true'
        )
        await frame.getByRole('button', { name: 'Copy request' }).click()
        await frame
          .locator('.copy-button')
          .filter({ hasText: /^Copied$/ })
          .waitFor()
        assert.equal(await frame.locator('.copy-button').innerText(), 'Copied')
        const clipboard = await page.evaluate(() =>
          navigator.clipboard.readText()
        )
        assert.match(clipboard, /https:\/\/94api\.dev\/v1\/responses/)
        assert.match(clipboard, /Content-Type: application\/json/)
        await page.evaluate(() => navigator.clipboard.writeText(''))
        if (!embedded && width <= 980) {
          const menu = frame.getByRole('button', { name: /Menu/ })
          await menu.click()
          assert.equal(await menu.getAttribute('aria-expanded'), 'true')
          await page.keyboard.press('Escape')
          assert.equal(await menu.getAttribute('aria-expanded'), 'false')
        }
        for (const section of ['#features', '#workflow', '.cta', '.footer']) {
          await frame.locator(section).scrollIntoViewIfNeeded()
          if (section !== '.footer') {
            await frame.locator(`${section}.visible`).waitFor()
          }
          await frame
            .locator(section)
            .evaluate((element) =>
              Promise.all(
                element.getAnimations().map((animation) => animation.finished)
              )
            )
          assert.equal(
            await frame
              .locator(section)
              .evaluate((element) => getComputedStyle(element).opacity),
            '1'
          )
        }
        const links = await frame
          .locator('a[href^="/"]')
          .evaluateAll((elements) =>
            elements.map((a) => ({
              href: a.getAttribute('href'),
              target: a.target,
            }))
          )
        assert(links.length > 0)
        for (const link of links) {
          assert.equal(
            link.target,
            '_top',
            `${link.href} must leave the embedded homepage`
          )
          assert(!['/login', '/status', '/terms'].includes(link.href))
        }
        if (embedded) await checkNativeTopbar(page, frame, width)
        await frame.locator('h1').scrollIntoViewIfNeeded()
        if (process.env.SCREENSHOT_DIR) {
          await page.screenshot({
            path: `${process.env.SCREENSHOT_DIR}/94api-theme-${width}.png`,
          })
          if (width === 1440) {
            await frame.locator('#features').scrollIntoViewIfNeeded()
            await page.screenshot({
              path: `${process.env.SCREENSHOT_DIR}/94api-theme-features.png`,
            })
          }
        }
        if (embedded) {
          await frame.locator('.hero-actions a[href="/keys"]').click()
          await page.waitForURL(/\/(sign-in|keys)/)
          assert.equal(
            await page.locator('iframe[src^="/94api-theme/home.html"]').count(),
            0
          )
          assert.equal(
            await page
              .locator('body')
              .evaluate(
                () => document.documentElement.scrollWidth > innerWidth
              ),
            false
          )
        }
        assert.deepEqual(errors, [])
        console.log(
          JSON.stringify({
            width,
            passed: true,
            embedded,
            languages: embedded ? 7 : 1,
            themes: embedded ? 3 : 0,
          })
        )
      } finally {
        await context.close()
      }
    }
  } finally {
    await browser.close()
  }
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
