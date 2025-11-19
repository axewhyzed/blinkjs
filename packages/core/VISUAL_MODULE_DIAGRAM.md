+------------------+
|  Public Entrypoints            (exports map)             |
|----------------------------------------------------------|
| blinkjs (full)  | blinkjs/core (minimal + strict)       |
| blinkjs/router  | blinkjs/context | blinkjs/portal      |
| blinkjs/jsx     | blinkjs/ssr     | blinkjs/disposal    |
+------------------+

                   (core)
+------------------+
|     DOM (dom)    |   el, Fragment, createDom (non-components)
+--------+---------+
         |
         v
+------------------+           +----------------------+
|  ComponentSystem | <--- getCurrentComponent()      |
|  (component)     | <--- getCurrentComponentUnsafe()|
+--------+---------+           +----------------------+
         |                                  ^
         v                                  |
+------------------+          +-------------+-------------+
| Hooks (core)     |          |   Strict (core)          |
| useSignal,       |          | enableStrictMode         |
| lifecycle,       |          +--------------------------+
| disposal (opt)   |
+--------+---------+
         |
         v
+------------------+
|    Batcher       |
|  (batcher.ts)    |
+--------+---------+
         |
         v
+------------------+       +------------------+
|    Runtime       |  -->  |  Reconcile/Patch |
|  (runtime.ts)    |       | (reconcile.ts)   |
| renderVNode      |       | patch()          |
| rerender(patch)  |       +------------------+
+--------+---------+
         |
         +------------------------------+
                                        |
        (optional)                      |
+---------------+     +-----------------+-----------------+     +----------------+
|   Router      |     |    Context                       |     |   Portal       |
|  (router)     |     |  (context) Provider/useContext   |     |  (portal)      |
+---------------+     +-----------------+-----------------+     +----------------+
                                        |
                                        v
                               +------------------+
                               |   SSR (ssr)      |
                               | renderToString   |
                               +------------------+

Notes:
- **Core** = DOM + Component + Batcher + Runtime + Reconcile + useSignal + Lifecycle + Strict.
- DOM only renders non-component VNodes; **Runtime** executes components.
- Patcher handles text/props/children with **keyed lists** (sequential fallback).
- Optional modules are imported via subpath exports.
