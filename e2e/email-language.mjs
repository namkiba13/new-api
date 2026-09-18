// Real browser -> HTTP handlers -> loopback SMTP. Only synthetic accounts are used.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'

const require = createRequire(import.meta.url)
const base = process.argv[2] || 'http://127.0.0.1:4198'
assert.equal(new URL(base).hostname, '127.0.0.1', 'Email LAB must only target loopback')
const locales = { en: 'en', vi: 'vi', fr: 'fr', ru: 'ru', ja: 'ja', zhCN: 'zh', zhTW: 'zh-TW' }
const subjects = {
  en: ['Verify your email', 'Reset your password'],
  vi: ['Xác minh địa chỉ email', 'Đặt lại mật khẩu'],
  fr: ['Vérifiez votre adresse e-mail', 'Réinitialisez votre mot de passe'],
  ru: ['Подтвердите адрес электронной почты', 'Сброс пароля'],
  ja: ['メールアドレスの確認', 'パスワードの再設定'],
  zhCN: ['验证邮箱地址', '重置密码'],
  zhTW: ['驗證電子郵件地址', '重設密碼'],
}
const kinds = ['wallet_low', 'subscription_low', 'channel_disabled', 'channel_enabled', 'channel_test', 'upstream_update']
const data = {
  Amount: '$1.23', Link: base + '/wallet', Name: 'LAB <channel>', ID: 123, Reason: 'Timeout & retry <unsafe>',
  Checked: 21, Changed: 12, Added: 13, Removed: 14, AutoAdded: 15, Failed: 16,
  Channels: [{ ChannelName: 'LAB <channel>', AddCount: 2, RemoveCount: 1 }], ChannelCount: 12, ChannelOmitted: 11,
  AddedModels: ['model-<a>'], AddedCount: 13, AddedOmitted: 12, RemovedModels: ['model-<b>'], RemovedCount: 14, RemovedOmitted: 13,
  FailedIDs: [123], FailedOmitted: 15,
}
const report = { scenarios: [], emails: 0, errors: [], captcha: 'single-use external-boundary fixture; real middleware' }
const password = 'EmailLab123!'
let ip = 1

async function request(path, method = 'GET', body, headers = {}) {
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) })
  const result = await response.json()
  assert.equal(result.success, true, `${method} ${path.split('?')[0]}: ${JSON.stringify(result)}`)
  return result.data
}

async function latestMail(to) {
  const messages = await (await fetch(base + '/lab/emails')).json()
  const message = messages.findLast(item => item.to === to)
  assert(message, `No SMTP delivery for ${to}`)
  return message
}

async function solveCaptcha(page) {
  const solved = page.waitForResponse(response => response.url().endsWith('/lab/captcha'))
  await page.getByRole('button', { name: 'Verify LAB CAPTCHA', exact: true }).click()
  assert.equal((await (await solved).json()).success, true)
}

async function expectResetError(page, link, copy) {
  await page.goto(link)
  const response = page.waitForResponse(response => response.url().endsWith('/api/user/reset'))
  await page.getByRole('button', { name: copy['auth.resetPasswordConfirm.confirm'], exact: true }).click()
  assert.equal((await (await response).json()).success, false)
  await page.locator('[data-sonner-toast][data-type="error"]').first().waitFor()
  assert.equal(await page.locator('#password').count(), 0)
}

