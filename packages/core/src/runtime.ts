// packages/core/src/runtime.ts
// BlinkJS - runtime.ts
// Async Support + Error Boundaries + SVG Context

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

  // Initial render always synchronous-first for root (async root not supported in mountApp simple logic)
  const vnode = invokeComponentSync(rootInst, App, {});
  rootInst.subtree = vnode;

  if ((rootEl as Element).hasChildNodes()) {
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

// Helper that handles both Sync and Promise returns
function invokeComponentSafe(inst: ComponentInstance, compFn: Function, props: any): VChild | Promise<VChild> {
  resetHooks(inst);
  setCurrentComponent(inst);
  inst.vnode = { tag: compFn as any, props, children: [] };
  
  try {
    const res = (compFn as any)(props || {});
    if (res instanceof Promise) return res; // Async Component
    if (Array.isArray(res)) return { tag: FragmentSymbol, props: null, children: res };
    return res;
  } catch (err) {
    console.error(`[BlinkJS] Error rendering ${inst.name}:`, err);
    return "Render Error"; // Simple Error Boundary
  } finally {
    setCurrentComponent(null);
  }
}

// Wrapper for initial mount where we expect sync (or handle async poorly)
function invokeComponentSync(inst: ComponentInstance, compFn: Function, props: any): VChild {
    const res = invokeComponentSafe(inst, compFn, props);
    if (res instanceof Promise) {
        // Root Async not supported in this simple mount. 
        // Use <Suspense> pattern in future or wrap App.
        console.warn('[BlinkJS] Root component cannot be async. Rendering placeholder.');
        return "Loading...";
    }
    return res as VChild;
}

export function renderVNode(vnode: VChild, parentContext: Record<symbol, unknown> = {}, isSvg = false): Node {
  if (vnode == null) return document.createTextNode('');
  if (typeof vnode === 'string' || typeof vnode === 'number') return document.createTextNode(String(vnode));

  if (!isVNode(vnode)) return createDomInternal(vnode, isSvg);

  // 1. Component
  if (typeof vnode.tag === 'function') {
    const compFn = vnode.tag as Function;
    const inst = createComponentInstance((compFn as any).name, parentContext);
    inst.vnode = vnode;

    const result = invokeComponentSafe(inst, compFn, vnode.props || {});
    
    // Handle Async Component
    if (result instanceof Promise) {
        const placeholder = document.createTextNode(''); // Invisible placeholder
        result.then(resolvedVNode => {
            if (!inst.mounted) return; // Abort if unmounted
            inst.subtree = resolvedVNode as VChild;
            const realDom = renderVNode(resolvedVNode as VChild, inst.context, isSvg);
            inst.dom = realDom;
            instanceDomMap.set(inst, realDom);
            
            if (placeholder.parentNode) {
                placeholder.parentNode.replaceChild(realDom, placeholder);
            }
            runEffects(inst);
        });
        inst.dom = placeholder;
        inst.mounted = true; // Mounted effectively, waiting for content
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

  // 2. Fragment
  if (vnode.tag === FragmentSymbol) {
    const frag = document.createDocumentFragment();
    for (const c of vnode.children) frag.appendChild(renderVNode(c, parentContext, isSvg));
    return frag;
  }

  // 3. Element
  // Check SVG context
  if (String(vnode.tag).toLowerCase() === 'svg') isSvg = true;
  
  const el = isSvg 
      ? document.createElementNS('http://www.w3.org/2000/svg', String(vnode.tag))
      : document.createElement(String(vnode.tag));

  if (vnode.props) applyProps(el, vnode.props);
  for (const c of vnode.children) el.appendChild(renderVNode(c, parentContext, isSvg));
  return el;
}

// ... (hydrateVNode implementation remains similar but assumes sync for hydration simplicity) ...
// For brevity, hydrateVNode is kept Sync. Async hydration is complex (requires suspense streaming).
// We will use the improved one from previous step but add isSvg flag if needed.

function getNextSibling(node: Node | null): Node | null {
  let current = node;
  while (current && current.nodeType === 3 && !current.textContent?.trim()) {
    current = current.nextSibling;
  }
  return current;
}

function hydrateVNode(node: Node, vnode: VChild, parentContext: Record<symbol, unknown>): Node {
   // ... (Logic from previous step, robust against whitespace) ...
   // Async components during hydration will mismatch. 
   // Limitation: Async components must not be used in SSR initial payload for this lite framework.
   
   // Re-implementing basic robust hydration from before:
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

  if (typeof vnode.tag === 'function') {
    const compFn = vnode.tag as Function;
    const inst = createComponentInstance((compFn as any).name, parentContext);
    inst.vnode = vnode;
    
    // Sync only for hydration
    const childVNode = invokeComponentSync(inst, compFn, vnode.props || {});
    inst.subtree = childVNode;
    
    const hydratedDom = hydrateVNode(node, childVNode, inst.context);
    inst.dom = hydratedDom;
    inst.mounted = true;
    instanceDomMap.set(inst, hydratedDom);
    runEffects(inst);
    return hydratedDom;
  }

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
  
  // Handle Async Rerender
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