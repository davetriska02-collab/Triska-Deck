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

## Build

```sh
npm install
npm run build
```

Then load `dist/` as an unpacked extension in Chrome.

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
