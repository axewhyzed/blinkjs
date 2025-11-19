// packages/core/modules/router.ts
// Fixed: Corrected RouterContextValue type to match Signal<MatchResult>

import { useSignal, useComputed, Signal } from '../engine/hooks/useSignal';
import { onStart } from '../engine/hooks/lifecycle';
import { el } from '../engine/internal/dom'; 
import { createContext, useContext } from './context';

// --- Types ---
export type RouteDef = {
  path: string;
  component: Function;
};

type CompiledRoute = {
  original: RouteDef;
  regex: RegExp;
  keys: string[];
  isFallback: boolean;
};

// Defined here so it can be used in RouterContextValue
type MatchResult = { 
  route: CompiledRoute; 
  params: Record<string, string> 
};

type RouterContextValue = {
  path: Signal<string>;
  params: Signal<Record<string, string>>;
  query: Signal<Record<string, string>>;
  routes: CompiledRoute[];
  // FIX: Updated type to MatchResult to match matchRoute return value
  match: Signal<MatchResult | null>;
};

// --- Context ---
const RouterCtx = createContext<RouterContextValue | null>(null);

// --- Global Config (Compatibility) ---
let globalRoutes: RouteDef[] = [];

export function defineRoutes(defs: RouteDef[]) {
  globalRoutes = defs;
}

/**
 * <Router routes={...}>
 */
export function Router(props: { routes?: RouteDef[]; children?: any }) {
  const initialRoutes = props.routes || globalRoutes;
  const compiledRoutes = initialRoutes.map(compileRoute);
  
  const currentPath = useSignal(window.location.pathname + window.location.search);

  // Computed match derived from path
  const matchSignal = useComputed(() => matchRoute(currentPath.value, compiledRoutes));

  // Computed params derived from match
  const paramsSignal = useComputed(() => matchSignal.value ? matchSignal.value.params : {});

  // Computed query derived from path
  const querySignal = useComputed(() => parseQuery(currentPath.value.split('?')[1] || ''));

  onStart(() => {
    const onPop = () => currentPath.value = window.location.pathname + window.location.search;
    window.addEventListener('popstate', onPop);
    
    const onPush = () => currentPath.value = window.location.pathname + window.location.search;
    window.addEventListener('blink:route-change', onPush);

    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('blink:route-change', onPush);
    };
  });

  const value: RouterContextValue = {
    path: currentPath,
    params: paramsSignal,
    query: querySignal,
    routes: compiledRoutes,
    match: matchSignal
  };

  // Cast to 'any' to satisfy strict TS checks on generic ComponentFn
  return el(RouterCtx.Provider as any, { value }, props.children);
}

/**
 * <Outlet />
 */
export function Outlet() {
  const ctx = useContext(RouterCtx);
  if (!ctx) return el('div', null, 'Error: Outlet used outside Router');

  // Reactive read: Re-renders when match changes
  const match = ctx.match.value;

  if (match) {
    // Accessing .route is now valid because match is typed as MatchResult
    const Comp = match.route.original.component;
    return el(Comp as any, {});
  }

  return null;
}

// --- Hooks ---
export function useParams() {
  const ctx = useContext(RouterCtx);
  return ctx?.params.value || {};
}

export function useQuery() {
  const ctx = useContext(RouterCtx);
  return ctx?.query.value || {};
}

// --- Navigation ---
export function navigateTo(path: string, replace = false) {
  if (replace) {
    history.replaceState(null, '', path);
  } else {
    history.pushState(null, '', path);
  }
  window.dispatchEvent(new Event('blink:route-change'));
}

export function link(event: MouseEvent) {
  const target = (event.target as Element).closest('a');
  
  if (!target) return;
  
  const href = target.getAttribute('href');
  if (!href) return;

  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
    return;
  }

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
  const regex = new RegExp(source);

  return { original: route, regex, keys, isFallback: false };
}

function matchRoute(fullPath: string, routes: CompiledRoute[]): MatchResult | null {
  const pathname = fullPath.split('?')[0];
  const path = pathname !== '/' ? pathname.replace(/\/+$/, '') : '/';

  for (const cr of routes) {
    if (cr.isFallback) continue;
    const m = cr.regex.exec(path);
    if (!m) continue;

    const params: Record<string, string> = {};
    for (let i = 0; i < cr.keys.length; i++) {
      params[cr.keys[i]] = decodeURIComponent(m[i + 1] || '');
    }
    return { route: cr, params };
  }
  
  const fallback = routes.find(c => c.isFallback);
  return fallback ? { route: fallback, params: {} } : null;
}

function parseQuery(qs: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!qs) return out;
  new URLSearchParams(qs).forEach((v, k) => {
    out[k] = v;
  });
  return out;
}