function checkMail(message, lang) {
  const tag = lang === 'zhCN' ? 'zh-CN' : lang === 'zhTW' ? 'zh-TW' : lang
  assert(message.html.includes(`<html lang="${tag}">`))
  assert(message.subject.startsWith('94API — '))
  assert(!message.html.includes('{{'))
  assert(!message.html.includes('<no value>'))
  assert(!message.html.includes('<unsafe>'))
  report.emails++
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })
report.browser = browser.version()
try {
  await request('/api/setup', 'POST', { username: 'emailroot', password, confirmPassword: password })
  const root = await request('/api/user/login', 'POST', { username: 'emailroot', password })
  const admin = { Authorization: `Bearer ${root.access_token}` }
  for (const [key, value] of Object.entries({ SystemName: '94API', ServerAddress: base, EmailVerificationEnabled: 'true', TurnstileCheckEnabled: 'true', 'legal.user_agreement': 'LAB terms', 'legal.privacy_policy': 'LAB privacy' })) {
    await request('/api/option/', 'PUT', { key, value }, admin)
  }
  for (const [lang, file] of Object.entries(locales)) {
    const copy = require(`../web/src/i18n/locales/${file}.json`).translation
    const header = lang === 'zhCN' ? 'zh-CN' : lang === 'zhTW' ? 'zh-TW' : lang
    for (const width of [390, 1440]) {
      const email = `lab+${lang.toLowerCase()}${width}@example.test`
      const username = `mail${lang}${width}`
      const forwarded = { 'X-Forwarded-For': `192.0.2.${ip++}` }
      const context = await browser.newContext({ locale: 'en-US', viewport: { width, height: 1000 }, extraHTTPHeaders: forwarded })
      await context.addCookies([{ name: 'vite-ui-theme', value: 'system', url: base }])
      await context.addInitScript(language => localStorage.setItem('i18nextLng', language), lang)
      await context.addInitScript(() => {
        window.turnstile = {
          render(element, options) {
            const id = crypto.randomUUID()
            const button = document.createElement('button')
            button.type = 'button'
            button.textContent = 'Verify LAB CAPTCHA'
            button.dataset.labWidget = id
            button.style.cssText = `height:65px;width:${options.size === 'compact' ? 150 : 300}px;max-width:100%`
            button.onclick = async () => {
              button.disabled = true
              const response = await fetch('/lab/captcha')
              options.callback((await response.json()).data)
            }
            element.append(button)
            return id
          },
          remove(id) { document.querySelector(`[data-lab-widget="${id}"]`)?.remove() },
        }
      })
      const page = await context.newPage()
      page.setDefaultTimeout(15000)
      page.on('pageerror', error => report.errors.push(error.message))
      await page.goto(base + '/sign-up')
      await page.locator('input[name="username"]').fill(username)
      await page.locator('input[name="password"]').fill(password)
      await page.locator('input[name="confirmPassword"]').fill(password)
      await page.locator('input[name="email"]').fill(email)
      await page.getByRole('checkbox').check()
      await solveCaptcha(page)
      const sending = page.waitForResponse(response => response.url().includes('/api/verification?'))
      await page.getByRole('button', { name: copy['Send code'], exact: true }).click()
      const sent = await sending
      assert.equal((await sent.json()).success, true)
      assert.equal(sent.request().headers()['accept-language'], header)
      const verification = await latestMail(email)
      checkMail(verification, lang)
      assert.equal(verification.subject, '94API — ' + subjects[lang][0])
      const code = verification.html.match(/<strong>([0-9a-f]{6})<\/strong>/)?.[1]
      assert(code)
      if (lang === 'vi' && width === 390) {
        await page.getByPlaceholder(copy['Verification code'], { exact: true }).fill('wrong!')
        await solveCaptcha(page)
        const invalid = page.waitForResponse(response => response.url().includes('/api/user/register'))
        await page.locator('form button[type="submit"]').click()
        assert.equal((await (await invalid).json()).success, false)
      }
      await page.getByPlaceholder(copy['Verification code'], { exact: true }).fill(code)
      await solveCaptcha(page)
      const registering = page.waitForResponse(response => response.url().includes('/api/user/register'))
      await page.locator('form button[type="submit"]').click()
      assert.equal((await (await registering).json()).success, true)
      await page.waitForURL('**/sign-in')

      await page.goto(base + '/forgot-password')
      await page.locator('input[name="email"]').fill(email)
      await solveCaptcha(page)
      const resetting = page.waitForResponse(response => response.url().includes('/api/reset_password?'))
      await page.locator('form button[type="submit"]').click()
      const resetResponse = await resetting
      assert.equal((await resetResponse.json()).success, true)
      assert.equal(resetResponse.request().headers()['accept-language'], header)
      const reset = await latestMail(email)
      checkMail(reset, lang)
      assert.equal(reset.subject, '94API — ' + subjects[lang][1])
      const link = reset.html.match(/href="([^"]+)"/)?.[1].replaceAll('&amp;', '&')
      assert(link)
      assert.equal(new URL(link).searchParams.get('email'), email)
      if (lang === 'vi' && width === 390) {
        const invalid = new URL(link)
        invalid.searchParams.set('token', 'invalid-token')
        await expectResetError(page, invalid.href, copy)
        await request('/lab/email/expiry?expired=true', 'POST')
        await expectResetError(page, link, copy)
        await request('/lab/email/expiry', 'POST')
      }
      await page.goto(link)
      assert.equal(await page.locator('#email').inputValue(), email)
      const resettingPassword = page.waitForResponse(response => response.url().endsWith('/api/user/reset'))
      await page.getByRole('button', { name: copy['auth.resetPasswordConfirm.confirm'], exact: true }).click()
      const changed = await (await resettingPassword).json()
      assert.equal(changed.success, true)
      await page.locator('#password').waitFor()
      assert.equal(await page.locator('#password').inputValue(), changed.data)
      if (lang === 'vi' && width === 390) await expectResetError(page, link, copy)
      await page.goto(base + '/sign-in')
      await page.locator('input[name="username"]').fill(username)
      await page.locator('input[name="password"]').fill(changed.data)
      await page.getByRole('checkbox').check()
      await solveCaptcha(page)
      const loggingIn = page.waitForResponse(response => new URL(response.url()).pathname === '/api/user/login')
      await page.locator('form button[type="submit"]').click()
      const loggedIn = await (await loggingIn).json()
      assert.equal(loggedIn.success, true)
      const login = loggedIn.data
      await page.waitForURL('**/dashboard/overview')
      const userHeaders = { Authorization: `Bearer ${login.access_token}`, ...forwarded, 'Accept-Language': header }
      await request('/api/user/self', 'PUT', { language: lang }, userHeaders)
      for (const kind of kinds) {
        await request('/lab/email/notify', 'POST', { user_id: login.user.id, kind, data })
        const message = await latestMail(email)
        checkMail(message, lang)
        if (kind.includes('low')) assert(message.html.includes('$1.23'))
        if (kind === 'channel_disabled') assert(message.html.includes('&lt;unsafe&gt;'))
        if (kind === 'upstream_update') assert(message.html.includes('model-&lt;a&gt;'))
      }
      const bindingEmail = `bind+${lang.toLowerCase()}${width}@example.test`
      await context.setExtraHTTPHeaders({ 'X-Forwarded-For': `192.0.2.${ip++}` })
      await page.goto(base + '/profile')
      await page.getByRole('button', { name: copy['Change'], exact: true }).first().click()
      const dialog = page.getByRole('dialog')
      await dialog.locator('input[type="email"]').fill(bindingEmail)
      assert.equal(await dialog.getByRole('button', { name: copy['Send'], exact: true }).isDisabled(), true)
      for (const layoutWidth of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width: layoutWidth, height: 1000 })
        for (const colorScheme of ['light', 'dark']) {
          await page.emulateMedia({ colorScheme })
          await page.waitForFunction(theme => document.documentElement.classList.contains(theme), colorScheme)
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
          assert.equal(await dialog.evaluate(node => node.scrollWidth > node.clientWidth + 1), false)
        }
      }
      if (lang === 'vi' && width === 390) {
        await request('/lab/email/fail-next', 'POST')
        await solveCaptcha(page)
        const failure = page.waitForResponse(response => response.url().includes('/api/verification?'))
        await dialog.getByRole('button', { name: copy['Send'], exact: true }).click()
        assert.equal((await (await failure).json()).success, false)
        await page.locator('[data-sonner-toast][data-type="error"]').first().waitFor()
      }
      await solveCaptcha(page)
      const bindingSent = page.waitForResponse(response => response.url().includes('/api/verification?'))
      await dialog.getByRole('button', { name: copy['Send'], exact: true }).click()
      const bindingResponse = await bindingSent
      assert.equal((await bindingResponse.json()).success, true)
      assert.equal(bindingResponse.request().headers()['accept-language'], header)
      const binding = await latestMail(bindingEmail)
      checkMail(binding, lang)
      const bindingCode = binding.html.match(/<strong>([0-9a-f]{6})<\/strong>/)?.[1]
      await dialog.locator('#code').fill(bindingCode)
      const bound = page.waitForResponse(response => response.url().endsWith('/api/oauth/email/bind'))
      await dialog.getByRole('button', { name: copy['Bind Email'], exact: true }).click()
      assert.equal((await (await bound).json()).success, true)
      await dialog.waitFor({ state: 'hidden' })
      const profile = await request('/api/user/self', 'GET', undefined, userHeaders)
      assert.equal(profile.email, bindingEmail)
      const viewer = await context.newPage()
      await viewer.setContent(reset.html)
      assert.equal(await viewer.locator('html').getAttribute('lang'), header)
      assert.equal(await viewer.locator('a').getAttribute('href'), link)
      assert.equal(await viewer.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Reset URL must wrap on mobile')
      if (width === 390) await viewer.screenshot({ path: join(tmpdir(), 'opencode', `94api-email-${lang}.png`), fullPage: true })
      report.scenarios.push({ language: lang, width, registration: true, passwordReset: true, emailBindingUI: true, captchaEnforced: true, notifications: kinds.length, dialogWidths: [320,390,768,1440], themes: ['light','dark'], emailOverflow: false })
      console.log(JSON.stringify(report.scenarios.at(-1)))
      await context.close()
    }
  }
  const fallbackToken = await request('/lab/captcha')
  await request('/api/verification?email=fallback%40example.test&turnstile=' + fallbackToken, 'GET', undefined, { 'Accept-Language': 'unsupported!', 'X-Forwarded-For': '198.51.100.1' })
  const fallback = await latestMail('fallback@example.test')
  assert.equal(fallback.subject, '94API — Verify your email')
  report.fallbackEnglish = true
  const beforeNegative = (await (await fetch(base + '/lab/emails')).json()).length
  for (const token of ['', 'forged-token', fallbackToken]) {
    const response = await fetch(base + '/api/reset_password?email=missing%40example.test&turnstile=' + token)
    assert.equal((await response.json()).success, false, 'Missing, forged and replayed CAPTCHA must fail')
  }
  const missingAccountToken = await request('/lab/captcha')
  await request('/api/reset_password?email=missing%40example.test&turnstile=' + missingAccountToken)
  const missingEmailToken = await request('/lab/captcha')
  const unverified = await fetch(base + '/api/user/register?turnstile=' + missingEmailToken, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'noemail', password }) })
  assert.equal((await unverified.json()).success, false, 'Registration must require verified email')
  for (let attempt = 0; attempt < 3; attempt++) {
    const limited = await fetch(base + '/api/verification', { headers: { 'X-Forwarded-For': '198.51.100.2' } })
    assert.equal(limited.status, attempt === 2 ? 429 : 200)
  }
  report.negativeCases = { missingCaptcha: true, forgedCaptcha: true, replayedCaptcha: true, invalidReset: true, expiredReset: true, usedReset: true, missingEmailRejected: true, smtpRetry: true, rateLimit: true }
  assert.equal((await (await fetch(base + '/lab/emails')).json()).length, beforeNegative)
  const capture = await (await fetch(base + '/lab/emails')).json()
  assert.equal(capture.length, 127)
  assert.deepEqual(report.errors, [])
  report.smtpCaptured = capture.length
  report.completed = true
  await writeFile(join(tmpdir(), 'opencode', '94api-email-lab-report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ smtpCaptured: capture.length, scenarios: report.scenarios.length, fallbackEnglish: true, pageErrors: 0 }))
} finally {
  await browser.close()
}
