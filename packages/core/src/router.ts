// packages/core/src/router.ts
// BlinkJS - router.ts
// Fix 2: Outlet Safety + TypeScript Casting

import { useSignal, Signal } from './hooks/useSignal';
import { onStart } from './hooks/lifecycle';
import { el, FragmentSymbol } from './dom'; 
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

type RouterContextValue = {
  path: Signal<string>;
  params: Signal<Record<string, string>>;
  query: Signal<Record<string, string>>;
  routes: CompiledRoute[];
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
export function Router(props: { routes?: RouteDef[]; children: any }) {
  const initialRoutes = props.routes || globalRoutes;
  const compiledRoutes = initialRoutes.map(compileRoute);
  
  const currentPath = useSignal(window.location.pathname + window.location.search);
  const paramsSignal = useSignal<Record<string, string>>({});
  const querySignal = useSignal<Record<string, string>>({});

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
    routes: compiledRoutes
  };

  // Fix: Cast to 'any' to satisfy strict TS checks on generic ComponentFn
  return el(RouterCtx.Provider as any, { value }, props.children);
}

/**
 * <Outlet />
 */
export function Outlet() {
  const ctx = useContext(RouterCtx);
  if (!ctx) return el('div', null, 'Error: Outlet used outside Router');

  const path = ctx.path.value;
  const match = matchRoute(path, ctx.routes);

  if (match) {
    // Implicit batch update via signals
    if (JSON.stringify(ctx.params.value) !== JSON.stringify(match.params)) {
        ctx.params.value = match.params;
    }
    
    const q = parseQuery(path.split('?')[1] || '');
    if (JSON.stringify(ctx.query.value) !== JSON.stringify(q)) {
        ctx.query.value = q;
    }

    const Comp = match.route.original.component;
    return el(Comp as any, {});
  }

  // Fix 2: Return explicit null.
  // This renders as an empty Text Node in the DOM, which is a valid "Physical" node.
  // This prevents the crash where a parent tries to remove an empty Fragment.
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
  if (replace) history.replaceState(null, '', path);
  else history.pushState(null, '', path);
  window.dispatchEvent(new Event('blink:route-change'));
}

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
  if (route.path === '*') return { original: route, regex: /.^/, keys: [], isFallback: true };
  const keys: string[] = [];
  const pattern = route.path.replace(/\/+$/, '').replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; });
  const source = '^' + (pattern === '' ? '/' : pattern) + '$';
  return { original: route, regex: new RegExp(source), keys, isFallback: false };
}

function matchRoute(fullPath: string, routes: CompiledRoute[]) {
  const pathname = fullPath.split('?')[0];
  const path = pathname !== '/' ? pathname.replace(/\/+$/, '') : '/';

  for (const cr of routes) {
    if (cr.isFallback) continue;
    const m = cr.regex.exec(path);
    if (!m) continue;
    const params: Record<string, string> = {};
    for (let i = 0; i < cr.keys.length; i++) params[cr.keys[i]] = decodeURIComponent(m[i + 1] || '');
    return { route: cr, params };
  }
  const fallback = routes.find(c => c.isFallback);
  return fallback ? { route: fallback, params: {} } : null;
}

function parseQuery(qs: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!qs) return out;
  new URLSearchParams(qs).forEach((v, k) => out[k] = v);
  return out;
}