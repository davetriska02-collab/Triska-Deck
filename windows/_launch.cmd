@echo off
REM ============================================================
REM  Triska-Deck core launcher  --  DO NOT POINT THE DECK HERE
REM ============================================================
REM  Internal helper. The deck-facing scripts (launch-claude.cmd,
REM  continue-claude.cmd, etc.) call this with arguments that are
REM  passed straight through to the `claude` command.
REM ------------------------------------------------------------
setlocal
call "%~dp0_config.cmd"

REM  Everything passed in becomes Claude Code's arguments.
set "CLAUDE_ARGS=%*"

REM  --- Windows Terminal (preferred) ---------------------------
if /i "%CLAUDE_DECK_TERMINAL%"=="wt" (
    where wt >nul 2>nul
    if not errorlevel 1 (
        start "" wt -d "%CLAUDE_DECK_PROJECT%" cmd /k "%CLAUDE_DECK_CMD% %CLAUDE_ARGS%"
        goto :done
    )
)

REM  --- PowerShell 7+ ------------------------------------------
if /i "%CLAUDE_DECK_TERMINAL%"=="pwsh" (
    start "" pwsh -NoExit -Command "Set-Location -LiteralPath '%CLAUDE_DECK_PROJECT%'; %CLAUDE_DECK_CMD% %CLAUDE_ARGS%"
    goto :done
)

REM  --- Windows PowerShell 5 -----------------------------------
if /i "%CLAUDE_DECK_TERMINAL%"=="powershell" (
    start "" powershell -NoExit -Command "Set-Location -LiteralPath '%CLAUDE_DECK_PROJECT%'; %CLAUDE_DECK_CMD% %CLAUDE_ARGS%"
    goto :done
)

REM  --- Fallback: classic cmd ----------------------------------
start "" cmd /k "cd /d "%CLAUDE_DECK_PROJECT%" && %CLAUDE_DECK_CMD% %CLAUDE_ARGS%"

:done
endlocal
