// packages/core/src/hooks/lifecycle.ts
// BlinkJS - lifecycle hooks: onStart, onEnd, onChange
//
// Necessary fixes:
// - Ensure onStart/onEnd register only once per component instance (idempotent).
// - Make onChange call the previous cleanup before running the new effect,
//   and ensure the latest cleanup runs on unmount.

import { getCurrentComponent } from '../internal/component';

/**
 * onStart(fn)
 * Called once, after the component is mounted for the first time.
 * fn may optionally return a cleanup function.
 */
export function onStart(fn: () => void | (() => void)) {
  const inst = getCurrentComponent();

  // Use per-hook slot to avoid registering multiple times across re-renders.
  const idx = inst.hookIndex++;
  const slot = (inst.hooks[idx] ||= { __type: 'onStart', registered: false }) as {
    __type: 'onStart';
    registered: boolean;
  };
  if (slot.registered) return;
  slot.registered = true;

  // Run only after the first mount commit.
  const effectWrapper = () => {
    if (!inst.mounted) return;
    const cleanup = fn();
    if (typeof cleanup === 'function') {
      inst.cleanup.push(cleanup);
    }
  };

  inst.effects.push(effectWrapper);
}

/**
 * onEnd(fn)
 * Called when the component is unmounted.
 * fn is automatically registered as a cleanup function.
 */
export function onEnd(fn: () => void) {
  const inst = getCurrentComponent();

  // Ensure we push this cleanup only once for the component's lifetime.
  const idx = inst.hookIndex++;
  const slot = (inst.hooks[idx] ||= { __type: 'onEnd', registered: false }) as {
    __type: 'onEnd';
    registered: boolean;
  };
  if (slot.registered) return;
  slot.registered = true;

  inst.cleanup.push(fn);
}

/**
 * onChange(fn)
 * Called after every re-render of this component (after mount too).
 * Runs the previous cleanup (if any) before running the new effect.
 * The latest cleanup is also invoked on unmount.
 */
export function onChange(fn: () => void | (() => void)) {
  const inst = getCurrentComponent();

  // Per-hook state to track the last cleanup and ensure it runs on unmount.
  const idx = inst.hookIndex++;
  const slot = (inst.hooks[idx] ||= {
    __type: 'onChange',
    lastCleanup: null as null | (() => void),
    unmountRegistered: false,
  }) as {
    __type: 'onChange';
    lastCleanup: null | (() => void);
    unmountRegistered: boolean;
  };

  // Ensure the latest cleanup runs on unmount (register once).
  if (!slot.unmountRegistered) {
    slot.unmountRegistered = true;
    inst.cleanup.push(() => {
      if (typeof slot.lastCleanup === 'function') {
        try {
          slot.lastCleanup();
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('[BlinkJS] onChange unmount cleanup error:', e);
        }
      }
    });
  }

  // Defer to post-commit: call previous cleanup, then run fn and store new cleanup.
  inst.effects.push(() => {
    // Run previous cleanup before applying the new effect
    if (typeof slot.lastCleanup === 'function') {
      try {
        slot.lastCleanup();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[BlinkJS] onChange cleanup error:', e);
      }
      slot.lastCleanup = null;
    }

    const cleanup = fn();
    if (typeof cleanup === 'function') {
      slot.lastCleanup = cleanup;
    }
  });
}
