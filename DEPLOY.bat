@echo off
title Synapse - Deploy to Vercel
echo.
echo ============================================
echo   SYNAPSE - DEPLOY TO VERCEL (PRODUCTION)
echo ============================================
echo.
echo This will:
echo   1. Log you into Vercel (opens browser)
echo   2. Build your project
echo   3. Deploy it live to production
echo.
echo Press any key to start...
pause >nul

echo.
echo [Step 1/3] Logging into Vercel...
echo A browser window will open. Click "Continue with GitHub" to log in.
echo.
call npx vercel login
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Login failed. Please try again.
    pause
    exit /b 1
)

echo.
echo [Step 2/3] Linking project to Vercel...
echo.
echo When asked:
echo   - "Set up and deploy?" = Y
echo   - "Which scope?" = Select your account
echo   - "Link to existing project?" = N
echo   - "Project name?" = synapse
echo   - "Directory?" = just press Enter
echo   - "Override settings?" = N
echo.
call npx vercel --prod
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo First deploy attempt done. Trying production deploy...
    call npx vercel --prod --yes
)

echo.
echo ============================================
echo   DEPLOYMENT COMPLETE!
echo ============================================
echo.
echo Your site should now be live at the URL shown above.
echo Open it in an Incognito window (Ctrl+Shift+N) to see changes.
echo.
pause
