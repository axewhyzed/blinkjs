// BlinkJS - jsx.ts
// Optional JSX runtime
//
// Critical change:
// - Do NOT invoke function components here. Always return a VNode via `el()`
//   so the runtime can create a proper ComponentInstance and run hooks/effects.

import { el, FragmentSymbol } from '../engine/internal/dom';

type Props = Record<string, any>;

/**
 * JSX pragma function
 * Used by JSX transpilers: <div className="x">...</div>
 * Converts JSX to BlinkJS VNodes without executing components.
 */
export function h(
  type: string | Function | typeof FragmentSymbol,
  props: Props | null,
  ...children: any[]
) {
  // Normalize fragments
  if (type === FragmentSymbol) {
    return el(FragmentSymbol, null, ...children);
  }

  // Always create a VNode — even for function components — and let the runtime render it.
  // This guarantees hooks run with a valid ComponentInstance and effects are scheduled correctly.
  return el(type as any, props, ...children);
}
