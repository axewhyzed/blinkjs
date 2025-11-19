// packages/core/src/hooks/useSignal.ts
// BlinkJS - Reactive signals & Computed values

import { getCurrentComponent } from '../component';
import { scheduleUpdate } from '../batcher';

// ---- Dependency Tracking System ----
let activeSubscriber: (() => void) | null = null;

export interface Signal<T> {
  value: T;
  subscribe?: (fn: () => void) => () => void;
  peek?: () => T; // Read without subscribing
}

/**
 * useSignal<T>(initialValue)
 * Returns a reactive signal.
 */
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
      // Dependency Tracking: If a computed/effect is running, register it.
      if (activeSubscriber) {
        subscribers.add(activeSubscriber);
      }
      return _val;
    },
    set value(newVal: T) {
      if (_val !== newVal) {
        _val = newVal;
        
        // 1. Schedule Component Update
        scheduleUpdate(inst);
        
        // 2. Notify Subscribers (Direct DOM bindings & Computed values)
        // Snapshot to avoid infinite loops if a subscriber triggers another update
        const runParams = Array.from(subscribers);
        runParams.forEach(fn => {
          try {
            fn();
          } catch (e) {
            console.error('[BlinkJS] signal subscriber error:', e);
          }
        });
      }
    },
    subscribe(fn: () => void) {
      subscribers.add(fn);
      return () => {
        subscribers.delete(fn);
      };
    },
    peek() {
      return _val;
    }
  };

  inst.signals[idx] = signal;
  return signal;
}

/**
 * useComputed<T>(fn)
 * Returns a read-only signal that automatically updates when dependencies change.
 */
export function useComputed<T>(computeFn: () => T): Signal<T> {
  // We use a signal to hold the computed result
  const s = useSignal<T>(undefined as any);
  
  // Use a flag to run initial computation only once per hook slot
  const inst = getCurrentComponent();
  // Hook index was incremented by useSignal above, so we check the "extra" state
  // actually, useSignal takes a slot. We need to run the effect.
  // To avoid complex hook index math, we'll just run the computation if value is undefined 
  // (assuming undefined isn't a valid computed result, or we track 'initialized' separately).
  // Better: use the lifecycle to run the computation.
  
  // BUT: Computed needs to run *now* so it's available for render.
  
  const runComputation = () => {
    const prev = activeSubscriber;
    activeSubscriber = runComputation; // Register this function as the dependency
    try {
      const newVal = computeFn();
      if (s.peek && s.peek() !== newVal) {
        s.value = newVal;
      }
    } finally {
      activeSubscriber = prev;
    }
  };

  // Run once immediately if we haven't initialized (or we can rely on lazy eval, 
  // but push-based is easier for this architecture).
  // We need a way to know if this is the *first* render of this computed.
  // We can check if 'subscribers' in the underlying signal has us? No.
  // Let's just run it if it's the first time creation (value is undefined sentinel).
  
  // Note: In strict React/BlinkJS, hooks run every render. 
  // We only want to set up the tracking once? 
  // No, we need to re-track if dependencies change? 
  // Actually, with this 'activeSubscriber' model, if A changes, it calls runComputation.
  // runComputation re-executes fn(), which re-reads A (re-subscribing).
  
  // We need to trigger the first run.
  // We can check a hidden property on the signal object or just rely on a closure variable 
  // stored in a Ref-like structure?
  // BlinkJS useSignal persists the object. We can attach a property to it.
  
  const sigObj = s as any;
  if (!sigObj._computedInit) {
    sigObj._computedInit = true;
    runComputation();
  }
  
  return s;
}