@echo off
REM ============================================================
REM  Triska-Deck configuration  --  EDIT THIS FILE
REM ============================================================
REM  These settings are shared by every launcher script.
REM  Only change the values to the right of the "=" sign.
REM ------------------------------------------------------------

REM  Default project directory Claude Code opens in.
REM  Examples:
REM     set "CLAUDE_DECK_PROJECT=C:\Users\dave\code\my-app"
REM     set "CLAUDE_DECK_PROJECT=%USERPROFILE%\projects\triska"
if not defined CLAUDE_DECK_PROJECT set "CLAUDE_DECK_PROJECT=%USERPROFILE%"

REM  The command used to start Claude Code.
REM     Native Windows install ........ claude
REM     Running Claude inside WSL ...... wsl claude
REM     Running via Git Bash .......... claude
if not defined CLAUDE_DECK_CMD set "CLAUDE_DECK_CMD=claude"

REM  Terminal to open Claude Code in. One of:
REM     wt          Windows Terminal (recommended, nicest UI)
REM     pwsh        PowerShell 7+
REM     powershell  Windows PowerShell 5
REM     cmd         classic Command Prompt
if not defined CLAUDE_DECK_TERMINAL set "CLAUDE_DECK_TERMINAL=wt"
