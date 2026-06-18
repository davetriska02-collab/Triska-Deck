@echo off
REM  One-press: start Claude and ask it to commit your staged changes.
call "%~dp0_launch.cmd" "Review my staged git changes and create a single commit with a clear, conventional commit message."
