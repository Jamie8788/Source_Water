"""
SOURCE Water — Research-Grade Analysis Service
FastAPI backend with real ML/AI intelligence.
"""
import os
import json
import uuid
import asyncio
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime
from contextlib import asynccontextmanager
import httpx

from fastapi import FastAPI, UploadFile, File, HTTPException, Form, BackgroundTasks, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
import pandas as pd
import uvicorn
import math

from services.file_parser import parse_file, extract_dataframe_stats
from services.embeddings import embedding_service
from services.ml_engine import (
    detect_anomalies, compute_risk_score,
    detect_trends, assess_data_quality, WHO_THRESHOLDS, normalize_column_name
)
from services.prompts import (
    get_analysis_system_prompt, get_document_system_prompt, get_ask_user_prompt,
    get_compare_prompt, get_anomaly_explanation_prompt, get_report_prompt, get_insights_prompt
)
from services.ai_models import ai_service
from services.nasa_weather import fetch_all_research_data, RESEARCH_LOCATIONS, get_great_lakes_water_data

# ── Configuration ────────────────────────────────────────────────────────────
DATA_DIR = Path("data")
UPLOADS_DIR = DATA_DIR / "uploads"
INDEXES_DIR = DATA_DIR / "indexes"
METADATA_FILE = DATA_DIR / "files.json"

DATA_DIR.mkdir(exist_ok=True)
UPLOADS_DIR.mkdir(exist_ok=True)
INDEXES_DIR.mkdir(exist_ok=True)

# ── State ────────────────────────────────────────────────────────────────────
files_metadata: Dict[str, Any] = {}
dataframes_cache: Dict[str, pd.DataFrame] = {}

