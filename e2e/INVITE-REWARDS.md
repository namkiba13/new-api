# 94API Invite friends — implementation and lab

## Behaviour

- User page: `/invite-rewards`. Configuration: `/system-settings/billing/invite-rewards`, protected by the existing root/system-administrator policy at both route and API boundaries.
- New installations start **paused**, with first-credit mode, 8% per participant, and a 24-hour hold. The administrator explicitly enables the campaign. Existing payment gateway settings are not changed.
- Eligible sources: successfully settled wallet payments (Stripe/Epay/Creem/Waffo/Pancake), redeemed codes, and positive administrator balance adjustments. Administrator overrides reward only their positive delta.
- First mode counts funding across all three sources, including recorded pre-campaign funding. Switching modes or disabling/re-enabling never resets first funding. No retroactive rewards.
- Amounts use integer quota units. The rate is integer basis points, 0–10000 (0–100% **each**); round down once per award. One quota unit remains the smallest accounting unit. The total award to both participants is twice the configured percentage.
- A invites B: B's funding rewards A and B; A's funding never rewards B. C invited by B rewards B/C only. Generic refunds, check-in/registration gifts and reward transfers never trigger this ledger.
- Funding, principal credit and award creation share one database transaction. Source IDs are unique; transfer and admin-funding requests use `Idempotency-Key` (16–80 bytes). Retain it on ambiguous failures; reuse with different admin parameters is rejected.
- Zero-hour awards are released after the funding commit; nonzero holds are picked up by the persistent DB-backed worker every 30 seconds. Failed releases retry without starving other accounts. Configuration is snapshotted at funding time.
- After release, inviter awards enter the existing `aff_quota` balance; invitee awards enter usable quota. Existing affiliate balances are preserved.
- Stripe `charge.refunded` events automatically recover referral awards using the original payment intent and cumulative refunded charge amount. For redeem/admin/other-provider refunds, the root administrator uses **Reward recovery** after confirming the refund externally. This operation recovers bonuses, **not principal** and does not initiate a payment refund.
- Full and partial recovery are idempotent. Released awards are recovered from available reward/wallet balances; any spent shortfall becomes explicit reward debt and is offset against future awards. Wallet balances are never made negative by reward recovery.
- Legacy first-funding history imports successful top-ups, redeemed codes, and retained administrator credit audit records; no balances are changed. Missing/deleted historical audit records cannot be reconstructed. Old OAuth referral relationships not persisted by the previous version likewise cannot be inferred; new OAuth registrations persist `inviter_id`.

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

The HTTP/browser script exercises real registration/login, A→B→C directionality, first/all, positive admin credits, authenticated code creation/redemption, correctly signed and invalid Stripe callbacks, duplicate callbacks/transfers, cumulative partial refunds, hold release, user/admin API isolation, forged recipient/amount, all seven locales, light/dark, and 320/390/768/1024/1440-pixel viewports. Model tests additionally cover all five gateway settlement functions, concurrent credits/transfers, integer limits, debt repayment, legacy migration and OAuth inviter persistence.

Verified database engines: SQLite via the existing Go driver, MySQL 8.0.46, PostgreSQL 15.19. Provider charges/refunds are simulated within the isolated lab; no real payment is made.

## Deployment and rollback

Use the existing Coolify Dockerfile application and persistent `/data` volume. Back up configuration and database, record the old image tag, deploy only after tests pass, and check production using a normal User session. Keep the campaign paused until the administrator reviews its settings.

Schema changes are additive (four new tables); rollback restores the prior image without dropping tables or restoring an older wallet snapshot. Pause the programme before an operational rollback. Preserve the new ledger for reconciliation and later redeployment; never erase already-earned balances or blindly replay historical funding.
