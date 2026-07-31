@echo off
setlocal
cd /d "%~dp0"

where py >nul 2>nul
if %errorlevel%==0 (
  echo.
  echo Starting OSCILLOSCOPE VISUALIZER at http://localhost:8128
  echo Keep this window open. Press Ctrl+C to stop the server.
  echo.
  start "" "http://localhost:8128"
  py -m http.server 8128 --bind 127.0.0.1
  goto :end
)

where python >nul 2>nul
if %errorlevel%==0 (
  echo.
  echo Starting OSCILLOSCOPE VISUALIZER at http://localhost:8128
  echo Keep this window open. Press Ctrl+C to stop the server.
  echo.
  start "" "http://localhost:8128"
  python -m http.server 8128 --bind 127.0.0.1
  goto :end
)

echo.
echo PYTHON IS NOT INSTALLED OR IS NOT AVAILABLE IN PATH.
echo Read "VIRTUAL SERVER SETUP.md" in this folder.
echo.
pause

:end
endlocal
