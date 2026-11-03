**Effective immediately**, ThriftOS backend domain is updated as follows:

> **Sorting Stage 1 & 2 MUST operate on a single Rag/Bale, NEVER directly on a Container.**

This change reflects **real-world thrift factory operations** and is now **LOCKED**.

---

## 🧠 FINAL PHYSICAL FLOW (AUTHORITATIVE)

```
Procurement
 ├── Container
 │    ├── Rag / Bale (physical unit)
 │    │     └── Sorting Stage 1 (Category)
 │    │           └── Category Outputs + Waste
 │    │
 │    ├── Rag / Bale
 │    │     └── Sorting Stage 1
 │    │
 │    └── ...
 │
 └── Loose Bale
       └── (treated as Rag/Bale)
             └── Sorting Stage 1
```

---

## 📦 DOMAIN ENTITIES (FINAL DEFINITIONS)

### Container

* Procurement-level entity
* Represents shipment / container
* Contains **many Rags/Bales**
* Never directly sorted

---

### Rag / Bale (NEW — CORE ENTITY)

> A **Rag/Bale** is the smallest physical sorting unit.

Attributes:

* ID (system-generated)
* Parent container (nullable for loose bale)
* Weight (kg)
* Status
* Notes

Statuses:

```
NOT_STARTED
IN_SORTING
SORTED
```

---

### Sorting Session Stage 1

* References **exactly ONE Rag/Bale**
* Cannot reference container
* Cannot reference multiple rags
* One-to-one lifecycle

---

## 🔁 UPDATED RELATIONSHIPS (LOCKED)

```
Container 1 ──── * Rag/Bale 1 ──── 1 SortingSessionStage1
```

Loose bale:

```
Rag/Bale (no container) ──── 1 SortingSessionStage1
```

---

## 🚫 FORBIDDEN (STRICT)

❌ SortingSession → Container
❌ SortingSession → multiple Rags
❌ Implicit Rag creation
❌ Skipping Rag/Bale layer

---

## 🧠 WHY THIS IS LOCKED

This ensures:

✅ Partial container processing
✅ Multi-day sorting
✅ Per-rag yield tracking
✅ Accurate waste analytics
✅ Factory-grade realism
✅ Trust from large operators

This is **not optional**.