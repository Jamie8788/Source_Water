@echo off
echo Starting SOURCE Water services...

:: Start analysis service (Python)
start "Analysis Service (port 8001)" cmd /k "cd analysis-service && ..\\.venv\\Scripts\\uvicorn main:app --host 0.0.0.0 --port 8001 --reload"

:: Wait a moment
timeout /t 3 /nobreak >nul

:: Start Node server
start "Node Server (port 3001)" cmd /k "cd server && npm run dev"

:: Start client
start "Client (port 5173)" cmd /k "cd client && npm run dev"

echo All services started.
echo   Analysis: http://localhost:8001
echo   Server:   http://localhost:3001
echo   Client:   http://localhost:5173
