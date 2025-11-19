// packages/core/src/dom.ts
// BlinkJS - DOM utilities with auto-reactive signals

import { Signal } from './hooks/useSignal';
import { getCurrentComponentUnsafe } from './component';

export type VChild = VNode | string | number | null | undefined;
export type VNode = {
  tag: string | typeof FragmentSymbol | ComponentFn;
  props: Record<string, any> | null;
  children: VChild[];
};

export type ComponentFn = (
  props: Record<string, any>,
  ...children: VChild[]
) => VChild | VChild[];

export const FragmentSymbol = Symbol('BLINK_FRAGMENT');

// ---- helper to detect BlinkJS signals ----
function isSignal(obj: any): obj is Signal<any> {
  return obj && typeof obj === 'object' && 'value' in obj && typeof obj.subscribe === 'function';
}

/**
 * el() — user-facing helper to create VNodes
 */
export function el(
  tag: string | typeof FragmentSymbol | ComponentFn,
  props?: Record<string, any> | null,
  ...children: any[]
): VNode {
  if (props == null) props = null;

  const flatChildren: VChild[] = children.flat(Infinity).filter(c => c !== null && c !== undefined);

  return {
    tag,
    props,
    children: flatChildren
  };
}

/** Type guard to detect VNode */
export function isVNode(x: any): x is VNode {
  return x != null && typeof x === 'object' && 'tag' in x && 'children' in x;
}

/**
 * createDom(vnode)
 * Convert a VNode (or primitive) into a real DOM Node.
 * IMPORTANT: Function-component VNodes MUST be handled by the runtime.
 */
export function createDom(vnode: VChild): Node {
  if (vnode === null || vnode === undefined) return textNode('');
  if (typeof vnode === 'string' || typeof vnode === 'number') return textNode(vnode);

  if (isSignal(vnode)) {
    return createSignalNode(vnode);
  }

  const v = vnode as VNode;

  // Guard: runtime is responsible for function components.
  if (typeof v.tag === 'function') {
    throw new Error(
      '[BlinkJS] createDom received a function-component VNode. This should be rendered by the runtime.'
    );
  }

  if (v.tag === FragmentSymbol) {
    const frag = document.createDocumentFragment();
    for (const child of v.children) {
      frag.appendChild(createDom(child));
    }
    return frag;
  }

  const elNode = document.createElement(String(v.tag));

  if (v.props) {
    for (const [k, val] of Object.entries(v.props)) {
      if (isSignal(val)) {
        setProp(elNode, k, val.value);
        const disposer = val.subscribe?.(() => setProp(elNode, k, val.value));
        if (typeof disposer === 'function') {
          const inst = getCurrentComponentUnsafe();
          inst?.cleanup.push(disposer);
        }
      } else {
        setProp(elNode, k, val);
      }
    }
  }

  for (const child of v.children) {
    appendChild(elNode, child);
  }

  return elNode;
}

function createSignalNode(signal: Signal<any>): Node {
  let currentNode = createDom(signal.value);

  const update = () => {
    const newNode = createDom(signal.value);
    if (currentNode.parentNode) {
      currentNode.parentNode.replaceChild(newNode, currentNode);
    }
    currentNode = newNode;
  };

  const disposer = signal.subscribe?.(update);
  if (typeof disposer === 'function') {
    const inst = getCurrentComponentUnsafe();
    inst?.cleanup.push(disposer);
  }

  return currentNode;
}

function appendChild(parent: Node, child: any): void {
  if (Array.isArray(child)) {
    for (const nested of child) {
      appendChild(parent, nested);
    }
  } else if (isSignal(child)) {
    const placeholder = textNode('');
    parent.appendChild(placeholder);

    let currentNode: Node = placeholder;

    const update = () => {
      const newNode = createDom(child.value);
      if (currentNode.parentNode) {
        currentNode.parentNode.replaceChild(newNode, currentNode);
        currentNode = newNode;
      }
    };

    update();

    const disposer = child.subscribe?.(update);
    if (typeof disposer === 'function') {
      const inst = getCurrentComponentUnsafe();
      inst?.cleanup.push(disposer);
    }
  } else if (typeof child === 'function') {
    appendChild(parent, child());
  } else if (isVNode(child)) {
    parent.appendChild(createDom(child));
  } else if (child != null) {
    parent.appendChild(textNode(child));
  }
}

/**
 * setProp(el, name, value)
 * Handles:
 * - Events: onClick -> addEventListener('click', handler)
 * - class / className
 * - style: object { color: 'red' } or string
 * - boolean attributes: disabled, checked, etc.
 * - normal attributes
 */
export function setProp(el: Element, name: string, value: any) {
  if (name === 'className') name = 'class';

  if (/^on[A-Z]/.test(name) && typeof value === 'function') {
    const eventName = name.slice(2).toLowerCase();
    el.addEventListener(eventName, value);
    return;
  }

  if (name === 'style') {
    if (!value) {
      (el as HTMLElement).removeAttribute('style');
      return;
    }
    if (typeof value === 'string') {
      (el as HTMLElement).style.cssText = value;
      return;
    }

    const styleObj = value as Record<string, string | number>;
    for (const [sname, sval] of Object.entries(styleObj)) {
      (el as HTMLElement).style[sname as any] = String(sval);
    }
    return;
  }

  const booleanAttrs = new Set(['disabled', 'checked', 'readonly', 'multiple', 'selected', 'hidden']);
  if (booleanAttrs.has(name)) {
    if (value) {
      el.setAttribute(name, '');
      (el as any)[name] = true;
    } else {
      el.removeAttribute(name);
      (el as any)[name] = false;
    }
    return;
  }

  if (value === null || value === undefined) {
    el.removeAttribute(name);
    return;
  }

  el.setAttribute(name, String(value));
}

export function textNode(str: string | number) {
  return document.createTextNode(String(str));
}
