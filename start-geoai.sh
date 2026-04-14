#!/bin/bash
# Start script for full GeoAI integration
# Runs: Main Node server + GeoAI Python service + React client

set -e

echo "🚀 Starting Full GeoAI Stack..."
echo ""

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Kill existing processes on ports
echo "${BLUE}Cleaning up existing processes...${NC}"
pkill -f "node.*server" || true
pkill -f "python.*main.py" || true
pkill -f "vite" || true
sleep 2

# 1. Start GeoAI Service (Python)
echo "${BLUE}1️⃣  Starting GeoAI Service (port 8002)...${NC}"
cd geoai-service
python main.py &
GEOAI_PID=$!
echo "${GREEN}✓ GeoAI Service running (PID: $GEOAI_PID)${NC}"
sleep 2

# 2. Start Node Server
echo "${BLUE}2️⃣  Starting Node Server (port 3001)...${NC}"
cd ../server
npm run dev &
NODE_PID=$!
echo "${GREEN}✓ Node Server running (PID: $NODE_PID)${NC}"
sleep 3

# 3. Start React Client
echo "${BLUE}3️⃣  Starting React Client (port 5173)...${NC}"
cd ../client
npm run dev &
REACT_PID=$!
echo "${GREEN}✓ React Client running (PID: $REACT_PID)${NC}"
sleep 2

echo ""
echo "${GREEN}═══════════════════════════════════════════${NC}"
echo "${GREEN}✓ All services started successfully!${NC}"
echo "${GREEN}═══════════════════════════════════════════${NC}"
echo ""
echo "📍 URLs:"
echo "   🌐 Client:        http://localhost:5173"
echo "   🔌 API Server:    http://localhost:3001"
echo "   🌍 GeoAI Service: http://localhost:8002"
echo ""
echo "📚 GeoAnalytics Tab: http://localhost:5173/geoanalytics"
echo ""
echo "Press Ctrl+C to stop all services..."
echo ""

# Wait for all processes
wait
