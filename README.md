### 1\. Updated `README.md` (Code Block Format)

Here is the strictly formatted Markdown file. You can copy this directly.

````markdown
# BlinkJS

**The Micro-Framework that thinks it's a Big Framework.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue.svg)](https://www.typescriptlang.org/)
[![Size](https://img.shields.io/badge/size-~3kb-green.svg)]()

BlinkJS is a lightweight (3KB) JavaScript framework that combines the **Virtual DOM** structure of React with the **Fine-Grained Reactivity** of SolidJS. It is designed for high-performance widgets, embedded apps, and modern dashboards.

---

## 🚀 Key Features

- **⚡ Hybrid Rendering**: Updates text directly via Signals (0ms diffing) while using VDOM for structure.
- **🧠 Intelligent Hydration**: "Lazy" hydration barrier that waits for Async Components to resolve.
- **🛡️ Memory Safe**: Global Event Delegation and Auto-Disposal prevent memory leaks.
- **🧩 Component Router**: Fully featured `<Router>` with nested `<Outlet>` layouts.
- **📦 Zero Dependencies**: No external libraries. Just raw, optimized TypeScript.

---

## 📦 Installation

```bash
npm install blinkjs
````

-----

## ⚡ Quick Start

### 1\. The Basics (Signals & Components)

```tsx
import { mountApp, useSignal, useComputed } from 'blinkjs';

function Counter() {
  // No more useState/useEffect! Just Signals.
  const count = useSignal(0);
  const double = useComputed(() => count.value * 2);

  return (
    <div>
      <h1>Count: {count}</h1>
      <h2>Double: {double}</h2>
      <button onClick={() => count.value++}>Increment</button>
    </div>
  );
}

mountApp('#app', Counter);
```

### 2\. Routing with Layouts

BlinkJS uses a Component-based router, so your layout persists while pages change.

```tsx
import { Router, Outlet, link } from 'blinkjs/router';

// Define your components (Home, About) elsewhere
import { Home } from './Home';
import { About } from './About';

const routes = [
  { path: '/', component: Home },
  { path: '/about', component: About }
];

function App() {
  return (
    <Router routes={routes}>
      <nav>
        <a href="/" onClick={link}>Home</a>
        <a href="/about" onClick={link}>About</a>
      </nav>
      
      {/* Only this part re-renders! */}
      <main>
        <Outlet />
      </main>
    </Router>
  );
}
```

### 3\. Async Components

Just make your component `async`. BlinkJS handles the rest.

```tsx
async function UserProfile({ id }) {
  // The UI will show a placeholder until this resolves
  const user = await fetch(`/api/users/${id}`).then(r => r.json());
  
  return (
    <div class="profile">
      <img src={user.avatar} />
      <h3>{user.name}</h3>
    </div>
  );
}
```

-----

## 📚 API Reference

| Export | Source | Description |
|--------|--------|-------------|
| `useSignal(val)` | Core | Create a reactive value. Updates text nodes directly. |
| `useComputed(fn)` | Core | Derived state. Auto-cleans up dependencies on unmount. |
| `onStart/onEnd` | Core | Lifecycle hooks (Mount / Unmount). |
| `createContext` | Module | Create a context provider (Prototype-chain based). |
| `Router` | Module | Router Provider component. |
| `renderToString` | Module | SSR String generator. |

-----

## 🤝 Comparison

| Feature | BlinkJS | React | SolidJS | Preact |
| :--- | :--- | :--- | :--- | :--- |
| **Reactivity** | Signals | Hooks | Signals | Signals |
| **DOM Strategy** | VDOM + Direct Bind | VDOM | No VDOM | VDOM |
| **Routing** | Component | Component | Component | Component |
| **Event System** | Global Delegation | Synthetic | Native | Native |
| **Size (gzip)** | **\~3kb** | \~40kb | \~7kb | \~4kb |

-----

## 📄 License

MIT © BlinkJS Team

````

### 2. Regarding the `README.md` Location

You asked: *"if i keep it in core, how will it be immediately shown when someone visits the repo?"*

**Answer:** It won't be shown immediately if it stays inside `packages/core/`. GitHub only displays the `README.md` located at the **root** of the repository by default.

**Suggestion:**
Since your repository seems to be a monorepo structure (`packages/core`), you have two standard options:

1.  **Move it to the Root:**
    Move the `README.md` file from `packages/core/` to the very top folder (`blinkjs/`). This is the standard approach for single-purpose repos.
    * *Path:* `blinkjs/README.md`

2.  **Create a Root README (The "Pointer" Strategy):**
    Keep the technical documentation inside `packages/core/README.md` (so it appears on NPM), but create a new, simpler `README.md` at the repository root that briefly explains the project and links to the core package.

    *Example Root `README.md`:*
    ```markdown
    # BlinkJS Repository

    This monorepo contains the source code for **BlinkJS**, the hybrid micro-framework.

    ## Packages
    - [**@blinkjs/core**](./packages/core): The main runtime engine and hooks.

    ---
    *See the [Core Documentation](./packages/core/README.md) for installation and usage.*
    ```

**My Recommendation:**
Since your project *is* BlinkJS (and `packages/core` is the only thing that matters right now), **Option 1 is better**. Just put the main `README.md` (the one I generated above) in the root directory (`blinkjs/README.md`). It ensures visitors see your framework's features immediately.
````