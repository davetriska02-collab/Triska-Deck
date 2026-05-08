# Triska Deck

A user-configurable Chrome extension delivering a Stream Deck style shortcut
panel and recordable workflows for clinical web applications, with an opt-in
arming mechanism for end-to-end execution.

> **Working name: Triska.** Named for the developer; coincidentally means
> *thirteen* in Czech, which informs the safety catch motif.

## Status

This repository implements **Phases 0–7** of the build sequence in the plan
(everything bar polish items: hotkey-binding UI, icon library, and first-run
onboarding modal).

Implemented:

- Project scaffolding (Vite + TypeScript + React + Tailwind + Manifest V3 via
  `@crxjs/vite-plugin`).
- Data model and `chrome.storage.local` workspace + audit-log persistence.
- Default Medicus pack (task list deep links, right-panel switcher,
  slash-menu shortcuts) seeded on first run.
- Floating panel content script with per-origin decks, multiple pages,
  toasts, and the **arming state machine** (5 s window, auto-disarm,
  per-button, in-memory only).
- Action executor for `NAVIGATE`, `CLICK`, `INJECT_TEXT`, `WAIT_FOR_DOM`
  primitives with the **safety catch** (SAFE / CONFIRM / LIVE), submit-class
  detection, draft snapshot + rollback on abort, and audit logging.
- **Workflow recorder** — captures clicks, key presses, focus changes and
  navigations; generates three-candidate selectors per element (CSS path on
  stable attributes, role + accessible name, text fallback); compresses
  duplicate clicks and merges adjacent typing into a single `INJECT_TEXT`;
  rewrites a click that triggers navigation as a `NAVIGATE`. Post-stop save
  modal lets the user name the workflow, reorder/delete steps, insert
  `WAIT_FOR_DOM` quiet-period waits, choose commit mode, and assign to a
  new or existing button on a new or existing page.
- **Host-permissions UX** in the editor: per-origin Enable / Disable / Remove
  controls calling `chrome.permissions.request`, with an "Add origin" form.
  Granting permission auto-reloads any open matching tabs.
- Background service worker for hotkeys (`Alt+Shift+T` to toggle the panel,
  `Alt+Shift+E` to open the editor) and toolbar action.
- Editor (options page) with pages (per-origin permission status), workflows
  (commit-mode and LIVE-eligible toggles with the three-runs warning and
  first-time LIVE tutorial gate), audit log viewer, kill switch and JSON
  import/export.

## Install

### Prerequisites

- Node.js 18 or newer (`node --version`).
- Google Chrome, Chromium, Edge, Brave or any Chromium-based browser that
  supports Manifest V3 unpacked extensions.

### Build the extension

```sh
git clone https://github.com/davetriska02-collab/triska-deck.git
cd triska-deck
git checkout claude/triska-chrome-extension-jMz0s
npm install
npm run build
```

The build emits the unpacked extension into `dist/`.

For active development, `npm run dev` keeps Vite watching and rebuilding into
`dist/`; reload the extension from `chrome://extensions` to pick up changes
to the background service worker, and reload the page to pick up content-
script changes.

### Load it in Chrome

1. Open `chrome://extensions`.
2. Toggle **Developer mode** on (top-right).
3. Click **Load unpacked** and select the `dist/` folder produced by the
   build.
4. The Triska icon will appear in the toolbar. Click the puzzle-piece icon
   in the toolbar and pin Triska so it's always visible.

### First run — enable the origin you want a deck on

The MVP ships with **no host permissions** at install. Until you grant
permission for an origin, no deck will appear on its pages.

1. Right-click the Triska toolbar icon → **Options** (or press
   `Alt+Shift+E` on any tab).
2. In the editor's **Pages** view you'll see Medicus pre-seeded.
3. Click **Enable** on the Medicus row. Chrome will prompt:
   *"Add 'Triska'? It can: Read and change your data on
   england.medicus.health"* — accept it.
4. Any open Medicus tabs reload automatically; the panel is now available
   on those tabs.

To enable a different origin, use the **Add origin** form: paste the URL
(e.g. `https://england.medicus.health`), give it a label, click **Add
origin**. Chrome prompts for permission immediately.

### Use the panel

- `Alt+Shift+T` (or click the toolbar icon) toggles the floating panel on
  the active tab.
- The panel only appears on origins that (a) have an entry in the workspace
  *and* (b) have host permission granted.
- The seeded Medicus task-list buttons use a `{tenant}` placeholder in the
  URL; until tenant-config UI lands, edit those URLs once via the editor's
  **Workflows** tab to substitute your actual tenant slug. The right-panel
  and slash-menu workflows work without any tenant editing.

### Record a workflow

1. With the panel open on a permitted origin, click the **●** button in
   the panel header. The panel auto-closes; a red **REC** badge appears
   bottom-right with a step counter.
2. Demonstrate the workflow on the page. Clicks become `CLICK` steps,
   typing in a field becomes a single `INJECT_TEXT` (flushed on blur, or on
   Enter/Tab), and any click that triggers navigation within 500 ms is
   rewritten as `NAVIGATE`. Use **↶** on the badge to undo the last step.
3. Click **Stop** on the badge. The save modal opens — name the workflow,
   pick a commit mode (default **SAFE**), pick a page (or *+ New page…*),
   give the button a label, optionally reorder steps or insert
   `WAIT_FOR_DOM` quiet-period waits between any two steps, then **Save**.
4. The new button appears in the panel.

### Promoting a workflow to LIVE (the safety catch)

Default is **SAFE** — the executor halts before any submit-class step and
the user fires the final click manually. To run a workflow end-to-end:

1. Editor → **Workflows** → set the workflow's *Mode* to `LIVE`.
2. Tick **LIVE-eligible**. The first time you do this you'll see a one-shot
   modal explaining the arming model; if the workflow has fewer than three
   successful SAFE/CONFIRM runs you'll get a separate warning.
3. Back on the panel, the button now has a red border and an **ARM** badge
   in its top-right corner. Tap **ARM** — the badge turns red with a
   five-second countdown ring. Within those five seconds, tap the button
   to fire the workflow LIVE. The arm consumes on use; closing the tab,
   timing out, or successfully running all clear it.

The kill switch in **Settings → LIVE kill switch** disables LIVE
workspace-wide; ship that on for shared devices.

### Build artefacts

```
dist/
  manifest.json
  service-worker-loader.js
  src/options/index.html
  assets/                 # bundled JS + CSS + sourcemaps
```

`dist/` is the folder you point Chrome at.

## Safety model

See [`HAZARD_LOG.md`](./HAZARD_LOG.md) for the hazard log. Every workflow
declares one of three commit modes:

- **SAFE** — Submit-class steps trigger an automatic stop; the user clicks
  the final button manually. Default for all workflows.
- **CONFIRM** — Workflow runs to the Submit-class step then prompts for
  Continue / Abort.
- **LIVE** — Workflow runs end-to-end including Submit. Requires the
  workflow to be flagged `liveEligible` in the editor *and* per-execution
  arming via the panel's ARM button (5 s window, auto-disarms after a
  successful run).

Selector miss aborts immediately in any mode; LIVE never overrides this.

## Layout

```
src/
  background/      service worker (commands, toolbar action)
  content/         floating panel, executor, arming, recorder, submit-class
  options/         editor (options page)
  shared/          types, storage, defaults, Medicus pack
manifest.config.ts MV3 manifest (consumed by @crxjs/vite-plugin)
HAZARD_LOG.md      DCB0129 hazard log
```
