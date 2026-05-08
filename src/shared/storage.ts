import type { AuditEntry, Workspace, WorkspaceSettings } from './types';
import { defaultWorkspace } from './defaults';

const WORKSPACE_KEY = 'triska.workspace.v1';
const AUDIT_KEY = 'triska.audit.v1';
const AUDIT_MAX_ENTRIES = 2000;

export async function loadWorkspace(): Promise<Workspace> {
  const got = await chrome.storage.local.get(WORKSPACE_KEY);
  const ws = got[WORKSPACE_KEY] as Workspace | undefined;
  if (!ws) {
    const seed = defaultWorkspace();
    await chrome.storage.local.set({ [WORKSPACE_KEY]: seed });
    return seed;
  }
  return ws;
}

export async function saveWorkspace(ws: Workspace): Promise<void> {
  ws.lastEditedAt = Date.now();
  await chrome.storage.local.set({ [WORKSPACE_KEY]: ws });
}

export async function updateSettings(
  patch: Partial<WorkspaceSettings>,
): Promise<Workspace> {
  const ws = await loadWorkspace();
  ws.settings = { ...ws.settings, ...patch };
  await saveWorkspace(ws);
  return ws;
}

export function watchWorkspace(cb: (ws: Workspace) => void): () => void {
  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    area: chrome.storage.AreaName,
  ) => {
    if (area !== 'local') return;
    const change = changes[WORKSPACE_KEY];
    if (!change) return;
    cb(change.newValue as Workspace);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

export async function loadAuditLog(): Promise<AuditEntry[]> {
  const got = await chrome.storage.local.get(AUDIT_KEY);
  return (got[AUDIT_KEY] as AuditEntry[] | undefined) ?? [];
}

export async function appendAuditEntry(entry: AuditEntry): Promise<void> {
  const log = await loadAuditLog();
  log.push(entry);
  // Cap the local log so storage doesn't grow without bound.
  const trimmed =
    log.length > AUDIT_MAX_ENTRIES ? log.slice(-AUDIT_MAX_ENTRIES) : log;
  await chrome.storage.local.set({ [AUDIT_KEY]: trimmed });
}

export async function clearAuditLog(): Promise<void> {
  await chrome.storage.local.set({ [AUDIT_KEY]: [] });
}

export async function exportWorkspace(): Promise<string> {
  const ws = await loadWorkspace();
  return JSON.stringify(ws, null, 2);
}

export async function importWorkspace(json: string): Promise<Workspace> {
  const parsed = JSON.parse(json) as Workspace;
  if (parsed.version !== 1) {
    throw new Error(`Unsupported workspace version: ${parsed.version}`);
  }
  await saveWorkspace(parsed);
  return parsed;
}
