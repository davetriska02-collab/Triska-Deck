@echo off
REM  One-press: start Claude and ask it to review your current changes.
call "%~dp0_launch.cmd" "Review my current uncommitted changes for bugs, edge cases, and anything that looks off. Be concise."
