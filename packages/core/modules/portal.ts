// packages/core/modules/portal.ts
// Fixed: Made children optional to satisfy TypeScript strict JSX check

import { mountApp, unmountApp } from '../engine/internal/runtime';
import { onStart, onEnd, onChange } from '../engine/hooks/lifecycle';

/**
 * <Portal target={document.body}>
 * <div class="modal">...</div>
 * </Portal>
 */
export function Portal(props: { children?: any; target?: HTMLElement }) {
  const container = document.createElement('div');
  const host = props.target || document.body;

  // Helper to render the content into the container
  const renderPortal = () => {
    // We wrap children in a function component so mountApp accepts it
    const AppShell = () => props.children;
    mountApp(container, AppShell);
  };

  onStart(() => {
    host.appendChild(container);
    renderPortal();
  });

  // Update content if props change
  onChange(() => {
    renderPortal();
  });

  // Cleanup
  onEnd(() => {
    try {
      unmountApp(container);
    } finally {
      if (container.parentNode === host) {
        host.removeChild(container);
      }
    }
  });

  return null;
}

export const createPortal = Portal;