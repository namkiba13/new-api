import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { chromium } from 'playwright'

const base = new URL(process.argv[2] || 'http://127.0.0.1:4180')
assert(
  ['localhost', '127.0.0.1'].includes(base.hostname),
  'API fixtures are restricted to local previews'
)
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  for (const [width, lang, theme] of [
    [320, 'en', 'light'],
    [390, 'vi', 'dark'],
    [768, 'fr', 'light'],
    [1024, 'ru', 'dark'],
    [1440, 'ja', 'light'],
    [320, 'zhCN', 'dark'],
    [1440, 'zhTW', 'dark'],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      colorScheme: theme,
      reducedMotion: 'reduce',
    })
    try {
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', (error) => errors.push(error.message))
      const now = Math.floor(Date.now() / 1000)
      const profile = {
        id: 2,
        username: 'profile-test',
        display_name: 'Profile Test',
        email: 'profile.test@example.invalid',
        role: 1,
        status: 1,
        group: 'default',
        quota: 5000000,
        used_quota: 1000000,
        request_count: 42,
        aff_count: 0,
        aff_quota: 0,
        aff_history_quota: 0,
        created_time: now,
        setting: JSON.stringify({
          language: lang,
          notify_type: 'email',
          quota_warning_threshold: 10,
        }),
        permissions: { sidebar_settings: false },
      }
      await page.addInitScript(
        (language) => localStorage.setItem('i18nextLng', language),
        lang
      )
      await page.route(`${base.origin}/api/**`, async (route) => {
        const path = new URL(route.request().url()).pathname
        let data = { enabled: false, locked: false, backup_codes_remaining: 0 }
        if (path === '/api/setup') data = { status: true }
        if (path === '/api/status') {
          data = {
            setup: true,
            system_name: '94API',
            quota_per_unit: 500000,
            quota_display_type: 'USD',
            logo: 'https://94api.dev/94api-logo-transparent.png',
            checkin_enabled: false,
            passkey_login: false,
            custom_oauth_providers: [
              { id: 1, name: 'Google', slug: 'google', client_id: 'fixture' },
            ],
          }
        }
        if (path === '/api/user/auth/refresh') {
          data = {
            access_token: 'local-layout-fixture',
            token_type: 'Bearer',
            access_expires_at: now + 3600,
            user: profile,
            session: {
              sid: 'layout-fixture',
              current: true,
              login_method: 'password',
              ip: '127.0.0.1',
              user_agent: 'local fixture',
              created_at: now,
              last_active_at: now,
              expires_at: now + 3600,
            },
          }
        }
        if (path === '/api/user/self') data = profile
        if (
          path === '/api/user/sessions' ||
          path === '/api/user/oauth/bindings'
        ) {
          data = []
        }
        if (path === '/api/notice') data = ''
        await route.fulfill({ json: { success: true, data } })
      })
      assert.equal(
        (await page.goto(new URL('/profile', base).href)).status(),
        200
      )
      await page
        .locator('.profile-page h2')
        .filter({ hasText: 'Profile Test' })
        .waitFor()
      assert.equal(await page.locator('#threshold').count(), 0)
      const locale = { zhCN: 'zh', zhTW: 'zh-TW' }[lang] || lang
      const copy = JSON.parse(
        readFileSync(
          new URL(`../web/src/i18n/locales/${locale}.json`, import.meta.url),
          'utf8'
        )
      ).translation
      assert.equal(
        await page.locator('.profile-page h1').innerText(),
        copy.Profile
      )
      const cards = await page
        .locator('.profile-page [data-slot=card]')
        .evaluateAll((nodes) =>
          nodes
            .map((node) => {
              const rect = node.getBoundingClientRect()
              return { x: rect.x, width: rect.width }
            })
            .filter((rect) => rect.width > 0)
        )
      assert(cards.length >= 5)
      assert(
        cards.every(
          (card) =>
            Math.abs(card.x - cards[0].x) < 2 &&
            Math.abs(card.width - cards[0].width) < 2
        ),
        'Profile cards must occupy one full-width column'
      )
      assert.equal(
        await page
          .locator('body')
          .evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
        JSON.stringify(
          await page.locator('body *').evaluateAll((nodes) =>
            nodes
              .filter(
                (node) => node.getBoundingClientRect().right > innerWidth + 1
              )
              .map((node) => ({
                tag: node.tagName,
                class: node.className,
                right: node.getBoundingClientRect().right,
              }))
              .slice(0, 15)
          )
        )
      )
      assert.equal(
        await page
          .locator('.profile-page')
          .evaluate((node) => node.scrollWidth > node.clientWidth),
        false
      )
      assert.equal(
        await page
          .locator('.profile-page')
          .getByText(copy['Sidebar Personal Settings'], { exact: true })
          .count(),
        0
      )
      await page
        .locator('.profile-page')
        .getByText(copy['Account Bindings'], { exact: true })
        .waitFor()
      assert.equal(await page.locator('.profile-page').getByText(copy.Notifications, { exact: true }).count(), 0)
      assert.equal(await page.locator('.profile-page').getByText(copy.Preferences, { exact: true }).count(), 0)
      await page
        .locator('.profile-page')
        .getByRole('button', { name: new RegExp(copy['Change Password']) })
        .click()
      await page.getByRole('dialog').waitFor()
      await page
        .getByRole('dialog')
        .getByRole('button', { name: copy.Cancel, exact: true })
        .click()
      await page.getByRole('dialog').waitFor({ state: 'hidden' })
      if (process.env.SCREENSHOT_DIR) {
        await page.locator('.profile-page h1').scrollIntoViewIfNeeded()
        await page.screenshot({
          path: `${process.env.SCREENSHOT_DIR}/94api-profile-${width}-${lang}.png`,
        })
      }
      assert.deepEqual(errors, [])
      console.log(
        JSON.stringify({
          width,
          lang,
          theme,
          cards: cards.length,
          api: 'local fixtures',
          passed: true,
        })
      )
    } finally {
      await context.close()
    }
  }
} finally {
  await browser.close()
}
