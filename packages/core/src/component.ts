// packages/core/src/component.ts
// BlinkJS - component.ts
// Handles per-component state (hooks, lifecycle) and current render context.

export type Hook = any;

export type ComponentInstance = {
  hooks: Hook[];
  hookIndex: number;
  vnode?: any;             // wrapper VNode for this component (tag: compFn)
  dom?: Node | null;       // root DOM node of this component's rendered subtree
  mounted: boolean;
  dirty: boolean;
  effects: (() => void)[];
  cleanup: (() => void)[];
  name?: string;
  signals: any[];

  // --- new: for minimal reconciliation ---
  subtree?: any;           // last rendered VChild returned from component (for patching)

  // --- context carrier (used by Provider impl) ---
  // no parent link required; we use global stacks in context.ts
};

// current component being rendered
let currentComponent: ComponentInstance | null = null;

export function getCurrentComponent(): ComponentInstance {
  if (!currentComponent) {
    throw new Error('[BlinkJS] Hooks can only be called inside a component render function.');
  }
  return currentComponent;
}

export function getCurrentComponentUnsafe(): ComponentInstance | null {
  return currentComponent;
}

export function setCurrentComponent(comp: ComponentInstance | null) {
  currentComponent = comp;
}

export function createComponentInstance(name?: string): ComponentInstance {
  return {
    hooks: [],
    hookIndex: 0,
    vnode: null,
    dom: null,
    mounted: false,
    dirty: false,
    effects: [],
    cleanup: [],
    name,
    signals: [],
    subtree: null,
  };
}

export function resetHooks(comp: ComponentInstance) {
  comp.hookIndex = 0;
}

/**
 * Delegate scheduling to the central batcher; noop DOM here.
 */
export async function markDirty(comp: ComponentInstance) {
  const batcher = await import('./batcher');
  batcher.scheduleUpdate(comp);
}
