# ADR-001: Naming Strategy Tool — Architecture & Requirements

**Status:** Proposed
**Date:** 2026-03-10
**Author:** Agentic PM

---

## Context

The Naming Strategy Tool is the first tool to move from placeholder to active in the Category Leaders Tools platform. It is based on a prototype built for Hack The Box (HTB) that demonstrates a 3×4 naming matrix framework. The production tool must be **client-agnostic** — any consulting engagement can use it.

### Prototype Analysis

The HTB prototype (`htb-naming-matrix.html`) is a ~1550-line single-file app with three tabs:

1. **Current State** — A 3×4 naming matrix (Approach × Construct) with colour-coded chips representing the client's named concepts. Filter toggles let users show/hide categories. Stats bar shows counts.
2. **The Problems** — Five pre-written problem cards identifying naming issues: Distribution (grid lopsided), Identity (nothing sounds like the brand), Overloaded (same word used many times), Anomalies (naming collisions), Coherence (multiple naming strategies at once).
3. **Future Possibilities** — An interactive 3×4 grid where clicking a cell shows how every item would be renamed to fit that convention. Uses a `renameMap` object mapping every cell × every item to a suggested name.

**Matrix axes:**
- **Approach (rows):** Abstract, Suggestive, Descriptive
- **Construct (columns):** Industry Jargon, Real Word, Compound, Coined

**Hard-coded data:** All items, categories, problem cards, and rename suggestions are hard-coded to HTB. Categories are: companies, products, learning, training, features.

---

## Decision: Tool Architecture

### Data Model

**Client-agnostic data flow:**
- User creates/selects a client workspace (stored in localStorage)
- User configures concept categories via Settings (defaults: Company, Products, Features, Content, Services)
- User inputs named items via Naming Audit tab (paste lists → lozenges/tags)
- Items are placed on the matrix via Concept Mapping tab
- Problems tab analyses placement for issues

**localStorage schema:**
```
naming-tool-clients: [
  {
    id: "uuid",
    name: "Client Name",
    categories: ["Company", "Products", "Features", "Content", "Services"],
    items: {
      "Company": [
        { name: "Acme Corp", cell: "suggestive_real" | null }
      ],
      "Products": [...],
      ...
    },
    problems: [...],        // auto-generated + user-added
    createdAt: "ISO date",
    updatedAt: "ISO date"
  }
]
```

### Tab Structure (4 tabs)

#### Tab 1: Examples
**Purpose:** Teach the naming matrix framework using well-known examples.
- Display the 3×4 matrix with hard-coded examples from well-known brands (Apple, Google, PayPal, etc.)
- Colour-coded chips by approach row
- Filter toggles for each example set
- No client data — purely educational
- Adapted from prototype's "Current State" tab but using universal examples instead of HTB

#### Tab 2: Naming Audit
**Purpose:** Input the client's named concepts.
- One multi-line text area per concept category (configurable in Settings)
- Default categories: Company, Brands, Products, Services, Features, Content
- Paste a list (one per line, or comma-separated) → each entry becomes a lozenge/tag
- Lozenges are editable (click to rename) and deletable (× button)
- Visual count per category
- Data saved to localStorage per client

#### Tab 3: Concept Mapping
**Purpose:** Place the client's items onto the naming matrix.
- Display the 3×4 matrix grid
- Client items (from Tab 2) shown as draggable/assignable chips
- Click a matrix cell → see unmapped items, assign them to that cell
- OR: click an item → select which cell it belongs in
- Colour-coded by category
- Stats showing distribution across cells
- Adapted from prototype's "Future Possibilities" interaction model, but reversed — instead of showing renames, this shows where items currently sit

#### Tab 4: Problems Identified
**Purpose:** Surface naming issues based on the mapping.
- **Auto-detected problems** (computed from mapping data):
  - Distribution: are items clustered in too few cells?
  - Overloaded: same word appears in multiple item names?
  - Coherence: items spread across too many naming strategies?
- **User-added problems:** free-text cards the consultant can write
- Each problem card has: title, description, severity (High/Medium/Low), affected items
- Adapted from prototype's "The Problems" tab but dynamic, not hard-coded

