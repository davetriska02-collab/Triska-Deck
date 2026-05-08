// Submit-class detection. Used by the executor in SAFE and CONFIRM modes to
// halt before an irreversible action. LIVE mode bypasses the halt but still
// uses this list when annotating audit entries.

const HEURISTIC_TEXT = [
  'submit',
  'send',
  'save and close',
  'sign and send',
  'confirm prescription',
  'issue',
];

export function isSubmitClass(
  el: Element,
  extras: string[] = [],
): boolean {
  if (!(el instanceof HTMLElement)) return false;

  // type=submit is a hard signal.
  if (el instanceof HTMLButtonElement && el.type === 'submit') return true;
  if (el instanceof HTMLInputElement && el.type === 'submit') return true;

  // role=button with submit-class accessible name.
  const role = el.getAttribute('role');
  const isButtonish =
    el.tagName === 'BUTTON' ||
    el.tagName === 'A' ||
    role === 'button' ||
    role === 'menuitem';
  if (!isButtonish) return false;

  const name = (
    el.getAttribute('aria-label') ??
    el.textContent ??
    ''
  )
    .trim()
    .toLowerCase();
  if (!name) return false;

  for (const t of HEURISTIC_TEXT) if (name.includes(t)) return true;
  for (const t of extras) if (name.includes(t.toLowerCase())) return true;
  return false;
}
