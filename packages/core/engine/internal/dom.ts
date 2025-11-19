// packages/core/src/dom.ts
// BlinkJS - DOM utilities with SVG & strict styles

import { Signal } from '../hooks/useSignal';
import { getCurrentComponentUnsafe } from './component';

export type VChild = VNode | string | number | null | undefined;
export type VNode = {
  tag: string | typeof FragmentSymbol | ComponentFn;
  props: Record<string, any> | null;
  children: VChild[];
};

export type ComponentFn = (props: Record<string, any>, ...children: VChild[]) => VChild | VChild[] | Promise<VChild | VChild[]>;

export const FragmentSymbol = Symbol('BLINK_FRAGMENT');

const delegatedEvents = new Set<string>();
const rootDocument = typeof document !== 'undefined' ? document : null;

function globalEventHandler(e: Event) {
  let target = e.target as Node | null;
  const eventType = e.type.toLowerCase();
  while (target && target !== rootDocument) {
    const handlers = (target as any).__blinkHandlers;
    if (handlers && handlers[eventType]) handlers[eventType](e);
    target = target.parentNode;
  }
}

function isSignal(obj: any): obj is Signal<any> {
  return obj && typeof obj === 'object' && 'value' in obj && typeof obj.subscribe === 'function';
}

export function el(tag: string | typeof FragmentSymbol | ComponentFn, props?: Record<string, any> | null, ...children: any[]): VNode {
  return {
    tag,
    props: props || null,
    children: children.flat(Infinity).filter(c => c != null)
  };
}

export function isVNode(x: any): x is VNode {
  return x != null && typeof x === 'object' && 'tag' in x && 'children' in x;
}

// Standard HTML creation
export function createDom(vnode: VChild): Node {
  return createDomInternal(vnode, false);
}

// Internal helper that supports SVG namespace flag
export function createDomInternal(vnode: VChild, isSvg: boolean): Node {
  if (vnode == null) return textNode('');
  if (typeof vnode === 'string' || typeof vnode === 'number') return textNode(vnode);
  if (isSignal(vnode)) return createSignalNode(vnode);

  const v = vnode as VNode;
  if (typeof v.tag === 'function') throw new Error('[BlinkJS] Function VNode passed to createDom');
  
  if (v.tag === FragmentSymbol) {
    const frag = document.createDocumentFragment();
    for (const child of v.children) frag.appendChild(createDomInternal(child, isSvg));
    return frag;
  }

  // Check if entering SVG mode
  const elementTag = String(v.tag).toLowerCase();
  if (elementTag === 'svg') isSvg = true;

  const elNode = isSvg 
    ? document.createElementNS('http://www.w3.org/2000/svg', elementTag)
    : document.createElement(elementTag);

  if (v.props) applyProps(elNode, v.props);
  for (const child of v.children) appendChild(elNode, child, isSvg);
  
  return elNode;
}

function createSignalNode(signal: Signal<any>): Node {
  const node = textNode(signal.value);
  bindSignalToNode(node, signal);
  return node;
}

export function bindSignalToNode(node: Node, signal: Signal<any>) {
  const update = () => {
    const newVal = String(signal.value);
    if (node.nodeType === 3 && node.textContent !== newVal) {
        node.textContent = newVal;
    }
  };
  const disposer = signal.subscribe?.(update);
  if (typeof disposer === 'function') {
    const inst = getCurrentComponentUnsafe();
    inst?.cleanup.push(disposer);
  }
}

function appendChild(parent: Node, child: any, isSvg: boolean): void {
  if (Array.isArray(child)) {
    child.forEach(c => appendChild(parent, c, isSvg));
  } else if (isSignal(child)) {
    parent.appendChild(createSignalNode(child));
  } else if (isVNode(child)) {
    parent.appendChild(createDomInternal(child, isSvg));
  } else if (child != null) {
    parent.appendChild(textNode(child));
  }
}

export function applyProps(el: Element, props: Record<string, any>) {
    for (const [k, val] of Object.entries(props)) {
        if (isSignal(val)) {
            setProp(el, k, val.value);
            const disposer = val.subscribe?.(() => setProp(el, k, val.value));
            if (typeof disposer === 'function') {
                const inst = getCurrentComponentUnsafe();
                inst?.cleanup.push(disposer);
            }
        } else {
            setProp(el, k, val);
        }
    }
}

export function setProp(el: Element, name: string, value: any) {
  if (name === 'className') name = 'class';
  if (/^on[A-Z]/.test(name)) {
    const eventName = name.slice(2).toLowerCase();
    const handlers = (el as any).__blinkHandlers || ((el as any).__blinkHandlers = {});
    if (value) {
      handlers[eventName] = value;
      if (!delegatedEvents.has(eventName) && rootDocument) {
        delegatedEvents.add(eventName);
        const useCapture = eventName === 'focus' || eventName === 'blur';
        rootDocument.addEventListener(eventName, globalEventHandler, useCapture);
      }
    } else {
      delete handlers[eventName];
    }
    return;
  }

  if (name === 'style') {
    if (typeof value === 'string') { (el as HTMLElement).style.cssText = value; return; }
    if (value && typeof value === 'object') {
      // Safe casting for CSSStyleDeclaration compatibility
      const style = (el as HTMLElement).style;
      for (const [sk, sv] of Object.entries(value as Partial<CSSStyleDeclaration>)) {
        if (sv != null) style[sk as any] = String(sv);
      }
    }
    return;
  }

  const booleanAttrs = new Set(['disabled', 'checked', 'readonly', 'hidden']);
  if (booleanAttrs.has(name)) {
    if (value) el.setAttribute(name, ''); else el.removeAttribute(name);
    return;
  }

  if (value == null) el.removeAttribute(name);
  else el.setAttribute(name, String(value));
}

export function textNode(str: string | number) {
  return document.createTextNode(String(str));
}