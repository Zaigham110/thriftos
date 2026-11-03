# ThriftOS v1 — Product Requirements (PRD)

Status: approved direction, 2026-10-29. Branch: `v1-reshape`.

## 1. One-line pitch
ThriftOS shows a used-clothing (landa) business owner the real profit of every container, and makes daily work (weighing, sorting, selling, udhaar) faster than a register — on a cheap phone, in Urdu, even without internet.

## 2. Product rule (applies to every decision)
**Sell easiness and productivity, not a complex tool.**
- If a feature makes a daily screen slower or longer, it does not ship in v1.
- One job per screen. Taps and numbers, not typing.
- Defaults fill everything; the user only changes what is different.
- Advanced features exist behind tenant settings and stay hidden by default.

## 3. Market context (from research, Oct 2026)
- Pakistan imported a record 1.137 million tonnes of used clothing worth $511m in FY25; ~300 importers in Karachi (Sher Shah) and 70–80 licensed KEPZ sorters handle most of it.
- A Sher Shah workshop owner earns about PKR 1.0–1.5m per sorted container; profit depends on yield (share of A grade) which varies by supplier/origin.
- No software exists for this trade. Substitutes: register (khata), memory, WhatsApp, Excel, generic tools (HysabOne PKR 3,499–7,000/month), free khata apps.
- FBR e-invoicing became mandatory for all importers from Nov 2025 (later phase for ThriftOS).
- Full report: `Used clothing market for ThriftOS.md` (research deliverable).

## 4. Target users (v1)
| Persona | Who | Device | What they need |
|---|---|---|---|
| Owner (Seth) | Importer / workshop owner, Karachi | Phone, sometimes laptop | 3 numbers: profit per container, udhaar owed, stock ready; supplier comparison |
| Munshi / supervisor | Writes records daily | Cheap Android phone, shared | Fast weigh-in, sorting entry, sales, payments; Urdu; offline |
| Sorter / worker | Sorts by hand | Usually no device in v1 | Their kg is recorded by munshi (v1.1: piece-rate pay) |
| Buyer (wholesaler / landa shop) | Buys bales on credit | Phone (WhatsApp) | Receives bill and reminders on WhatsApp; no login needed in v1 |
| Small merchant | Buys ready bales, sells pieces | Phone | Direct stock: buy → sell, khata (free tier later) |

First paying segment: **Karachi importer-sorters and larger Sher Shah workshops.**

## 5. v1 scope — must have
1. **Container / lot in** — supplier, origin country, weight (invoice vs weighbridge), purchase cost, charges (duty, clearing, freight, transport, misc) in PKR (with optional FX). Landed cost per kg is computed automatically.
2. **Sorting** — open a lot, weigh outputs by category (stage 1) and optionally by grade (stage 2), record waste/rags. Stages per tenant: 1 or 2. Cost flows to outputs by weight.
3. **Finished bales** — make bales from sorted stock (one or mixed grades), each with a QR sticker (code, grade, category, weight, origin). Printable on A4 label sheet or thermal printer.
4. **Direct stock** — receive ready-made bales/pieces from a supplier and sell them without any sorting (for small merchants and traders).
5. **Sell** — sale to a customer (name + phone only required), cash or credit (udhaar), per kg / per bale / per piece. Bill shareable to WhatsApp as a link/PDF/image.
6. **Khata (customer ledger)** — balance per customer, payments (cash, bank, Raast, JazzCash, Easypaisa) with optional screenshot, WhatsApp reminder message in one tap.
7. **Owner home** — profit per container, profit by supplier/origin (yield), udhaar owed (total + top 5), stock ready to sell (kg / bales), today's sales.
8. **Easiness** — Urdu + English toggle, installable PWA, works offline and syncs, big-button screens, demo tenant with realistic Karachi data.

## 6. Out of v1 (built later, behind settings)
FBR e-invoicing (via PRAL / licensed integrator) · export packs and EU bale-level records · multi-warehouse transfers · piece-rate payroll (v1.1) · heavy report builder · buyer portal login · super-admin billing.

## 7. Success criteria for v1 (demo-ready)
- A munshi can record a container arrival in < 60 seconds, a sorting output line in < 10 seconds, a cash sale in < 30 seconds.
- Owner home loads in < 2 seconds on a low-end Android phone on 3G.
- Cost allocation: sum of allocated costs equals container landed cost exactly (to the paisa) at every stage; covered by automated tests.
- Works offline for weigh-in, sorting entry, sale and payment; syncs without duplicates (idempotency keys).
- Full demo (container → sort → bale → sale on credit → payment → profit shown) in under 5 minutes.

## 8. Pricing hypothesis (to validate while pitching)
Free (single device, khata + direct stock) · Workshop ~PKR 5,000–8,000/month · Importer ~PKR 15,000–25,000/month · Export tier by quote. Annual prepay discount; pay via JazzCash/Easypaisa/bank.
