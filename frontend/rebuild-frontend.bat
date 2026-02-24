@echo off
echo ============================================
echo REBUILDING FRONTEND WITH NEW CODE
echo ============================================
echo.

cd /d "%~dp0"

echo Cleaning old build...
if exist dist rmdir /s /q dist

echo.
echo Building new frontend...
call npm run build

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================
    echo ✅ BUILD SUCCESSFUL!
    echo ============================================
    echo.
    echo Now do these steps:
    echo 1. Hard refresh your browser: Ctrl+Shift+R
    echo 2. Try dragging a token onto the map
    echo 3. Check console for "🔥🔥🔥 NEW CODE IS RUNNING!" message
    echo.
) else (
    echo.
    echo ============================================
    echo ❌ BUILD FAILED!
    echo ============================================
    echo Check the error messages above
    echo.
)

pause

