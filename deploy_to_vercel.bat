@echo off
echo ========================================================
echo   Synapse: Direct Vercel Production Deploy
echo ========================================================
echo.
cd /d "%~dp0"

echo [1/2] Logging into Vercel (if not already logged in)...
cmd.exe /c "npx --yes vercel login"

echo.
echo [2/2] Deploying latest build directly to Vercel Production...
cmd.exe /c "npx --yes vercel --prod --yes"

echo.
echo ========================================================
echo   Deployment finished! 
echo ========================================================
pause
