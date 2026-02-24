@echo off
echo Stopping backend...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

echo Starting backend...
cd /d "%~dp0"
start /min "BlueMusic Backend" node src/index.js

echo Backend restarted!
timeout /t 2 /nobreak >nul

