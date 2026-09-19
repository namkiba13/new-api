import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { chromium } from 'playwright'

const require = createRequire(import.meta.url)
const flag = 'token_setting.smart_key_wizard_enabled'
const label = 'Show Smart API Key creator'
const description = 'Show the Smart API Key button and creation dialog. Existing keys and the standard key creator are unaffected.'
const password = 'SmartKeyLab123!'
const servers = [
  { name: 'sqlite', base: 'http://127.0.0.1:4199' },
  { name: 'mysql', base: 'http://127.0.0.1:4200' },
  { name: 'postgres', base: 'http://127.0.0.1:4201' },
]
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const contexts = []
const mode = process.argv[2] || 'all'

async function request(context, base, route, method = 'GET', data, headers) {
  assert.equal(new URL(base).hostname, '127.0.0.1')
  const response = await context.request.fetch(base + route, { method, data, headers })
  let body
  try { body = await response.json() } catch { body = {} }
  return { status: response.status(), body }
}
async function signIn(base, name) {
  const context = await browser.newContext()
  contexts.push(context)
  const r = await request(context, base, '/api/user/login', 'POST', { username: name, password })
  assert.equal(r.body.success, true, 'Real lab login must succeed')
  assert(r.body.data.access_token)
  await context.setExtraHTTPHeaders({ Authorization: 'Bearer ' + r.body.data.access_token })
  return context
}
async function option(context, base, key, value) {
  const r = await request(context, base, '/api/option/', 'PUT', { key, value })
  assert.equal(r.status, 200)
  assert.equal(r.body.success, true, r.body.message)
}
async function ready(base) {
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(base + '/api/status'); if (r.ok) return } catch {}
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  throw new Error('Local test server not ready: ' + base)
}