### Settings Page
**Purpose:** Configure the tool per client.
- **Client selector:** dropdown to switch between clients, + button to add new
- **Concept categories:** list of current categories with:
  - Drag to reorder
  - Edit name inline
  - Delete (with confirmation if items exist)
  - Add new category
  - Defaults: Company, Products, Features, Content, Services
- **Danger zone:** Delete client workspace

### Navigation
- Tool loads in the main content area when "Naming Strategy" is clicked in the sidebar
- Sub-navigation: horizontal tab bar within the tool (Examples | Naming Audit | Concept Mapping | Problems)
- Settings accessible via a gear icon in the tool's top bar, or via the global Settings button

---

## File Structure

```
gtm-tools/
├── index.html              ← app shell, sidebar, routing
├── logo.png
├── tools/
│   └── naming-strategy/
│       ├── naming-strategy.html   ← tool shell + tab navigation
│       ├── naming-strategy.css    ← all tool styles
│       ├── naming-strategy.js     ← core logic, data model, routing
│       ├── tab-examples.js        ← Tab 1 logic + example data
│       ├── tab-audit.js           ← Tab 2 logic (lozenge input)
│       ├── tab-mapping.js         ← Tab 3 logic (matrix interaction)
│       ├── tab-problems.js        ← Tab 4 logic (analysis engine)
│       └── settings.js            ← Settings panel logic
├── shared/
│   ├── shared.css                 ← brand tokens, shared components
│   └── storage.js                 ← localStorage wrapper
└── docs/
    └── adr-001-naming-strategy-tool-architecture.md
```

---

## Backlog

### Core tickets (specified by Sophie — build these)

| ID | Title | Type | Description |
|---|---|---|---|
| CL.T-W-2603-0002 | App shell routing — load tools into main content area | W | Enable sidebar nav to load tool HTML into the main content panel. Create shared.css with brand tokens. Create storage.js wrapper. |
| CL.T-A-2603-0007 | Naming Strategy — Tab 1: Examples | A | 3×4 matrix with hard-coded well-known brand examples. Colour-coded chips, filter toggles, stats bar. Educational, no client data. |
| CL.T-A-2603-0008 | Naming Strategy — Tab 2: Naming Audit | A | Multi-line text inputs per category that convert to lozenges/tags. Add/edit/delete items. Persists to localStorage. |
| CL.T-A-2603-0009 | Naming Strategy — Tab 3: Concept Mapping | A | Interactive 3×4 matrix. Assign client items to cells. Colour-coded chips. Distribution stats. |
| CL.T-A-2603-0010 | Naming Strategy — Tab 4: Problems Identified | A | Auto-detect naming issues from mapping data. User-added problem cards. Severity levels. |
| CL.T-A-2603-0011 | Naming Strategy — Settings: Client & Category Management | A | Client selector/creator. Editable concept category list. Delete client. |

### Research ideas (awaiting Sophie's input)

| ID | Title | Type | Description |
|---|---|---|---|
| CL.T-A-2603-0012 | Naming Strategy — Export: PDF/PNG report generation | A | Export the current state, mapping, and problems as a branded PDF or screenshot for client presentations. |
| CL.T-A-2603-0013 | Naming Strategy — Future Possibilities: rename suggestions | A | Like the prototype's Tab 3 — click a target cell and see how all items would be renamed to fit that convention. AI-assisted name generation. |
| CL.T-A-2603-0014 | Naming Strategy — Scoring: quantitative naming health score | A | Compute a 0–100 naming health score based on distribution, coherence, overloading, and other metrics. |
| CL.T-A-2603-0015 | Naming Strategy — Competitor comparison: side-by-side matrices | A | Map a competitor's naming alongside the client's on the same matrix for contrast. |
| CL.T-C-2603-0001 | Naming Strategy — Example content: curated brand examples | C | Research and curate the best real-world examples for each of the 12 matrix cells (Abstract+Jargon, Abstract+Real, etc). |

---

## Risks & Open Questions

1. **localStorage limits:** Fine for MVP; if clients have 500+ items, may need IndexedDB later.
2. **No auth:** Anyone with the URL can access. Acceptable for MVP — Category Leaders controls who gets the link.
3. **Example data licensing:** Using well-known brand names as educational examples is standard practice in consulting tools. No logos or copyrighted material.
