// Element resolver. Tries the three candidate selectors in priority order:
// CSS path, role+accessible name, then visible text content.

import type { SelectorBundle } from '@/shared/types';

export interface ResolveResult {
  el: HTMLElement | null;
  used: 'css' | 'aria' | 'text' | null;
  triedSelector?: string;
}

export function resolveOnce(bundle: SelectorBundle): ResolveResult {
  if (bundle.css) {
    try {
      const el = document.querySelector(bundle.css);
      if (el instanceof HTMLElement) return { el, used: 'css', triedSelector: bundle.css };
    } catch {
      // Invalid selector; fall through.
    }
  }
  if (bundle.ariaName) {
    const el = findByAria(bundle.ariaName.role, bundle.ariaName.name);
    if (el)
      return {
        el,
        used: 'aria',
        triedSelector: `${bundle.ariaName.role ?? '*'}[name="${bundle.ariaName.name}"]`,
      };
  }
  if (bundle.text) {
    const el = findByText(bundle.text);
    if (el) return { el, used: 'text', triedSelector: `text="${bundle.text}"` };
  }
  return { el: null, used: null };
}

export async function resolveWithRetry(
  bundle: SelectorBundle,
  timeoutMs: number,
): Promise<ResolveResult> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const r = resolveOnce(bundle);
    if (r.el) return r;
    await sleep(50);
  }
  return resolveOnce(bundle);
}

function findByAria(role: string | undefined, name: string): HTMLElement | null {
  const lname = name.toLowerCase();
  // Naive accessible name: aria-label, aria-labelledby, then text content.
  const candidates = role
    ? document.querySelectorAll(`[role="${cssEscape(role)}"]`)
    : document.querySelectorAll<HTMLElement>(
        'button, a, input, textarea, select, [role]',
      );
  for (const el of Array.from(candidates)) {
    if (!(el instanceof HTMLElement)) continue;
    const accName = accessibleName(el);
    if (!accName) continue;
    if (accName.toLowerCase() === lname) return el;
  }
  // Fallback: substring match.
  for (const el of Array.from(candidates)) {
    if (!(el instanceof HTMLElement)) continue;
    const accName = accessibleName(el);
    if (!accName) continue;
    if (accName.toLowerCase().includes(lname)) return el;
  }
  return null;
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
  return (el.textContent ?? '').trim();
}

function findByText(text: string): HTMLElement | null {
  const lt = text.toLowerCase();
  const interactive = document.querySelectorAll<HTMLElement>(
    'button, a, [role="button"], [role="menuitem"], [role="option"]',
  );
  for (const el of Array.from(interactive)) {
    const t = (el.textContent ?? '').trim().toLowerCase();
    if (t === lt) return el;
  }
  for (const el of Array.from(interactive)) {
    const t = (el.textContent ?? '').trim().toLowerCase();
    if (t.includes(lt)) return el;
  }
  return null;
}

function cssEscape(s: string): string {
  // Minimal escape: enough for role values which are alpha-only in practice.
  return s.replace(/"/g, '\\"');
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Wait until MutationObserver reports no changes for `quietMs`, or `timeoutMs`
// elapses.
export function waitQuiet(quietMs: number, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    let lastChange = Date.now();
    const obs = new MutationObserver(() => {
      lastChange = Date.now();
    });
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });

    const start = Date.now();
    const tick = () => {
      const sinceChange = Date.now() - lastChange;
      if (sinceChange >= quietMs) {
        obs.disconnect();
        resolve();
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        obs.disconnect();
        resolve();
        return;
      }
      window.setTimeout(tick, Math.min(quietMs - sinceChange, 50));
    };
    tick();
  });
}
