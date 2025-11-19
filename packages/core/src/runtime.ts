// packages/core/src/runtime.ts
// BlinkJS - runtime.ts
// Hydration + Context Propagation + Type Safety

import { VNode, VChild, createDom, FragmentSymbol, isVNode, applyProps, bindSignalToNode } from './dom';
import { ComponentInstance, createComponentInstance, setCurrentComponent, resetHooks } from './component';
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
  const rootEl = typeof rootSelector === 'string' ? document.querySelector(rootSelector) : rootSelector;
  if (!rootEl) throw new Error('[BlinkJS] Root not found');

  if (roots.has(rootEl as Element)) unmountApp(rootEl as Element);

  const rootInst = createComponentInstance((App as any).name || 'AppRoot');
  roots.set(rootEl as Element, { rootEl: rootEl as Element, appComponent: App, rootInstance: rootInst });

  const vnode = invokeComponent(rootInst, App, {});
  rootInst.subtree = vnode;

  // Hydration Check
  if ((rootEl as Element).hasChildNodes()) {
    const dom = hydrateVNode((rootEl as Element).firstChild!, vnode, rootInst.context);
    rootInst.dom = dom;
  } else {
    const dom = renderVNode(vnode, rootInst.context);
    rootInst.dom = dom;
    rootEl!.appendChild(dom);
  }

  rootInst.mounted = true;
  instanceDomMap.set(rootInst, rootInst.dom!);
  runEffects(rootInst);
}

export function unmountApp(rootSelector: string | Element) {
  const rootEl = typeof rootSelector === 'string' ? document.querySelector(rootSelector) : rootSelector;
  if (!rootEl) return;
  const info = roots.get(rootEl as Element);
  if (info?.rootInstance) unmountInstance(info.rootInstance);
  roots.delete(rootEl as Element);
  (rootEl as Element).innerHTML = '';
}

function invokeComponent(inst: ComponentInstance, compFn: Function, props: any): VChild {
  resetHooks(inst);
  setCurrentComponent(inst);
  inst.vnode = { tag: compFn as any, props, children: [] };
  
  try {
    const res = (compFn as any)(props || {});
    if (Array.isArray(res)) return { tag: FragmentSymbol, props: null, children: res };
    return res;
  } finally {
    setCurrentComponent(null);
  }
}

export function renderVNode(vnode: VChild, parentContext: Record<symbol, unknown> = {}): Node {
  if (vnode == null) return document.createTextNode('');
  if (typeof vnode === 'string' || typeof vnode === 'number') return document.createTextNode(String(vnode));

  // If it's not a VNode, it might be a Signal or unknown (fallback to createDom)
  if (!isVNode(vnode)) {
    return createDom(vnode);
  }

  // 1. Component
  if (typeof vnode.tag === 'function') {
    const compFn = vnode.tag as Function;
    const inst = createComponentInstance((compFn as any).name, parentContext);
    inst.vnode = vnode;

    const childVNode = invokeComponent(inst, compFn, vnode.props || {});
    inst.subtree = childVNode;
    
    const childDom = renderVNode(childVNode, inst.context);
    
    inst.dom = childDom;
    inst.mounted = true;
    instanceDomMap.set(inst, childDom);
    runEffects(inst);
    return childDom;
  }

  // 2. Fragment
  if (vnode.tag === FragmentSymbol) {
    const frag = document.createDocumentFragment();
    for (const c of vnode.children) frag.appendChild(renderVNode(c, parentContext));
    return frag;
  }

  // 3. Element
  const el = document.createElement(String(vnode.tag));
  if (vnode.props) applyProps(el, vnode.props);
  for (const c of vnode.children) el.appendChild(renderVNode(c, parentContext));
  return el;
}

function hydrateVNode(node: Node, vnode: VChild, parentContext: Record<symbol, unknown>): Node {
  // Handle Primitives (String/Number/Signal-like)
  if (!isVNode(vnode)) {
    const isSignal = vnode && typeof vnode === 'object' && 'value' in (vnode as any);
    const val = isSignal ? (vnode as any).value : vnode;
    const strVal = String(val ?? '');

    // If the DOM node is text, update/bind it
    if (node.nodeType === 3) {
       if (isSignal && 'subscribe' in (vnode as any)) {
          bindSignalToNode(node, vnode as any);
       }
       if (node.textContent !== strVal) node.textContent = strVal;
       return node;
    }
    // Mismatch: replace
    const newNode = renderVNode(vnode, parentContext);
    node.parentNode?.replaceChild(newNode, node);
    return newNode;
  }

  // 1. Component
  if (typeof vnode.tag === 'function') {
    const compFn = vnode.tag as Function;
    const inst = createComponentInstance((compFn as any).name, parentContext);
    inst.vnode = vnode;
    const childVNode = invokeComponent(inst, compFn, vnode.props || {});
    inst.subtree = childVNode;
    
    // Recurse hydration on the same node (components don't introduce a wrapper DOM node themselves)
    const hydratedDom = hydrateVNode(node, childVNode, inst.context);
    inst.dom = hydratedDom;
    inst.mounted = true;
    instanceDomMap.set(inst, hydratedDom);
    runEffects(inst);
    return hydratedDom;
  }

  // 2. Fragment
  if (vnode.tag === FragmentSymbol) {
     let sibling: Node | null = node;
     for (const child of vnode.children) {
         if (sibling) {
             // Fix: Explicit type annotation prevents cyclic inference error (TS 7022)
             const next: Node | null = sibling.nextSibling;
             hydrateVNode(sibling, child, parentContext);
             sibling = next;
         }
     }
     return node; 
  }

  // 3. Element
  if (node.nodeType === 1 && (node as Element).tagName.toLowerCase() === String(vnode.tag).toLowerCase()) {
      if (vnode.props) applyProps(node as Element, vnode.props);
      
      let domChild: Node | null = node.firstChild;
      for (const vChild of vnode.children) {
          if (domChild) {
              // Fix: Explicit type annotation here as well
              const next: Node | null = domChild.nextSibling;
              hydrateVNode(domChild, vChild, parentContext);
              domChild = next;
          } else {
              node.appendChild(renderVNode(vChild, parentContext));
          }
      }
      return node;
  }

  // Tag mismatch fallback
  const newNode = renderVNode(vnode, parentContext);
  node.parentNode?.replaceChild(newNode, node);
  return newNode;
}

export function rerenderComponent(inst: ComponentInstance) {
  if (!inst || !inst.mounted) return;
  const vnodeWrapper = inst.vnode;
  if (!vnodeWrapper || typeof vnodeWrapper.tag !== 'function') return;

  const compFn = vnodeWrapper.tag as Function;
  const newSubtree = invokeComponent(inst, compFn, vnodeWrapper.props || {});
  
  if (inst.dom && inst.dom.parentNode) {
    const newDom = patch(inst.dom.parentNode, inst.subtree, newSubtree, inst.dom);
    inst.dom = newDom;
    inst.subtree = newSubtree;
    instanceDomMap.set(inst, newDom);
  }
  runEffects(inst);
}

export function getInstanceForDom(node: Node): ComponentInstance | null {
  return null;
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