# Storehouse — Design System Decisions

Companion spec to the mid-fi wireframe canvas (see `README.md`). These are
the system-level rules the five screens already follow implicitly — written
down here so hi-fi and new screens stay consistent instead of re-deriving
them per screen.

## 1. Grid and Layout Margins

- **Reference frame**: mobile portrait, 390px width (covers the
  iPhone 12–15 width class).
- **8pt spacing scale**: `4 (xs) · 8 (sm) · 12 (md) · 16 (lg) · 24 (xl) · 32 (xxl)`.
  - Page horizontal margin: `16px` (lg) on every screen.
  - Card internal padding: `16px` (lg).
  - Section-to-section vertical gap: `16–18px` (lg), rounding to `16px` going
    forward.
  - List item gap inside a card: `8px` (sm).
  - Icon-to-label gap: `6–8px` (xs/sm).
- **Header exception**: the icon row uses `24px` side padding (tighter
  grouping than the `16px` body) — deliberate, to read as a secondary strip
  under the primary back/title/alerts row, not a continuation of body content.
- Single column only at this width — no internal multi-column grid.

## 2. Focal Points and Content Density

One hero focal point per screen, always above the fold:

| Screen | Focal point |
|---|---|
| Home | Total Storehouse Value (T1) |
| Watchtower | Expense Categorisation chart |
| Planning | Harvest Yield Curve + Est. Yield |
| Allocation | Stream Splitter visual |
| Measurement | Jubilee Countdown |

Everything else is secondary, grouped into cards so no screen is a flat wall
of numbers. Density cap: ~5–6 modules (cards/sections) per screen before the
user has to scroll past the primary content.

## 3. Component Container Styles

Two container levels, used consistently:

- **Level 1 — Card**: white surface, `1px solid var(--border)`, `14px`
  radius, `16px` padding. The standard container for every module.
- **Level 2 — Inset module**: `var(--bg)` fill, `10px` radius, no border (or
  a `1px var(--border)` hairline), nested *inside* a card — used for
  sub-groupings (Planning's dial rows, Home's steward card, subcards).

Interactive containers (assessment rows, vault rows, Unallocated Funds) are
visually distinguished from static display cards by a `border-strong`
outline plus a trailing chevron — the chevron is the tap-through signal, not
color.

Radius hierarchy: cards `14px` < buttons `16–20px` < circular icon buttons
`50%`. Rounder = more interactive.

## 4. Type Scale and Hierarchy

| Style | Size / weight | Use |
|---|---|---|
| T1 | 34px / 700 | Hero numbers only — max one per screen |
| T2 | 17px / 700 | Section titles — one per major section |
| T3 | 11px / 700, uppercase, 0.07em tracking | Card/module labels |
| **T3n** *(new, formalized)* | 15px / 700 | Secondary numeric emphasis inside a card (Est. Yield, vault balances) — sits between T2 and T4 |
| T4 | 12px / 400, muted | Body copy, meta, list details |

T3n existed ad hoc as `.t3-val` in the wireframe markup; promoting it to a
named 5th style rather than leaving it a one-off class.

## 5. Responsive Scenarios

- **Primary target**: mobile portrait (375–430px). This is the only breakpoint
  the mid-fi screens are designed for.
- **Tablet/desktop (v1 decision)**: the shell is treated like a phone frame —
  centered in the viewport at its natural ~390–430px width, letterboxed by
  the background, rather than reflowing into a multi-column dashboard. Keeps
  scope contained; a true desktop layout (e.g. Financial Goals + Giving
  Targets side-by-side) is an explicit future decision, not an accident of
  stretching cards.
- **Horizontal scroll** (Growth Trackers row) is the one intentionally
  responsive pattern — content may bleed past the right edge as an
  affordance for "more," on every breakpoint.

## 6. Component Positioning

- Header and bottom nav are pinned (`flex: 0 0 auto`); only the body between
  them scrolls.
- **CTA-anchors-bottom rule**: a card's primary action button always sits at
  the bottom of that card (Deploy Capital, Prune Payments, Review & Prune,
  Log Kingdom Impact) — never top or mid-card.
- **Disclosure rule**: a trailing chevron is always right-aligned in any
  tappable row.
- **List row rule**: label/icon left-aligned, value right-aligned — applied
  uniformly across Recent Activity, Vaults, Wellspring legend, Prune lists.

## 7. Visual Language

- Base palette is neutral/grayscale (zinc scale) for all chrome, text,
  borders, and default UI — a brand color is not yet assigned.
- Two deliberate departures from gray, each reserved for one meaning only:
  - **Slate-blue family** (`#94A3B8 / #64748B / #3F3F46 / #CBD5E1`) — money
    *in motion*: Stream Splitter, Wellspring, the river icon on Stream
    Allocation rows. Nothing else may use these tones.
  - **Solid ink-black** (`var(--fill)`) — primary/active: primary buttons,
    the elevated Home nav button, filled progress/dial arcs.
- Icons: 2px stroke, round caps/joins, outline-only (no fills except
  progress arcs and the flow-family shapes). No emoji, no gradients, no
  shadows — except the Home nav button's shadow, which exists specifically
  to signal "this floats above the bar."

## 8. Visual Hierarchy

Consistent reading order, top to bottom, on every screen:

**Header (orientation) → hero/focal metric → primary visual → actions →
supporting lists/detail.**

Weight hierarchy follows the type scale directly (T1 > T2 > T3n > T3 > T4).
Only one filled/primary button is ever visible per section — every other
action in that section is outlined, so there's always exactly one obvious
"next step."

## 9. Data Limits and Wrapping

- **Unbounded lists** (Recent Activity sub-lists, Kingdom Impact, Prune
  Suggestions, Expense Audit) show a fixed preview count rather than growing
  the page: 2 items for Home's activity sub-lists, 3 for Expense
  Audit/Prune, 5 for Kingdom Impact. Kingdom Impact's internal scroll
  (`max-height` + `overflow-y`) is the standard pattern for any list expected
  to exceed ~5 items — cap and scroll internally, don't let the page grow.
- **Text**: single-line labels (vault names, list item names) truncate with
  ellipsis to keep row heights consistent; two-line descriptions (assessment
  subtitles, impact descriptions) may wrap to 2 lines, then truncate.
- **Currency**: hero and precise values show pence (`£6,000.00`); dense list
  rows may drop pence (`£1,800`) unless the row is itself a specific payment
  amount, which should always read as exact.

## 10. Data Visualisations

Four visual families, each reserved for one kind of data — never mixed or
reinvented per screen:

| Family | Shape | Used for |
|---|---|---|
| Dial gauge | Circular stroke-progress ring | Any 0–100% score or goal (Health Score, Financial Goal dials, the horizontal-track marker) |
| Target rings | Concentric "archery target," fills outside-in | Giving/generosity progress only (Tithe, Offerings, Kingdom Fund) |
| Flow | Branching river lines / concentric "well" | Money movement across destinations (Stream Splitter, Wellspring) — always in the slate-blue family |
| Bar / line | Flat monochrome placeholder | Time-series or categorical analytics (Expense Categorisation, Analytics Engine, Yield Curve) |

Rule: a new screen reaches for one of these four before inventing a new
chart type. Category-specific chart coloring is intentionally deferred to
hi-fi (bars/lines stay monochrome for now, since no brand palette exists
yet).
