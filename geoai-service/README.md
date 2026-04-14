# GeoAI Microservice

**Fully isolated** geospatial ML service for water quality analysis, satellite detection, and geographic data processing.

## Features

- 🛰️ **Water Detection** — Find water bodies in satellite imagery
- 🌿 **Wetland Mapping** — Classify and map wetland areas  
- 📊 **Change Detection** — Track water level changes over time
- 🔮 **Quality Prediction** — ML-based water quality forecasting
- 🗺️ **Land Cover Classification** — Classify terrain types
- ⬇️ **Sentinel-2 Downloads** — Fetch satellite imagery

## Setup

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with any API keys (optional)
```

### 3. Run Locally
```bash
python main.py
```

Service will start on `http://localhost:8002`

Health check: `curl http://localhost:8002/health`

## API Endpoints

### Water Detection
```bash
POST /api/geoai/detect-water
{
  "latitude": 46.5,
  "longitude": -84.3,
  "date_start": "2024-01-01",
  "date_end": "2024-03-31"
}
```

### Wetland Mapping
```bash
POST /api/geoai/map-wetlands
{
  "latitude": 46.5,
  "longitude": -84.3,
  "area_km_radius": 5
}
```

### Change Detection
```bash
POST /api/geoai/detect-changes
{
  "latitude": 46.5,
  "longitude": -84.3,
  "date_start": "2023-01-01",
  "date_end": "2024-01-01",
  "comparison_interval": "monthly"
}
```

### Quality Prediction
```bash
POST /api/geoai/predict-quality
{
  "latitude": 46.5,
  "longitude": -84.3,
  "historical_observations": [...]
}
```

### Land Cover Classification
```bash
POST /api/geoai/classify-landcover
{
  "latitude": 46.5,
  "longitude": -84.3,
  "zoom_level": 13
}
```

### Sentinel-2 Download
```bash
POST /api/geoai/download-sentinel
{
  "latitude": 46.5,
  "longitude": -84.3,
  "date_start": "2024-01-01",
  "date_end": "2024-03-31",
  "max_cloud_cover": 20
}
```

## Architecture

- **Isolation** — Runs as separate process/container from main app
- **No Database Access** — Doesn't touch existing user data
- **Stateless** — Can scale horizontally
- **Flask-based** — Same framework as analysis-service for consistency

## Deployment

### Local Docker
```bash
docker build -t geoai-service .
docker run -p 8002:8002 geoai-service
```

### With Docker Compose (add to docker-compose.yml)
```yaml
geoai-service:
  build: ./geoai-service
  ports:
    - "8002:8002"
  environment:
    - DEBUG=False
    - GEOAI_PORT=8002
```

### Production (Render, Fly.io, etc.)
- Set `GEOAI_PORT` via environment variables
- Update main server proxy to point to deployed service URL

## Integration with Main Server

The main Express server proxies requests:

```javascript
// server/routes/geoai.js
const geoaiUrl = process.env.GEOAI_SERVICE_URL || 'http://localhost:8002'

app.post('/api/geoai/*', (req, res) => {
  proxy.web(req, res, { target: geoaiUrl })
})
```

**Zero impact on existing endpoints** — new routes don't touch old code.

## Future Enhancements

- [ ] Integrate actual GeoAI library (currently placeholder)
- [ ] Add Sentinel Hub real satellite downloads
- [ ] Fine-tune ML models on Missanabie water data
- [ ] Support for aerial drone imagery
- [ ] WebSocket streaming for real-time processing
- [ ] Caching layer for repeated queries
