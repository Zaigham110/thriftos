# ThriftOS Enterprise Workspace — Plan

Status: in progress (E1 and E2 done 2026-11-03/04). v2 Phase 5 (AWS go-live) was done first, as the owner chose. Branch: `enterprise-workspace` (from `v1-reshape` at `26f1ae3`, tag `v1.0.0-demo`).

## Why
The owner reviewed the v1 demo: it works, but it is not enough to pitch and does not look like serious business software.
On a laptop every owner screen is the phone screen stretched out: a narrow column of cards and list rows, no tables,
filters, record pages, charts, top bar or global search. A buyer comparing us with Odoo, Dynamics or Oracle sees an
app, not an ERP. The pitch now runs from small traders to large importers and exporters, so the product must look and
behave like enterprise software while keeping what makes it ours.

## Two faces, one system
- **Floor app (phone)** — munshi screens from v1 stay as they are: big tiles, keypad, offline, Urdu first, the 10-second
  test (`docs/v1/05-UI-UX-GUIDELINES.md`). Nothing in this plan makes them harder.
- **Workspace (laptop / tablet ≥ 1024px)** — a new owner and manager workspace in the style of an enterprise ERP. Same
  data, same API, same permissions. The owner on a phone keeps the v1 phone screens; on a laptop the workspace opens.

