@echo off
REM  One-press: start Claude and ask it to run the tests and fix failures.
call "%~dp0_launch.cmd" "Run the project's test suite, then diagnose and fix any failures. Show me the final passing output."
