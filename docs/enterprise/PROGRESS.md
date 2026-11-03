# ThriftOS Enterprise Workspace — progress log

Plan: `01-ENTERPRISE-PLAN.md`. Branch: `enterprise-e1` (from `v2-go-live` at `10a9b85`, `v1.1.1` live).

## Log
- 2026-11-03 — **E1 Design system and app shell** (done; frontend only, no migration, nothing deployed):
  - **E1.1 Tokens** (`thriftos-frontend/src/styles/_workspace.scss`): `--ws-*` surfaces, ink, plum brand (interface only), status colours, type scale (Inter + Noto Naskh Arabic), 4 px spacing, radii, shadows, density (comfortable / compact), layout sizes; light and dark. Text pairs computed against WCAG: all ≥ 4.5:1 in both themes (the first muted ink measured 4.08 and was darkened). Chart colours: the dataviz skill's validated 8-slot categorical palette, run through `validate_palette.js` against the workspace surfaces (#ffffff / #1c1a1d): all gates pass; three light-mode slots are below 3:1 on white, so charts always carry labels or a table view. Dark mode also remaps the floor (`--tos-*`), Flow and older `--app-*`/Tailwind tokens so existing pages follow it; hard-coded white backgrounds on floor screens moved to tokens (printable labels stay white).
  - Decision: **light is the default and dark is the person's choice** (not the phone's system setting), so floor phones in daylight never turn dark by surprise. `ThemeService` keeps theme and density per device.
  - **E1.2 Workspace shell** (`shell/workspace/`), used from 1024 px; phones and tablets keep the floor layout unchanged: top bar (business name, "Search or jump to…" with Ctrl/⌘ K, Create menu, sync status, theme, language, account menu with change password, row density, shortcuts, sign out); grouped menu that collapses (Home · Operations: Purchasing, Sorting, Inventory · Sales and money: Sales, Receivables · Insights: Reports · Settings), modules a business has off are hidden; breadcrumbs from the URL; command palette (screens, create, actions; ↑ ↓ Enter Esc; matches English, Urdu and Roman-Urdu keywords); shortcuts `/`, `?`, `[`, Esc; skip link. Record search in the palette waits for E2.5 (the old global search still returns pre-v1 `/app/...` links).
  - **E1.3 Components** (`shared/ui/workspace/`): page header, command bar, data grid (sticky header, sort, selection with bulk bar, totals row, money/kg/number/date formats, tabular figures), filter bar (search + removable chips), status pipeline, smart button, KPI card (delta with arrow and word, sparkline), bar chart (one axis, fixed colour slots, 2 px gaps, rounded ends, legend, hover/focus tooltip, "Show as table"), record tabs (ARIA tabs keyboard, mirrored in Urdu), activity panel (history + notes), side sheet, date range (presets + custom), empty/loading/error state. Charts and sparklines read left to right in both languages. Gallery at `/settings/ui-gallery` (not in the menu).
  - **E1.4** Floor tiles are now buttons in a group (they were buttons with a list-item role, which Lighthouse flagged); browser tests updated.
  - Tests: unit (Karma) 9 — menu/breadcrumbs, grid sorting, sparkline, axis rounding, date presets, palette matching. Browser `workspace.spec.ts` 6 — every owner screen (21 routes) opens inside the workspace at 1440 px with no page errors and no sideways scroll; home/sales records/khata/gallery in Urdu+dark at 1024, English at 1024, Urdu at 1440; Ctrl+K, `/`, `?`, `[`; theme and density remembered. Full check script green: server 181/181, i18n 415 keys, build without warnings (initial 500 kB, budget 600), browser 26 passed + 4 skipped, demo journey 3/3. **Lighthouse accessibility (desktop): 100** on home, gallery, khata and new sale, light and dark (sale was 94 before the tile fix).
  - Screenshots: `docs/enterprise/screenshots/` (gallery light/English, gallery dark/Urdu, home).
  - Known and planned: the pages inside the shell are still the phone-style floor screens and the older ERP pages (`/sell/records` etc., hard-coded white cards in dark mode). They are replaced by real list/record/dashboard screens in E2–E4.

## Decisions
- Dark mode is opt-in per person and device; light stays the default everywhere.
- The brand plum is never a chart series; charts use the validated categorical slots in fixed order.
- Workspace only from 1024 px; 600–1023 px keeps the tablet rail, phones the floor tabs.

## Blockers
- None.
