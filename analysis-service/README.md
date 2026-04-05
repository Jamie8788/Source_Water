# SOURCE Water Analysis Service

**Research-grade backend AI/ML engine for water quality analysis.**

A FastAPI application providing real intelligence for the SOURCE Water Analysis page:
- Real anomaly detection (IsolationForest)
- Risk scoring based on WHO thresholds
- Trend analysis
- RAG-based document Q&A
- Smart AI explanations (Gemini or local Ollama)
- Multi-file comparison
- Comprehensive reporting

## Quick Start

### 1. Install Dependencies

```bash
cd analysis-service
pip install -r requirements.txt
```

### 2. Configure AI Model

Edit `.env` and set your Gemini API key:

```bash
GEMINI_API_KEY=your_api_key_here
```

Get a free API key: https://aistudio.google.com/app/apikey

### 3. Run Server

```bash
python main.py
```

Server will start at `http://localhost:8001`

## API Endpoints

### Health & Files

- **GET /health** — Service status
- **GET /files** — List all uploaded files
- **POST /upload** — Upload and process a file
- **DELETE /files/{file_id}** — Delete a file

### Analysis

- **POST /ask** — Ask questions about a file (RAG + ML + AI)
- **POST /ml/anomaly/{file_id}** — Detailed anomaly analysis with AI explanation
- **POST /compare** — Compare multiple files
- **POST /report/{file_id}** — Generate comprehensive report

## File Support

- **CSV** — Analyzed as datasets with ML
- **XLSX** — Multi-sheet analysis with ML
- **PDF** — Text extraction and RAG indexing
- **DOCX** — Document parsing
- **TXT** — Text file indexing
- **JSON** — Parsed as records if possible

## Model Configuration

### Default: Gemini 2.5 Flash (Fast & Free)

Requires: `GEMINI_API_KEY` in `.env`

```env
MODEL_PROVIDER=gemini
GEMINI_API_KEY=your_key
```

### Optional: Gemini 2.5 Pro (More Capable)

For deeper analysis, frontend can request Pro mode:

```python
# In frontend request:
POST /ask
{
  "file_id": "...",
  "query": "...",
  "use_pro_model": true  # Use Pro instead of Flash
}
```

### Local: Ollama (Offline)

Requires Ollama running locally: https://ollama.com

```env
MODEL_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:30b
```

Install offline model:
```bash
ollama pull qwen3:30b
```

Other models available:
- `qwen3.5:32b` — Newer Qwen release
- `llama3.3:70b` — Strong reasoning (heavy)
- `gemma4:80b` — Newer model

Then start Ollama:
```bash
ollama serve
```

## Real ML Features

### Anomaly Detection

Uses **IsolationForest** to detect outliers in numeric data:
- Per-column analysis
- Global anomaly rate
- IQR-based statistical backup

### Risk Scoring

Combines:
- **WHO violations** (thresholds: pH, turbidity, DO, conductivity, etc.)
- **Anomaly burden**
- **Trend direction** (improving/deteriorating)
- **Data quality** (missing values, outliers)

Outputs: Risk Level (critical/elevated/moderate/low) + Score (0-100)

### Trend Detection

- Linear regression for trend slopes
- Significance testing
- Per-column trend direction
- Percentage change calculations

### Data Quality Assessment

- Missing value analysis
- Outlier severity
- Sample size validation
- Reliability scoring

## RAG + AI Hybrid

The `/ask` endpoint combines:

1. **Retrieved document chunks** (semantic search)
2. **Computed statistics** from data
3. **ML results** (anomalies, risk, trends)
4. **AI reasoning** (Gemini or Ollama)

Result: Answers grounded in data, not just hallucinations.

## Response Style

Prompting ensures responses are:
- ✅ **Concise** but not dumb
- ✅ **Grounded** in actual data
- ✅ **Sharp** and informative
- ✅ **Signal-dense** (no filler)

As per the spec: "Short doesn't mean dumb — maintain signal density."

## Environment Variables

```bash
# Required
GEMINI_API_KEY=          # Gemini API key (for gemini provider)

# Optional
MODEL_PROVIDER=gemini    # "gemini" or "ollama"
GEMINI_MODEL=gemini-2.5-flash
GEMINI_PRO_MODEL=gemini-2.5-pro
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:30b
PORT=8001
```

## Storage

Data stored in `data/` directory:
- `uploads/` — Uploaded files
- `indexes/` — FAISS indexes + chunks
- `files.json` — Metadata file

## Example Usage

### Upload a File

```bash
curl -X POST -F "file=@data.csv" http://localhost:8001/upload
```

Response:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "filename": "data.csv",
  "status": "processed",
  "stats": {...},
  "risk": {
    "score": 45,
    "level": "elevated",
    "violations": [...]
  },
  "anomalies": {
    "anomaly_rate": 8.5,
    "per_column": {...}
  }
}
```

### Ask a Question

```bash
curl -X POST http://localhost:8001/ask \
  -H "Content-Type: application/json" \
  -d '{
    "file_id": "550e8400-e29b-41d4-a716-446655440000",
    "query": "What are the key water quality concerns?",
    "use_pro_model": false
  }'
```

### Generate Report

```bash
curl -X POST http://localhost:8001/report/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -d '{"output_format": "text"}'
```

## Architecture

```
analysis-service/
├── main.py                 # FastAPI application
├── requirements.txt        # Python dependencies
├── .env                    # Environment config
├── services/
│   ├── file_parser.py     # Parse all file types
│   ├── embeddings.py      # FAISS RAG indexing
│   ├── ml_engine.py       # Real ML algorithms
│   ├── ai_models.py       # Gemini/Ollama integration
│   └── prompts.py         # Intelligent prompting
├── data/
│   ├── uploads/           # User uploaded files
│   ├── indexes/           # FAISS indexes
│   └── files.json         # Metadata
└── README.md              # This file
```

## Performance Notes

- **First request**: ~5-10s (model loading + embedding generation)
- **Subsequent requests**: ~2-3s
- **Large files** (>100MB): Processed in chunks
- **Embeddings**: Cached in FAISS for fast retrieval

## Troubleshooting

### API KEY NOT SET
```
Error: GEMINI_API_KEY not configured
```

Solution: Add your API key to `.env`:
```bash
GEMINI_API_KEY=your_actual_key
```

### Connection Refused
```
Error: Cannot connect to localhost:8001
```

Make sure server is running:
```bash
python main.py
```

### Ollama Not Found
```
Error: Ollama generation failed
```

If using Ollama, ensure it's running:
```bash
ollama serve
```

And model is available:
```bash
ollama list
```

## Contributing

This is a research-grade system. Enhancements welcome:

- Better anomaly algorithms
- Additional data quality metrics
- Custom WHO thresholds per region
- Export formats (PDF, Excel)
- Real-time streaming responses

## License

SOURCE Water — Open-source water quality intelligence.
