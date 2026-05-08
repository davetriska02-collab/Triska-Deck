// Background service worker. Owns chrome.commands hotkeys and toolbar action
// clicks; broadcasts messages to the active tab's content script.

import type { RuntimeMessage } from '@/shared/types';

async function sendToActive(message: RuntimeMessage): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, message);
  } catch {
    // Content script not present (chrome:// page, store, etc). Silently drop.
  }
}

chrome.action.onClicked.addListener(() => {
  void sendToActive({ kind: 'TOGGLE_PANEL' });
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-panel') {
    void sendToActive({ kind: 'TOGGLE_PANEL' });
  } else if (command === 'open-editor') {
    void chrome.runtime.openOptionsPage();
  }
});

chrome.runtime.onInstalled.addListener(() => {
  // Seed the workspace lazily on first storage read; nothing to do here yet.
});

// When the user grants a new host permission from the editor, reload any
// already-open matching tabs so the manifest content script gets injected
// without the user having to reload by hand. New navigations after this
// point pick up the content script automatically.
chrome.permissions.onAdded.addListener(async (perm) => {
  if (!perm.origins || perm.origins.length === 0) return;
  for (const origin of perm.origins) {
    try {
      const tabs = await chrome.tabs.query({ url: origin });
      for (const tab of tabs) {
        if (tab.id !== undefined) {
          try {
            await chrome.tabs.reload(tab.id);
          } catch {
            // ignore — tab may be unloadable
          }
        }
      }
    } catch {
      // ignore
    }
  }
});
