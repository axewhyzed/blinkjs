// src/index.ts - BlinkJS entry point

// Core DOM & component helpers
export { el, FragmentSymbol } from './dom';
export { mountApp, unmountApp } from './runtime';

// Hooks
export { useSignal, useComputed } from './hooks/useSignal';
export { onStart, onEnd, onChange } from './hooks/lifecycle';

// Context
export { createContext, useContext } from './context';

// Disposal helpers
export { disposeOnUnmount, autoDispose } from './hooks/disposal'

// Router
export { defineRoutes, navigateTo, link, Router } from './router';

// Optional / additional features
export { enableStrictMode } from './strict';
export { createPortal } from './portal';

// Optional JSX runtime
export { h as jsx } from './jsx';