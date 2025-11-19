// packages/core/modules/ssr.ts

import { Fragment, VChild, VNode, isVNode } from '../engine/internal/dom';
import { createComponentInstance, resetHooks, setCurrentComponent } from '../engine/internal/component';

function isSignal(obj: any): obj is { value: any } { return obj && typeof obj === 'object' && 'value' in obj; }
function isTextLike(x: any): x is string | number { return typeof x === 'string' || typeof x === 'number'; }
function escapeHtml(str: string): string { return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function escapeAttr(str: string): string { return escapeHtml(str).replace(/"/g, '&quot;'); }
function styleToString(style: any): string {
  if (!style) return '';
  if (typeof style === 'string') return style;
  return Object.entries(style).map(([k, v]) => `${k}:${String(v)}`).join(';');
}

export function renderToString(input: VChild | (() => any)): string {
  if (typeof input === 'function') {
    const inst = createComponentInstance(input.name || 'Component');
    return renderComponentToString(inst, input as Function, {});
  }
  return renderChild(input);
}

function renderChild(node: VChild): string {
  if (node == null || typeof node === 'boolean') return '';
  if (isTextLike(node)) return escapeHtml(String(node));
  if (isSignal(node)) return renderChild(node.value);
  if (Array.isArray(node)) return node.map(renderChild).join('');

  if (isVNode(node)) {
    if (node.tag === Fragment) {
      return (node.children || []).map(renderChild).join('');
    }
    if (typeof node.tag === 'function') {
      const inst = createComponentInstance((node.tag as any).name || 'Component');
      return renderComponentToString(inst, node.tag as Function, node.props || {});
    }
    return renderElement(node as VNode);
  }
  return escapeHtml(String(node));
}

function renderComponentToString(inst: any, compFn: Function, props: any): string {
  resetHooks(inst);
  setCurrentComponent(inst);
  inst.vnode = { tag: compFn, props, children: [] } as any;
  let out: any;
  try {
    out = compFn(props || {});
  } catch (e) {
    console.error(`[BlinkJS SSR] Error rendering ${compFn.name}:`, e);
    return '';
  } finally {
    setCurrentComponent(null);
  }
  if (out instanceof Promise) {
    console.warn(`[BlinkJS SSR] Async component '${compFn.name}' detected. Async SSR is not supported in this version.`);
    return ''; 
  }
  if (isTextLike(out) || out == null) return renderChild(out as any);
  if (Array.isArray(out)) return out.map(renderChild).join('');
  return renderChild(out);
}

function renderElement(v: VNode): string {
  const tag = String(v.tag);
  let attrs = '';
  if (v.props) {
    for (const [nameRaw, value] of Object.entries(v.props)) {
      if (nameRaw === 'children') continue;
      if (/^on[A-Z]/.test(nameRaw)) continue;
      let name = nameRaw === 'className' ? 'class' : nameRaw;
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
  const voidElements = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
  if (voidElements.has(tag) && !children) return open;
  return open + children + close;
}