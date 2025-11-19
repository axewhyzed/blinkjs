# BlinkJS Feature Overview

**Version:** 1.0 (Production Ready)  
**Architecture:** Hybrid (VDOM Structure + Signal Reactivity)  
**Philosophy:** "Preact size, Solid speed, React API."

---

## 1. The Hybrid Engine (`packages/core/engine`)

BlinkJS uses a unique **Dual-Mode Rendering Engine** to maximize performance while keeping the API familiar.

| Feature | Description | Benefit |
|---------|------------|---------|
| **Fine-Grained Signals** | `useSignal` updates text nodes directly (`textContent`). | Bypasses VDOM diffing for atomic updates. 0(1) cost. |
| **Iterative Reconciliation** | Stack-based VDOM diffing algorithm. | Safe for massive lists (no Stack Overflow). |
| **Event Delegation** | Single global event listener on `document`. | O(1) memory overhead for event handlers. |
| **Auto-Disposal** | `useComputed` and effects auto-clean on unmount. | Prevents "Zombie" memory leaks in SPAs. |
| **Whitespace-Tolerant Hydration** | Smart hydration barrier for SSR. | Prevents "Flash of Unstyled Content" or crashes on whitespace. |

---

## 2. Feature Modules (`packages/core/modules`)

Optional features that can be tree-shaken if not used.

| Module | Feature | Key Capabilities |
|--------|---------|------------------|
| **Router** | `<Router>`, `<Outlet>` | Component-based, Layout-preserving, Nested Routes support. |
| **Context** | `createContext` | Prototype-chain based propagation (faster than React Context). |
| **SSR** | `renderToString` | Generates static HTML. Async-compatible (via hydration barrier). |
| **Portal** | `createPortal` | Teleport components to `document.body` (Modals/Tooltips). |
| **JSX** | `jsx-runtime` | Standard JSX support (compatible with Vite/Babel). |

---

## 3. Developer Experience (DX)

- **Async Components:** First-class support. Just `return new Promise(...)` or make your component `async`.
- **Error Boundaries:** Built-in protection against render crashes.
- **Strict TypeScript:** 100% typed API.
- **No Build Magic:** Works with standard transpilers; no custom Babel plugins required.