// BlinkJS - router.ts
// Minimal SPA router with params (:id), query parsing, and 404 fallback (*)

import { mountApp, unmountApp } from './runtime';

type Route = {
  path: string;           // e.g. '/', '/users/:id', or '*' for fallback
  component: Function;    // component invoked with { params, query }
};

type CompiledRoute = {
  original: Route;
  regex: RegExp;
  keys: string[];         // param names in order
  isFallback: boolean;    // path === '*'
};

let compiled: CompiledRoute[] = [];
let rootSelector: string | Element;

/**
 * defineRoutes([
 *   { path: '/', component: Home },
 *   { path: '/post/:id', component: Post },
 *   { path: '*', component: NotFound }   // optional fallback
 * ], '#app')
 */
export function defineRoutes(routeDefs: Route[], root: string | Element) {
  rootSelector = root;
  compiled = routeDefs.map(compileRoute);

  // Handle browser nav
  window.addEventListener('popstate', () => {
    navigateTo(getPath(), false);
  });

  // Initial navigation
  navigateTo(getPath(), false);
}

/**
 * Programmatic navigation
 * push = true for history.pushState, false for replaceState
 */
export function navigateTo(path: string, push = true) {
  const { pathname, search } = splitPath(path);
  const match = matchRoute(pathname);

  const query = parseQuery(search);

  if (!match) {
    const fallback = compiled.find(c => c.isFallback);
    if (!fallback) {
      console.warn(`[BlinkJS Router] No route matched and no '*' fallback: ${pathname}`);
      return;
    }
    mountRoute(fallback, {}, query, push ? 'push' : 'replace', pathname, search);
    return;
  }

  mountRoute(match.route, match.params, query, push ? 'push' : 'replace', pathname, search);
}

/**
 * SPA link helper: <a href="/x" onclick={link}>X</a>
 */
export function link(event: MouseEvent) {
  const target = event.currentTarget as HTMLAnchorElement | null;
  if (!target) return;

  const href = target.getAttribute('href');
  if (!href) return;

  // Respect new tab/middle click/modifiers
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
    return;
  }

  event.preventDefault();
  navigateTo(href);
}

/* ---------------- internal helpers ---------------- */

function getPath() {
  return window.location.pathname + window.location.search;
}

function splitPath(path: string): { pathname: string; search: string } {
  const qIdx = path.indexOf('?');
  return qIdx === -1
    ? { pathname: path, search: '' }
    : { pathname: path.slice(0, qIdx), search: path.slice(qIdx) };
}

function parseQuery(search: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!search || search[0] !== '?') return out;
  const usp = new URLSearchParams(search);
  usp.forEach((v, k) => {
    out[k] = v;
  });
  return out;
}

function compileRoute(route: Route): CompiledRoute {
  if (route.path === '*') {
    return { original: route, regex: /.^/, keys: [], isFallback: true };
  }

  const keys: string[] = [];
  // Convert '/users/:id' -> /^\/users\/([^/]+)$/
  const pattern = route.path
    .replace(/\/+$/, '') // trim trailing slash (except root)
    .replace(/:(\w+)/g, (_, k) => {
      keys.push(k);
      return '([^/]+)';
    });

  const source = '^' + (pattern === '' ? '/' : pattern) + '$';
  const regex = new RegExp(source);

  return { original: route, regex, keys, isFallback: false };
}

function matchRoute(pathname: string): { route: CompiledRoute; params: Record<string, string> } | null {
  // normalize: remove trailing slash except root
  const path = pathname !== '/' ? pathname.replace(/\/+$/, '') : '/';

  for (const cr of compiled) {
    if (cr.isFallback) continue;
    const m = cr.regex.exec(path);
    if (!m) continue;

    const params: Record<string, string> = {};
    for (let i = 0; i < cr.keys.length; i++) {
      params[cr.keys[i]] = decodeURIComponent(m[i + 1] || '');
    }
    return { route: cr, params };
  }
  return null;
}

function mountRoute(
  route: CompiledRoute | { original: Route },
  params: Record<string, string>,
  query: Record<string, string>,
  nav: 'push' | 'replace',
  pathname: string,
  search: string
) {
  // Unmount previous and mount wrapped component with route props.
  unmountApp(rootSelector);

  const Comp = route.original.component;
  const Wrapped = () => (Comp as any)({ params, query });

  mountApp(rootSelector, Wrapped);

  if (nav === 'push') {
    history.pushState({}, '', pathname + (search || ''));
  } else {
    history.replaceState({}, '', pathname + (search || ''));
  }
}
