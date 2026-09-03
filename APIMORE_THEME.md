# apiMore theme and product customizations

This branch preserves the complete apiMore customization layer on top of NewAPI.
It is intended to be rebased or cherry-picked when NewAPI is upgraded.

## Included scope

- Public apiMore home page, header, footer, responsive layout, light/dark themes.
- Public pricing/model catalog, provider icons, model details and mobile model picker.
- Public documentation and setup-guide routes.
- SEO/meta helpers and localized navigation/content.
- English, Vietnamese, French, Japanese, Russian, Simplified Chinese and Traditional Chinese strings.
- Smart API Key creation and routing strategies:
  - Balanced uses all `*-stable` groups.
  - Stability first uses all `*-premium` groups.
  - Low price first uses all `*-award` groups.
- API key group labels and filtering of internal `auto`/`default` groups from normal key creation.

## Upgrade workflow

1. Create a backup of the production database and current deployed image.
2. Fetch the desired upstream NewAPI release into a temporary upgrade branch.
3. Rebase this theme branch onto that release, or cherry-pick the saved theme commit.
4. Resolve conflicts by keeping upstream API contracts and reapplying apiMore presentation/components.
5. In `web`, install dependencies and run `pnpm typecheck`, `pnpm test`, and `pnpm build`.
6. Test `/`, `/pricing`, `/docs`, `/keys` and the Smart API Key flow locally in light/dark and desktop/mobile modes.
7. Confirm all locales, SEO metadata, model/provider icons and live model calls.
8. Deploy only after local acceptance, then verify production and retain the previous image for rollback.

## Runtime settings that are not stored in the theme

Database-backed NewAPI settings must be preserved separately during an upgrade. In particular:

- Pricing groups and ratios.
- Auto group order and per-token auto group snapshots.
- Special usable group rule granting the default user group access to `auto`.
- Channels, models, model abilities, API keys and user data.

Do not commit local `.env.development`, credentials, channel keys or production API keys to this branch.
