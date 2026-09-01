@echo off
REM ===================================================================
REM  Kalb Project Atlas - lobby display launcher (Windows)
REM
REM  Put this file on the kiosk PC and make a shortcut to it in
REM     shell:startup
REM  so the wall comes back on its own after a power cut. Nobody should
REM  ever have to log in and click something to get the lobby working.
REM
REM  What this does that a plain shortcut to Chrome does not:
REM   - relaunches Chrome if it is closed or crashes, forever
REM   - uses its own Chrome profile, so the kiosk cannot inherit tabs,
REM     bookmarks, sign-ins or an "restore pages?" bar from normal use
REM   - suppresses the crash-restore bubble, which after a power cut
REM     otherwise sits on the wall until somebody dismisses it
REM   - keeps Windows awake (no sleep, no screen blank, no lock)
REM ===================================================================

REM --- The display URL and its display settings.
REM       overscan=3  keeps all chrome clear of a TV that crops its own
REM                   picture. Set it to 0 if your TV's picture size is
REM                   already Screen Fit / Just Scan and nothing is cut.
REM       tour=0      no automatic camera tour; delete this to turn the
REM                   tour back on.
REM       lite=1      only for a weak display. A PC does not need it and
REM                   loses the 3D city, the orbit and sharper rendering.
set ATLAS_URL=https://kalb-projects-wall-map.vercel.app/?overscan=3

REM --- A profile that belongs to the kiosk and nothing else.
set ATLAS_PROFILE=%LOCALAPPDATA%\KalbAtlasKiosk

REM --- Find Chrome.
set CHROME="%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist %CHROME% set CHROME="%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist %CHROME% (
  echo Could not find Chrome. Edit CHROME= in this file.
  pause
  exit /b 1
)

REM --- Keep the machine and the panel awake while this window lives.
REM     These are the settings that actually matter; the TV going black at
REM     3pm because Windows decided to sleep is the most common way a
REM     lobby display "breaks".
powercfg /change monitor-timeout-ac 0
powercfg /change standby-timeout-ac 0
powercfg /change disk-timeout-ac 0
powercfg /change hibernate-timeout-ac 0

REM --- Clear the flags Chrome uses to decide it crashed, so the restore
REM     bubble never appears after an unclean shutdown.
if exist "%ATLAS_PROFILE%\Default\Preferences" (
  powershell -NoProfile -Command ^
    "$p='%ATLAS_PROFILE%\Default\Preferences';" ^
    "$j=Get-Content $p -Raw;" ^
    "$j=$j -replace '\"exit_type\":\"[^\"]*\"','\"exit_type\":\"Normal\"';" ^
    "$j=$j -replace '\"exited_cleanly\":false','\"exited_cleanly\":true';" ^
    "Set-Content $p $j -NoNewline" 2>nul
)

:launch
echo [%date% %time%] starting Kalb Atlas kiosk
%CHROME% ^
  --kiosk ^
  --user-data-dir="%ATLAS_PROFILE%" ^
  --noerrdialogs ^
  --disable-session-crashed-bubble ^
  --disable-infobars ^
  --no-first-run ^
  --no-default-browser-check ^
  --disable-pinch ^
  --overscroll-history-navigation=0 ^
  --autoplay-policy=no-user-gesture-required ^
  --check-for-update-interval=31536000 ^
  "%ATLAS_URL%"

REM --- Chrome exited: crash, driver reset, or somebody closed it.
REM     Wait a moment so a hard failure loop does not spin, then go again.
echo [%date% %time%] Chrome exited - relaunching in 10s
timeout /t 10 /nobreak >nul
goto launch
