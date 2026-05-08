// Content script entry. Mounts the floating panel into a sealed shadow root
// so the host page's CSS cannot interfere with it. Listens for messages from
// the background service worker (commands, hotkeys).

import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import type { RuntimeMessage } from '@/shared/types';
import { Panel } from './panel';

const HOST_ID = 'triska-host';

function ensureHost(): ShadowRoot {
  let host = document.getElementById(HOST_ID) as HTMLElement | null;
  if (!host) {
    host = document.createElement('div');
    host.id = HOST_ID;
    host.style.all = 'initial';
    document.documentElement.appendChild(host);
  }
  if (!host.shadowRoot) {
    host.attachShadow({ mode: 'open' });
  }
  return host.shadowRoot!;
}

function Root() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onMsg = (msg: RuntimeMessage) => {
      if (msg.kind === 'TOGGLE_PANEL') setOpen((v) => !v);
    };
    chrome.runtime.onMessage.addListener(onMsg);
    return () => chrome.runtime.onMessage.removeListener(onMsg);
  }, []);

  return <Panel open={open} onClose={() => setOpen(false)} />;
}

const shadow = ensureHost();
const mount = document.createElement('div');
shadow.appendChild(mount);
createRoot(mount).render(<Root />);
