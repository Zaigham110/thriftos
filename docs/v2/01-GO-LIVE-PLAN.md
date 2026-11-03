# ThriftOS v2 — From demo to paid product

Status: active plan (2026-11-03). Branch: `v2-go-live` (from `v1-reshape` at tag `v1.0.0-demo`).
v1 docs in `docs/v1/` stay the source of truth for product rules, UX rules, architecture and data model. This plan adds what is needed to run ThriftOS for real customers.
Product rule still applies to every task: **sell easiness and productivity, not a complex tool.**

Order (owner had no preference; chosen to reach a first paying pilot fastest):
Phase 5 Go live → Phase 6 Onboarding (import, Play Store, printing) → Phase 7 Billing → Phase 8 Payroll → Phase 9 FBR e-invoicing and export.

## Phase 5 — Housekeeping and go live on AWS (week 1–2)
Target: the owner's existing AWS free-tier account. One EC2 micro instance (1 GB RAM) running Docker Compose. Nothing is built on the server.

- [ ] 5.0 Housekeeping
  - Work only in this repository folder (no separate clone/worktree); confirm installs, tags and commits land here.
  - Remove the unused imports behind every NG8113 warning; CI fails on new Angular warnings.
  - Make GitHub Actions run green on push (owner enables Actions if disabled); merge `v1-reshape` → `main` via PR once green.
