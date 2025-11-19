// BlinkJS - context.ts
// Fixed: Use display:contents to prevent Fragment Unmount Crash

import { el } from './dom';
import { getCurrentComponent } from './component';

export type Context<T> = {
  key: symbol;
  Provider: (props: { value: T; children?: any }) => any;
  defaultValue: T | undefined;
};

export function createContext<T>(defaultValue?: T): Context<T> {
  const key = Symbol('BLINK_CTX');

  function Provider(props: { value: T; children?: any }) {
    const inst = getCurrentComponent();
    inst.context[key] = props.value;

    const kids = Array.isArray(props.children) ? props.children : [props.children];
    
    // FIX: Use a physical wrapper with display:contents.
    // This ensures inst.dom points to a real node that stays in the tree,
    // allowing unmount/patch to work correctly without breaking CSS layouts.
    return el('div', { style: { display: 'contents' } }, ...kids);
  }

  return { key, Provider, defaultValue };
}

export function useContext<T>(ctx: Context<T>): T {
  const inst = getCurrentComponent();
  const val = inst.context[ctx.key];
  return val !== undefined ? (val as T) : (ctx.defaultValue as T);
}