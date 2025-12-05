@echo off
ECHO ======================================================
ECHO         VAULT Development Environment Startup
ECHO ======================================================

:: --- Check if running from project root ---
IF NOT EXIST "backend\package.json" (
  ECHO ERROR: This script must be run from the project root directory.
  ECHO Current directory: %CD%
  PAUSE
  EXIT /B 1
)

ECHO Starting all backend services...

:: --- Terminal 1: Redis Server (Broker) ---
ECHO 1. Starting Redis Server...
START "Redis Server" cmd /k "echo Starting Redis... && redis-server"
TIMEOUT /T 2 /NOBREAK > NUL

:: --- Terminal 2: Python Embedder API (Port 8001) ---
ECHO 2. Starting Python Embedder API (Port 8001)...
START "Embedder API (Port 8001)" cmd /k "cd backend && echo Activating Python env... && .\ml_env\Scripts\activate && echo Starting Embedder... && python embedder.py"

:: --- Terminal 3: Python Parser API (Port 8002) ---
ECHO 3. Starting Python Parser API (Port 8002)...
START "Parser API (Port 8002)" cmd /k "cd backend && echo Activating Python env... && .\ml_env\Scripts\activate && echo Starting Parser... && python parser.py"

:: --- Terminal 4: Node.js Web Server (Express API, Port 5000) ---
ECHO 4. Starting Node.js Web Server (Main API)...
START "Web Server (Express/Socket.io)" cmd /k "cd backend && echo Installing dependencies... && npm install && echo Starting server... && node index.js"

:: --- Terminal 5: Node.js Worker (BullMQ Consumer) ---
ECHO 5. Starting Node.js Worker (BullMQ Job Consumer)...
START "BullMQ Worker" cmd /k "cd backend && echo Starting worker... && node worker.js"

ECHO ======================================================
ECHO All 5 backend services launched successfully!
ECHO.
ECHO IMPORTANT: Make sure PostgreSQL is running separately.
ECHO.
ECHO Now start the React frontend in a NEW terminal:
ECHO   cd frontend
ECHO   npm start
ECHO ======================================================

PAUSE