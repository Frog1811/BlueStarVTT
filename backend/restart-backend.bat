@echo off
echo Stopping all Node.js processes...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

echo Starting backend server...
cd /d "%~dp0"
start "BlueMusic Backend" cmd /k "node src/index.js"

echo Backend server starting...
timeout /t 3 /nobreak >nul

echo Testing backend endpoints...
curl http://localhost:3001/api/health
echo.
echo.
echo Backend should now be running with updated endpoints!
echo.
pause