- [ ] 5.1 Production config
  - `docker-compose.prod.yml`: `postgres:16-alpine` (tuned for 1 GB: shared_buffers 128MB, max_connections 30), `server`, `web` (nginx serving the built app), `caddy` (HTTPS via Let's Encrypt, reverse proxy `/api` → server). Memory limits per container; 2 GB swap file documented in the server setup script.
  - Rename the migrate switch to `RUN_MIGRATIONS_ON_START` (production: 1); keep the dev guard behaviour from `scripts/db-guard.js`.
  - All secrets from `/opt/thriftos/.env.prod` on the server (never in git). New `JWT_SECRET` and DB password generated on the server (this closes "rotate secrets").
  - `NODE_ENV=production`, CORS limited to the app domain, rate limits on auth (already Throttler), secure cookies/headers in Caddy.
- [ ] 5.2 Build and deploy pipeline
  - GitHub Actions: on tag `v*` (and manual dispatch) build `server` and `web` images for `linux/amd64` (or arm64 if the instance is Graviton), push to GHCR, then deploy over SSH: `docker compose pull && docker compose up -d`, wait for `/api/health`, roll back to the previous image tag if health fails.
  - `scripts/server-setup.sh`: one-time EC2 setup (Docker, swap, firewall: 22 from owner IP only, 80/443 open; unattended security updates).
- [ ] 5.3 Backups and restore
  - Nightly `pg_dump -Fc` to S3 (free tier 5 GB) with 14 daily + 8 weekly kept; encrypt at rest (SSE-S3).
  - `scripts/restore-from-s3.sh` and a monthly restore test documented; a GitHub Action or cron alerts if the last backup is older than 26 h.
- [ ] 5.4 Monitoring
  - Uptime check on `/api/health` (free service, e.g. UptimeRobot or Better Stack), alert to owner's email/WhatsApp.
  - Structured JSON logs with request id and tenantId; log rotation in Docker; error tracking (Sentry free tier) for server and web, no personal data in events.
- [ ] 5.5 Domain and email
  - Domain (owner buys, e.g. thriftos.pk or .app); `app.<domain>` for the PWA, public bill links use it (`PUBLIC_APP_URL`).
  - Transactional email only for owner password reset (SES or a free SMTP tier); munshi uses phone + PIN.
- [ ] 5.6 Legal and trust basics
  - Simple Terms and Privacy page (English + Urdu), data ownership statement ("your data is yours; export any time"), data export of a whole tenant (Excel/CSV zip) from Settings.
- [ ] 5.7 Free-tier exit plan
  - Document cost and steps to move to a paid instance (e.g. t4g.small) and when (free tier expiry date, or > 70% RAM, or > 10 active businesses).
- Acceptance: `https://app.<domain>` serves the PWA over HTTPS; deploy from a tag in < 10 minutes with automatic rollback; a backup restores into a fresh DB and both SQL checks return 0 rows; uptime alert tested.

## Phase 6 — Onboarding real customers (weeks 3–5)
- [ ] 6.1 Import from register/Excel
  - Downloadable Excel templates (Urdu + English headers): customers with opening udhaar, suppliers, opening stock (bales/kg/pieces with cost).
  - Upload → preview with row-level errors in plain words → confirm. Idempotent (re-uploading the same file does not duplicate). Tests with messy real-world data (Roman Urdu names, phone formats, blank rows, "Rs 1,25,000").
- [ ] 6.2 Android app on Play Store
  - Trusted Web Activity wrapping the PWA (Bubblewrap), Digital Asset Links on the domain, app name "ThriftOS", Urdu + English store listing, screenshots from `docs/v1/screenshots/`, privacy policy URL. Internal testing track first.
- [ ] 6.3 Printing
  - Bluetooth thermal printer support for 58 mm and 80 mm (ESC/POS) via Web Bluetooth where available, with fallback to the Android print dialog / shared PDF. Templates: bale QR label (50×30 mm), sale bill, payment receipt. Test on at least one common local printer model.
- [ ] 6.4 First-week experience
  - In-app checklist on Home for a new business (add supplier → first container → first sale → invite munshi), each one tap. Short Urdu help videos/screens linked from empty states.
- [ ] 6.5 Super-admin onboarding tools
  - Create a business for a customer in < 2 minutes, impersonate read-only for support (audited), see last activity per business.
- Acceptance: a pilot business is onboarded from its paper register in one visit (< 1 hour), installs the Play Store app, and prints a bale label and a bill.

## Phase 7 — Subscriptions and billing (weeks 6–7)
- [ ] 7.1 Plans in data, not code: Free (1 device, khata + direct stock), Workshop, Importer, Export (prices editable by super admin; PKR). Plan decides `enabledModules` and limits (users, devices).
- [ ] 7.2 14-day trial of Workshop for every new business; then Free unless paid.
- [ ] 7.3 Payment: manual first — customer pays to the owner's JazzCash/Easypaisa/bank and uploads a screenshot; super admin confirms in one tap; invoice PDF. Design the provider interface so an online gateway (e.g. JazzCash/Easypaisa merchant API, Safepay, PayFast) can be added later.
- [ ] 7.4 Non-payment: 7-day grace with a banner, then read-only (data never deleted, export always allowed).
- [ ] 7.5 Super-admin revenue view: active businesses, plan, paid until, MRR in PKR.
- Acceptance: a business moves trial → paid → expired → read-only → paid again, with correct module access at each step; tests cover it.

## Phase 8 — Sorter payroll (weeks 8–9)
- [ ] 8.1 Workers as people without login (name, phone, rate type: per kg / per day / monthly, rate).
- [ ] 8.2 Sorting entries can carry a worker (default: last worker on this device); kg per worker per day computed from sorting outputs.
- [ ] 8.3 Pay sheet per week/month: kg × rate or days × rate, advances, deductions, net; mark paid (cash); WhatsApp payslip text.
- [ ] 8.4 Owner home: labour cost per container added to profit (container profit = sales − landed cost − labour).
- [ ] 8.5 Productivity: kg per worker per day and A-grade share by worker (useful for theft/quality questions), visible to owner only.
- Acceptance: a week of sorting produces a correct pay sheet; container profit includes labour; tests prove totals.

## Phase 9 — FBR e-invoicing and export (weeks 10–12)
- [ ] 9.1 FBR e-invoicing for sales-tax-registered businesses via PRAL or a licensed integrator: tenant settings (NTN/STRN, buyer registration), invoice submission on sale issue, FBR invoice number + QR on the bill, retry queue, sandbox tests. Confirm the current FBR technical spec and integrator terms before building; record sources in PROGRESS.md.
- [ ] 9.2 Export pack (EXPORT module): packing list per container shipment from bales (code, grade, kg, pieces), commercial invoice, fumigation/certificate attachments, per-bale sorting record ("fit for reuse" evidence) printable/exportable.
- [ ] 9.3 Multi-warehouse (WAREHOUSES module): stock per location, transfer with QR scan, stock report per warehouse.
- Acceptance: a registered business's sale gets an FBR invoice number in sandbox; an export shipment produces a packing list and per-bale records from existing data.

## Later
Buyer portal (customers see their own khata and bills), online payment gateway, multi-currency export sales, analytics across businesses (opt-in), AI-assisted grading from photos.
