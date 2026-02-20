#!/bin/bash

set -e

echo "========================================"
echo " EDI - Life Manager Web"
echo " Starting Backend and Frontend..."
echo "========================================"
echo ""

# Install frontend dependencies only when needed
if [ ! -d "frontend/node_modules" ]; then
  echo "[setup] frontend/node_modules não encontrado. Executando npm install..."
  (cd frontend && npm install)
fi

# Start backend in background
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 3

# Start frontend in background
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "========================================"
echo " EDI is running!"
echo " Backend: http://localhost:8000"
echo " Frontend: http://localhost:3000"
echo " API Docs: http://localhost:8000/docs"
echo "========================================"
echo ""
echo "Press Ctrl+C to stop both servers"

# Function to kill both processes on exit
cleanup() {
    echo ""
    echo "Stopping EDI..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}

# Trap Ctrl+C
trap cleanup INT

# Wait for both processes
wait
