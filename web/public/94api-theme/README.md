# 94API homepage

Source: user-supplied `94api-theme.zip` (2026-09-12).

The entry is named `home.html`: Go's file server redirects `index.html` to a
directory, which conflicts with Gin's trailing-slash redirects in production.

The default Home route embeds these trusted, same-origin static assets. The
document owns its header, footer, styles, and scrolling. Application links use
`target="_top"`; section anchors remain inside the page. Admin-configured custom
home content continues to use the existing sanitized/sandboxed renderer.

API requests and responses are illustrative. Use a model enabled for your
account from `/pricing`; the production API base is `https://94api.dev`.

Browser regression check: `node e2e/94api-home.mjs https://94api.dev`
(requires Playwright and Microsoft Edge). Pass a local preview URL to check
before deployment.
