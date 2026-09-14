# API Info layout and action verification

The route row follows the observed Modelflare layout: a vertical stack of name, full wrapping description and monospace URL, with latency and Copy on the right. External speed-test and open-new-tab actions are removed. Configured route names/descriptions remain server-provided data; interface labels and feedback use the existing seven locales.

Run from the repository root after building `web/dist`:

```powershell
bun run --cwd web build:check
bun run --cwd web test src/features/dashboard
./e2e/run-invite-lab.ps1 -Scenario api-info.mjs
```

The scenario reuses the existing loopback-only backend harness, bootstraps an isolated DB and creates real root/User sessions. API Info is configured through its real administration endpoint. It performs no payments, reward transfers or security changes on production.

Checks:
- 320/390/768/1024/1440px, light/dark, English/Vietnamese/French/Russian/Japanese/Simplified Chinese/Traditional Chinese.
- Name, description and URL occupy separate lines; full description remains visible without clipping or horizontal page overflow.
- Exactly two action buttons; no external-link action or popups.
- Every matrix case sends a real HEAD to the configured local URL, renders the latency and copies the exact URL into the browser clipboard with translated success feedback.
- A controlled in-flight HEAD verifies disabled/pending state. An aborted network request verifies N/A and recovery; keyboard Enter is tested.
- Original clipboard content is restored when available. Set `SCREENSHOT_DIR` to an existing directory to save desktop/mobile screenshots.

The latency value measures browser HEAD request time. It is not a model-provider health check or a billable API request. Production verification uses the real configured endpoint and checks the actual public site after deployment.
