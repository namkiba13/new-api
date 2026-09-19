# Smart API Key creator visibility

Admin location: **Settings → Security → Token Limits**.

`token_setting.smart_key_wizard_enabled` is a boolean, default **false**. The public
status field is `smart_key_wizard_enabled`. It controls the Smart creation button
and dialog only. Turning it off closes an open Smart dialog when the client
receives the updated status. The ordinary creator, existing keys, Auto permissions,
routing, pricing and token endpoints keep their existing behavior.

The option uses the existing settings persistence/API and validates `true`/`false`
before saving. No schema migration or new dependency is needed. The settings save
invalidates the status query and its local-storage cache. Other browser sessions
pick up changes on their next status refresh or page reload.

## Verification

- `bun run test`: **286 tests / 52 files passed**.
- `bun run typecheck` and `bun run build:check`: passed.
- `bun run lint`: no errors; 19 pre-existing warnings in other files.
- Changed files passed protected-header-preserving formatting. The full
  `bun run format:check` reports 15 pre-existing files outside this change.
- `go test ./controller ./setting/operation_setting`: passed, including persistence,
  invalid-value rejection, status output and the normal Auto token contract.
- Production Dockerfile built successfully with Go 1.26.1 / Bun 1.4.0.
- `node e2e/smart-key-toggle.mjs http` passed against the real application on
  **SQLite 3.50.4, MySQL 8.0.46, PostgreSQL 15.19**: default off, saves/restart,
  invalid-save preservation, normal-user admin rejection, normal token creation,
  existing Auto token access to `/v1/models` after toggles and process restart.
- `node e2e/smart-key-toggle.mjs ui` passed real admin/user browser flows in all seven
  locales, at 1440/390/320px in light/dark: visible switch, save/reload, creator
  shown/hidden, normal creator available, no overflow or page errors.

The HTTP/browser lab is restricted to loopback and disposable Docker resources;
it creates only local test users/keys and sends no model inference requests.

## Deployment recovery

Previous production: `b5e317b8333d2ce51fff4fcd244e71381910b7f3`.

- Verified configuration snapshot: `~/.config/coolify/94api-before-smart-key-toggle.dpapi`.
- SQLite backup: `/data/94api-before-smart-key-toggle.db`; integrity check `ok`, mode `600`.
- Code rollback uses the previous Coolify image while retaining the existing data
  volume and environment. A database restore is not required for this additive
  visibility option.
