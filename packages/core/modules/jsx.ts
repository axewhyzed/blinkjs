// packages/core/modules/jsx.ts
// Fixed: Use Fragment function

import { el, Fragment } from '../engine/internal/dom';

type Props = Record<string, any>;

export function h(
  type: string | Function | typeof Fragment,
  props: Props | null,
  ...children: any[]
) {
  if (type === Fragment) {
    return el(Fragment, null, ...children);
  }
  return el(type as any, props, ...children);
}

export const jsx = h;