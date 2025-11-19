// src/index.ts - BlinkJS entry point

// Core DOM & component helpers
export { el, FragmentSymbol } from './internal/dom';
export { mountApp, unmountApp } from './internal/runtime';

// Hooks
export { useSignal, useComputed } from './hooks/useSignal';
export { onStart, onEnd, onChange } from './hooks/lifecycle';

// Context
export { createContext, useContext } from '../modules/context';

// Disposal helpers
export { disposeOnUnmount, autoDispose } from './hooks/disposal'

// Router
export { defineRoutes, navigateTo, link, Router } from '../modules/router';

// Optional / additional features
export { enableStrictMode } from '../modules/strict';
export { createPortal } from '../modules/portal';

// Optional JSX runtime
export { h as jsx } from '../modules/jsx';