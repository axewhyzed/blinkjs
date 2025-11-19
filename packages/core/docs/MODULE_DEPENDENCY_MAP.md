BlinkJS Core Module Dependency Map (Modularized)
================================================

Public Entry Points
-------------------
- **blinkjs** → `dist/index.js`
  - Full bundle (back-compat). Re-exports everything.

- **blinkjs/core** → `dist/core.js`
  - Minimal core **including strict mode**.
  - Exports: `el`, `FragmentSymbol`, `mountApp`, `unmountApp`, `useSignal`, `onStart`, `onEnd`, `onChange`, `enableStrictMode`.

- Optional subpath entries (opt-in):
  - **blinkjs/router** → `dist/router.entry.js` → `{ defineRoutes, navigateTo, link }`
  - **blinkjs/context** → `dist/context.entry.js` → `{ createContext, useContext }`
  - **blinkjs/portal** → `dist/portal.entry.js` → `{ createPortal }`
  - **blinkjs/jsx** → `dist/jsx.entry.js` → `{ jsx }`
  - **blinkjs/ssr** → `dist/ssr.entry.js` → `{ renderToString }`
  - **blinkjs/disposal** → `dist/disposal.entry.js` → `{ disposeOnUnmount, autoDispose }`

Internal Modules
----------------
1. **DOM (dom.ts)**
   - `el()`, `FragmentSymbol`, `createDom()`, `setProp()`, `textNode()`
   - Only renders **non-component** VNodes + primitives; signal-aware props/children.
   - Depends: native DOM.

2. **Runtime (runtime.ts)**
   - `mountApp`, `unmountApp`, `renderVNode`, `rerenderComponent`
   - Executes function components with `ComponentInstance`
   - Tracks `inst.dom` + `inst.subtree`
   - Delegates scheduling to **batcher.scheduleUpdate**
   - Depends: `component.ts`, `dom.ts`, `reconcile.ts`.

3. **Reconciliation (reconcile.ts)**
   - `patch(parent, oldVNode, newVNode, oldDom)`
   - Minimal patcher: text updates, same-tag prop diff, sequential children, **keyed lists** (fallback to sequential if fragments).
   - Depends: `dom.ts`.

4. **Component System (component.ts)**
   - `createComponentInstance`, `getCurrentComponent`, `getCurrentComponentUnsafe`, `setCurrentComponent`, `resetHooks`, `markDirty`
   - Stores: `hooks`, `hookIndex`, `signals`, `effects`, `cleanup`, `mounted/dirty`, `vnode`, `dom`, `subtree`
   - `markDirty` delegates to **batcher**.

5. **Batcher (batcher.ts)**
   - `scheduleUpdate(inst)` → rAF-batched → calls `runtime.rerenderComponent`
   - Single source of truth for scheduling.
   - Depends: `runtime.ts`.

6. **Hooks**
   - **useSignal (hooks/useSignal.ts)**: `{ value, subscribe() → unsubscribe }`, notifies DOM + schedules updates.
   - **lifecycle (hooks/lifecycle.ts)**: `onStart` (once), `onEnd` (unmount), `onChange` (post-commit with cleanup).
   - **disposal (hooks/disposal.ts)**: `disposeOnUnmount`, `autoDispose`.

7. **Context (context.ts)** *(optional)*
   - `createContext(default?)`, `useContext(ctx)`; Provider uses a per-context value stack with Fragment wrapper.

8. **Router (router.ts)** *(optional)*
   - `defineRoutes`, `navigateTo`, `link` with `:params`, query parsing, `*` fallback; passes `{ params, query }` to route component.

9. **Strict Mode (strict.ts)**
   - `enableStrictMode`, `checkHookUsage`, `checkComponentUpdate` (uses safe getter, no throws).
   - **Included in core**.

10. **Portal (portal.ts)** *(optional)*
    - `createPortal(component, target?)` with idempotent disposer.

11. **JSX Runtime (jsx.ts)** *(optional)
    - `jsx/h()` always returns VNodes; runtime executes components.

12. **SSR (ssr.ts)** *(optional)*
    - `renderToString(VChild|Component)`; executes comps without DOM, reads signals, supports style/boolean attrs; no hydration.
