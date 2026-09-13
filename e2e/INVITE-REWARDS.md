# 94API Invite friends — implementation and lab

## Behaviour

- User page: `/invite-rewards`. Configuration: `/system-settings/billing/invite-rewards`, protected by the existing root/system-administrator policy at both route and API boundaries.
- New installations start **paused**, with first-credit mode, 8% per participant, and a 24-hour hold. The administrator explicitly enables the campaign. Existing payment gateway settings are not changed.
- Eligible sources: successfully settled wallet payments (Stripe/Epay/Creem/Waffo/Pancake), redeemed codes, and positive administrator balance adjustments. Administrator overrides reward only their positive delta.
- Only the first eligible credit counts, jointly across all three sources, including recorded pre-campaign funding. Disabling/re-enabling never resets first funding. The repeat-award option is retired in both UI and API. Upgrade normalizes old `all` settings to `first` and preserves rates, holds, activation and already-earned/pending awards. No retroactive rewards.
- Amounts use integer quota units. The rate is integer basis points, 0–10000 (0–100% **each**); round down once per award. One quota unit remains the smallest accounting unit. The total award to both participants is twice the configured percentage.
- A invites B: B's funding rewards A and B; A's funding never rewards B. C invited by B rewards B/C only. Generic refunds, check-in/registration gifts and reward transfers never trigger this ledger.
- Funding, principal credit and award creation share one database transaction. The common funding lock is acquired before reading funding rows to prevent SQLite read-to-write upgrade failures; only known rolled-back busy/deadlock/serialization errors receive bounded retries. Source IDs are unique; transfer and admin-funding requests use `Idempotency-Key` (16–80 bytes). Retain it on ambiguous failures; reuse with different admin parameters is rejected.
- Zero-hour awards are released after the funding commit; nonzero holds are picked up by the persistent DB-backed worker every 30 seconds. Failed releases retry without starving other accounts. Configuration is snapshotted at funding time.
- After release, inviter awards enter the existing `aff_quota` balance; invitee awards enter usable quota. Existing affiliate balances are preserved.
- Stripe `charge.refunded` events automatically recover referral awards using the original payment intent and cumulative refunded charge amount. For redeem/admin/other-provider refunds, the root administrator uses **Reward recovery** after confirming the refund externally. This operation recovers bonuses, **not principal** and does not initiate a payment refund.
- Full and partial recovery are idempotent. Released awards are recovered from available reward/wallet balances; any spent shortfall becomes explicit reward debt and is offset against future awards. Wallet balances are never made negative by reward recovery.
- Legacy first-funding history imports successful top-ups, redeemed codes, and retained administrator credit audit records; no balances are changed. Missing/deleted historical audit records cannot be reconstructed. Old OAuth referral relationships not persisted by the previous version likewise cannot be inferred; new OAuth registrations persist `inviter_id`.

## Recipient journal and reconciliation

- `invite_journals` records earned/released/transferred/recovered events per recipient in the same transaction as the associated balance change. Wallet/reward/debt balances are locked before snapshots; failure to write either recipient's journal rolls back both credits. A unique event key also protects replay.
- Admin history shows both participants, original Credits, the snapshotted rate, gross award per person, actual credit at release and debt offsets. Search by username, user ID, internal source or full payment trade reference; filter source/date/status, paginate and open the recipient journal.
- The User page shows only the inviter and invitee summaries, with the existing reward-transfer action; no separate detailed-history block or new detail buttons. Admin retains the reconciliation table. The `received` summary reports the invitee's pending amount and recorded wallet credits. History APIs still derive identity from authentication and exclude other recipients' journals and actual credits.
- Actual credit at release and Credits added are historical amounts, not the current wallet balance. Recoveries are separate entries. Transfers spend the pooled reward balance; they are not artificially allocated to a particular referral.
- Old funding remains visible. Missing historical snapshots/net credits are explicitly unknown. Verified old transfers are imported idempotently with known amounts and null balance snapshots; migration never changes wallet balances.
- Programme polling refreshes the open User page every 30 seconds while visible. Changing 8% to 10% updates current descriptions/examples; existing pending and historical awards retain their original rate and availability time.
- Read endpoints: `/api/user/invite-rewards/history` and `/journal` under the same prefix; equivalent `/api/option/invite-rewards/history` and `/journal` routes require root authorization. Requests validate page size, role, source, status and date boundaries.

## Repeatable local verification (Windows PowerShell)

Run from the repository root. Requires Go, Bun, Node, Docker, Edge and Playwright available to Node (the existing workstation installation was used).

