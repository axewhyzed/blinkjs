// BlinkJS - router.ts
// Component-based Router

import { useSignal, Signal } from './hooks/useSignal';
import { onStart, onEnd } from './hooks/lifecycle';
import { el } from './dom';

type RouteDef = {
  path: string;
  component: Function;
};

type CompiledRoute = {
  original: RouteDef;
  regex: RegExp;
  keys: string[];
  isFallback: boolean;
};

// Global config (shared across Router instances)
let routesConfig: CompiledRoute[] = [];

/**
 * Define routes for the application.
 * Does NOT mount the app anymore. Use <Router /> in your main App component.
 */
export function defineRoutes(defs: RouteDef[]) {
  routesConfig = defs.map(compileRoute);
}

/**
 * <Router /> Component
 * Renders the current matched route component.
 */
export function Router() {
  const currentPath = useSignal(window.location.pathname + window.location.search);
  const paramsSignal = useSignal<Record<string, string>>({});
  const querySignal = useSignal<Record<string, string>>({});

  // Listen to history events
  onStart(() => {
    const onPop = () => {
      currentPath.value = window.location.pathname + window.location.search;
    };
    window.addEventListener('popstate', onPop);
    
    // Custom event for pushState/replaceState
    const onPush = () => {
       currentPath.value = window.location.pathname + window.location.search;
    };
    window.addEventListener('blink:route-change', onPush);

    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('blink:route-change', onPush);
    };
  });

  // Match logic
  // We use a derived value logic here inside render
  const match = matchRoute(currentPath.value);
  
  if (match) {
    // Update param signals if they changed (deep check omitted for speed)
    paramsSignal.value = match.params;
    querySignal.value = parseQuery(currentPath.value.split('?')[1] || '');
    
    // Render the Route Component
    // We pass signals or values? 
    // Passing values is React-like. Passing signals is Solid-like.
    // Let's pass values to be compatible with standard components.
    const Comp = match.route.original.component;
    return el(Comp as any, { params: match.params, query: querySignal.value });
  }

  return el('div', null, '404 Not Found');
}

/**
 * Navigate programmatically
 */
export function navigateTo(path: string, replace = false) {
  if (replace) {
    history.replaceState(null, '', path);
  } else {
    history.pushState(null, '', path);
  }
  window.dispatchEvent(new Event('blink:route-change'));
}

/**
 * Link helper
 */
export function link(event: MouseEvent) {
  const target = event.currentTarget as HTMLAnchorElement | null;
  if (!target) return;
  const href = target.getAttribute('href');
  if (!href) return;
  
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
  
  event.preventDefault();
  navigateTo(href);
}

// --- Internals ---

function compileRoute(route: RouteDef): CompiledRoute {
  if (route.path === '*') {
    return { original: route, regex: /.^/, keys: [], isFallback: true };
  }
  const keys: string[] = [];
  const pattern = route.path
    .replace(/\/+$/, '')
    .replace(/:(\w+)/g, (_, k) => {
      keys.push(k);
      return '([^/]+)';
    });
  const source = '^' + (pattern === '' ? '/' : pattern) + '$';
  return { original: route, regex: new RegExp(source), keys, isFallback: false };
}

function matchRoute(fullPath: string) {
  const pathname = fullPath.split('?')[0];
  const path = pathname !== '/' ? pathname.replace(/\/+$/, '') : '/';

  for (const cr of routesConfig) {
    if (cr.isFallback) continue;
    const m = cr.regex.exec(path);
    if (!m) continue;

    const params: Record<string, string> = {};
    for (let i = 0; i < cr.keys.length; i++) {
      params[cr.keys[i]] = decodeURIComponent(m[i + 1] || '');
    }
    return { route: cr, params };
  }
  
  const fallback = routesConfig.find(c => c.isFallback);
  return fallback ? { route: fallback, params: {} } : null;
}

function parseQuery(queryString: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!queryString) return out;
  new URLSearchParams(queryString).forEach((v, k) => out[k] = v);
  return out;
}