// packages/core/src/runtime.ts
// BlinkJS - runtime.ts
// Async Hydration Barrier + Error Boundaries + SVG Context

import { VNode, VChild, createDomInternal, FragmentSymbol, isVNode, applyProps, bindSignalToNode } from './dom';
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

  const vnode = invokeComponentSync(rootInst, App, {});
  rootInst.subtree = vnode;

  // Hydration Check
  if ((rootEl as Element).hasChildNodes()) {
    // Hydration Barrier: Handle root hydration
    const dom = hydrateVNode((rootEl as Element).firstChild!, vnode, rootInst.context);
    rootInst.dom = dom;
  } else {
    const dom = renderVNode(vnode, rootInst.context, false);
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

function invokeComponentSafe(inst: ComponentInstance, compFn: Function, props: any): VChild | Promise<VChild> {
  resetHooks(inst);
  setCurrentComponent(inst);
  inst.vnode = { tag: compFn as any, props, children: [] };
  
  try {
    const res = (compFn as any)(props || {});
    if (res instanceof Promise) return res;
    if (Array.isArray(res)) return { tag: FragmentSymbol, props: null, children: res };
    return res;
  } catch (err) {
    console.error(`[BlinkJS] Error rendering ${inst.name}:`, err);
    return "Render Error";
  } finally {
    setCurrentComponent(null);
  }
}

function invokeComponentSync(inst: ComponentInstance, compFn: Function, props: any): VChild {
    const res = invokeComponentSafe(inst, compFn, props);
    if (res instanceof Promise) {
        console.warn('[BlinkJS] Async root not supported in mountApp. Rendering placeholder.');
        return "Loading...";
    }
    return res as VChild;
}

export function renderVNode(vnode: VChild, parentContext: Record<symbol, unknown> = {}, isSvg = false): Node {
  if (vnode == null) return document.createTextNode('');
  if (typeof vnode === 'string' || typeof vnode === 'number') return document.createTextNode(String(vnode));

  if (!isVNode(vnode)) return createDomInternal(vnode, isSvg);

  if (typeof vnode.tag === 'function') {
    const compFn = vnode.tag as Function;
    const inst = createComponentInstance((compFn as any).name, parentContext);
    inst.vnode = vnode;

    const result = invokeComponentSafe(inst, compFn, vnode.props || {});
    
    // Async Component Handler
    if (result instanceof Promise) {
        const placeholder = document.createTextNode('');
        result.then(resolvedVNode => {
            if (!inst.mounted) return;
            inst.subtree = resolvedVNode as VChild;
            const realDom = renderVNode(resolvedVNode as VChild, inst.context, isSvg);
            
            // Replace placeholder
            if (placeholder.parentNode) {
                placeholder.parentNode.replaceChild(realDom, placeholder);
            }
            inst.dom = realDom;
            instanceDomMap.set(inst, realDom);
            runEffects(inst);
        });
        inst.dom = placeholder;
        inst.mounted = true; 
        return placeholder;
    }

    inst.subtree = result as VChild;
    const childDom = renderVNode(inst.subtree, inst.context, isSvg);
    inst.dom = childDom;
    inst.mounted = true;
    instanceDomMap.set(inst, childDom);
    runEffects(inst);
    return childDom;
  }

  if (vnode.tag === FragmentSymbol) {
    const frag = document.createDocumentFragment();
    for (const c of vnode.children) frag.appendChild(renderVNode(c, parentContext, isSvg));
    return frag;
  }

  if (String(vnode.tag).toLowerCase() === 'svg') isSvg = true;
  
  const el = isSvg 
      ? document.createElementNS('http://www.w3.org/2000/svg', String(vnode.tag))
      : document.createElement(String(vnode.tag));

  if (vnode.props) applyProps(el, vnode.props);
  for (const c of vnode.children) el.appendChild(renderVNode(c, parentContext, isSvg));
  return el;
}

// Helper: Get next non-whitespace sibling for hydration
function getNextSibling(node: Node | null): Node | null {
  let current = node;
  while (current && current.nodeType === 3 && !current.textContent?.trim()) {
    current = current.nextSibling;
  }
  return current;
}

function hydrateVNode(node: Node, vnode: VChild, parentContext: Record<symbol, unknown>): Node {
  // 0. Handle Non-VNodes (Text, Signals)
  if (!isVNode(vnode)) {
    const isSignal = vnode && typeof vnode === 'object' && 'value' in (vnode as any);
    const val = isSignal ? (vnode as any).value : vnode;
    const strVal = String(val ?? '');

    if (node.nodeType === 3) {
       if (isSignal && 'subscribe' in (vnode as any)) bindSignalToNode(node, vnode as any);
       if (node.textContent !== strVal) node.textContent = strVal;
       return node;
    }
    const newNode = renderVNode(vnode, parentContext, false);
    node.parentNode?.replaceChild(newNode, node);
    return newNode;
  }

  // 1. Component
  if (typeof vnode.tag === 'function') {
    const compFn = vnode.tag as Function;
    const inst = createComponentInstance((compFn as any).name, parentContext);
    inst.vnode = vnode;
    
    // Hydration Barrier for Async Components
    const result = invokeComponentSafe(inst, compFn, vnode.props || {});
    
    if (result instanceof Promise) {
        // Async Hydration Barrier:
        // We cannot hydration into the future. We treat the existing server HTML 
        // as the "Placeholder" and take over when ready.
        
        result.then(resolvedVNode => {
            if (!inst.mounted) return;
            inst.subtree = resolvedVNode as VChild;
            
            // Render Client-Side (Takeover)
            const realDom = renderVNode(resolvedVNode as VChild, inst.context, false);
            
            if (node.parentNode) {
                node.parentNode.replaceChild(realDom, node);
            }
            inst.dom = realDom;
            instanceDomMap.set(inst, realDom);
            runEffects(inst);
        });
        
        // Temporarily claim this node
        inst.dom = node;
        inst.mounted = true;
        return node;
    }

    // Sync Hydration
    inst.subtree = result as VChild;
    const hydratedDom = hydrateVNode(node, inst.subtree, inst.context);
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
             const next: Node | null = getNextSibling(sibling.nextSibling);
             hydrateVNode(sibling, child, parentContext);
             sibling = next;
         }
     }
     return node; 
  }

  // 3. Element
  if (node.nodeType === 1 && (node as Element).tagName.toLowerCase() === String(vnode.tag).toLowerCase()) {
      if (vnode.props) applyProps(node as Element, vnode.props);
      
      let domChild: Node | null = getNextSibling(node.firstChild);
      for (const vChild of vnode.children) {
          if (domChild) {
              const next: Node | null = getNextSibling(domChild.nextSibling);
              hydrateVNode(domChild, vChild, parentContext);
              domChild = next;
          } else {
              node.appendChild(renderVNode(vChild, parentContext, false));
          }
      }
      return node;
  }

  // Mismatch Fallback
  const newNode = renderVNode(vnode, parentContext, false);
  node.parentNode?.replaceChild(newNode, node);
  return newNode;
}

