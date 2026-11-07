@echo off
rem Launches the TDS Railway tray (no console window).
rem First run creates tools\venv and installs pystray/pillow/requests.
cd /d "%~dp0"
if not exist "venv\Scripts\pythonw.exe" (
  python -m venv venv
  "venv\Scripts\python.exe" -m pip install -q -r requirements-tray.txt
)
start "" "venv\Scripts\pythonw.exe" tds_tray.py
