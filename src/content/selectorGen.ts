// Selector generation for the recorder. For any element, builds up to three
// candidate selectors in priority order:
//   1. css   — a path anchored on stable attributes (id, data-*, name, role)
//              with nth-of-type fallbacks. Auto-generated IDs are skipped.
//   2. aria  — role + accessible name when both are well-defined.
//   3. text  — visible text content for interactive elements.
//
// The output is a SelectorBundle. The executor's resolver tries each in turn.

import type { SelectorBundle } from '@/shared/types';

const STABLE_ATTRS = [
  'data-testid',
  'data-test',
  'data-cy',
  'data-qa',
  'data-id',
  'name',
  'aria-label',
  'aria-labelledby',
  'role',
  'type',
];

// Heuristic: skip IDs that look auto-generated (UUIDs, hashes, framework
// gibberish like Mui-1234, ember-1234, etc).
const AUTO_ID_RE =
  /(^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$)|(^[0-9a-f]{12,}$)|(\d{4,}$)|(^:r[0-9a-z]+:)|(^ember\d+)/i;

export function generateSelectors(el: Element): SelectorBundle {
  const bundle: SelectorBundle = {};

  const css = generateCss(el);
  if (css) bundle.css = css;

  const aria = generateAria(el);
  if (aria) bundle.ariaName = aria;

  const text = generateText(el);
  if (text) bundle.text = text;

  return bundle;
}

function generateCss(el: Element): string | undefined {
  // Walk up until we either find a uniquely-anchored ancestor or hit body.
  const segments: string[] = [];
  let node: Element | null = el;
  let depth = 0;
  while (node && node !== document.body && depth < 6) {
    const seg = describeSegment(node);
    segments.unshift(seg);
    if (isUniquelyAnchored(node)) {
      return segments.join(' > ');
    }
    node = node.parentElement;
    depth += 1;
  }
  if (segments.length === 0) return undefined;
  return segments.join(' > ');
}

function describeSegment(el: Element): string {
  const tag = el.tagName.toLowerCase();

  // Stable id wins outright.
  if (el.id && !AUTO_ID_RE.test(el.id)) {
    return `${tag}#${cssEscape(el.id)}`;
  }

  // Look for any stable attribute we can hang on to.
  const attrs: string[] = [];
  for (const a of STABLE_ATTRS) {
    const v = el.getAttribute(a);
    if (!v) continue;
    if (a === 'aria-labelledby') continue; // resolves indirectly; not useful
    if (a === 'aria-label') {
      attrs.push(`[aria-label="${cssAttr(v)}"]`);
    } else {
      attrs.push(`[${a}="${cssAttr(v)}"]`);
    }
  }
  if (attrs.length > 0) {
    return `${tag}${attrs.join('')}`;
  }

  // Last resort: nth-of-type within parent.
  const parent = el.parentElement;
  if (parent) {
    const sameTag = Array.from(parent.children).filter(
      (c) => c.tagName === el.tagName,
    );
    if (sameTag.length > 1) {
      const idx = sameTag.indexOf(el) + 1;
      return `${tag}:nth-of-type(${idx})`;
    }
  }
  return tag;
}

function isUniquelyAnchored(el: Element): boolean {
  if (el.id && !AUTO_ID_RE.test(el.id)) return true;
  for (const a of ['data-testid', 'data-test', 'data-cy', 'data-qa', 'name']) {
    const v = el.getAttribute(a);
    if (v) return true;
  }
  return false;
}

function generateAria(el: Element): { role?: string; name: string } | undefined {
  if (!(el instanceof HTMLElement)) return undefined;
  const role = el.getAttribute('role') ?? implicitRole(el);
  const name = accessibleName(el);
  if (!name) return undefined;
  // Don't emit very short or trivial names — they collide easily.
  if (name.length < 2) return undefined;
  return role ? { role, name } : { name };
}

function implicitRole(el: HTMLElement): string | undefined {
  switch (el.tagName) {
    case 'BUTTON':
      return 'button';
    case 'A':
      return 'link';
    case 'INPUT': {
      const t = (el as HTMLInputElement).type;
      if (t === 'checkbox') return 'checkbox';
      if (t === 'radio') return 'radio';
      if (t === 'submit' || t === 'button') return 'button';
      return 'textbox';
    }
    case 'TEXTAREA':
      return 'textbox';
    case 'SELECT':
      return 'combobox';
    default:
      return undefined;
  }
}

function accessibleName(el: HTMLElement): string {
  const aria = el.getAttribute('aria-label');
  if (aria) return aria.trim();
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const target = document.getElementById(labelledBy);
    if (target) return (target.textContent ?? '').trim();
  }
  if (el instanceof HTMLInputElement && el.placeholder) return el.placeholder;
  // For form controls, look for an associated <label>.
  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement
  ) {
    if (el.labels && el.labels.length > 0) {
      return (el.labels[0].textContent ?? '').trim();
    }
  }
  const text = (el.textContent ?? '').trim();
  // Truncate huge text content to a sane size.
  return text.length > 80 ? text.slice(0, 80) : text;
}

function generateText(el: Element): string | undefined {
  if (!(el instanceof HTMLElement)) return undefined;
  const tag = el.tagName;
  const role = el.getAttribute('role');
  const interactive =
    tag === 'BUTTON' ||
    tag === 'A' ||
    role === 'button' ||
    role === 'menuitem' ||
    role === 'option' ||
    role === 'tab';
  if (!interactive) return undefined;
  const t = (el.textContent ?? '').trim();
  if (!t || t.length > 60) return undefined;
  return t;
}

function cssEscape(s: string): string {
  return s.replace(/([^a-zA-Z0-9_-])/g, '\\$1');
}

function cssAttr(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
