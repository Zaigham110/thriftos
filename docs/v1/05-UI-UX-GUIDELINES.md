# ThriftOS v1 — UI/UX Guidelines ("easy first")

These rules override older design docs (`docs/ui/*`, `docs/design-system/*`, now in `docs/archive/`) where they conflict. The brand colour stays deep plum `#714b67`.

## The 10-second test
Every daily screen (receive, sort line, sale, payment) must be usable by a munshi in under 10 seconds, with one hand, on a 5–6 inch Android phone, possibly with poor light, dirty hands and no internet. If a screen fails this, simplify it before adding anything.

## Rules
1. **One job per screen.** A screen has one primary button at the bottom (thumb zone), full width, min height 52px.
2. **Minimum fields.** Required fields on any form: max 4. Everything else is optional, collapsed under "More details".
3. **Numbers, not text.** Weight, money and count inputs open a large numeric keypad (`inputmode="decimal"`). Show units (kg, PKR, pcs) inside the field.
4. **Tiles over dropdowns.** Categories, grades, payment methods, suppliers (top 8) are big tap tiles (min 64×64px) with icon + label; most-used first. Search appears only when the list > 8.
5. **Smart defaults.** Today's date, current user, last supplier, last price for this customer+grade, PKR, tenant's default language are pre-filled.
6. **Immediate feedback.** After save: short success toast + vibration, the screen stays ready for the next entry (sorting) or shows the next useful action (sale → "Share bill on WhatsApp").
7. **Undo instead of confirm.** No "Are you sure?" for normal actions; show "Undo" for 10 seconds. Confirm dialogs only for destructive or money-impacting edits (close lot with remainder, cancel sale).
8. **Numbers the owner understands.** Show PKR with thousands separators (Rs 1,25,000 style optional setting), kg with 1 decimal, percentages as whole numbers. No raw IDs anywhere in the UI; show codes like `C-0012`, `B-0345`.
9. **Language.** Every label comes from the i18n dictionary (`en`, `ur`). Urdu uses RTL layout and an Urdu font (e.g., Noto Nastaliq Urdu for headings, Noto Naskh Arabic/Urdu UI font for body for readability). Numbers stay in Western digits.
10. **Offline is visible but calm.** A small cloud badge shows "Offline — saved on phone (3)" ; never block the user for connectivity.
11. **Hide advanced.** Modules not enabled for the tenant do not appear at all (no disabled grey menu items).
12. **Accessible.** Contrast AA, touch targets ≥ 48px, labels on every icon button, works with system font scaling.

## Layout
- Phone: top bar (title + sync badge), content, bottom tab bar (5 tabs max: Home, Receive, Sort, Sell, Khata; Stock and More inside Home/More).
- Desktop (owner/admin): side nav, wider tables, same components. Data-dense tables (44px rows, 13px) are allowed on desktop only.

## Components to build/keep in `shared/ui`
Big tile grid · numeric keypad sheet · amount/weight input with unit · customer/supplier picker (tiles + search) · bottom action bar · stat card (owner home) · list row with right-aligned amount · empty state with one action · toast with undo · sync badge · QR scanner sheet (camera) · QR label print layout.

## Copy style
Short, spoken words. "Maal aya" over "Inbound procurement". English and Urdu strings reviewed by a native speaker. Error messages say what to do: "Weight is more than the lot left (420 kg). Enter 420 or less."
