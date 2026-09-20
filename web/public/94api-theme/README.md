# 94API homepage

Source: user-supplied `94api-theme.zip` (2026-09-12).

The entry is named `home.html`: Go's file server redirects `index.html` to a
directory, which conflicts with Gin's trailing-slash redirects in production.

The default Home route embeds these trusted, same-origin static assets. The
application owns the native header, language selector, theme selector and
notification popover. The embedded document hides its fallback header and owns
its footer, styles, and scrolling. Application links use
`target="_top"`; section anchors remain inside the page. Admin-configured custom
home content continues to use the existing sanitized/sandboxed renderer.

The native language selector provides en, vi, fr, ru, ja, zhCN and zhTW.
`translations.js` translates the landing page; API examples and brand names stay
unchanged. `preferences.js` accepts language and resolved light/dark preferences
only from its same-origin parent. The application's existing theme provider owns
Light/Dark/System persistence and system-color changes. Notifications use the
existing application APIs, not demo content.

Deploy the React changes together with these static assets, then rebuild the
frontend through the existing Coolify workflow. Uploading only this folder is
not sufficient. Regression tests: `bun run test src/features/home/__tests__`.

API requests and responses are illustrative. Use a model enabled for your
account from `/pricing`; the production API base is `https://94api.dev`.

Browser regression check: `node e2e/94api-home.mjs https://94api.dev`
(requires Playwright and Microsoft Edge). Pass a local preview URL to check
before deployment.

## Home footer

The Home footer uses the existing theme-aware 94API wordmarks, a short service
description, and two link groups: Resources (Docs, Quick start, Models & pricing)
and Support (email, Terms of Use, Privacy Policy). The original New API /
QuantumNous attribution is retained. Customer navigation does not expose the raw
`/api/status` JSON endpoint. Internal links leave the iframe with `target="_top"`.

On 2026-09-20, `node e2e/home-footer.mjs http://127.0.0.1:4186` passed all 70
locale/width/theme cases (seven locales, 320/390/768/1024/1440 px, Light/Dark),
including readable links, 44 px navigation targets, correct logos, and eight
keyboard navigations out of the iframe. Six Home tests, typecheck, production
build, and changed-file formatting passed; full frontend lint had no errors and
19 existing warnings. The five public destination routes returned HTTP 200.
Run the same footer check with `https://94api.dev` for anonymous production
verification; API fixtures are enabled only for loopback previews.
