// packages/core/modules/portal.ts
// Fixed: Component-based Portal with lifecycle

import { mountApp, unmountApp } from '../engine/internal/runtime';
import { onStart, onEnd, onChange } from '../engine/hooks/lifecycle';

export function Portal(props: { children?: any; target?: HTMLElement }) {
  const container = document.createElement('div');
  const host = props.target || document.body;

  const renderPortal = () => {
    const AppShell = () => props.children;
    mountApp(container, AppShell);
  };

  onStart(() => {
    host.appendChild(container);
    // No render here, onChange handles it
  });

  onChange(() => {
    renderPortal();
  });

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