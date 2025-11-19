// packages/core/src/hooks/useSignal.ts
// BlinkJS - Reactive signals & Computed values (Fixed Leak)

import { getCurrentComponent } from '../component';
import { scheduleUpdate } from '../batcher';
import { onEnd } from './lifecycle';

// ---- Dependency Tracking System ----
type TrackingContext = {
  subscriber: () => void;
  sources: Set<Signal<any>>;
};

let activeContext: TrackingContext | null = null;

export interface Signal<T> {
  value: T;
  subscribe?: (fn: () => void) => () => void;
  peek?: () => T;
  // Internal: used to remove subscribers
  _removeSubscriber?: (fn: () => void) => void;
}

export function useSignal<T>(initialValue: T): Signal<T> {
  const inst = getCurrentComponent();
  const idx = inst.hookIndex++;
  
  if (inst.signals[idx]) {
    return inst.signals[idx] as Signal<T>;
  }

  let _val = initialValue;
  const subscribers = new Set<() => void>();

  const signal: Signal<T> = {
    get value() {
      if (activeContext) {
        // 1. Register the subscriber (the computed function) to this signal
        subscribers.add(activeContext.subscriber);
        // 2. Register this signal to the context (so computed knows what to clean up)
        activeContext.sources.add(signal);
      }
      return _val;
    },
    set value(newVal: T) {
      if (_val !== newVal) {
        _val = newVal;
        scheduleUpdate(inst);
        Array.from(subscribers).forEach(fn => {
          try { fn(); } catch (e) { console.error(e); }
        });
      }
    },
    subscribe(fn: () => void) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
    peek() {
      return _val;
    },
    _removeSubscriber(fn: () => void) {
      subscribers.delete(fn);
    }
  };

  inst.signals[idx] = signal;
  return signal;
}

export function useComputed<T>(computeFn: () => T): Signal<T> {
  const s = useSignal<T>(undefined as any);
  // useSignal increments the hook index, so we access the SAME signal object via s.
  // We need to attach state to it to persist across renders.
  const sigObj = s as any;

  if (!sigObj._computedState) {
    sigObj._computedState = {
      sources: new Set<Signal<any>>(),
      runner: null as (() => void) | null
    };
    
    // Register Cleanup ONCE on mount to prevent leaks
    onEnd(() => {
      const state = sigObj._computedState;
      if (state && state.runner) {
        state.sources.forEach((src: Signal<any>) => src._removeSubscriber?.(state.runner!));
        state.sources.clear();
      }
    });
  }
  
  const state = sigObj._computedState;

  const runComputation = () => {
    // 1. Cleanup previous dependencies to avoid stale subscriptions
    if (state.runner) {
        state.sources.forEach((src: Signal<any>) => src._removeSubscriber?.(state.runner!));
        state.sources.clear();
    }
    
    // 2. Setup new context
    const prevContext = activeContext;
    state.runner = runComputation; // Ensure reference consistency
    activeContext = {
      subscriber: state.runner,
      sources: state.sources
    };

    try {
      const newVal = computeFn();
      if (s.peek && s.peek() !== newVal) {
        s.value = newVal;
      }
    } finally {
      activeContext = prevContext;
    }
  };

  // Initial run (idempotent check)
  if (!sigObj._initialized) {
    sigObj._initialized = true;
    runComputation();
  }

  return s;
}