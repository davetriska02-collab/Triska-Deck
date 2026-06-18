# Triska-Deck

Claude Code on your **Ulanzi D200 / U-Studio** stream-deck clone — one-press keys
that launch and drive Claude Code, inspired by
[claude-deck](https://github.com/etechlead/claude-deck) (which is Elgato-only).

This repo is the **Windows, triggers-only** setup: it uses the native
**UlanziDeck** app's actions (Run/Open a script, Text, Hotkey), so there's no
Elgato SDK and nothing to compile.

## What you get

🟢 **Launch keys** (run a script):
- **Launch** — start a fresh Claude Code session in your project
- **Continue** — `claude --continue` (resume last conversation)
- **Resume** — `claude --resume` (session picker)
- **Review** — start Claude and ask it to review your changes
- **Commit** — start Claude and ask it to commit staged changes
- **Tests** — start Claude, run the test suite, fix failures
- **YOLO** — start with permissions skipped (optional, use with care)

🔵 **In-session keys** (native Text / Hotkey actions, typed into the focused
terminal): `/clear`, `/compact`, `/review`, plan-mode (`Shift+Tab`), interrupt
(`Esc`), confirm (`Enter`), and more.

## Quick start

1. Put this repo somewhere on your PC (e.g. `C:\Users\<you>\Triska-Deck`).
2. Edit [`windows/_config.cmd`](windows/_config.cmd) — set your project folder and
   terminal. Double-click `windows/launch-claude.cmd` to confirm Claude opens.
3. In the UlanziDeck app, point keys at the scripts in `windows/` and add the
   in-session Text/Hotkey actions.

Full walkthrough: [`docs/SETUP_WINDOWS.md`](docs/SETUP_WINDOWS.md)
Suggested 13-key layout: [`docs/DECK_LAYOUT.md`](docs/DECK_LAYOUT.md)

## Repo contents

```
windows/
  _config.cmd          ← edit this (project dir, terminal, claude command)
  _launch.cmd          ← internal helper (don't point the deck at it)
  launch-claude.cmd    ← 🟢 fresh session
  continue-claude.cmd  ← 🟢 --continue
  resume-claude.cmd    ← 🟢 --resume
  review-claude.cmd    ← 🟢 review my changes
  commit-claude.cmd    ← 🟢 commit staged changes
  test-claude.cmd      ← 🟢 run tests & fix
  claude-yolo.cmd      ← 🟢 --dangerously-skip-permissions (optional)
docs/
  SETUP_WINDOWS.md     ← step-by-step wiring in the UlanziDeck app
  DECK_LAYOUT.md       ← 13-key layout + in-session strings/hotkeys
```

## Not included (yet)

Live **status feedback** on the keys (idle / running / done / needs-input) — the
other half of claude-deck. That needs a custom Ulanzi plugin plus a Claude Code
hook and real hardware to test against. Open an issue / ask and we can add it.
