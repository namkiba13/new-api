# 94API — Email language implementation and LAB report

Date: 2026-09-18 (original email localization LAB: 2026-09-14)

## Status

The email work has been integrated with production commit `cef58a9df1c88ed3e8b556115ec38458c2c2f099` on `feat/94api-email-i18n`. The 2026-09-18 release candidate includes the email binding CAPTCHA and reset error fixes below. Production deployment verification is recorded separately in the release handoff.

## 2026-09-18 recovery acceptance

- Confirmed production registration email verification was already enabled by the operator; this release does not change that setting.
- Four failing frontend regression checks reproduced missing binding CAPTCHA, stale CAPTCHA retry, and silent reset errors before fixes. The shared Turnstile hook now refreshes consumed challenges for login, registration, forgot-password, and email binding.
- Bind Email renders the existing responsive CAPTCHA, passes its token to the actual verification API, handles expiry, and resets the challenge on send completion and dialog closure.
- Reset confirmation reuses the shared API error handler instead of suppressing invalid/expired/consumed-token errors.
- The complete browser LAB passed 14 scenarios (seven languages × 390/1440 px): receive verification, register with consent, receive reset link containing a `+` alias, reset, sign in through the browser, open Profile, receive binding code through the actual dialog, and verify the bound email through authenticated API.
- All eight email kinds were captured through real loopback SMTP; 127 messages, English fallback, HTML escaping, no unresolved templates, no page errors.
- Additional cases passed: incorrect registration code followed by successful retry; invalid/expired/used reset token with visible error; SMTP rejection followed by a fresh-CAPTCHA retry; missing/forged/replayed CAPTCHA; registration without verified email; unknown reset address without outbound mail; HTTP 429 verification rate limit.
- Binding dialog passed 320/390/768/1440 px in light/dark for every scenario. Reset emails fit mobile.
- CAPTCHA's external service is replaced **only inside the loopback LAB executable** by a single-use token fixture; the application's real middleware is exercised. Production does not include `e2e/` or this fixture. This is not a claim of live Cloudflare verification or real Gmail/Outlook inbox delivery.
- `go test ./i18n ./common ./service ./controller ./model ./middleware -count=1 -timeout 120s`, root Go build, independent RelayKit build, frontend typecheck/build, and frontend suite passed. `bun install --frozen-lockfile` required no dependency changes.
- Full frontend lint has zero errors and 19 pre-existing warnings. Changed-file formatting passes; repository-wide formatting still reports 14 pre-existing files outside this release.
- Pre-release real Cloudflare widget rendering passed signup/login/forgot-password in Vietnamese and English, 1440→320→390→768→1440 px, light/dark, without overflow or widget recreation while typing.
- Verified pre-release SQLite backup: `/data/94api-before-email-recovery-20260918.db`, 1,458,176 bytes, permissions 600, `PRAGMA integrity_check=ok`. Application/environment/options/storage snapshot: `~/.config/coolify/94api-before-email-recovery-20260918.dpapi`, encrypted restore verified. Rollback image: `cef58a9df1c88ed3e8b556115ec38458c2c2f099`.

## Implemented behavior

- Eight email kinds support English, Vietnamese, French, Russian, Japanese, Simplified Chinese, and Traditional Chinese, including both subject and body.
- Registration verification, email binding verification, and password reset use the interface language at the time the request is sent (`Accept-Language`).
- Wallet/subscription warnings and administrative notifications use the recipient's saved language. Watcher notifications are rendered separately for each recipient.
- Missing/unsupported language preferences fall back to English. Standard regional tags, `zhCN`/`zhTW`, Chinese script variants, and weighted language headers are normalized.
- The existing go-i18n bundle and standard-library HTML templates are reused. Dynamic content is contextually escaped, subjects remain single-line, and long URLs wrap on mobile.
- Reset URLs use encoded query parameters so email aliases containing `+` survive the complete reset flow.

### Email inventory

| Kind | Purpose |
| --- | --- |
| `verification` | Registration and email binding verification code |
| `password_reset` | Password reset link |
| `wallet_low` | Low wallet balance |
| `subscription_low` | Low subscription allowance |
| `channel_disabled` | Channel disabled, including reason |
| `channel_enabled` | Channel enabled |
| `channel_test` | Selected channel tests completed |
| `upstream_update` | Upstream model changes, summary, and bounded details |

## Changed implementation surfaces

- `i18n/i18n.go`: language normalization, weighted header parsing, catalog loading, English fallback.
- `i18n/email.go`: email identifiers and safe subject/HTML rendering.
- `i18n/locales/email.*.yaml`: seven catalogs, 16 entries each.
- `controller/misc.go`: localized verification/reset emails and encoded reset URLs.
- `service/user_notify.go`: per-recipient email localization and localized send entry point.
- `service/quota.go`, `service/channel.go`, `controller/channel-test.go`, `controller/channel_upstream_update.go`: email template metadata on the existing notification paths.
- `relaykit/dto/notify.go`: email-only template metadata excluded from serialized notification payloads.
- `web/src/features/auth/api.ts`, `web/src/features/profile/api.ts`: selected interface language on all three email request functions.

