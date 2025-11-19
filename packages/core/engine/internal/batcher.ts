// packages/core/engine/internal/batcher.ts
// Fixed: Added cancelUpdate to prevent double-renders

import { ComponentInstance } from './component';
import { rerenderComponent } from './runtime';

const dirtySet = new Set<ComponentInstance>();
let scheduled = false;

export function scheduleUpdate(inst: ComponentInstance) {
  if (!inst || !inst.mounted) return;
  dirtySet.add(inst);

  if (!scheduled) {
    scheduled = true;
    requestAnimationFrame(flushUpdates);
  }
}

// NEW: Called by runtime when a component is updated by its parent
export function cancelUpdate(inst: ComponentInstance) {
  dirtySet.delete(inst);
}

function flushUpdates() {
  scheduled = false;
  const list = Array.from(dirtySet);
  dirtySet.clear();

  for (const inst of list) {
    if (inst.mounted) {
        try {
            rerenderComponent(inst);
        } catch (err) {
            console.error('[BlinkJS] Error rerendering component:', err);
        }
    }
  }
}