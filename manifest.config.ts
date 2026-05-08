import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'Triska',
  short_name: 'Triska',
  description:
    'Stream Deck style shortcut panel and recordable workflows for clinical web applications. Includes opt-in arming for end-to-end execution.',
  version: '0.1.0',
  action: {
    default_title: 'Triska',
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  options_page: 'src/options/index.html',
  permissions: ['storage', 'activeTab', 'scripting'],
  optional_host_permissions: ['https://*/*', 'http://*/*'],
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/index.tsx'],
      run_at: 'document_idle',
      all_frames: false,
    },
  ],
  commands: {
    'toggle-panel': {
      suggested_key: { default: 'Alt+Shift+T' },
      description: 'Toggle the Triska panel in the active tab',
    },
    'open-editor': {
      suggested_key: { default: 'Alt+Shift+E' },
      description: 'Open the Triska editor',
    },
  },
});
