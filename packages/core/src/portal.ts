// BlinkJS - portal.ts
// Allows rendering components outside main root

import { mountApp, unmountApp } from './runtime';

type PortalInstance = {
  container: HTMLElement; // wrapper div we create and mount into
  host: HTMLElement;      // the host element where container is appended
  comp: Function;
  disposed: boolean;
};

const portals: PortalInstance[] = [];

/**
 * createPortal(component, target)
 * - component: BlinkJS component function
 * - target: DOM element or defaults to document.body
 */
export function createPortal(component: Function, target?: HTMLElement) {
  const host = target || document.body;
  const container = document.createElement('div');
  host.appendChild(container);

  mountApp(container, component);

  const portal: PortalInstance = { container, host, comp: component, disposed: false };
  portals.push(portal);

  // return a function to remove/unmount (idempotent)
  return () => {
    if (portal.disposed) return;
    portal.disposed = true;

    try {
      unmountApp(container);
    } finally {
      if (container.parentNode === host) {
        host.removeChild(container);
      }
      const idx = portals.indexOf(portal);
      if (idx > -1) portals.splice(idx, 1);
    }
  };
}
