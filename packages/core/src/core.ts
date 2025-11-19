// Minimal core API (includes strict mode)
export { el, FragmentSymbol } from './dom';
export { mountApp, unmountApp } from './runtime';
export { useSignal } from './hooks/useSignal';
export { onStart, onEnd, onChange } from './hooks/lifecycle';
export { enableStrictMode } from './strict';
