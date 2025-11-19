# BlinkJS Feature Overview

**Version:** 1.0 (Core Modules Only)  
**Author:** BlinkJS Team  
**Purpose:** Minimal, reactive, and modular frontend framework for building fast, predictable UIs with JSX support.

---

## 1. Vision & Philosophy

BlinkJS is designed to be:  

- **Tiny & Fast:** Minimal runtime, small footprint, fast rendering.  
- **Reactive:** Automatic state-driven UI updates with signals.  
- **Predictable:** Component lifecycle and context behavior is explicit and easy to reason about.  
- **Modular & Extensible:** Core features can be extended with routers, portals, JSX, and context.

---

## 2. Core Features

| Feature | Module | Description | Benefit to Developer | Notes / Limitations |
|---------|--------|------------|-------------------|-------------------|
| **Reactive Signals** | `hooks/useSignal.ts` | Provides per-component reactive state. Components re-render automatically when signals update. | Eliminates manual DOM updates, reduces boilerplate. Enables fine-grained reactivity. | Must be used inside components. |
| **Component Lifecycle Hooks** | `hooks/lifecycle.ts` | Hooks: `onStart`, `onEnd`, `onChange`. `onStart` after mount, `onEnd` on unmount, `onChange` after each render. | Fine control over component lifecycle. Handles cleanup automatically. | Effects run asynchronously after commit. |
| **DOM Helpers** | `dom.ts` | `el()`, `createDom()`, `setProp()`, `FragmentSymbol`. Enables creation of VNodes and actual DOM nodes. | Simplifies DOM node creation, supports signals, fragments, and event binding. | Function components must be rendered via runtime. |
| **Component Runtime** | `runtime.ts` | Mount/unmount apps, render VNodes, manage component instances and effects. | Handles initial render, updates, and minimal DOM patching. | Heavy logic delegated to `batcher` for updates. |
| **Batching & Scheduling** | `batcher.ts` | Collects dirty components and rerenders them in next animation frame. | Prevents redundant renders; ensures efficient updates. | Uses requestAnimationFrame. |
| **JSX Runtime Support** | `jsx.ts` | `h()` pragma converts JSX to BlinkJS VNodes without invoking function components. | Supports JSX-friendly development workflow. | JSX transpiler configuration required. |
| **Context API** | `context.ts` | `createContext()`, `useContext()`. Provides context values across component tree without props drilling. | Simplifies shared state and dependency injection. | Stack-based; no diffing, uses global map. |
| **Router** | `router.ts` | SPA router with param parsing, query parsing, fallback routes, and `link()` helper. | Enables SPA navigation with minimal boilerplate. | Minimal features compared to React Router; no nested routes yet. |
| **Portals** | `portal.ts` | `createPortal()` allows rendering components outside main root DOM. | Useful for modals, tooltips, notifications. | Only handles DOM placement; no lifecycle isolation beyond mount/unmount. |
| **Automatic Disposal** | `hooks/disposal.ts` | `disposeOnUnmount()`, `autoDispose()`. Registers cleanup functions for signals/subscriptions. | Prevents memory leaks, ensures resource cleanup. | Must be called inside component hooks. |
| **Strict Mode (Optional)** | `strict.ts` | Enforces stricter runtime checks (not shown in core). | Catches common mistakes early in dev environment. | Runtime overhead; optional. |

---

## 3. Module Map Reference

- **Core Modules:** `dom.ts`, `runtime.ts`, `component.ts`, `batcher.ts`, `hooks/*`  
- **Optional / Add-ons:** `router.ts`, `portal.ts`, `jsx.ts`, `context.ts`, `strict.ts`  
- Module dependencies are hierarchical: `runtime.ts` → `dom.ts` + `component.ts`, `batcher.ts` for updates.  
- Optional features can be imported individually, allowing **tree-shaking and minimal builds**.

---

## 4. Developer Benefits / Target Audience

**Target Audience:**  

- Frontend developers seeking **small, fast, reactive frameworks**.  
- Developers who want **JSX-friendly, component-based UI** without heavy frameworks like React/Angular.  
- Teams building **SPAs, dashboards, or embedded UI components** with strict performance requirements.  

**Benefits:**  

- Minimal API surface → easier learning curve.  
- Modular architecture → pick and choose features.  
- Fine-grained reactivity → less unnecessary re-rendering.  
- Built-in SPA routing and portals for common UI patterns.

---

## 5. Limitations / Notes

- No SSR support yet.  
- Router is minimal; no nested routes, no route guards.  
- Context stack is global; careful with async operations.  
- Function-component VNodes **cannot** be rendered outside runtime.  
- JSX requires proper pragma configuration.  

---

## 6. Roadmap / Future Enhancements

- Nested routing and route guards.  
- Server-side rendering (SSR) support.  
- TypeScript-friendly type inference for JSX and signals.  
- More built-in lifecycle hooks for animation/transition support.  
- Advanced keyed diffing optimizations in `reconcile.ts`.

---

## 7. Suggested Usage Example

```ts
import { el, mountApp, useSignal, jsx as h } from 'blinkjs';

function Counter() {
  const count = useSignal(0);
  return (
    <div>
      <p>Count: {count.value}</p>
      <button onClick={() => count.value++}>Increment</button>
    </div>
  );
}

mountApp('#app', Counter);
