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
