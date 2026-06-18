# Setting up Triska-Deck on Windows (Ulanzi D200 / U-Studio)

This gets "Claude Code on your deck": one-press keys that launch Claude Code and
fire common commands. It uses the **UlanziDeck** app's built-in actions — no
Elgato SDK, no plugin to compile.

## 0. Prerequisites

- The **UlanziDeck** app installed (from <https://www.ulanzi.com/pages/ulanzi-app>)
  and your D200 showing up in it.
- **Claude Code** installed and working from a terminal. Confirm by opening a
  terminal and running:
  ```
  claude --version
  ```
  If that fails, install/fix Claude Code first — the deck just runs this command.
- (Recommended) **Windows Terminal** installed, so the launch keys open a nice
  window. If you don't have it, set `CLAUDE_DECK_TERMINAL=cmd` in step 2.

## 1. Get these files onto your PC

Clone or download this repo somewhere stable, e.g.:
```
C:\Users\<you>\Triska-Deck
```
Everything the deck needs is in the `windows\` folder.

## 2. Edit your config (once)

Open `windows\_config.cmd` in Notepad and set:

- `CLAUDE_DECK_PROJECT` → the folder Claude should open in (your main repo).
- `CLAUDE_DECK_CMD` → leave as `claude` (or `wsl claude` if you run it in WSL).
- `CLAUDE_DECK_TERMINAL` → `wt`, `pwsh`, `powershell`, or `cmd`.

Save. Test it by **double-clicking `windows\launch-claude.cmd`** — a terminal
should open in your project with Claude Code running. If that works, the deck
will too.

## 3. Wire up the launch keys (the 🟢 scripts)

In the UlanziDeck app, for each launch key:

1. Drag a **System → Open** action (some versions call it **"Run" / "Open
   File"**) onto an empty key.
   - If your app has the community **"Run Command"** plugin instead, use that and
     point it at the same `.cmd` file — either works.
2. Set the **path/file** to the script, e.g.:
   ```
   C:\Users\<you>\Triska-Deck\windows\launch-claude.cmd
   ```
3. Give the key a **title** and **icon**.
4. Repeat for `continue-claude.cmd`, `resume-claude.cmd`, `review-claude.cmd`,
   `commit-claude.cmd`, `test-claude.cmd`, and (optional) `claude-yolo.cmd`.

See [`DECK_LAYOUT.md`](./DECK_LAYOUT.md) for the suggested 13-key arrangement.

## 4. Wire up the in-session keys (the 🔵 text/hotkeys)

These type into whatever window is focused, so they drive a Claude session that's
already open and focused.

- **Slash commands** (e.g. `/clear`, `/compact`, `/review`): add a **Text** /
  **Multi-key (Hotstring)** action. Put the command in the text box and enable
  **"send Enter at the end"** (or append a newline / add an Enter key to the
  macro).
- **Hotkeys** (e.g. `Shift+Tab` for plan mode, `Esc` to interrupt, `Enter` to
  confirm): add a **Hotkey / Shortcut** action and record the key combo.

The full list of strings and combos is in [`DECK_LAYOUT.md`](./DECK_LAYOUT.md).

## 5. Try it

- Press **Launch** → Claude opens in your project.
- Click the terminal so it's focused, press **Plan mode** (`Shift+Tab`), type a
  request, press **Stop** (`Esc`) to interrupt, **Clear** to reset.

## Troubleshooting

- **Key does nothing / flashes**: double-click the `.cmd` directly. If that fails,
  the problem is the script/config, not the deck. Fix `_config.cmd`.
- **"claude is not recognized"**: Claude Code isn't on your PATH for non-login
  shells. Use the full path in `_config.cmd`, e.g.
  `set "CLAUDE_DECK_CMD=C:\Users\<you>\AppData\Roaming\npm\claude.cmd"`,
  or set `CLAUDE_DECK_CMD=wsl claude` if you run it under WSL.
- **Wrong folder opens**: fix `CLAUDE_DECK_PROJECT` in `_config.cmd`.
- **In-session key types into the wrong window**: focus the Claude terminal first.
  Consider adding a key that focuses your terminal (UlanziDeck **"Open app"** →
  Windows Terminal) before the in-session keys.

## What this does NOT do

This is the **triggers-only** setup you chose: keys that *start* and *drive*
Claude. It does **not** push live status (running / done / needs-input) back onto
the keys — that needs a custom plugin against the Ulanzi app and a Claude Code
hook. If you want that later, say so and we'll build the status half.
