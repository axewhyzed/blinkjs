BlinkJS Dependency Map
======================

The framework is split into two distinct layers: the **Engine** (Internal Logic) and **Modules** (Public Features).

Layer 1: The Core Engine (`/engine`)
-----------------------------------
*Self-contained. Does not import from Modules.*

- **entry (index.ts)**: Exports everything.
- **runtime.ts**: Orchestrates mounting, rendering, and hydration.
  - *Depends on*: `dom`, `reconcile`, `component`, `batcher`
- **reconcile.ts**: The Diffing Algorithm (Iterative).
  - *Depends on*: `dom`
- **dom.ts**: DOM creation, SVG support, Event Delegation.
- **component.ts**: Instance tracking and Context prototype chain.
- **hooks/**: `useSignal`, `lifecycle`, `disposal`.

Layer 2: Feature Modules (`/modules`)
------------------------------------
*Pluggable features. Depends on Engine.*

- **router.ts**: Component-based routing.
  - *Depends on*: `engine/hooks`, `engine/context`, `engine/dom`
- **context.ts**: React-like Context API.
  - *Depends on*: `engine/component`
- **ssr.ts**: Server-Side String Generator.
  - *Depends on*: `engine/dom` (Types only)
- **portal.ts**: DOM Teleportation.
  - *Depends on*: `engine/runtime`

Layer 3: Public API (Exports)
----------------------------
Users import via `blinkjs` or `blinkjs/router`.
- `.` -> `dist/engine/index.js`
- `./router` -> `dist/modules/router.js`
- ...etc