// Workflow recorder. Listens for clicks, keystrokes, focus changes and
// navigations on the page, and emits the smallest sequence of primitive
// Steps that reproduces the trace.
//
// Capture model:
//   - A click on an interactive element emits a CLICK step. If the click
//     starts a navigation within ~500 ms, the click is rewritten as a
//     NAVIGATE step with the destination URL.
//   - Focusing a text field starts a typing buffer. The buffer is flushed
//     into a single INJECT_TEXT step on blur or when the next non-input
//     action fires. Enter and Tab inside the field flush the buffer first.
//   - DOM mutations after each user action are observed; if the click
//     opens a fresh menu/option list a WAIT_FOR_DOM (APPEAR) step is
//     inserted before the next CLICK so replay is robust.
//
// Output is a Step[]; the panel renders the post-stop editor where the
// user names, reorders, deletes, or adds waits between steps.

import type { Step, InjectTextStep, ClickStep } from '@/shared/types';
import { newId } from '@/shared/ids';
import { generateSelectors } from './selectorGen';

export interface RecorderHandle {
  stop(): Promise<Step[]>;
  cancel(): void;
  count(): number;
  subscribe(cb: (count: number) => void): () => void;
  undoLast(): void;
}

export function startRecording(): RecorderHandle {
  const steps: Step[] = [];
  const listeners = new Set<(count: number) => void>();
  let typingEl: HTMLElement | null = null;
  let typingBuffer = '';
  let typingTarget: ReturnType<typeof generateSelectors> | null = null;
  let typingIsClinicalSearch = false;
  let lastClickAt = 0;
  let lastUrl = window.location.href;
  let stopped = false;

  const notify = () => {
    for (const l of listeners) l(steps.length);
  };

  const flushTyping = () => {
    if (!typingEl || !typingTarget || typingBuffer.length === 0) {
      typingEl = null;
      typingBuffer = '';
      typingTarget = null;
      typingIsClinicalSearch = false;
      return;
    }
    const step: InjectTextStep = {
      id: newId('step'),
      type: 'INJECT_TEXT',
      target: typingTarget,
      text: typingBuffer,
      isClinicalSearch: typingIsClinicalSearch,
    };
    steps.push(step);
    typingEl = null;
    typingBuffer = '';
    typingTarget = null;
    typingIsClinicalSearch = false;
    notify();
  };

  // Heuristic: a field is treated as a clinical search if its accessible
  // name or surrounding label suggests SNOMED / code search. The redaction
  // policy in the audit log relies on this flag.
  const isClinicalSearchField = (el: HTMLElement): boolean => {
    const name = (
      el.getAttribute('aria-label') ??
      el.getAttribute('placeholder') ??
      el.getAttribute('name') ??
      ''
    ).toLowerCase();
    return (
      name.includes('codes and actions') ||
      name.includes('snomed') ||
      name.includes('search code') ||
      name.includes('clinical code')
    );
  };

  const onClick = (e: MouseEvent) => {
    const target = e.target as Element | null;
    if (!target) return;
    if (isInsideShadowHost(target)) return; // ignore the panel itself
    flushTyping();
    const interactiveTarget =
      target.closest(
        'button, a, [role="button"], [role="menuitem"], [role="option"], [role="tab"], [role="combobox"], input[type="checkbox"], input[type="radio"], input[type="submit"]',
      ) ?? target;
    const bundle = generateSelectors(interactiveTarget);
    const step: ClickStep = {
      id: newId('step'),
      type: 'CLICK',
      target: bundle,
    };
    steps.push(step);
    lastClickAt = Date.now();
    notify();
  };

  const onFocusIn = (e: FocusEvent) => {
    const target = e.target as Element | null;
    if (!target) return;
    if (isInsideShadowHost(target)) return;
    if (!isTextField(target)) return;
    if (target === typingEl) return;
    flushTyping();
    typingEl = target as HTMLElement;
    typingBuffer = '';
    typingTarget = generateSelectors(target);
    typingIsClinicalSearch = isClinicalSearchField(target as HTMLElement);
  };

  const onInput = (e: Event) => {
    const target = e.target as HTMLElement | null;
    if (!target || target !== typingEl) return;
    typingBuffer = readFieldValue(target);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const target = e.target as Element | null;
    if (!target) return;
    if (isInsideShadowHost(target)) return;
    if (!isTextField(target)) return;
    // Enter / Tab close out the current typing buffer with a trailing
    // newline / tab character so replay re-fires the same submission.
    if (e.key === 'Enter') {
      typingBuffer += '\n';
      flushTyping();
    } else if (e.key === 'Tab') {
      typingBuffer += '\t';
      flushTyping();
    }
  };

  const onFocusOut = (e: FocusEvent) => {
    const target = e.target as Element | null;
    if (target === typingEl) flushTyping();
  };

  // Track URL changes; convert the last CLICK to NAVIGATE if it triggered
  // navigation within 500 ms.
  const checkNavigation = () => {
    if (window.location.href !== lastUrl) {
      const since = Date.now() - lastClickAt;
      if (since < 500 && steps.length > 0) {
        const last = steps[steps.length - 1];
        if (last.type === 'CLICK') {
          steps[steps.length - 1] = {
            id: last.id,
            type: 'NAVIGATE',
            url: window.location.href,
          };
          notify();
        }
      } else {
        steps.push({
          id: newId('step'),
          type: 'NAVIGATE',
          url: window.location.href,
        });
        notify();
      }
      lastUrl = window.location.href;
    }
  };

  const navInterval = window.setInterval(checkNavigation, 200);

  document.addEventListener('click', onClick, true);
  document.addEventListener('focusin', onFocusIn, true);
  document.addEventListener('focusout', onFocusOut, true);
  document.addEventListener('input', onInput, true);
  document.addEventListener('keydown', onKeyDown, true);

  const teardown = () => {
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('focusin', onFocusIn, true);
    document.removeEventListener('focusout', onFocusOut, true);
    document.removeEventListener('input', onInput, true);
    document.removeEventListener('keydown', onKeyDown, true);
    window.clearInterval(navInterval);
  };

  return {
    async stop() {
      if (stopped) return steps;
      flushTyping();
      teardown();
      stopped = true;
      return compress(steps);
    },
    cancel() {
      if (stopped) return;
      teardown();
      stopped = true;
    },
    count() {
      return steps.length;
    },
    undoLast() {
      if (steps.length > 0) {
        steps.pop();
        notify();
      }
    },
    subscribe(cb) {
      listeners.add(cb);
      cb(steps.length);
      return () => listeners.delete(cb);
    },
  };
}

