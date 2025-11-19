// packages/core/engine/internal/reconcile.ts

import { VChild, VNode, isVNode, createDom, setProp, Fragment } from './dom';
import { renderVNode, updateComponentFromVNode, unmountComponentAtNode } from './runtime';

function isTextLike(x: any): x is string | number { return typeof x === 'string' || typeof x === 'number'; }

function sameVNodeType(a: VChild, b: VChild): boolean {
  const isAEmpty = a == null || typeof a === 'boolean';
  const isBEmpty = b == null || typeof b === 'boolean';
  if (isAEmpty && isBEmpty) return true;
  if (isAEmpty || isBEmpty) return false;
  if (isTextLike(a) || isTextLike(b)) return isTextLike(a) && isTextLike(b);
  if (!isVNode(a) || !isVNode(b)) return false;
  return a.tag === b.tag && a.tag !== Fragment;
}

function getKey(v: VChild): any | null { return isVNode(v) && v.props && 'key' in v.props ? (v.props as any).key : null; }

function flattenChildren(children: VChild[]): VChild[] {
  const out: VChild[] = [];
  const stack = [...children].reverse();
  while (stack.length > 0) {
    const c = stack.pop();
    if (isVNode(c) && c.tag === Fragment) {
      for (let i = c.children.length - 1; i >= 0; i--) stack.push(c.children[i]);
    } else if (Array.isArray(c)) {
      for (let i = c.length - 1; i >= 0; i--) stack.push(c[i]);
    } else {
      out.push(c);
    }
  }
  return out;
}

export function patch(parent: Node, oldVNode: VChild, newVNode: VChild, oldDom: Node, context: Record<symbol, unknown> = {}): Node {
  if (oldVNode == null || typeof oldVNode === 'boolean') oldVNode = '';
  if (newVNode == null || typeof newVNode === 'boolean') newVNode = '';

  if (!oldDom) {
     const newDom = renderVNode(newVNode, context);
     parent.appendChild(newDom);
     return newDom;
  }

  if (isTextLike(oldVNode) && isTextLike(newVNode)) {
    if (String(oldVNode) !== String(newVNode)) (oldDom as Text).data = String(newVNode);
    return oldDom;
  }

  if (!sameVNodeType(oldVNode, newVNode)) {
    unmountComponentAtNode(oldDom);
    const newDom = renderVNode(newVNode, context);
    if (oldDom.parentNode) oldDom.parentNode.replaceChild(newDom, oldDom);
    return newDom;
  }

  const oldV = oldVNode as VNode;
  const newV = newVNode as VNode;
  
  if (typeof newV.tag === 'function') {
      return updateComponentFromVNode(oldDom, newV, context);
  }

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

  if (anyKey) patchChildrenKeyed(el, oldChildren, newChildren, context);
  else patchChildrenSequential(el, oldChildren, newChildren, context);

  return el;
}

function patchChildrenSequential(el: Element, oldC: VChild[], newC: VChild[], context: Record<symbol, unknown>) {
  const childNodes = Array.from(el.childNodes);
  const minLen = Math.min(oldC.length, newC.length);
  for (let i = 0; i < minLen; i++) {
    const childDom = childNodes[i];
    if (childDom) patch(el, oldC[i], newC[i], childDom, context);
    else el.appendChild(renderVNode(newC[i], context));
  }
  for (let i = minLen; i < newC.length; i++) el.appendChild(renderVNode(newC[i], context));
  for (let i = childNodes.length - 1; i >= newC.length; i--) {
    const n = childNodes[i];
    if (n) { unmountComponentAtNode(n); el.removeChild(n); }
  }
}

function patchChildrenKeyed(el: Element, oldC: VChild[], newC: VChild[], context: Record<symbol, unknown>) {
  const oldNodes = Array.from(el.childNodes);
  type Entry = { vnode: VChild; dom: Node; used: boolean };
  const oldKeyMap = new Map<any, Entry>();
  for (let i = 0, domIdx = 0; i < oldC.length && domIdx < oldNodes.length; i++, domIdx++) {
    const k = getKey(oldC[i]);
    if (k != null) oldKeyMap.set(k, { vnode: oldC[i], dom: oldNodes[domIdx], used: false });
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
            unmountComponentAtNode(currentDom);
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
      unmountComponentAtNode(entry.dom);
      el.removeChild(entry.dom);
    }
  }
  while (el.childNodes.length > cursor) {
    const n = el.lastChild;
    if (n) { unmountComponentAtNode(n); el.removeChild(n); }
  }
}