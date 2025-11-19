// BlinkJS - strict.ts
// Dev-time runtime checks

import { getCurrentComponentUnsafe } from './internal/component';

let strictEnabled = false;

/**
 * enableStrictMode()
 * Turns on dev-time checks
 */
export function enableStrictMode() {
  strictEnabled = true;
}

/**
 * Checks if a hook is called inside a component.
 * Uses a safe getter to avoid throwing outside component render.
 */
export function checkHookUsage(hookName: string) {
  if (!strictEnabled) return;

  const inst = getCurrentComponentUnsafe();
  if (!inst) {
    console.error(`[BlinkJS Strict] ${hookName}() called outside a component!`);
  }
}

/**
 * Checks if a component instance is valid before update.
 */
export function checkComponentUpdate(inst: any) {
  if (!strictEnabled) return;

  if (!inst || !inst.mounted) {
    console.error('[BlinkJS Strict] Updating a non-mounted component or invalid instance!');
  }
}