```powershell
docker compose -f e2e/invite-lab.compose.yml up -d --wait
go test ./model ./controller -count=1

$env:INVITE_LAB_ENGINE='mysql'
$env:INVITE_LAB_DSN='root:invite-lab-only@tcp(127.0.0.1:13316)/invite_lab?charset=utf8mb4&parseTime=True&loc=Local'
go test ./model -run '^TestInvite' -count=1 -v

$env:INVITE_LAB_ENGINE='postgres'
$env:INVITE_LAB_DSN='host=127.0.0.1 port=15446 user=postgres password=invite-lab-only dbname=invite_lab sslmode=disable'
go test ./model -run '^TestInvite' -count=1 -v
$env:INVITE_LAB_ENGINE=$null
$env:INVITE_LAB_DSN=$null

bun run --cwd web build
bun run --cwd web typecheck
bun run --cwd web lint
bun run --cwd web test
./e2e/run-invite-lab.ps1
docker compose -f e2e/invite-lab.compose.yml down
```

The database tests **clear only the dedicated `invite_lab` databases**. Never supply production DSNs. The HTTP lab refuses external DSNs, creates its own temporary SQLite database, binds to `127.0.0.1:4198`, and uses the actual API router, authentication and production frontend. Its `/lab/*` fixture/clock endpoints exist only in `e2e/invite-lab`; Docker excludes `/e2e` entirely. The wrapper stops its own server on success or failure. Lab credentials are intentionally public test-only constants.

The HTTP/browser script exercises real registration/login, A→B→C directionality, first-only enforcement (including administrator attempts to enable repeat awards), positive admin credits, authenticated code creation/redemption, correctly signed and invalid Stripe callbacks, duplicate callbacks/transfers, cumulative partial refunds, hold release, user/admin API isolation, forged recipient/amount, all seven locales, light/dark, and 320/390/768/1024/1440-pixel viewports. It checks the restored theme button and persistence, six matching Hugeicons, responsive statistics columns, and desktop hero panels. The history phase covers A inviting B/D, $10/$20 first credits at 8% producing two pending rewards totaling $2.40 for A, distinct availability times, incoming pending cards, 8%→10% updates on the still-open page, new 10% awards, ownership attacks, pagination/search/date filters, transfer through the UI, exact before/after snapshots and both recipients in the Admin dialog. Model tests additionally cover all five gateway settlement functions, all three first-source orderings, concurrent mixed funding sources and transfers, zero/invalid rates and amounts, debt repayment, journal-write rollback (including failure on the second recipient), legacy migration, pending awards after a database reopen and OAuth inviter persistence.

Verified database engines: SQLite 3.50.4 via the existing Go driver, MySQL 8.0.46, PostgreSQL 15.19. Provider charges/refunds are simulated within the isolated lab; no real payment is made.

## Deployment and rollback

Use the existing Coolify Dockerfile application and persistent `/data` volume. Back up configuration and database, record the old image tag, deploy only after tests pass, and check production using a normal User session. Keep the campaign paused until the administrator reviews its settings.

The journal release adds one table to the existing four Invite tables. Rollback restores the prior image without dropping tables or restoring an older wallet snapshot. Preserve the new ledger for reconciliation and later redeployment; never erase already-earned balances or blindly replay historical funding. Operations during a rollback to pre-journal code will lack detailed snapshots and must remain marked historical on re-upgrade.

## Upgrade fixture from the released implementation

For each engine above, before running ordinary tests that clear lab data, seed using the actual previous release and run the opt-in upgrade test. The seed deletes only the dedicated lab tables. SQLite uses `$env:TEMP/opencode/invite-journal-upgrade.db`; ensure that temporary parent exists.

```powershell
$old = Join-Path $env:TEMP 'opencode/94api-pre-journal'
git worktree add --detach $old c8f08f57761c1ef338a90d4caa51a11a559e3fa8
Copy-Item e2e/fixtures/pre-journal-seed.go.txt "$old/model/invite_upgrade_seed_test.go"
# Set INVITE_LAB_ENGINE/INVITE_LAB_DSN as above; unset both for SQLite.
go -C $old test ./model -run '^TestInviteReleasedVersionUpgradeSeed$' -count=1
$env:INVITE_LAB_UPGRADE='1'
go test ./model -run '^TestInviteUpgradeFromReleasedDatabase$' -count=1 -v
$env:INVITE_LAB_UPGRADE=$null
```

This verifies the absent journal table, two successive migrations, preserved configuration/wallets/pending/refund/debt, null old snapshots, transfer import without duplication, release of an old pending award with debt offset and no bonus on subsequent funding. The reward journal uses the main database only; the separate application log schema is unchanged.
