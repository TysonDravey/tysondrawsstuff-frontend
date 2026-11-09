@echo off
rem Opens the product description editor (no console window).
cd /d "%~dp0..\.."
start "" "tools\venv\Scripts\pythonw.exe" "tools\describe\describe_gui.py"
