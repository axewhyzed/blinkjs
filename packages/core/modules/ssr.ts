// BlinkJS - ssr.ts
// Minimal server-side renderer: renderToString(VChild | Component)
// - Executes function components with a lightweight instance
// - No effects run; hooks can be used (safe render-only)
// - Signals are read via .value (no subscriptions)
// - Handles: elements, text, fragments, style (obj/string), boolean attrs
//
// NOTE: This is intentionally tiny. It doesn't hydrate; it's for pre-rendering.

import { FragmentSymbol, VChild, VNode, isVNode } from './internal/dom';
import { createComponentInstance, resetHooks, setCurrentComponent } from './internal/component';

// ---- local helpers ----

function isSignal(obj: any): obj is { value: any } {
  return obj && typeof obj === 'object' && 'value' in obj;
}

function isTextLike(x: any): x is string | number {
  return typeof x === 'string' || typeof x === 'number';
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(str: string): string {
  // Attribute-friendly escaping (also escape quotes)
  return escapeHtml(str).replace(/"/g, '&quot;');
}

function styleToString(style: any): string {
  if (!style) return '';
  if (typeof style === 'string') return style;
  return Object.entries(style)
    .map(([k, v]) => `${k}:${String(v)}`)
    .join(';');
}

// ---- core rendering ----

/**
 * Render any BlinkJS "child" value to HTML.
 */
export function renderToString(input: VChild | (() => any)): string {
  if (typeof input === 'function') {
    const inst = createComponentInstance(input.name || 'Component');
    return renderComponentToString(inst, input as Function, {});
  }
  return renderChild(input);
}

function renderChild(node: VChild): string {
  if (node == null) return '';
  if (isTextLike(node)) return escapeHtml(String(node));
  if (isSignal(node)) return renderChild(node.value);

  if (Array.isArray(node)) {
    // Not typical in VChild, but handle defensively
    return node.map(renderChild).join('');
  }

  if (isVNode(node)) {
    // Fragment
    if (node.tag === FragmentSymbol) {
      return (node.children || []).map(renderChild).join('');
    }

    // Function component: execute with instance context
    if (typeof node.tag === 'function') {
      const inst = createComponentInstance((node.tag as any).name || 'Component');
      return renderComponentToString(inst, node.tag as Function, node.props || {});
    }

    // DOM Element
    return renderElement(node as VNode);
  }

  // Fallback
  return escapeHtml(String(node));
}

function renderComponentToString(inst: any, compFn: Function, props: any): string {
  resetHooks(inst);
  setCurrentComponent(inst);
  inst.vnode = { tag: compFn, props, children: [] } as any;

  let out: any;
  try {
    out = compFn(props || {});
  } finally {
    setCurrentComponent(null);
  }

  // Normalize: array => Fragment
  if (isTextLike(out) || out == null) return renderChild(out as any);
  if (Array.isArray(out)) {
    return out.map(renderChild).join('');
  }
  return renderChild(out);
}

function renderElement(v: VNode): string {
  const tag = String(v.tag);

  // Build attributes
  let attrs = '';
  if (v.props) {
    for (const [nameRaw, value] of Object.entries(v.props)) {
      if (nameRaw === 'children') continue;
      if (/^on[A-Z]/.test(nameRaw)) continue; // ignore event handlers

      let name = nameRaw === 'className' ? 'class' : nameRaw;

      // boolean attrs
      const booleanAttrs = new Set(['disabled', 'checked', 'readonly', 'multiple', 'selected', 'hidden']);
      if (booleanAttrs.has(name)) {
        if (value) attrs += ` ${name}`;
        continue;
      }

      if (name === 'style') {
        const css = styleToString(value);
        if (css) attrs += ` style="${escapeAttr(css)}"`;
        continue;
      }

      const val = isSignal(value) ? value.value : value;
      if (val == null) continue;

      attrs += ` ${name}="${escapeAttr(String(val))}"`;
    }
  }

  const open = `<${tag}${attrs}>`;
  const children = (v.children || []).map(renderChild).join('');
  const close = `</${tag}>`;
  return open + children + close;
}
