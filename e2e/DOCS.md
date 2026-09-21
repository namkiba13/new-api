# Docs browser validation — 2026-09-20

## Checkout and runtime

- Branch: `fix/94api-docs-accuracy`, base `fe84283`.
- Checkout: `C:\Users\94media\AppData\Local\Temp\opencode\94api-smart-key-toggle`.
- Node `v24.20.0`, OpenCode `1.18.31`, headless Microsoft Edge `153.0.4234.32`.
- Production-build preview: `http://127.0.0.1:4186`; public-layout API fixtures are restricted to loopback in `docs-browser.mjs`.
- No commit, push, deployment, or production inference was performed.

## Local result: passed

`node e2e/docs-browser.mjs http://127.0.0.1:4186`

- 560 guide cases: 8 guides × 7 locales × 5 widths × 2 themes.
- 70 Docs index cases: 7 locales × 5 widths × 2 themes.
- Locales: `en`, `vi`, `fr`, `ru`, `ja`, `zhCN`, `zhTW`.
- Widths: 320, 390, 768, 1024, 1440 CSS px; Light and Dark.
- Complete translated paragraphs/notes, section headings, and unchanged code blocks matched source data. Official references and their review date rendered correctly.
- Search, empty state, clear search, guide links, copy base URL, keyboard code copy, mobile menu close/navigation, Esc dismissal, focus containment and focus return passed.
- No page/main/heading/code-container overflow; no JavaScript page errors or unexpected fixture API paths.
- The published long CC-Switch protocol value was also reproduced as a layout fixture and now fits at 320 px.
- Additional touch-emulated checks passed at 390 px in both themes; menu screenshots were checked after opening animations finished.
- Screenshots reviewed for the index and guide pages on mobile/desktop, the French 1024 px heading, and the touch menu in both themes.

## Fixes made during this run

1. Replaced the custom mobile overlay with the existing Base UI-backed Sheet, which provides Esc dismissal, modal keyboard focus handling, and accessible naming.
2. Sized guide titles relative to the actual content column using native CSS container units, with word wrapping as a fallback. This fixes long French headings at 1024 px.
3. Allowed metadata grid items to shrink (`min-w-0`), fixing the long multi-protocol value that widened CC-Switch's mobile content.
4. Normalized Windows clipboard CRLF to LF in the browser assertion; copied code content remains unchanged.

The menu, heading overflow, and long metadata regressions were observed failing before their corresponding fixes.

## Public production inspection

Direct, anonymous checks against `https://94api.dev` ran the same 630 route/locale/width/theme combinations using real public responses.

- All nine Docs routes loaded with HTTP 200; no JavaScript page errors.
- Index search/empty state/reset passed in all seven locales.
- **22 geometry failures remain on the deployed version:**
  - CC-Switch metadata at 320 px in all seven locales and both themes: main content was 288 px wide but had 343 px scroll width.
  - French titles at 1024 px in both themes on OpenAI SDK, Anthropic SDK, CC-Switch, and OpenCode.
- Mobile menu Esc dismissal failed in all seven locales on the deployed version.
- Production still displays the old guide titles/content and lacks the revised official-reference sections. Local fixes above are not deployed.

## Other checks

- `bun run test src/features/docs/__tests__/content.test.tsx`: 10 passed on the final source.
- `bun run build:check`: typecheck and production build passed on the final source.
- Full frontend lint: no errors, 19 existing warnings. Final changed-file lint and formatting checks passed.
- `git diff --check`: passed.

Evidence under `C:\Users\94media\AppData\Local\Temp\opencode`:

- `docs-live-resume-report.json`: full production matrix and failures.
- `docs-live-resume.mjs`: anonymous production inspection script.
- `docs-resume-visual.mjs`: focused visual/touch checks.
- `docs-resume-build.log`: final typecheck/build output.
- `docs-*.png`: local/production and focused regression screenshots.
