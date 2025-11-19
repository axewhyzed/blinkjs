// BlinkJS - context.ts
// Minimal Context API: createContext + useContext
//
// Design goals:
// - Tiny and predictable (no diff graph)
// - Context value is resolved via a per-context stack
// - Provider is a simple function component that pushes a value for its children
// - Works with JSX: <Ctx.Provider value={...}>{children}</Ctx.Provider>

import { FragmentSymbol, el } from './dom';

type Stack<T> = T[];

const stacks = new Map<symbol, Stack<any>>();

export type Context<T> = {
  key: symbol;
  /** Provider component: <Ctx.Provider value={...}>{children}</Ctx.Provider> */
  Provider: (props: { value: T; children?: any }) => any;
  /** default value when no Provider is present */
  _default: T | undefined;
};

export function createContext<T>(defaultValue?: T): Context<T> {
  const key = Symbol('BLINK_CTX');

  function Provider(props: { value: T; children?: any }) {
    let stack = stacks.get(key);
    if (!stack) {
      stack = [];
      stacks.set(key, stack);
    }
    // Push value for descendants
    stack.push(props.value);
    try {
      // Return children as-is (array or single). Use Fragment to avoid extra wrapper.
      const kids = Array.isArray(props.children) ? props.children : [props.children];
      return el(FragmentSymbol, null, ...(kids ?? []));
    } finally {
      // Pop after children render completes
      stack.pop();
    }
  }

  return { key, Provider, _default: defaultValue };
}

/**
 * Read the nearest context value; if none, return default.
 */
export function useContext<T>(ctx: Context<T>): T {
  const stack = stacks.get(ctx.key);
  if (stack && stack.length) {
    return stack[stack.length - 1] as T;
  }
  return ctx._default as T;
}
