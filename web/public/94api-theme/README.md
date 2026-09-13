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