try {
  if (mode !== 'ui') for (const server of servers) {
    await ready(server.base)
    const bootstrap = await browser.newContext()
    contexts.push(bootstrap)
    assert.equal((await request(bootstrap, server.base, '/api/setup', 'POST', { username: 'labroot', password, confirmPassword: password })).body.success, true)
    const admin = await signIn(server.base, 'labroot')
    const initial = await request(admin, server.base, '/api/status')
    assert.equal(initial.body.data.smart_key_wizard_enabled, false)
    const maxTokens = (await request(admin, server.base, '/api/option/')).body.data.find(o => o.key === 'token_setting.max_user_tokens').value
    await option(admin, server.base, 'GroupRatio', JSON.stringify({ default: 1, 'openai-stable': 1 }))
    await option(admin, server.base, 'UserUsableGroups', JSON.stringify({ default: 'Default', auto: 'Auto', 'openai-stable': 'Stable' }))
    await option(admin, server.base, 'AutoGroups', JSON.stringify(['openai-stable']))
    assert.equal((await request(admin, server.base, '/api/user/', 'POST', { username: 'labuser', password, display_name: 'Lab user', role: 1 })).body.success, true)
    const user = await signIn(server.base, 'labuser')
    assert.equal((await request(user, server.base, '/api/option/')).status, 403)
    assert.equal((await request(user, server.base, '/api/option/', 'PUT', { key: flag, value: true })).status, 403)
    // Hidden wizard does not gate the normal token endpoint, even for Auto keys.
    assert.equal((await request(user, server.base, '/api/token/', 'POST', {
      name: 'auto-before-toggle', group: 'auto', auto_groups: ['openai-stable'], cross_group_retry: true,
      unlimited_quota: true, remain_quota: 0, expired_time: -1,
    })).body.success, true)
    const tokens = (await request(user, server.base, '/api/token/?p=1&page_size=100')).body.data.items
    const saved = tokens.find(t => t.name === 'auto-before-toggle')
    assert(saved)
    const revealed = await request(user, server.base, `/api/token/${saved.id}/key`, 'POST')
    assert.equal(revealed.body.success, true)
    const plain = await browser.newContext()
    contexts.push(plain)
    const checkKey = async () => {
      const r = await request(plain, server.base, '/v1/models', 'GET', undefined, { Authorization: 'Bearer sk-' + revealed.body.data.key })
      assert.equal(r.status, 200)
    }
    await checkKey()
    await option(admin, server.base, flag, true)
    assert.equal((await request(admin, server.base, '/api/status')).body.data.smart_key_wizard_enabled, true)
    execFileSync('docker', ['restart', 'smart-key-lab-' + server.name], { stdio: 'pipe' })
    await ready(server.base)
    assert.equal((await request(admin, server.base, '/api/status')).body.data.smart_key_wizard_enabled, true, 'Persisted option survives process restart')
    await checkKey()
    await option(admin, server.base, flag, false)
    const invalid = await request(admin, server.base, '/api/option/', 'PUT', { key: flag, value: 'invalid' })
    assert.equal(invalid.body.success, false)
    const after = (await request(admin, server.base, '/api/option/')).body.data
    assert.equal(after.find(o => o.key === flag).value, 'false')
    assert.equal(after.find(o => o.key === 'token_setting.max_user_tokens').value, maxTokens)
    await checkKey()
    assert.equal((await request(user, server.base, '/api/token/', 'POST', { name: 'ordinary-after-toggle', group: 'default', unlimited_quota: true, expired_time: -1 })).body.success, true)
    assert.equal((await request(user, server.base, `/api/token/${saved.id}`)).body.data.id, saved.id)
    console.log(JSON.stringify({ database: server.name, defaultOff: true, persistedAcrossRestart: true, userWriteForbidden: true, existingAutoKeyWorks: true, ordinaryCreationWorks: true }))
  }

  if (mode !== 'http') {
    const base = servers[0].base
    const admin = await signIn(base, 'labroot')
    const user = await signIn(base, 'labuser')
    const errors = []
    const ap = await admin.newPage(), up = await user.newPage()
    ap.on('pageerror', e => errors.push(e.message)); up.on('pageerror', e => errors.push(e.message))
    await ap.goto(base + '/system-settings/security/token-limits')
    await up.goto(base + '/keys')
    const languages = { en: 'en', vi: 'vi', fr: 'fr', ru: 'ru', ja: 'ja', zhCN: 'zh', zhTW: 'zh-TW' }
    for (const [language, file] of Object.entries(languages)) {
      const copy = require('../web/src/i18n/locales/' + file + '.json').translation
      await ap.evaluate(lang => localStorage.setItem('i18nextLng', lang), language)
      await up.evaluate(lang => localStorage.setItem('i18nextLng', lang), language)
      await option(admin, base, flag, false)
      for (const width of [1440, 390, 320]) {
        await ap.setViewportSize({ width, height: 950 }); await up.setViewportSize({ width, height: 950 })
        await ap.reload(); await up.reload()
        const toggle = ap.getByRole('switch', { name: copy[label], exact: true })
        await toggle.waitFor()
        assert.equal(await toggle.isChecked(), false)
        assert.equal(await ap.getByText(copy[description], { exact: true }).isVisible(), true)
        assert.equal(await up.getByRole('button', { name: copy['Create Smart API Key'] || 'Create Smart API Key', exact: true }).count(), 0)
        await up.getByRole('button', { name: copy['Create API Key'], exact: true }).waitFor()
        await toggle.click()
        const saved = ap.waitForResponse(r => new URL(r.url()).pathname === '/api/option/' && r.request().method() === 'PUT')
        await ap.getByRole('button', { name: copy['Save token limits'] || 'Save token limits', exact: true }).click()
        assert.equal((await (await saved).json()).success, true)
        await up.reload()
        const createSmart = up.getByRole('button', { name: copy['Create Smart API Key'] || 'Create Smart API Key', exact: true })
        await createSmart.waitFor()
        await createSmart.click()
        await up.getByRole('dialog', { name: copy['Create Smart API Key'] || 'Create Smart API Key' }).waitFor()
        await up.getByRole('dialog').getByRole('button', { name: copy['Close'] || 'Close', exact: true }).last().click()
        for (const theme of ['light', 'dark']) {
          await ap.emulateMedia({ colorScheme: theme }); await up.emulateMedia({ colorScheme: theme })
          assert(await ap.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Admin overflow')
          assert(await up.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Keys overflow')
        }
        await toggle.click()
        const disabled = ap.waitForResponse(r => new URL(r.url()).pathname === '/api/option/' && r.request().method() === 'PUT')
        await ap.getByRole('button', { name: copy['Save token limits'] || 'Save token limits', exact: true }).click()
        assert.equal((await (await disabled).json()).success, true)
        await up.reload()
        await up.getByRole('button', { name: copy['Create API Key'], exact: true }).waitFor()
        assert.equal(await up.getByRole('button', { name: copy['Create Smart API Key'] || 'Create Smart API Key', exact: true }).count(), 0)
        if (process.env.SCREENSHOT_DIR && language === 'vi') await ap.screenshot({ path: process.env.SCREENSHOT_DIR + '/smart-key-admin-' + width + '.png', fullPage: true })
      }
      console.log(JSON.stringify({ language, widths: [1440, 390, 320], onOff: true, themes: ['light', 'dark'] }))
    }
    assert.deepEqual(errors, [])
    assert.equal((await request(admin, base, '/api/status')).body.data.smart_key_wizard_enabled, false)
    console.log('Smart creator browser checks passed: real admin saves, user visibility, reload, translations, responsive layout, and no page errors.')
  }
} finally {
  for (const context of contexts) await context.close()
  await browser.close()
}
