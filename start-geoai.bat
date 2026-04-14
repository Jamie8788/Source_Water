@echo off
REM Windows batch script to start full GeoAI integration
REM Runs: Main Node server + GeoAI Python service + React client

setlocal enabledelayedexpansion

echo 🚀 Starting Full GeoAI Stack...
echo.

REM Colors using PowerShell (approximate)
REM In batch, we'll just use echo

REM Kill existing processes on ports
echo Cleaning up existing processes...
taskkill /F /IM node.exe 2>nul
taskkill /F /IM python.exe 2>nul
timeout /t 2 /nobreak >nul

REM 1. Start GeoAI Service (Python)
echo.
echo 1️⃣  Starting GeoAI Service on port 8002...
start "GeoAI Service" cmd /k "cd geoai-service && python main.py"
timeout /t 2 /nobreak >nul

REM 2. Start Node Server
echo.
echo 2️⃣  Starting Node Server on port 3001...
start "Node Server" cmd /k "cd server && npm run dev"
timeout /t 3 /nobreak >nul

REM 3. Start React Client
echo.
echo 3️⃣  Starting React Client on port 5173...
start "React Client" cmd /k "cd client && npm run dev"
timeout /t 2 /nobreak >nul

echo.
echo ════════════════════════════════════════════
echo ✓ All services starting in separate windows!
echo ════════════════════════════════════════════
echo.
echo 📍 URLs:
echo    🌐 Client:        http://localhost:5173
echo    🔌 API Server:    http://localhost:3001
echo    🌍 GeoAI Service: http://localhost:8002
echo.
echo 📚 GeoAnalytics Tab: http://localhost:5173/geoanalytics
echo.
echo Close windows to stop services...
echo.
pause
