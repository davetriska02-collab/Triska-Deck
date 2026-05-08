// Helpers around chrome.permissions for runtime host-permission grants.
// The MVP ships with no host permissions at install; the user enables each
// origin from the editor and Chrome prompts for the matching origin.

export function originPattern(origin: string): string {
  // chrome.permissions wants a match pattern, not a bare origin.
  return `${origin}/*`;
}

export async function hasOriginPermission(origin: string): Promise<boolean> {
  return chrome.permissions.contains({ origins: [originPattern(origin)] });
}

export async function requestOriginPermission(origin: string): Promise<boolean> {
  return chrome.permissions.request({ origins: [originPattern(origin)] });
}

export async function removeOriginPermission(origin: string): Promise<boolean> {
  return chrome.permissions.remove({ origins: [originPattern(origin)] });
}

export function watchPermissions(cb: () => void): () => void {
  // The chrome.permissions events expose addListener but the type definitions
  // don't expose removeListener. Poll instead — the editor doesn't need
  // sub-second freshness.
  chrome.permissions.onAdded.addListener(cb);
  chrome.permissions.onRemoved.addListener(cb);
  return () => {
    // No-op cleanup. The listeners persist for the life of the options page.
  };
}