## Final results

| Check | Result |
| --- | --- |
| Catalog completeness and rendering | PASS — 8 kinds × 7 languages = 56 combinations; actual locale resolution checked, not just fallback |
| Real HTTP/browser/SMTP LAB | PASS — 14 scenarios: 7 languages × 390/1440 px |
| SMTP messages captured in browser LAB | PASS — 127 (112 template-matrix messages, 14 additional binding verifications, 1 English fallback) |
| Registration | PASS — receive code, create account through the real form |
| Password reset | PASS — receive/open link, reset through the real page, sign in with the returned new password |
| Email binding | PASS — real verification and authenticated binding APIs |
| Interface language vs. browser language | PASS — browser locale held at en-US while interface and email changed across seven languages |
| Notification delivery | PASS — six notification variants per browser scenario; direct wallet/subscription and channel disable/enable paths additionally exercised in Go |
| Upstream task integration | PASS — real local upstream HTTP response, 9 changed channels, 117 detected additions, 9 removals, 7 localized admin messages, detail truncation preserved |
| Recipient selection | PASS — notification email override, saved language, enabled/opted-in admin filtering, and concurrent recipients |
| Error paths | PASS — invalid/missing template data, invalid language, incorrect/expired verification data, consumed reset token, missing account, SMTP failure |
| Rate limits | PASS — actual HTTP verification limit returns 429; notification limit checked separately |
| Other notification payloads | PASS — legacy subject/content retained; email metadata excluded from JSON |
| HTML/encoding | PASS — Unicode subjects, escaped dynamic names/reasons/models, correctly encoded links, no unresolved placeholders |
| Mobile email overflow | PASS — reset links wrap at 390 px in all seven languages |
| Browser JavaScript errors | 0 |
| Frontend tests (original 2026-09-14 LAB) | PASS — 256 tests in 47 files; current recovery regression checks are additional |
| Backend tests | PASS — i18n, common, service, controller, model, middleware |
| Typecheck | PASS |
| Frontend lint | PASS — 0 errors; 19 existing warnings outside the changed email files |
| Formatting and diff whitespace | PASS — changed Go/TypeScript files and `git diff --check` |
| Frontend production build | PASS |
| Root Go build | PASS |
| Independent relaykit build | PASS with GOWORK=off |

### Findings corrected during implementation/LAB

1. Backend normalization previously collapsed vi/fr/ru/ja to English, misread `zhTW`/`zh-Hant`, ignored language preference weights, and treated unknown languages as supported. A failing regression check reproduced these cases before the fix.
2. Password reset links needed query encoding for `+` email aliases. Real reset/login flows now cover those addresses.
3. The original long fallback URL overflowed a 390 px email viewport. A browser assertion reproduced the failure; inline word wrapping fixed it and the complete browser LAB was rerun successfully.
4. Two existing service cache-stat tests intermittently shared timestamp-derived keys on Windows. The issue was reproduced in an untouched baseline worktree. Test identifiers now use test names with cleanup; the three related tests passed three consecutive runs. Production cache behavior was not changed.
5. LAB fixture issues were corrected: unique referral codes for synthetic users, explicit notification rate-window initialization, and the reset form's actual `name=email` selector.

## Reproduction commands

Run from the repository root unless noted:

```powershell
go test ./i18n ./common ./service ./controller ./model ./middleware -count=1 -timeout 120s
go test ./service -run TestObserveChannelAffinityUsageCacheByRelayFormat -count=3
powershell -NoProfile -ExecutionPolicy Bypass -File e2e/run-invite-lab.ps1 -Scenario email-language.mjs
go build -o "$env:TEMP\opencode\94api-email-release.exe" .
git diff --check
```

From `relaykit/`:

```powershell
$env:GOWORK='off'
go build ./...
$env:GOWORK=$null
```

From `web/`:

```powershell
bun run test
bun run typecheck
bun run lint
bun run build
bun x --no-install oxfmt --check src/features/auth/api.ts src/features/profile/api.ts src/features/auth/__tests__/email-language.test.ts
```

The existing local Bun executable was used because Bun was not on this shell's PATH.

## Environment and evidence

- Windows amd64; Go 1.27.0; Bun 1.4.2; Node.js 24.20.0; Edge 153.0.4234.32.
- Fresh isolated SQLite database and loopback-only SMTP capture. The browser uses the real built frontend and real application API handlers.
- `%TEMP%\opencode\94api-email-lab-report.json`: final machine-readable report.
- `%TEMP%\opencode\94api-email-{en,vi,fr,ru,ja,zhCN,zhTW}.png`: final 390 px email screenshots.
- `i18n/email_test.go`, `service/email_language_test.go`, `controller/email_language_test.go`: backend regression/integration checks.
- `web/src/features/auth/__tests__/email-language.test.ts`: all three frontend request paths.
- `e2e/email-language.mjs`: rerunnable browser/HTTP/SMTP LAB.

SMTP delivery was verified against the local capture server. External provider delivery and Gmail/Outlook inbox rendering were not part of this local LAB.
