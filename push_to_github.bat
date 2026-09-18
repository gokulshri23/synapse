@echo off
title Push Synapse to GitHub
cls
cd /d "%~dp0"

echo ==========================================================
echo    SYNAPSE — AUTOMATED GITHUB DEPLOYMENT HELPER
echo ==========================================================
echo Current project directory: %cd%
echo.

git status
echo.

echo ----------------------------------------------------------
echo Paste your GitHub repository URL below.
echo Example: https://github.com/your-username/synapse.git
echo ----------------------------------------------------------
set /p REPO="GitHub Repo URL: "

if "%REPO%"=="" (
    echo [ERROR] No URL entered. Please run again and paste your GitHub repository URL.
    pause
    exit /b
)

echo.
echo [1/3] Setting remote origin...
git remote remove origin 2>nul
git remote add origin %REPO%

echo [2/3] Setting default branch to main...
git branch -M main

echo [3/3] Pushing project files to GitHub...
git push -u origin main

echo.
echo ==========================================================
if %ERRORLEVEL% EQU 0 (
    echo  SUCCESS! Your code is now live on GitHub!
    echo  Next Step: Open https://vercel.com and import this repo.
) else (
    echo  Push encountered an issue. Check your GitHub permissions/login.
)
echo ==========================================================
echo.
pause
