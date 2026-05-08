// Tiny ID helper. crypto.randomUUID is available in service workers and pages
// that support secure contexts. Chrome extension contexts qualify.
export function newId(prefix = ''): string {
  const uuid =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return prefix ? `${prefix}_${uuid}` : uuid;
}
