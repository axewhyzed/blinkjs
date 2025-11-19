// packages/core/src/component.ts
// BlinkJS - component.ts
// Handles per-component state (hooks, lifecycle) and current render context.

import { VNode, VChild } from './dom';
import type { Signal } from './hooks/useSignal';

export type Hook = unknown;

export type ComponentInstance = {
  hooks: Hook[];
  hookIndex: number;
  vnode?: VNode;             // wrapper VNode for this component
  dom?: Node | null;         // root DOM node of rendered subtree
  mounted: boolean;
  dirty: boolean;
  effects: (() => void)[];
  cleanup: (() => void)[];
  name?: string;
  signals: Signal<unknown>[];
  
  // Fix C: Context moved to instance (Inheritance via Prototype Chain)
  context: Record<symbol, unknown>;

  // Minimal reconciliation
  subtree?: VChild;
};

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

/**
 * Creates a new component instance.
 * Fix C: Inherits context from parent if provided.
 */
export function createComponentInstance(name?: string, parentContext?: Record<symbol, unknown>): ComponentInstance {
  return {
    hooks: [],
    hookIndex: 0,
    vnode: undefined,
    dom: null,
    mounted: false,
    dirty: false,
    effects: [],
    cleanup: [],
    name,
    signals: [],
    subtree: null,
    // Prototype inheritance allows O(1) context reads and independent writes
    context: parentContext ? Object.create(parentContext) : {},
  };
}

export function resetHooks(comp: ComponentInstance) {
  comp.hookIndex = 0;
}

export async function markDirty(comp: ComponentInstance) {
  const batcher = await import('./batcher');
  batcher.scheduleUpdate(comp);
}