// Minimal core API (includes strict mode)
export { el, FragmentSymbol } from './internal/dom';
export { mountApp, unmountApp } from './internal/runtime';
export { useSignal } from './hooks/useSignal';
export { onStart, onEnd, onChange } from './hooks/lifecycle';
export { enableStrictMode } from '../modules/strict';
