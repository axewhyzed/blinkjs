// packages/core/src/runtime.ts
// BlinkJS - runtime.ts
// Mounting, rendering, update scheduling (delegated to batcher), and component lifecycle wiring.

import { VNode, VChild, createDom, FragmentSymbol, isVNode } from './dom';
import {
  ComponentInstance,
  createComponentInstance,
  setCurrentComponent,
  resetHooks,
} from './component';
import { patch } from './reconcile';

const instanceDomMap = new WeakMap<ComponentInstance, Node>();

type RootInfo = {
  rootEl: Element;
  appComponent?: Function;
  rootInstance?: ComponentInstance;
};
const roots = new Map<Element, RootInfo>();

export async function scheduleUpdate(inst: ComponentInstance) {
  const batcher = await import('./batcher');
  batcher.scheduleUpdate(inst);
}

export function mountApp(rootSelector: string | Element, App: Function) {
  const rootEl =
    typeof rootSelector === 'string'
      ? (document.querySelector(rootSelector) as Element | null)
      : (rootSelector as Element);

  if (!rootEl) {
    throw new Error(`[BlinkJS] mountApp: root element not found: ${String(rootSelector)}`);
  }

  if (roots.has(rootEl)) {
    const info = roots.get(rootEl)!;
    if (info.rootInstance) {
      unmountInstance(info.rootInstance);
    }
    roots.delete(rootEl);
    rootEl.innerHTML = '';
  }

  const info: RootInfo = { rootEl, appComponent: App as Function };
  roots.set(rootEl, info);

  const rootInst = createComponentInstance((App && (App as any).name) || 'AppRoot');
  info.rootInstance = rootInst;

  // Initial render
  const vnode = invokeComponent(rootInst, App as Function, {});
  rootInst.subtree = vnode;
  const dom = renderVNode(vnode);
  rootInst.dom = dom;
  rootInst.mounted = true;
  instanceDomMap.set(rootInst, dom);
  rootEl.appendChild(dom);

  runEffects(rootInst);
}

export function unmountApp(rootSelector: string | Element) {
  const rootEl =
    typeof rootSelector === 'string'
      ? (document.querySelector(rootSelector) as Element | null)
      : (rootSelector as Element);

  if (!rootEl) return;

  const info = roots.get(rootEl);
  if (!info) {
    rootEl.innerHTML = '';
    return;
  }

  if (info.rootInstance) {
    unmountInstance(info.rootInstance);
  }
  roots.delete(rootEl);
  rootEl.innerHTML = '';
}

function invokeComponent(inst: ComponentInstance, compFn: Function, props: any): VChild {
  resetHooks(inst);
  setCurrentComponent(inst);

  // inst.vnode is just a wrapper for context, not the full tree
  inst.vnode = { tag: compFn as any, props, children: [] };

  let result: any;
  try {
    result = (compFn as any)(props || {});
  } finally {
    setCurrentComponent(null);
  }

  if (result === null || result === undefined) {
    return null;
  }
  if (typeof result === 'string' || typeof result === 'number') {
    return result;
  }
  if (Array.isArray(result)) {
    return {
      tag: FragmentSymbol,
      props: null,
      children: result,
    } as VNode;
  }
  return result as VNode;
}

/**
 * Helper to check if a VNode is a component (function tag)
 */
function isComponentVNode(vnode: VChild): vnode is VNode {
  return isVNode(vnode) && typeof vnode.tag === 'function';
}

/**
 * Exported so dom.ts can delegate function-component VNodes here (initial mount path).
 */
export function renderVNode(vnode: VChild): Node {
  if (vnode === null || vnode === undefined) {
    return document.createTextNode('');
  }
  if (typeof vnode === 'string' || typeof vnode === 'number') {
    return document.createTextNode(String(vnode));
  }

  if (isComponentVNode(vnode)) {
    const compFn = vnode.tag as Function;
    const inst = createComponentInstance((compFn as any).name || 'Component');

    inst.vnode = vnode;

    const childVNode = invokeComponent(inst, compFn, vnode.props || {});
    inst.subtree = childVNode; // track subtree for future patches

    const childDom = renderVNode(childVNode);
    inst.dom = childDom;
    inst.mounted = true;
    instanceDomMap.set(inst, childDom);
    runEffects(inst);

    return childDom;
  }

  // If it's a standard VNode (HTML tag or Fragment)
  return createDom(vnode);
}

/**
 * Rerender using minimal patching.
 */
export function rerenderComponent(inst: ComponentInstance) {
  if (!inst || !inst.mounted) return;

  const vnodeWrapper = inst.vnode;
  // Safety check: ensure it is actually a component wrapper
  if (!vnodeWrapper || typeof vnodeWrapper.tag !== 'function') return;

  const compFn = vnodeWrapper.tag as Function;
  const oldSubtree = inst.subtree;

  const newSubtree = invokeComponent(inst, compFn, vnodeWrapper.props || {});
  const oldDom = inst.dom as Node;
  const parent = oldDom.parentNode as Node | null;

  if (parent) {
    // We can safely pass 'undefined' as VChild? No, let's ensure null fallback
    const validOld = oldSubtree === undefined ? null : oldSubtree;
    const newDom = patch(parent, validOld, newSubtree, oldDom);
    
    inst.dom = newDom;
    inst.subtree = newSubtree;
    instanceDomMap.set(inst, newDom);
  }

  runEffects(inst);
}

function unmountInstance(inst: ComponentInstance) {
  if (!inst) return;
  for (const fn of inst.cleanup) {
    try {
      fn();
    } catch (err) {
      console.error('[BlinkJS] cleanup error:', err);
    }
  }
  inst.mounted = false;

  const dom = instanceDomMap.get(inst);
  if (dom && dom.parentNode) {
    dom.parentNode.removeChild(dom);
  }
  instanceDomMap.delete(inst);
}

function runEffects(inst: ComponentInstance) {
  if (!inst) return;
  const list = inst.effects.splice(0, inst.effects.length);
  for (const effect of list) {
    try {
      const cleanup = effect();
      if (typeof cleanup === 'function') {
        inst.cleanup.push(cleanup);
      }
    } catch (err) {
      console.error('[BlinkJS] effect error:', err);
    }
  }
}

export function getInstanceForDom(node: Node): ComponentInstance | null {
  // WeakMap iteration isn't possible, but if we needed this feature 
  // we would need to store the instance on the DOM node directly.
  // For now, returning null as strictly per WeakMap limitations.
  return null;
}