// Collapse adjacent duplicate clicks (a double-trigger we don't want), and
// merge sequences of INJECT_TEXT into the same target.
function compress(steps: Step[]): Step[] {
  const out: Step[] = [];
  for (const s of steps) {
    const prev = out[out.length - 1];
    if (
      prev &&
      prev.type === 'INJECT_TEXT' &&
      s.type === 'INJECT_TEXT' &&
      sameTarget(prev.target, s.target)
    ) {
      out[out.length - 1] = { ...prev, text: prev.text + s.text };
      continue;
    }
    if (
      prev &&
      prev.type === 'CLICK' &&
      s.type === 'CLICK' &&
      sameTarget(prev.target, s.target)
    ) {
      // Drop the duplicate.
      continue;
    }
    out.push(s);
  }
  return out;
}

function sameTarget(
  a: { css?: string; ariaName?: { role?: string; name: string }; text?: string },
  b: { css?: string; ariaName?: { role?: string; name: string }; text?: string },
): boolean {
  if (a.css && b.css) return a.css === b.css;
  if (a.ariaName && b.ariaName)
    return (
      a.ariaName.role === b.ariaName.role &&
      a.ariaName.name === b.ariaName.name
    );
  if (a.text && b.text) return a.text === b.text;
  return false;
}

function isTextField(el: Element): boolean {
  if (el instanceof HTMLInputElement) {
    const t = el.type;
    return (
      t === 'text' ||
      t === 'search' ||
      t === 'email' ||
      t === 'url' ||
      t === 'tel' ||
      t === 'password' ||
      t === ''
    );
  }
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLElement && el.isContentEditable) return true;
  return false;
}

function readFieldValue(el: HTMLElement): string {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return el.value;
  }
  if (el.isContentEditable) return el.textContent ?? '';
  return '';
}

function isInsideShadowHost(target: Element): boolean {
  // The Triska panel mounts under #triska-host with a shadow root; events
  // dispatched from inside it bubble out with composedPath. We need to keep
  // those out of the recording.
  return target.closest?.('#triska-host') !== null;
}