export function rerenderComponent(inst: ComponentInstance) {
  if (!inst || !inst.mounted) return;
  const vnodeWrapper = inst.vnode;
  if (!vnodeWrapper || typeof vnodeWrapper.tag !== 'function') return;

  const compFn = vnodeWrapper.tag as Function;
  const res = invokeComponentSafe(inst, compFn, vnodeWrapper.props || {});

  if (res instanceof Promise) {
     res.then(newSubtree => {
         if (!inst.mounted) return;
         if (inst.dom && inst.dom.parentNode) {
            const newDom = patch(inst.dom.parentNode, inst.subtree, newSubtree as VChild, inst.dom);
            inst.dom = newDom;
            inst.subtree = newSubtree as VChild;
            instanceDomMap.set(inst, newDom);
         }
         runEffects(inst);
     });
     return;
  }

  const newSubtree = res as VChild;
  if (inst.dom && inst.dom.parentNode) {
    const newDom = patch(inst.dom.parentNode, inst.subtree, newSubtree, inst.dom);
    inst.dom = newDom;
    inst.subtree = newSubtree;
    instanceDomMap.set(inst, newDom);
  }
  runEffects(inst);
}

export function getInstanceForDom(node: Node): ComponentInstance | null { return null; }

function unmountInstance(inst: ComponentInstance) {
  if (!inst) return;
  for (const fn of inst.cleanup) { try { fn(); } catch (e) { console.error(e); } }
  inst.mounted = false;
  const dom = instanceDomMap.get(inst);
  if (dom && dom.parentNode) dom.parentNode.removeChild(dom);
  instanceDomMap.delete(inst);
}

function runEffects(inst: ComponentInstance) {
  if (!inst) return;
  const list = inst.effects.splice(0, inst.effects.length);
  for (const effect of list) {
    try {
      const cleanup = effect();
      if (typeof cleanup === 'function') inst.cleanup.push(cleanup);
    } catch (err) { console.error('[BlinkJS] effect error:', err); }
  }
}