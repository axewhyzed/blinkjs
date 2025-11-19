// BlinkJS - hooks/disposal.ts
// Small helpers to register disposers on component unmount.

import { getCurrentComponent } from '../internal/component';

/**
 * Register a disposer to run when the current component unmounts.
 * Returns the same disposer for convenience.
 */
export function disposeOnUnmount(disposer: () => void) {
  const inst = getCurrentComponent();
  inst.cleanup.push(() => {
    try {
      disposer();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[BlinkJS] disposeOnUnmount error:', e);
    }
  });
  return disposer;
}

/**
 * Convenience: wrap an unsubscribe function so it auto-disposes on unmount.
 * Usage:
 *   const unsubscribe = signal.subscribe(fn);
 *   autoDispose(unsubscribe);
 */
export function autoDispose(unsubscribe: (() => void) | void) {
  if (typeof unsubscribe === 'function') {
    disposeOnUnmount(unsubscribe);
  }
}
