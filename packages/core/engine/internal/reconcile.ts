// packages/core/engine/internal/reconcile.ts
// Fixed: Component-Aware Reconciliation with Context

import { VChild, VNode, isVNode, createDom, setProp, FragmentSymbol } from './dom';
import { renderVNode, updateComponentFromVNode } from './runtime';

function isTextLike(x: any): x is string | number {
  return typeof x === 'string' || typeof x === 'number';
}

function sameVNodeType(a: VChild, b: VChild): boolean {
  if (a === undefined || a === null || b === undefined || b === null) return false;
  if (isTextLike(a) || isTextLike(b)) return isTextLike(a) && isTextLike(b);
  if (!isVNode(a) || !isVNode(b)) return false;
  return a.tag === b.tag && a.tag !== FragmentSymbol;
}

function getKey(v: VChild): any | null {
  return isVNode(v) && v.props && 'key' in v.props ? (v.props as any).key : null;
}

function flattenChildren(children: VChild[]): VChild[] {
  const out: VChild[] = [];
  const stack = [...children].reverse();

  while (stack.length > 0) {
    const c = stack.pop();
    if (isVNode(c) && c.tag === FragmentSymbol) {
      for (let i = c.children.length - 1; i >= 0; i--) {
        stack.push(c.children[i]);
      }
    } else if (Array.isArray(c)) {
      for (let i = c.length - 1; i >= 0; i--) {
        stack.push(c[i]);
      }
    } else {
      out.push(c);
    }
  }
  return out;
}

// FIX: Added 'context' argument
export function patch(parent: Node, oldVNode: VChild, newVNode: VChild, oldDom: Node, context: Record<symbol, unknown> = {}): Node {
  if (oldVNode == null) oldVNode = '';
  if (newVNode == null) newVNode = '';

  if (isTextLike(oldVNode) && isTextLike(newVNode)) {
    if (String(oldVNode) !== String(newVNode)) {
      (oldDom as Text).data = String(newVNode);
    }
    return oldDom;
  }

  if (!sameVNodeType(oldVNode, newVNode)) {
    // FIX: Use renderVNode for replacement (supports Components)
    const newDom = renderVNode(newVNode, context);
    if (oldDom.parentNode) {
      oldDom.parentNode.replaceChild(newDom, oldDom);
    }
    return newDom;
  }

  // Handle Components
  const oldV = oldVNode as VNode;
  const newV = newVNode as VNode;
  
  if (typeof newV.tag === 'function') {
      // Delegate component update to runtime
      return updateComponentFromVNode(oldDom, newV, context);
  }

  // Handle Elements
  const el = oldDom as Element;

  const oldProps = oldV.props || {};
  const newProps = newV.props || {};
  
  for (const [k, v] of Object.entries(newProps)) {
    if ((oldProps as any)[k] !== v) setProp(el, k, v);
  }
  for (const k of Object.keys(oldProps)) {
    if (!(k in newProps)) setProp(el, k, undefined);
  }

  const oldChildren = flattenChildren(oldV.children || []);
  const newChildren = flattenChildren(newV.children || []);

  const anyKey = oldChildren.some(c => getKey(c) != null) || newChildren.some(c => getKey(c) != null);

  // Pass context down to children
  if (anyKey) {
    patchChildrenKeyed(el, oldChildren, newChildren, context);
  } else {
    patchChildrenSequential(el, oldChildren, newChildren, context);
  }

  return el;
}

function patchChildrenSequential(el: Element, oldC: VChild[], newC: VChild[], context: Record<symbol, unknown>) {
  const childNodes = Array.from(el.childNodes);
  const minLen = Math.min(oldC.length, newC.length);

  for (let i = 0; i < minLen; i++) {
    const childDom = childNodes[i];
    // Pass context
    const patched = patch(el, oldC[i], newC[i], childDom, context);
  }

  for (let i = minLen; i < newC.length; i++) {
    // Pass context
    el.appendChild(renderVNode(newC[i], context));
  }

  for (let i = childNodes.length - 1; i >= newC.length; i--) {
    const n = childNodes[i];
    el.removeChild(n);
  }
}

function patchChildrenKeyed(el: Element, oldC: VChild[], newC: VChild[], context: Record<symbol, unknown>) {
  const oldNodes = Array.from(el.childNodes);
  type Entry = { vnode: VChild; dom: Node; used: boolean };
  const oldKeyMap = new Map<any, Entry>();

  for (let i = 0, domIdx = 0; i < oldC.length && domIdx < oldNodes.length; i++, domIdx++) {
    const k = getKey(oldC[i]);
    if (k != null) {
      oldKeyMap.set(k, { vnode: oldC[i], dom: oldNodes[domIdx], used: false });
    }
  }

  let cursor = 0;
  for (let i = 0; i < newC.length; i++) {
    const newChild = newC[i];
    const key = getKey(newChild);
    const refNode = el.childNodes[cursor] || null;

    if (key != null) {
      const entry = oldKeyMap.get(key);
      if (entry) {
        const patchedDom = patch(el, entry.vnode, newChild, entry.dom, context);
        entry.used = true;
        if (patchedDom !== refNode) el.insertBefore(patchedDom, refNode);
        cursor++;
        continue;
      } else {
        const newDom = renderVNode(newChild, context);
        el.insertBefore(newDom, refNode);
        cursor++;
        continue;
      }
    }

    const currentDom = el.childNodes[cursor] || null;
    if (currentDom) {
      const oldVNode = oldC[cursor];
      if (oldVNode !== undefined) {
        const patched = patch(el, oldVNode, newChild, currentDom, context);
        if (patched !== currentDom) {
            el.insertBefore(patched, currentDom);
            if (currentDom.parentNode === el) el.removeChild(currentDom);
        }
      } else {
        el.insertBefore(renderVNode(newChild, context), currentDom);
      }
    } else {
      el.appendChild(renderVNode(newChild, context));
    }
    cursor++;
  }

  for (const [, entry] of oldKeyMap) {
    if (!entry.used && entry.dom.parentNode === el) {
      el.removeChild(entry.dom);
    }
  }
  
  while (el.childNodes.length > cursor) {
    el.removeChild(el.lastChild!);
  }
}