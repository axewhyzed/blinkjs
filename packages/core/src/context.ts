// BlinkJS - context.ts
// Minimal Context API (Instance-based)

import { FragmentSymbol, el } from './dom';
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
    // Shadow the key in this component's context scope.
    // Children created by this component will inherit this new scope.
    inst.context[key] = props.value;

    // Render children directly (Fragment)
    const kids = Array.isArray(props.children) ? props.children : [props.children];
    return el(FragmentSymbol, null, ...(kids ?? []));
  }

  return { key, Provider, defaultValue };
}

export function useContext<T>(ctx: Context<T>): T {
  const inst = getCurrentComponent();
  // Lookup via prototype chain
  const val = inst.context[ctx.key];
  return val !== undefined ? (val as T) : (ctx.defaultValue as T);
}