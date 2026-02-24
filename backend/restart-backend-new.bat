@echo off
echo ============================================
echo STOPPING BACKEND
echo ============================================
taskkill /F /IM node.exe 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Backend stopped successfully
) else (
    echo No backend process was running
)

timeout /t 2 /nobreak >nul

echo.
echo ============================================
echo STARTING BACKEND WITH NEW CODE
echo ============================================
cd /d "%~dp0"
start "BlueMusic Backend" cmd /k "node src/index.js"

timeout /t 3 /nobreak >nul

echo.
echo ============================================
echo Backend should now be starting...
echo ============================================
echo.
echo IMPORTANT: Check the backend console window for:
echo   [Database Migration] Populating base tokens...
echo   [Database Migration] Created XX Icon base tokens
echo   [Database Migration] Created XX JOCAT base tokens
echo.
echo If you see those messages, the new code is running!
echo.
pause

