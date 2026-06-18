# Triska-Deck — recommended layout (Ulanzi D200 / U-Studio, 13 keys)

The D200 has **13 LCD keys**. The layout below mixes two kinds of actions:

- **🟢 Launch keys** point at a `.cmd` script in `windows/`. They open a terminal
  and start Claude Code. (Configured as a *System → Open / Run Command* action.)
- **🔵 In-session keys** type text or press hotkeys into the **already-focused
  terminal** where Claude is running. (Configured as a native *Text* or *Hotkey*
  action — no script needed.)

> In-session keys only work when your Claude terminal window has focus. Click the
> terminal (or add a "focus terminal" key) before using them.

```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ 1 🟢 Launch   │ 2 🟢 Continue │ 3 🟢 Resume   │ 4 🔵 Plan mode│
│   claude      │   --continue  │   --resume    │   Shift+Tab   │
├──────────────┼──────────────┼──────────────┼──────────────┤
│ 5 🟢 Review   │ 6 🟢 Commit   │ 7 🟢 Tests    │ 8 🔵 Clear    │
│   review-...  │   commit-...  │   test-...    │   /clear ⏎    │
├──────────────┼──────────────┼──────────────┼──────────────┤
│ 9 🔵 Compact  │ 10 🔵 Review  │ 11 🔵 Stop    │ 12 🔵 Yes/OK  │
│   /compact ⏎  │   /review ⏎   │   Esc         │   Enter       │
├──────────────┴──────────────┴──────────────┴──────────────┤
│ 13 🟢 YOLO  (claude-yolo.cmd — optional, skips permissions) │
└────────────────────────────────────────────────────────────┘
```

## Key-by-key

| # | Label | Type | What to configure |
|---|-------|------|-------------------|
| 1 | Launch | 🟢 Run script | `windows\launch-claude.cmd` |
| 2 | Continue | 🟢 Run script | `windows\continue-claude.cmd` |
| 3 | Resume | 🟢 Run script | `windows\resume-claude.cmd` |
| 4 | Plan mode | 🔵 Hotkey | `Shift+Tab` (cycles permission/plan modes) |
| 5 | Review changes | 🟢 Run script | `windows\review-claude.cmd` |
| 6 | Commit | 🟢 Run script | `windows\commit-claude.cmd` |
| 7 | Run tests | 🟢 Run script | `windows\test-claude.cmd` |
| 8 | Clear | 🔵 Text | type `/clear` then **Enter** |
| 9 | Compact | 🔵 Text | type `/compact` then **Enter** |
| 10 | /review | 🔵 Text | type `/review` then **Enter** |
| 11 | Stop / interrupt | 🔵 Hotkey | `Esc` (interrupts Claude mid-task) |
| 12 | Confirm | 🔵 Hotkey | `Enter` (accept the highlighted prompt option) |
| 13 | YOLO | 🟢 Run script | `windows\claude-yolo.cmd` (optional) |

## Useful in-session strings & hotkeys (mix in whatever you like)

| Action | Configure as | Value |
|--------|--------------|-------|
| New chat | Text | `/clear` + Enter |
| Compact context | Text | `/compact` + Enter |
| Code review | Text | `/review` + Enter |
| Init CLAUDE.md | Text | `/init` + Enter |
| Show cost | Text | `/cost` + Enter |
| Pick model | Text | `/model` + Enter |
| Resume picker | Text | `/resume` + Enter |
| Cycle plan/edit modes | Hotkey | `Shift+Tab` |
| Interrupt Claude | Hotkey | `Esc` |
| Accept prompt option | Hotkey | `Enter` |
| Quit Claude | Text | `/exit` + Enter |

> Slash-command names occasionally change between Claude Code versions. Run
> `/help` inside a session to see the current list, then tweak these keys.
