// packages/core/src/reconcile.ts
// BlinkJS - reconcile.ts

import { VChild, VNode, isVNode, createDom, setProp, FragmentSymbol } from './dom';

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

/**
 * Fix B: Flatten fragments to allow keys to bubble up for diffing.
 */
function flattenChildren(children: VChild[]): VChild[] {
  const out: VChild[] = [];
  for (const c of children) {
    if (isVNode(c) && c.tag === FragmentSymbol) {
      out.push(...flattenChildren(c.children));
    } else if (Array.isArray(c)) {
        // Handle accidental nested arrays
        out.push(...flattenChildren(c));
    } else {
      out.push(c);
    }
  }
  return out;
}

export function patch(parent: Node, oldVNode: VChild, newVNode: VChild, oldDom: Node): Node {
  if (oldVNode == null) oldVNode = '';
  if (newVNode == null) newVNode = '';

  if (isTextLike(oldVNode) && isTextLike(newVNode)) {
    if (String(oldVNode) !== String(newVNode)) {
      (oldDom as Text).data = String(newVNode);
    }
    return oldDom;
  }

  if (!sameVNodeType(oldVNode, newVNode)) {
    const newDom = createDom(newVNode);
    if (oldDom.parentNode) {
      oldDom.parentNode.replaceChild(newDom, oldDom);
    }
    return newDom;
  }

  const oldV = oldVNode as VNode;
  const newV = newVNode as VNode;
  const el = oldDom as Element;

  const oldProps = oldV.props || {};
  const newProps = newV.props || {};
  
  for (const [k, v] of Object.entries(newProps)) {
    if ((oldProps as any)[k] !== v) setProp(el, k, v);
  }
  for (const k of Object.keys(oldProps)) {
    if (!(k in newProps)) setProp(el, k, undefined);
  }

  // Fix B: Flatten children before diffing
  const oldChildren = flattenChildren(oldV.children || []);
  const newChildren = flattenChildren(newV.children || []);

  const anyKey = oldChildren.some(c => getKey(c) != null) || newChildren.some(c => getKey(c) != null);

  if (anyKey) {
    patchChildrenKeyed(el, oldChildren, newChildren);
  } else {
    patchChildrenSequential(el, oldChildren, newChildren);
  }

  return el;
}

function patchChildrenSequential(el: Element, oldC: VChild[], newC: VChild[]) {
  const childNodes = Array.from(el.childNodes);
  const minLen = Math.min(oldC.length, newC.length);

  for (let i = 0; i < minLen; i++) {
    const childDom = childNodes[i];
    const patched = patch(el, oldC[i], newC[i], childDom);
    // If patch replaced the node, ensure we don't lose track
    if (patched !== childDom && el.childNodes[i] !== patched) {
        // Should already be handled by patch's replaceChild, 
        // but logic here safeguards strict sequential order.
    }
  }

  for (let i = minLen; i < newC.length; i++) {
    el.appendChild(createDom(newC[i]));
  }

  for (let i = childNodes.length - 1; i >= newC.length; i--) {
    const n = childNodes[i];
    el.removeChild(n);
  }
}

function patchChildrenKeyed(el: Element, oldC: VChild[], newC: VChild[]) {
  const oldNodes = Array.from(el.childNodes);
  type Entry = { vnode: VChild; dom: Node; used: boolean };
  const oldKeyMap = new Map<any, Entry>();

  // Index old nodes
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
        const patchedDom = patch(el, entry.vnode, newChild, entry.dom);
        entry.used = true;
        if (patchedDom !== refNode) el.insertBefore(patchedDom, refNode);
        cursor++;
        continue;
      } else {
        const newDom = createDom(newChild);
        el.insertBefore(newDom, refNode);
        cursor++;
        continue;
      }
    }

    // Unkeyed fallback
    const currentDom = el.childNodes[cursor] || null;
    if (currentDom) {
      const oldVNode = oldC[cursor];
      if (oldVNode !== undefined) {
        // Patch existing
        const patched = patch(el, oldVNode, newChild, currentDom);
        if (patched !== currentDom) {
            el.insertBefore(patched, currentDom);
            // If we inserted a new node, the old one (currentDom) is pushed. 
            // We should remove it if we replaced it logically.
            if (currentDom.parentNode === el) el.removeChild(currentDom);
        }
      } else {
        el.insertBefore(createDom(newChild), currentDom);
      }
    } else {
      el.appendChild(createDom(newChild));
    }
    cursor++;
  }

  // Cleanup unused keyed nodes
  for (const [, entry] of oldKeyMap) {
    if (!entry.used && entry.dom.parentNode === el) {
      el.removeChild(entry.dom);
    }
  }
  
  // Cleanup extra unkeyed nodes
  while (el.childNodes.length > cursor) {
    el.removeChild(el.lastChild!);
  }
}