# ── Utility Functions ───────────────────────────────────────────────────────
def clean_json_value(obj):
    """Recursively clean NaN/inf/numpy types for JSON serialization."""
    import numpy as np
    if isinstance(obj, dict):
        return {str(k): clean_json_value(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_json_value(v) for v in obj]
    elif isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    elif isinstance(obj, (np.integer,)):
        return int(obj)
    elif isinstance(obj, (np.floating,)):
        v = float(obj)
        return None if (math.isnan(v) or math.isinf(v)) else v
    elif isinstance(obj, np.ndarray):
        return [clean_json_value(x) for x in obj.tolist()]
    elif isinstance(obj, np.bool_):
        return bool(obj)
    return obj

def load_metadata():
    global files_metadata
    if METADATA_FILE.exists():
        files_metadata = json.loads(METADATA_FILE.read_text())

def save_metadata():
    METADATA_FILE.write_text(json.dumps(files_metadata, indent=2, default=str))

load_metadata()

# ── Pydantic Models ──────────────────────────────────────────────────────────
class AskRequest(BaseModel):
    file_id: str
    query: str
    use_pro_model: Optional[bool] = False


class CompareRequest(BaseModel):
    file_ids: List[str]


class ReportRequest(BaseModel):
    output_format: Optional[str] = "text"  # "text" or "json"


class AnalyzeObservationsRequest(BaseModel):
    """Real ML analysis for raw water quality observations (NO FAKE DATA)"""
    observations: List[Dict[str, Any]]  # List of observation dicts with water quality parameters


# ── Keep-alive: ping self every 10 min so Render free tier never sleeps ───────
@asynccontextmanager
async def lifespan(application):
    self_url = os.getenv("RENDER_EXTERNAL_URL") or os.getenv("SELF_URL")
    task = None
    if self_url:
        async def ping():
            while True:
                await asyncio.sleep(600)
                try:
                    async with httpx.AsyncClient(timeout=10) as c:
                        await c.get(f"{self_url}/health")
                    print("[keep-alive] pinged")
                except Exception as e:
                    print(f"[keep-alive] ping failed: {e}")
        task = asyncio.create_task(ping())
        print(f"[keep-alive] started → {self_url}")
    else:
        print("[keep-alive] No RENDER_EXTERNAL_URL set — add it in Render env vars to prevent sleeping")
    yield
    if task:
        task.cancel()

# ── FastAPI App ──────────────────────────────────────────────────────────────
app = FastAPI(title="SOURCE Water Analysis Service", lifespan=lifespan)

app.add_middleware(CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"])

# ── Health Check ─────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "files_indexed": len(files_metadata),
        "provider": os.getenv("MODEL_PROVIDER", "gemini"),
        "gemini_key_present": bool(getattr(ai_service, "gemini_key", "")),
        "gemini_last_error": getattr(ai_service, "last_gemini_error", ""),
    }


# ── File Management ──────────────────────────────────────────────────────────
@app.get("/files")
async def list_files(x_user_id: Optional[str] = Header(None)):
    """List all uploaded and indexed files. Optionally filter by user_id header."""
    files = []
    for file_id, meta in files_metadata.items():
        # Filter by user if header provided
        if x_user_id and meta.get("user_id") != x_user_id:
            continue
        
        # Clean NaN/inf values from stats
        stats = clean_json_value(meta.get("stats", {}))
            
        files.append({
            "id": file_id,
            "name": meta.get("filename") or meta.get("name"),
            "filename": meta.get("filename") or meta.get("name"),
            "size": meta.get("size"),
            "uploaded_at": meta.get("uploaded_at"),
            "file_type": meta.get("file_type"),
            "ext": meta.get("file_type"),
            "status": meta.get("status", "processed"),
            "stats": stats,
        })
    # Return newest first
    files.sort(key=lambda f: f.get("uploaded_at") or "2000-01-01", reverse=True)
    return {"files": files}


@app.post("/upload")
async def upload_file(file: UploadFile = File(...), x_user_id: Optional[str] = Header(None)):
    """
    Upload and process a file.
    Parses content, builds embeddings index, computes stats/ML results.
    Optional: include x-user-id header for multi-user file organization.
    """
    try:
        file_id = str(uuid.uuid4())
        filename = file.filename
        user_id = x_user_id or "default"
        
        # Save uploaded file
        file_path = UPLOADS_DIR / f"{file_id}_{filename}"
        content = await file.read()
        file_path.write_bytes(content)
        
        # Parse file
        print(f"Parsing {filename}...")
        text, parse_metadata = parse_file(file_path)
        
        # Build embeddings index
        print(f"Building embeddings index...")
        embedding_service.build_index(file_id, text, INDEXES_DIR)
        
        # Compute stats/ML results
        print(f"Computing ML analysis...")
        
        stats = {}
        risk = {}
        anomalies = {}
        trends = {}
        quality = {}
        
        # Try to load as dataframe for numeric analysis
        df = None
        try:
            # Try various parsing strategies
            if filename.endswith(('.csv', '.xlsx')):
                if filename.endswith('.csv'):
                    df = pd.read_csv(file_path)
                else:
                    df = pd.read_excel(file_path)
            else:
                # For text files, just store the text
                pass
        except:
            pass
        
        if df is not None and len(df) > 0:
            # Compute statistics
            stats = extract_dataframe_stats(df)
            dataframes_cache[file_id] = df
            
            # Run ML analysis
            anomalies = detect_anomalies(df)
            risk = compute_risk_score(df, stats)
            trends = detect_trends(df)
            quality = assess_data_quality(df, stats)
            
            # Store dataframe info
            stats['is_numeric'] = True
        else:
            stats['is_numeric'] = False
        
        # Store metadata
        files_metadata[file_id] = {
            "id": file_id,
            "user_id": user_id,
            "filename": filename,
            "name": filename,
            "file_type": file_path.suffix.lower(),
            "size": len(content),
            "uploaded_at": datetime.now().isoformat(),
            "status": "processed",
            "parse_metadata": parse_metadata,
            "stats": stats,
            "risk": risk,
            "anomalies": anomalies,
            "trends": trends,
            "quality": quality,
        }
        
        save_metadata()
        
        print(f"File {file_id} processed successfully")

        return JSONResponse(content=clean_json_value({
            "id": file_id,
            "filename": filename,
            "name": filename,
            "size": len(content),
            "file_type": file_path.suffix.lower(),
            "uploaded_at": files_metadata[file_id]["uploaded_at"],
            "status": "processed",
            "stats": stats,
            "risk": risk,
            "anomalies": anomalies,
            "trends": trends,
            "quality": quality,
        }))
    
    except Exception as e:
        print(f"Upload error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/download/{file_id}")
async def download_original_file(file_id: str):
    """Download the original uploaded file."""
    if file_id not in files_metadata:
        raise HTTPException(status_code=404, detail="File not found")
    meta = files_metadata[file_id]
    filename = meta.get("filename", "file")
    matches = list(UPLOADS_DIR.glob(f"{file_id}_*"))
    if not matches:
        raise HTTPException(status_code=404, detail="File not found on disk")
    return FileResponse(matches[0], filename=filename, media_type="application/octet-stream")


@app.get("/export/{file_id}")
async def export_file(file_id: str, format: str = "csv"):
    """
    Export processed data as CSV or JSON.
    ?format=csv  → CSV download
    ?format=json → full JSON with stats, risk, anomalies
    """
    if file_id not in files_metadata:
        raise HTTPException(status_code=404, detail="File not found")
    meta = files_metadata[file_id]
    filename = meta.get("filename", "export")

    if format == "csv":
        # Return the original file if it's already CSV, else convert df
        if filename.endswith(".csv"):
            matches = list(UPLOADS_DIR.glob(f"{file_id}_*"))
            if matches:
                return FileResponse(matches[0], filename=filename, media_type="text/csv")
        # Convert from df
        if file_id in dataframes_cache:
            import io
            df = dataframes_cache[file_id]
            buf = io.StringIO()
            df.to_csv(buf, index=False)
            from fastapi.responses import Response
            return Response(
                content=buf.getvalue(),
                media_type="text/csv",
                headers={"Content-Disposition": f'attachment; filename="{filename}.csv"'}
            )
        raise HTTPException(status_code=400, detail="No tabular data available for CSV export")

    elif format == "json":
        payload = clean_json_value({
            "file_id": file_id,
            "filename": filename,
            "exported_at": datetime.now().isoformat(),
            "stats": meta.get("stats", {}),
            "risk": meta.get("risk", {}),
            "anomalies": meta.get("anomalies", {}),
            "trends": meta.get("trends", {}),
            "quality": meta.get("quality", {}),
        })
        import io
        from fastapi.responses import Response
        return Response(
            content=json.dumps(payload, indent=2, default=str),
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{filename}_analysis.json"'}
        )

    raise HTTPException(status_code=400, detail="Unsupported format. Use csv or json.")


@app.delete("/files/{file_id}")
async def delete_file(file_id: str):
    """Delete a file and its index."""
    try:
        if file_id not in files_metadata:
            raise HTTPException(status_code=404, detail="File not found")
        
        # Delete from disk
        for path in UPLOADS_DIR.glob(f"{file_id}_*"):
            path.unlink()
        
        embedding_service.delete_index(file_id, INDEXES_DIR)
        
        if file_id in dataframes_cache:
            del dataframes_cache[file_id]
        
        del files_metadata[file_id]
        save_metadata()
        
        return {"status": "deleted"}
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ── Analysis Endpoints ───────────────────────────────────────────────────────
@app.post("/ask")
async def ask(request: AskRequest):
    """
    RAG + ML hybrid endpoint.
    Retrieves relevant document chunks + provides ML context + calls AI model.
    """
    try:
        if request.file_id not in files_metadata:
            raise HTTPException(status_code=404, detail="File not found")
        
        file_meta = files_metadata[request.file_id]
        
        # Determine if this is a plain document (PDF/DOCX/TXT) vs numeric data (CSV/XLSX)
        stats = file_meta.get("stats", {})
        is_document_only = not stats.get("is_numeric", False)

        # Retrieve more chunks for documents, fewer for data files
        top_k = 10 if is_document_only else 5
        retrieved_chunks = embedding_service.retrieve(request.file_id, request.query, top_k=top_k)

        # Get ML results (only meaningful for numeric files)
        risk = file_meta.get("risk", {})
        anomalies = file_meta.get("anomalies", {})

        # Build prompts — use document Q&A mode for PDFs/reports, water-quality mode for data
        system_prompt = get_document_system_prompt() if is_document_only else get_analysis_system_prompt()
        user_prompt = get_ask_user_prompt(
            request.query,
            retrieved_chunks,
            stats,
            anomalies,
            risk,
            is_document_only=is_document_only,
        )
        
        # Call AI model
        response_text, model_used = await ai_service.generate_with_model(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            max_tokens=1000,
            use_pro=request.use_pro_model,
            is_document=is_document_only,
        )
        print(f"[AI] Response generated by: {model_used}")

        return {
            "response": response_text,
            "answer": response_text,
            "retrieved_chunks": retrieved_chunks,
            "model": model_used,
            "retrieved_chunks_count": len(retrieved_chunks),
        }
    
    except Exception as e:
        print(f"Ask error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# ── REAL ML ANALYSIS FOR RAW OBSERVATIONS (NO FAKE DATA) ───────────────────
@app.post("/analyze")
async def analyze_observations(request: AnalyzeObservationsRequest):
    """
    Real ML analysis for raw water quality observations.
    Runs IsolationForest anomaly detection, trend analysis, risk scoring, quality assessment.
    
    NO FAKE DATA — Uses real scikit-learn ML models on actual observations.
    
    Returns: anomalies, trends, risk_score, quality_assessment
    """
    try:
        if not request.observations or len(request.observations) == 0:
            return {
                "success": False,
                "message": "No observations provided",
                "anomalies_detected": [],
                "risk_score": 0,
            }
        
        # Convert observations to DataFrame for ML processing
        df = pd.DataFrame(request.observations)
        
        if len(df) == 0:
            return {
                "success": False,
                "message": "Could not parse observations",
                "anomalies_detected": [],
                "risk_score": 0,
            }
        
        print(f"[ML] Analyzing {len(df)} observations for real ML predictions")
        
        # Run REAL ML models — NO FAKE DATA
        anomalies_result = detect_anomalies(df)
        risk_result = compute_risk_score(df, {})
        trends_result = detect_trends(df)
        quality_result = assess_data_quality(df, {})
        
        # Extract anomalies for reporting
        anomalies_detected = []
        if anomalies_result.get('global_anomalies'):
            anomalies_detected = [f"Row {idx} is an outlier" for idx in anomalies_result['global_anomalies'][:5]]
        
        # Per-column anomalies
        for col, col_anomalies in anomalies_result.get('per_column', {}).items():
            if col_anomalies.get('outlier_count', 0) > 0:
                anomalies_detected.append(f"{col}: {col_anomalies['outlier_count']} outliers ({col_anomalies['outlier_pct']:.1f}%)")
        
        # Extract trends
        trends_found = []
        for col, trend_info in trends_result.get('per_column', {}).items():
            if trend_info.get('trend_detected'):
                direction = trend_info.get('trend_direction', 'unknown')
                strength = trend_info.get('trend_strength', 0)
                trends_found.append(f"{col}: {direction} trend (strength={strength:.2f})")
        
        risk_score = risk_result.get('score', 0)
        
        response = {
            "success": True,
            "observation_count": len(df),
            "risk_score": float(risk_score),
            "status": "critical" if risk_score > 0.7 else "warning" if risk_score > 0.4 else "active",
            "anomalies_detected": anomalies_detected[:10],  # Top 10
            "anomaly_count": len(anomalies_detected),
            "anomaly_rate": float(anomalies_result.get('anomaly_rate', 0)),
            "trends": trends_found[:5],  # Top 5 trends
            "quality_metrics": quality_result,
            "ml_models_used": [
                "IsolationForest (scikit-learn) for anomaly detection",
                "Linear trend analysis (scipy) for trend detection",
                "WHO-standard based risk scoring",
                "Data quality assessment (completeness, validity)"
            ],
            "timestamp": datetime.now().isoformat(),
            "data_integrity": "REAL ML — No synthetic or fake data",
        }
        
        print(f"[ML] Analysis complete: risk_score={risk_score}, anomalies={len(anomalies_detected)}, trends={len(trends_found)}")
        
        return response
    
    except Exception as e:
        print(f"[ML] Observation analysis error: {e}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "message": f"Analysis error: {str(e)}",
            "anomalies_detected": [],
            "risk_score": 0,
            "error": str(e)
        }


@app.post("/ml/anomaly/{file_id}")
async def analyze_anomalies(file_id: str):
    """
    Detailed anomaly analysis with AI explanation.
    """
    try:
        if file_id not in files_metadata:
            raise HTTPException(status_code=404, detail="File not found")
        
        file_meta = files_metadata[file_id]
        anomalies = file_meta.get("anomalies", {})
        stats = file_meta.get("stats", {})
        
        # Generate AI explanation
        system_prompt = get_analysis_system_prompt()
        user_prompt = get_anomaly_explanation_prompt(
            file_meta.get("filename"),
            anomalies,
            stats
        )
        
        explanation = await ai_service.generate(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            max_tokens=500
        )
        
        return {
            "anomalies": anomalies,
            "explanation": explanation,
            "timestamp": datetime.now().isoformat(),
        }
    
    except Exception as e:
        print(f"Anomaly analysis error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/compare")
async def compare_files(request: CompareRequest):
    """
    Real backend comparison of multiple files.
    Compares stats, violations, anomalies, trends, and risk scores.
    """
    try:
        if len(request.file_ids) < 2:
            raise HTTPException(status_code=400, detail="At least 2 files required")
        
        files_data = []
        for file_id in request.file_ids:
            if file_id not in files_metadata:
                raise HTTPException(status_code=404, detail=f"File {file_id} not found")
            
            meta = files_metadata[file_id]
            files_data.append({
                "id": file_id,
                "name": meta.get("filename"),
                "stats": meta.get("stats", {}),
                "risk": meta.get("risk", {}),
                "anomalies": meta.get("anomalies", {}),
            })
        
        # Build comparison matrix
        comparison = {
            "files": files_data,
            "comparison_matrix": {},
            "summary": "",
        }
        
        # Build comparison metrics
        for i, file1 in enumerate(files_data):
            for j, file2 in enumerate(files_data):
                if i >= j:
                    continue
                
                key = f"{file1['id']}_vs_{file2['id']}"
                comparison["comparison_matrix"][key] = {
                    "file1": file1['name'],
                    "file2": file2['name'],
                    "risk_delta": float(file1['risk'].get('score', 0) - file2['risk'].get('score', 0)),
                    "risk_comparison": "File 1 riskier" if file1['risk'].get('score', 0) > file2['risk'].get('score', 0) else "File 2 riskier",
                    "violations_file1": len(file1['risk'].get('violations', [])),
                    "violations_file2": len(file2['risk'].get('violations', [])),
                    "anomaly_rate_file1": file1['anomalies'].get('anomaly_rate', 0),
                    "anomaly_rate_file2": file2['anomalies'].get('anomaly_rate', 0),
                }
        
        # Generate AI summary
        if len(files_data) == 2:
            system_prompt = get_analysis_system_prompt()
            user_prompt = get_compare_prompt(
                files_data[0]['name'], files_data[0]['stats'], files_data[0]['risk'],
                files_data[1]['name'], files_data[1]['stats'], files_data[1]['risk'],
            )
            
            summary = await ai_service.generate(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                max_tokens=400
            )
            comparison["summary"] = summary
        
        return comparison
    
    except Exception as e:
        print(f"Compare error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/report/{file_id}")
async def generate_report(file_id: str, request: ReportRequest):
    """
    Generate comprehensive analysis report.
    Includes executive summary, findings, risks, recommendations.
    """
    try:
        if file_id not in files_metadata:
            raise HTTPException(status_code=404, detail="File not found")
        
        file_meta = files_metadata[file_id]
        stats = file_meta.get("stats", {})
        risk = file_meta.get("risk", {})
        anomalies = file_meta.get("anomalies", {})
        trends = file_meta.get("trends", {})
        quality = file_meta.get("quality", {})
        
        # Generate executive summary
        system_prompt = get_analysis_system_prompt()
        user_prompt = get_report_prompt(
            file_meta.get("filename"),
            stats,
            risk,
            anomalies,
            trends,
            quality
        )
        
        executive_summary = await ai_service.generate(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            max_tokens=800
        )
        
        # Generate insights
        insights_prompt = get_insights_prompt(stats, risk, anomalies, trends)
        insights = await ai_service.generate(
            system_prompt=system_prompt,
            user_prompt=insights_prompt,
            max_tokens=400
        )
        
        # Build report
        report = {
            "file_id": file_id,
            "filename": file_meta.get("filename"),
            "generated_at": datetime.now().isoformat(),
            "executive_summary": executive_summary,
            "insights": insights,
            "statistics": stats,
            "risk_assessment": risk,
            "anomaly_analysis": anomalies,
            "trend_analysis": trends,
            "data_quality": quality,
            "format": request.output_format,
        }
        
        # Format output
        if request.output_format == "json":
            return report
        else:
            # Generate text report
            text_report = f"""
SOURCE WATER QUALITY ANALYSIS REPORT
Generated: {report['generated_at']}
File: {report['filename']}

{'='*60}
EXECUTIVE SUMMARY
{'='*60}
{executive_summary}

{'='*60}
KEY INSIGHTS
{'='*60}
{insights}

{'='*60}
RISK ASSESSMENT
{'='*60}
Risk Level: {risk.get('level', 'unknown').upper()}
Risk Score: {risk.get('score', 0):.0f}/100

Violations:
{chr(10).join(f"  - {v['column']}: {v['issue']} (value: {v.get('value'):.2f})" for v in risk.get('violations', []))}

Recommendations:
{chr(10).join(f"  - {r}" for r in risk.get('recommendations', []))}

{'='*60}
DATA QUALITY
{'='*60}
Overall Score: {quality.get('overall_score', 0):.0f}/100
Missing Data Severity: {quality.get('missing_data_severity', 'unknown')}
Outlier Severity: {quality.get('outlier_severity', 'unknown')}

Issues: {', '.join(quality.get('issues', [])) if quality.get('issues') else 'None'}
Warnings: {', '.join(quality.get('warnings', [])) if quality.get('warnings') else 'None'}

{'='*60}
ANOMALIES
{'='*60}
Anomaly Rate: {anomalies.get('anomaly_rate', 0):.1f}%
Anomalies Detected: {anomalies.get('global_count', 0)}

{'='*60}
TRENDS
{'='*60}
Increasing Trends: {trends.get('increasing_trend_count', 0)}
Decreasing Trends: {trends.get('decreasing_trend_count', 0)}

{'='*60}
END REPORT
{'='*60}
"""
            return {"report": text_report.strip()}
    
    except Exception as e:
        print(f"Report generation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# ── NASA Weather & Water Research ────────────────────────────────────────────
@app.get("/weather/research-locations")
async def get_research_locations():
    """List all research locations for Great Lakes water quality monitoring."""
    return {
        "locations": list(RESEARCH_LOCATIONS.keys()),
        "count": len(RESEARCH_LOCATIONS),
        "focus": "NORDIK water research + Great Lakes system monitoring"
    }


@app.get("/weather/research/{location}")
async def get_research_weather(location: str):
    """
    Comprehensive NASA + NOAA research data for a location.
    Includes NASA POWER satellite data, NOAA weather, Great Lakes data, water quality index.
    FREE API - scales to 10K+ users.
    """
    if location not in RESEARCH_LOCATIONS:
        raise HTTPException(status_code=404, detail=f"Location not found. Available: {list(RESEARCH_LOCATIONS.keys())}")
    
    try:
        data = await fetch_all_research_data(location)
        return data
    except Exception as e:
        print(f"Weather research error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/weather/great-lakes")
async def get_great_lakes_overview():
    """
    Real-time Great Lakes system data: surface temperatures, water levels, algae risk.
    Perfect for research-level water systems analysis.
    """
    try:
        data = await get_great_lakes_water_data()
        return {
            "great_lakes_overview": data,
            "timestamp": datetime.now().isoformat(),
            "research_focus": "NORDIK Water Research",
            "regions": [
                "Superior", "Michigan", "Huron", "Erie", "Ontario",
                "St. Marys River (Sault Ste. Marie)", "Welland Canal", "St. Lawrence Seaway"
            ]
        }
    except Exception as e:
        print(f"Lakes data error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Startup/Shutdown ─────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    """Load all indexes on startup."""
    print("Starting up...")
    print(f"Model Provider: {os.getenv('MODEL_PROVIDER', 'gemini')}")
    
    for file_id in list(files_metadata.keys()):
        if not embedding_service.load_index(file_id, INDEXES_DIR):
            print(f"Could not load index for {file_id}")


@app.on_event("shutdown")
async def shutdown():
    """Cleanup on shutdown."""
    print("Shutting down...")
    await ai_service.close()


# ── Entry Point ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.getenv("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port, server_header=False)
