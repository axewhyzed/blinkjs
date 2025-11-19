// BlinkJS - reconcile.ts
// Minimal DOM patching with optional keyed children diffing.
// Strategy:
// - If types differ → replace node
// - Text ↔ Text → update data
// - Element same tag → diff props, then children
// - Children: if any key is present (and no fragments), use keyed diff; else sequential
// - Fragment in children: fallback to sequential (keeps logic small & robust)

import { VChild, VNode, isVNode, createDom, setProp, FragmentSymbol } from './dom';

function isTextLike(x: any): x is string | number {
  return typeof x === 'string' || typeof x === 'number';
}

function sameVNodeType(a: any, b: any): boolean {
  if (!a || !b) return false;
  if (isTextLike(a) || isTextLike(b)) return isTextLike(a) && isTextLike(b);
  if (!isVNode(a) || !isVNode(b)) return false;
  // Only handle native elements here; function components are already expanded by runtime.
  return a.tag === b.tag && a.tag !== FragmentSymbol;
}

function hasFragment(children: VChild[]): boolean {
  for (const c of children) {
    if (isVNode(c) && c.tag === FragmentSymbol) return true;
  }
  return false;
}

function getKey(v: VChild): any | null {
  return isVNode(v) && v.props && 'key' in v.props ? (v.props as any).key : null;
}

/**
 * Patch oldVNode → newVNode in place under parent, using oldDom as the current node.
 * Returns the DOM node representing newVNode.
 */
export function patch(parent: Node, oldVNode: VChild, newVNode: VChild, oldDom: Node): Node {
  // Handle null/undefined uniformly as empty text.
  if (oldVNode == null) oldVNode = '';
  if (newVNode == null) newVNode = '';

  // Text ↔ Text fast path
  if (isTextLike(oldVNode) && isTextLike(newVNode)) {
    if (String(oldVNode) !== String(newVNode)) {
      (oldDom as Text).data = String(newVNode);
    }
    return oldDom;
  }

  // If types mismatch or either is Fragment → replace
  if (!sameVNodeType(oldVNode, newVNode)) {
    const newDom = createDom(newVNode as any);
    if (oldDom.parentNode) {
      oldDom.parentNode.replaceChild(newDom, oldDom);
    }
    return newDom;
  }

  // Same element tag: diff props then children
  const oldV = oldVNode as VNode;
  const newV = newVNode as VNode;

  const el = oldDom as Element;

  // Props diff: set/update new, remove old not present
  const oldProps = oldV.props || {};
  const newProps = newV.props || {};
  // Set/update
  for (const [k, v] of Object.entries(newProps)) {
    const ov = (oldProps as any)[k];
    if (ov !== v) {
      setProp(el, k, v);
    }
  }
  // Remove
  for (const k of Object.keys(oldProps)) {
    if (!(k in newProps)) {
      setProp(el, k, undefined);
    }
  }

  // Children diff
  const oldChildren = oldV.children || [];
  const newChildren = newV.children || [];

  const anyKey =
    oldChildren.some(c => getKey(c) != null) || newChildren.some(c => getKey(c) != null);

  // Keyed diff only when no fragments (1:1 child ↔ DOM node mapping assumption)
  if (
    anyKey &&
    !hasFragment(oldChildren as VChild[]) &&
    !hasFragment(newChildren as VChild[])
  ) {
    patchChildrenKeyed(el, oldChildren as VChild[], newChildren as VChild[]);
  } else {
    patchChildrenSequential(el, oldChildren as VChild[], newChildren as VChild[]);
  }

  return el;
}

/**
 * Sequential child diff (no keys): patch min(len), append extras, remove leftovers.
 */
function patchChildrenSequential(el: Element, oldC: VChild[], newC: VChild[]) {
  const childNodes = Array.from(el.childNodes);
  const minLen = Math.min(oldC.length, newC.length);

  // Patch shared prefix
  for (let i = 0; i < minLen; i++) {
    const childDom = childNodes[i];
    const patched = patch(el, oldC[i] as any, newC[i] as any, childDom);
    if (patched !== childDom) {
      if (el.childNodes[i] !== patched) {
        el.replaceChild(patched, childDom);
      }
    }
  }

  // Append extras
  for (let i = minLen; i < newC.length; i++) {
    el.appendChild(createDom(newC[i] as any));
  }

  // Remove leftovers
  for (let i = childNodes.length - 1; i >= newC.length; i--) {
    const n = childNodes[i];
    el.removeChild(n);
  }
}

/**
 * Keyed child diff:
 * - Build map of old keyed children: key -> { vnode, dom, used }
 * - Iterate new children in order:
 *   - If key exists in map: patch + move into correct position
 *   - Else: create new node and insert at current cursor
 * - Remove any old keyed nodes not reused
 * - Unkeyed children get sequential treatment at their positions
 */
function patchChildrenKeyed(el: Element, oldC: VChild[], newC: VChild[]) {
  const oldNodes = Array.from(el.childNodes);

  type Entry = { vnode: VChild; dom: Node; used: boolean };
  const oldKeyMap = new Map<any, Entry>();

  // Build key map from old children (only those with keys)
  for (let i = 0, domIdx = 0; i < oldC.length && domIdx < oldNodes.length; i++, domIdx++) {
    const k = getKey(oldC[i]);
    if (k != null) {
      oldKeyMap.set(k, { vnode: oldC[i], dom: oldNodes[domIdx], used: false });
    }
  }

  // Cursor for insertion point
  let cursor = 0;

  for (let i = 0; i < newC.length; i++) {
    const newChild = newC[i];
    const key = getKey(newChild);

    const refNode = el.childNodes[cursor] || null;

    if (key != null) {
      const entry = oldKeyMap.get(key);
      if (entry) {
        // Patch in place
        const patchedDom = patch(el, entry.vnode as any, newChild as any, entry.dom);
        entry.used = true;

        // Move node to cursor position if needed
        if (patchedDom !== refNode) {
          el.insertBefore(patchedDom, refNode);
        }

        // Advance cursor
        cursor++;
        continue;
      } else {
        // New keyed node: create and insert
        const newDom = createDom(newChild as any);
        el.insertBefore(newDom, refNode);
        cursor++;
        continue;
      }
    }

    // Unkeyed child in a keyed list: try to reuse current DOM node sequentially
    const currentDom = el.childNodes[cursor] || null;
    if (currentDom) {
      const oldVNode = oldC[cursor] as VChild | undefined;
      if (oldVNode !== undefined) {
        const patchedDom = patch(el, oldVNode as any, newChild as any, currentDom);
        if (patchedDom !== currentDom) {
          el.insertBefore(patchedDom, currentDom);
          if (el.childNodes[cursor + 1]) {
            el.removeChild(currentDom);
          }
        }
      } else {
        const newDom = createDom(newChild as any);
        el.insertBefore(newDom, currentDom);
      }
    } else {
      // No DOM at cursor; just append
      el.appendChild(createDom(newChild as any));
    }
    cursor++;
  }

  // Remove any old keyed nodes not reused
  for (const [k, entry] of oldKeyMap.entries()) {
    if (!entry.used) {
      if (entry.dom.parentNode === el) {
        el.removeChild(entry.dom);
      }
    }
  }

  // If there are extra old unkeyed nodes beyond the new length, remove them
  while (el.childNodes.length > newC.length) {
    el.removeChild(el.lastChild as ChildNode);
  }
}
