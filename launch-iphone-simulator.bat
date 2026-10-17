@echo off
echo Starting ZoneClock in iPhone Simulation Mode...
start "" "chrome.exe" --new-window --window-size=430,932 --user-agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" "http://localhost:5173/"
echo Launched Chrome in iPhone window size!
echo Press F12, then Ctrl+Shift+M to enable touch simulation and GPS sensor overrides.
