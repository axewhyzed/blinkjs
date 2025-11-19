// packages/core/engine/internal/runtime.ts
// Fixed: Guard unmountComponentAtNode against undefined

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

// FIX: Guard against undefined node
export function unmountComponentAtNode(node: Node | null | undefined) {
  if (!node) return;
  const inst = (node as any).__blinkInstance;
  if (inst) {
    unmountInstance(inst);
  }
}

export function updateComponentFromVNode(dom: Node, newVNode: VNode, context: Record<symbol, unknown>) {
  const inst = (dom as any).__blinkInstance as ComponentInstance;
  // Safety check: If instance is missing or tag mismatch, do full replace
  if (!inst || inst.vnode?.tag !== newVNode.tag) {
    const newDom = renderVNode(newVNode, context);
    if (dom.parentNode) dom.parentNode.replaceChild(newDom, dom);
    return newDom;
  }

  const compFn = newVNode.tag as Function;
  const props = getPropsWithChildren(newVNode.props, newVNode.children);
  
  inst.vnode = newVNode;
  
  const res = invokeComponentSafe(inst, compFn, props);
  
  if (res instanceof Promise) {
     res.then(newSubtree => {
         if (!inst.mounted) return;
         if (inst.dom && inst.dom.parentNode) {
            const newDom = patch(inst.dom.parentNode, inst.subtree, newSubtree as VChild, inst.dom, context);
            inst.dom = newDom;
            inst.subtree = newSubtree as VChild;
            instanceDomMap.set(inst, newDom);
            (newDom as any).__blinkInstance = inst;
         }
         runEffects(inst);
     });
     return dom;
  }

  const newSubtree = res as VChild;
  // Ensure we have a parent to patch against
  if (inst.dom && inst.dom.parentNode) {
      const newDom = patch(inst.dom.parentNode, inst.subtree, newSubtree, inst.dom, inst.context);
      inst.dom = newDom;
      inst.subtree = newSubtree;
      instanceDomMap.set(inst, newDom);
      (newDom as any).__blinkInstance = inst;
  }
  
  runEffects(inst);
  return inst.dom!;
}


function getPropsWithChildren(vnodeProps: any, children: VChild[]) {
  const props = vnodeProps || {};
  if (children && children.length > 0) {
    props.children = children.length === 1 ? children[0] : children;
  }
  return props;
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
  if (vnode == null || typeof vnode === 'boolean') return document.createTextNode('');
  if (typeof vnode === 'string' || typeof vnode === 'number') return document.createTextNode(String(vnode));

  if (!isVNode(vnode)) return createDomInternal(vnode, isSvg);

  if (typeof vnode.tag === 'function') {
    const compFn = vnode.tag as Function;
    const inst = createComponentInstance((compFn as any).name, parentContext);
    inst.vnode = vnode;

    const props = getPropsWithChildren(vnode.props, vnode.children);
    const result = invokeComponentSafe(inst, compFn, props);
    
    if (result instanceof Promise) {
        const placeholder = document.createTextNode('');
        result.then(resolvedVNode => {
            if (!inst.mounted) return;
            inst.subtree = resolvedVNode as VChild;
            const realDom = renderVNode(resolvedVNode as VChild, inst.context, isSvg);
            
            if (placeholder.parentNode) {
                placeholder.parentNode.replaceChild(realDom, placeholder);
            }
            inst.dom = realDom;
            instanceDomMap.set(inst, realDom);
            (realDom as any).__blinkInstance = inst;
            runEffects(inst);
        });
        inst.dom = placeholder;
        inst.mounted = true; 
        (placeholder as any).__blinkInstance = inst;
        return placeholder;
    }

    inst.subtree = result as VChild;
    const childDom = renderVNode(inst.subtree, inst.context, isSvg);
    inst.dom = childDom;
    inst.mounted = true;
    instanceDomMap.set(inst, childDom);
    (childDom as any).__blinkInstance = inst;
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

function getNextSibling(node: Node | null): Node | null {
  let current = node;
  while (current && current.nodeType === 3 && !current.textContent?.trim()) {
    current = current.nextSibling;
  }
  return current;
}

function hydrateVNode(node: Node, vnode: VChild, parentContext: Record<symbol, unknown>): Node {
  if (!isVNode(vnode)) {
    const isSignal = vnode && typeof vnode === 'object' && 'value' in (vnode as any);
    const val = isSignal ? (vnode as any).value : vnode;
    const strVal = (val === true || val === false || val == null) ? '' : String(val);

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
    
    const props = getPropsWithChildren(vnode.props, vnode.children);
    const result = invokeComponentSafe(inst, compFn, props);
    
    if (result instanceof Promise) {
        result.then(resolvedVNode => {
            if (!inst.mounted) return;
            inst.subtree = resolvedVNode as VChild;
            const realDom = renderVNode(resolvedVNode as VChild, inst.context, false);
            if (node.parentNode) node.parentNode.replaceChild(realDom, node);
            inst.dom = realDom;
            instanceDomMap.set(inst, realDom);
            (realDom as any).__blinkInstance = inst;
            runEffects(inst);
        });
        inst.dom = node;
        inst.mounted = true;
        (node as any).__blinkInstance = inst;
        return node;
    }

    inst.subtree = result as VChild;
    const hydratedDom = hydrateVNode(node, inst.subtree, inst.context);
    inst.dom = hydratedDom;
    inst.mounted = true;
    instanceDomMap.set(inst, hydratedDom);
    (hydratedDom as any).__blinkInstance = inst;
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
  const props = getPropsWithChildren(vnodeWrapper.props, vnodeWrapper.children);
  const res = invokeComponentSafe(inst, compFn, props);

  if (res instanceof Promise) {
     res.then(newSubtree => {
         if (!inst.mounted) return;
         if (inst.dom && inst.dom.parentNode) {
            const newDom = patch(inst.dom.parentNode, inst.subtree, newSubtree as VChild, inst.dom, inst.context);
            inst.dom = newDom;
            inst.subtree = newSubtree as VChild;
            instanceDomMap.set(inst, newDom);
            (newDom as any).__blinkInstance = inst;
         }
         runEffects(inst);
     });
     return;
  }

  const newSubtree = res as VChild;
  if (inst.dom && inst.dom.parentNode) {
    const newDom = patch(inst.dom.parentNode, inst.subtree, newSubtree, inst.dom, inst.context);
    inst.dom = newDom;
    inst.subtree = newSubtree;
    instanceDomMap.set(inst, newDom);
    (newDom as any).__blinkInstance = inst;
  }
  runEffects(inst);
}

export function getInstanceForDom(node: Node): ComponentInstance | null {
    return (node as any).__blinkInstance || null;
}

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