Look and feel is a mix chosen for this product (owner's call: "mix, your call"):
- **Odoo** — list / kanban / form views for every record type, a status pipeline on each record, "smart buttons" with
  counts of related records, an activity log on the right of every record.
- **Dynamics 365** — left navigation grouped by area, a command bar above every list and record, dense grids with
  column chooser, saved views.
- **Oracle Redwood** — calm spacing, strong page headers, KPI cards and guided steps for long processes.

## What "enterprise" means here (must-haves)
Every item below is something a buyer expects from Odoo/Dynamics/Oracle; each ends up as a task in the phases.

1. **App shell** — top bar (business name/logo, global search, quick create "+", notifications, help, user menu with
   language, theme and sign-out), grouped left navigation that can collapse, breadcrumbs, favourites, keyboard
   shortcuts and a command palette (Ctrl/⌘ K).
2. **List views** — server-side paging, sort, filters (chips + advanced), group-by with subtotals, totals row, column
   chooser, density (comfortable / compact), saved views per user, multi-select with bulk actions, export to Excel/CSV,
   print.
3. **Kanban views** — for things that move through stages (containers, sorting sessions, collections).
4. **Record (form) views** — header with code, status pipeline and the main actions; smart buttons ("Lots 3",
   "Bales 18", "Sales 12", "Profit Rs 2,10,000"); tabs; right-hand activity panel with the audit trail, notes,
   attachments and @mentions; previous / next record.
5. **Dashboards** — KPI cards with trend and change vs the previous period, charts, a date-range and branch filter on
   every dashboard, click any number to open the list behind it.
6. **Documents** — branded PDF templates (logo, NTN/STRN, address, terms): sale invoice, payment receipt, customer
   statement of account, goods received note for a container, packing list, bale labels. Print, download, or share on
   WhatsApp.
7. **Security and control** — roles with a permission matrix (view / create / edit / delete / approve per area),
   field-level hiding of costs and profit for non-owners, approvals (discount above a limit, sale over credit limit,
   back-dated entry), full audit log viewer, active sessions, two-step sign-in for owners.
8. **Multi-branch and multi-warehouse** — a business can have several branches/godowns; every list and dashboard
   filters by branch; stock transfers between godowns.
9. **Data in and out** — import from Excel with preview and row errors, export of any list, a full business export.
10. **Notifications** — in-app bell for approvals, overdue customers, low stock, a sale over credit limit.
11. **Settings that look like an ERP** — company profile, branches, numbering sequences, document templates, taxes,
    payment methods, categories/grades, modules, users and roles, all in one settings area with a left menu.
12. **Polish** — one design system, light and dark theme, Urdu RTL in the workspace too, empty / loading / error states
    on every screen, accessible (WCAG AA), fast (lists < 1 s for 10,000 rows with server paging).

## What makes us stand out (differentiators)
Generic ERPs cannot do these without months of customisation; local tools cannot do them at all.

1. **Container-to-cash traceability** — open any container and see landed cost → lots → sorting yield by category and
   grade → bales → who bought them → profit, to the paisa. Scan any bale QR and see the same chain backwards.
2. **Supplier and origin scorecard** — profit per kg, A-grade %, waste %, days to sell, by supplier and by country,
   so the owner knows where to buy the next container. This is the headline of the pitch.
3. **Sorting yield analytics** — expected vs actual yield per supplier/category, waste trend, and (with payroll)
   kg and quality per worker.
4. **Stock ageing for bales** — what has been sitting 30/60/90+ days, its cost, and a suggested markdown.
5. **Udhaar collections desk** — ageing buckets, promise-to-pay dates, one-click WhatsApp reminders in Urdu/English,
   statement of account on WhatsApp, collection effectiveness by month.
6. **Floor + office in one** — offline Urdu phone app for the munshi, enterprise workspace for the owner, same live data.
7. **Industry templates** — presets for a Sher Shah importer/sorter, a Lahore bale trader, and an exporter, so a new
   business is set up in minutes.
8. **Ask ThriftOS** (stretch) — type a question ("which supplier made the most profit per kg this quarter?") and get the
   answer with the numbers behind it.

## Phases

### Phase E1 — Design system and app shell (week 1–2)
- [x] E1.1 Design tokens (`thriftos-frontend/src/styles/tokens`): neutral grey scale + plum brand `#714b67`, semantic
  colours (success, warning, danger, info), a validated chart palette, type scale (Inter for Latin, Noto Naskh Urdu for
  Urdu), 4px spacing grid, radii, shadows, comfortable/compact density, light and dark themes, RTL-safe (logical CSS
  properties only).
- [x] E1.2 Workspace shell (≥ 1024px): top bar, grouped collapsible left nav (Home · Purchasing · Sorting · Inventory ·
  Sales · Receivables · Finance · Reports · Settings), breadcrumbs, command palette (Ctrl/⌘ K: go to any screen, find a
  container/bale/customer/sale by code or name, quick create), keyboard shortcuts help (`?`).
- [x] E1.3 Core components in `shared/ui/workspace`: page header with actions, command bar, data grid, filter bar,
  status pipeline, smart button, KPI card with sparkline, chart wrapper, record tabs, activity panel, side sheet,
  date-range picker, empty/loading/error states. A component gallery page (`/settings/ui-gallery`, owner only) to review
  them.
- [x] E1.4 The phone layout stays the default under 1024px; owners on a laptop land in the workspace. Floor tests stay
  green.
- Acceptance: every existing owner route renders inside the new shell at 1440×900 and 1024×768 in English and Urdu;
  light and dark; Lighthouse accessibility ≥ 95.

### Phase E2 — List, kanban and record framework (week 2–3)
- [x] E2.1 Server: one list query contract for all list endpoints — `page`, `pageSize`, `sort`, `filter` (typed
  operators), `groupBy` with subtotals, `fields`; tenant-scoped, indexed; returns totals. Tests for each operator and
  for tenant isolation.
- [x] E2.2 Saved views per user (filters, columns, sort, group-by, density) — new table `SavedView`.
- [x] E2.3 Export of any list to Excel/CSV (server-side, streams, respects filters and the user's field permissions).
- [x] E2.4 Activity panel: audit trail per record from `AuditLog` (who changed what, before → after), notes,
  attachments (reusing `FileStorageService`), @mention → notification. New tables `RecordNote`, `Attachment`,
  `Notification`.
- [x] E2.5 Global search across containers, lots, bales, customers, suppliers, sales, payments (extend `search/`).
- Acceptance: a reusable grid + record page used by at least one real record type end to end; 10,000-row list loads a
  page in < 1 s on the test DB.

### Phase E3 — Workspace modules (week 3–6)
Each area gets list + record (+ kanban where it has stages), using E2.
- [ ] E3.1 **Purchasing** — suppliers (record with scorecard tab), containers (kanban by status, record with landed cost
  breakdown, charges, lots, sorting, bales, sales, profit — the traceability page), loose lots, purchase orders (when the
  module is on), goods received note PDF.
- [ ] E3.2 **Sorting** — sessions list/kanban, session record with category/grade outputs and waste, yield analysis
  view.
- [ ] E3.3 **Inventory** — stock items (filter by category, grade, age, branch), bale record with full lineage and QR,
  movements ledger, stock ageing, stock valuation, stock count and adjustment with approval, godown transfers.
- [ ] E3.4 **Sales** — sales list (filters, group by customer/category/month, totals and profit), sale record with
  lines, payments, profit, invoice PDF, WhatsApp share; a desktop sale entry form with keyboard-first line entry;
  price lists by customer group.
- [ ] E3.5 **Receivables (Khata)** — customer 360 record (balance, ageing, sales, payments, statement, credit limit,
  notes), ageing report 0–30 / 31–60 / 61–90 / 90+, collections worklist with promise-to-pay dates, bulk WhatsApp
  reminders, statement of account PDF.
- [ ] E3.6 **Finance (management accounts)** — expenses with categories (rent, labour, transport, electricity, other)
  and attachments, cash and bank book by payment method, daily cash close, profit and loss by month (gross profit from
  sales − expenses). A full general ledger is not in scope; noted for later.
- Acceptance: the owner can run the whole business from a laptop without the phone screens, and every list has
  filters, group-by, totals and export.

### Phase E4 — Dashboards and analytics (week 6–7)
- [ ] E4.1 Owner dashboard: revenue, gross profit and margin with trend, cash collected, udhaar owed with ageing, stock
  value with ageing, containers in progress, today's activity; date range and branch filter; every number opens its list.
- [ ] E4.2 Supplier & origin scorecard (differentiator 2) with charts and ranking.
- [ ] E4.3 Sales analytics: by customer, category, grade, city, month; top customers; price trend per grade.
- [ ] E4.4 Sorting analytics (yield, waste, by supplier and category) and stock ageing dashboard.
- [ ] E4.5 Report centre: all reports in one place, each with filters, chart + table, export and print.
- Acceptance: each dashboard loads in < 2 s on the demo data; numbers match the SQL checks and the list totals (tests).

### Phase E5 — Control, multi-branch and administration (week 7–8)
- [ ] E5.1 Roles with a permission matrix screen; field-level hiding of cost/profit; built-in roles Owner, Manager,
  Accountant, Sales, Munshi.
- [ ] E5.2 Approvals: discount over a limit, sale over credit limit, back-dated entry, stock adjustment — request,
  approve/reject with a note, notification, audit.
- [ ] E5.3 Branches and godowns: branch on users, containers, stock, sales, payments; branch filter everywhere; transfers.
- [ ] E5.4 Settings area with left menu: company profile and logo, branches, numbering, document templates, taxes,
  payment methods, catalogue (categories, grades, waste types), modules, users and roles, audit log viewer, active
  sessions, import/export, two-step sign-in for owners.
- Acceptance: a Sales user cannot see cost or profit anywhere (API and screens, tested); an approval flow works end to
  end; two-branch business filters correctly everywhere.

### Phase E6 — Enterprise demo (week 8–9)
- [ ] E6.1 Demo data v2: 12 months, 2 branches (Karachi Sher Shah, Lahore), 4 suppliers (USA, UK, Korea, Canada),
  24 containers, ~1,000 bales, 40 customers with realistic ageing, ~800 sales, expenses, a few pending approvals, users
  for every role. Built through the services like v1's `demo:reset`.
- [ ] E6.2 Enterprise demo script (15 minutes) for medium/large buyers, plus the 5-minute floor demo from v1.
- [ ] E6.3 Playwright tests at 1440×900 for the workspace journeys, screenshot set for the pitch deck and website.
- [ ] E6.4 Visual review pass: every workspace screen checked against the design system in light/dark, English/Urdu.
- Acceptance: the 15-minute enterprise demo runs without a phone, all workspace tests green 3 runs in a row.

### Later
Full general ledger and bank reconciliation · FBR e-invoicing (v2 Phase 9) · payroll (v2 Phase 8) · API keys and
webhooks · SSO · buyer portal · Ask ThriftOS (if not done as a stretch in E4).

## Rules carried over
- Migrations only on `thriftos_test`; the dev DB changes only through an `apply-*.sh` script the owner runs.
- One commit per task, tests with every task, tenant isolation tests for every new endpoint, Decimal for all money.
- Floor app tests and the v1 demo test stay green throughout.
- Progress in `docs/enterprise/PROGRESS.md`.

## Relation to the v2 go-live plan
`docs/v2/01-GO-LIVE-PLAN.md` (branch `v2-go-live`) covers deploying to AWS, onboarding, billing, payroll and FBR.
The two plans touch different code except the shell and settings. Order is the owner's decision (see open questions).

## Open questions for the owner
1. ~~Order~~ — decided 2026-11-03: v2 Phase 5 (AWS go-live) first, then this plan.
2. Finance depth: management accounts (expenses, cash book, P&L) as planned, or a full double-entry general ledger now?
3. Ask ThriftOS (AI questions on your data): include in E4, or later?
