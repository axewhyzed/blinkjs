// BlinkJS - batcher.ts
// Handles batching of component updates to prevent multiple renders per frame.
// This is the single source of truth for scheduling. Runtime delegates here.

import { ComponentInstance } from './internal/component';
import { rerenderComponent } from './internal/runtime';

// A set of dirty components to re-render
const dirtySet = new Set<ComponentInstance>();

// Flag to prevent multiple scheduled flushes
let scheduled = false;

/**
 * Schedule a component to be updated.
 * Components are batched and flushed in the next animation frame.
 */
export function scheduleUpdate(inst: ComponentInstance) {
  if (!inst || !inst.mounted) return;

  dirtySet.add(inst);

  if (!scheduled) {
    scheduled = true;
    requestAnimationFrame(() => {
      flushUpdates();
      scheduled = false;
    });
  }
}

/**
 * Flush all dirty components by re-rendering them
 */
function flushUpdates() {
  const components = Array.from(dirtySet);
  dirtySet.clear();

  for (const comp of components) {
    try {
      rerenderComponent(comp);
    } catch (err) {
      console.error('[BlinkJS] Error rerendering component:', err);
    }
  }
}