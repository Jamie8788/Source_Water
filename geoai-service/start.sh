#!/bin/bash
# Render.com startup script for GeoAI microservice
# Properly handles PORT environment variable substitution

PORT=${PORT:-8000}
echo "Starting GeoAI service on port $PORT"
exec gunicorn -w 2 -b 0.0.0.0:$PORT main:app
