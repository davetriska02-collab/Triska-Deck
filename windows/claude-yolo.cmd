@echo off
REM  Start Claude Code with permission prompts disabled.
REM  WARNING: this lets Claude run tools without asking. Only use it
REM  in a trusted/sandboxed project. Remove this key if unsure.
call "%~dp0_launch.cmd" --dangerously-skip-permissions
