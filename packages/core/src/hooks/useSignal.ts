// packages/core/src/hooks/useSignal.ts
// BlinkJS - reactive state (signals) with batching

import { getCurrentComponent } from '../component';
import { scheduleUpdate } from '../batcher';

export interface Signal<T> {
  value: T;
  /**
   * Subscribe to value changes.
   * Returns an unsubscribe function to prevent leaks.
   */
  subscribe?: (fn: () => void) => () => void;
}

/**
 * useSignal<T>(initialValue)
 * Returns a reactive signal whose updates trigger a component re-render.
 * Also allows DOM nodes to auto-update when used in el().
 */
export function useSignal<T>(initialValue: T): Signal<T> {
  const inst = getCurrentComponent();
  if (!inst) {
    throw new Error('[BlinkJS] useSignal() must be called inside a component.');
  }

  const idx = inst.hookIndex++;
  if (inst.signals[idx]) {
    return inst.signals[idx];
  }

  let _val = initialValue;
  const subscribers = new Set<() => void>();

  const signal: Signal<T> = {
    get value() {
      return _val;
    },
    set value(newVal: T) {
      if (_val !== newVal) {
        _val = newVal;
        // Schedule a batched update via batcher
        scheduleUpdate(inst);
        // Notify DOM/runtime subscribers (snapshot to avoid mutation during iteration)
        Array.from(subscribers).forEach(fn => {
          try {
            fn();
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error('[BlinkJS] signal subscriber error:', e);
          }
        });
      }
    },
    subscribe(fn: () => void) {
      subscribers.add(fn);
      // Return an unsubscribe to avoid memory leaks
      return () => {
        subscribers.delete(fn);
      };
    },
  };

  inst.signals[idx] = signal;
  return signal;
}
