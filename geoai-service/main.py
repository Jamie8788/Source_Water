"""
Honest GeoAI microservice.

This service only returns computed outputs for endpoints that actually process data.
Each response contains explicit mode and implementation_status fields.
"""

import logging
import os
import time
import uuid
from datetime import datetime
from typing import Dict, List, Tuple

import numpy as np
import planetary_computer
import rasterio
from dotenv import load_dotenv
from flask import Flask, jsonify, request, url_for
from flask_cors import CORS
from PIL import Image, ImageFilter
from pyproj import Transformer
from pystac_client import Client
from rasterio.windows import Window

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("geoai-service")

API_VERSION = "3.0.0"
COLLECTION = "sentinel-2-l2a"
PC_STAC_URL = "https://planetarycomputer.microsoft.com/api/stac/v1"
DEFAULT_PATCH_SIZE = 256
VISUAL_SCALE = 2

app = Flask(__name__, static_folder="static", static_url_path="/static")
CORS(app)

OUTPUT_DIR = os.path.join(app.static_folder, "outputs")
os.makedirs(OUTPUT_DIR, exist_ok=True)


def _safe_float(v, fallback=0.0):
    try:
        return float(v)
    except Exception:
        return float(fallback)


def _validate_point(lat: float, lon: float) -> None:
    if not (-90 <= lat <= 90):
        raise ValueError("latitude must be between -90 and 90")
    if not (-180 <= lon <= 180):
        raise ValueError("longitude must be between -180 and 180")


def _now_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _season(date_iso: str, lat: float) -> str:
    month = datetime.fromisoformat(date_iso).month
    # Meteorological seasons; reversed labels for southern hemisphere.
    north = {
        12: "winter",
        1: "winter",
        2: "winter",
        3: "spring",
        4: "spring",
        5: "spring",
        6: "summer",
        7: "summer",
        8: "summer",
        9: "autumn",
        10: "autumn",
        11: "autumn",
    }
    south = {
        12: "summer",
        1: "summer",
        2: "summer",
        3: "autumn",
        4: "autumn",
        5: "autumn",
        6: "winter",
        7: "winter",
        8: "winter",
        9: "spring",
        10: "spring",
        11: "spring",
    }
    return (north if lat >= 0 else south)[month]


def _search_items(lat: float, lon: float, start_date: str, end_date: str, max_cloud_cover: float):
    client = Client.open(PC_STAC_URL)
    search = client.search(
        collections=[COLLECTION],
        intersects={"type": "Point", "coordinates": [lon, lat]},
        datetime=f"{start_date}/{end_date}",
        query={"eo:cloud_cover": {"lt": max_cloud_cover}},
        limit=24,
    )
    items = list(search.items())
    items.sort(key=lambda i: i.properties.get("eo:cloud_cover", 100.0))
    return items


def _read_band_patch(asset_href: str, lon: float, lat: float, patch_size: int = DEFAULT_PATCH_SIZE):
    with rasterio.open(asset_href) as src:
        transformer = Transformer.from_crs("EPSG:4326", src.crs, always_xy=True)
        x, y = transformer.transform(lon, lat)
        row, col = src.index(x, y)
        half = patch_size // 2

        row_off = max(0, row - half)
        col_off = max(0, col - half)
        h = min(patch_size, max(1, src.height - row_off))
        w = min(patch_size, max(1, src.width - col_off))

        window = Window(col_off=col_off, row_off=row_off, width=w, height=h)
        arr = src.read(1, window=window, boundless=True, fill_value=np.nan).astype(np.float32)

        nodata = src.nodata
        if nodata is not None:
            arr[arr == nodata] = np.nan

        pixel_area_m2 = abs(src.transform.a * src.transform.e)
        return arr, pixel_area_m2


def _safe_divide(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    out = np.full_like(a, np.nan, dtype=np.float32)
    valid = np.isfinite(a) & np.isfinite(b) & (np.abs(b) > 1e-6)
    out[valid] = a[valid] / b[valid]
    return out


def _stretch_to_uint8(arr: np.ndarray, low=2, high=98) -> np.ndarray:
    valid = arr[np.isfinite(arr)]
    if valid.size == 0:
        return np.zeros(arr.shape, dtype=np.uint8)
    p_low = np.percentile(valid, low)
    p_high = np.percentile(valid, high)
    if p_high <= p_low:
        p_high = p_low + 1e-3
    scaled = np.clip((arr - p_low) / (p_high - p_low), 0, 1)
    scaled[~np.isfinite(scaled)] = 0
    return (scaled * 255).astype(np.uint8)


def _save_visuals(red, green, blue, ndwi, water_mask, run_id: str) -> Dict[str, str]:
    rgb = np.dstack([
        _stretch_to_uint8(red),
        _stretch_to_uint8(green),
        _stretch_to_uint8(blue),
    ])

    ndwi_norm = np.clip((ndwi + 1.0) / 2.0, 0, 1)
    ndwi_norm[~np.isfinite(ndwi_norm)] = 0
    ndwi_rgb = np.dstack([
        (1.0 - ndwi_norm) * 200,
        (1.0 - np.abs(ndwi_norm - 0.5) * 2.0) * 170,
        ndwi_norm * 255,
    ]).astype(np.uint8)

    rgb_img = Image.fromarray(rgb)
    ndwi_img = Image.fromarray(ndwi_rgb)

    # Clean mask edges for visualization only; detection mask is unchanged.
    mask_binary = (water_mask.astype(np.uint8) * 255)
    mask_alpha_img = Image.fromarray(mask_binary, mode="L").filter(ImageFilter.MedianFilter(size=3))
    mask_alpha_img = mask_alpha_img.filter(ImageFilter.GaussianBlur(radius=0.8))
    mask_alpha = np.array(mask_alpha_img, dtype=np.uint8)
    mask_alpha[mask_alpha < 40] = 0
    mask_alpha = (mask_alpha.astype(np.float32) * 0.70).astype(np.uint8)

    mask_rgba = np.zeros((*water_mask.shape, 4), dtype=np.uint8)
    mask_rgba[..., 2] = 255  # consistent blue for water overlay
    mask_rgba[..., 3] = mask_alpha
    mask_img = Image.fromarray(mask_rgba, mode="RGBA")

    if VISUAL_SCALE > 1:
        out_size = (rgb_img.width * VISUAL_SCALE, rgb_img.height * VISUAL_SCALE)
        rgb_img = rgb_img.resize(out_size, Image.Resampling.BICUBIC)
        ndwi_img = ndwi_img.resize(out_size, Image.Resampling.BICUBIC)
        mask_img = mask_img.resize(out_size, Image.Resampling.BICUBIC)

    rgb_img = rgb_img.filter(ImageFilter.UnsharpMask(radius=1.2, percent=120, threshold=3))

    rgb_name = f"{run_id}_rgb.png"
    ndwi_name = f"{run_id}_ndwi.png"
    mask_name = f"{run_id}_water_mask.png"

    rgb_img.save(os.path.join(OUTPUT_DIR, rgb_name))
    ndwi_img.save(os.path.join(OUTPUT_DIR, ndwi_name))
    mask_img.save(os.path.join(OUTPUT_DIR, mask_name))

    return {
        "rgb_preview_url": url_for("static", filename=f"outputs/{rgb_name}", _external=True),
        "ndwi_preview_url": url_for("static", filename=f"outputs/{ndwi_name}", _external=True),
        "water_mask_url": url_for("static", filename=f"outputs/{mask_name}", _external=True),
    }


def _save_wetland_visuals(red, green, blue, ndwi, wetland_mask, run_id: str) -> Dict[str, str]:
    rgb = np.dstack([
        _stretch_to_uint8(red),
        _stretch_to_uint8(green),
        _stretch_to_uint8(blue),
    ])

    ndwi_norm = np.clip((ndwi + 1.0) / 2.0, 0, 1)
    ndwi_norm[~np.isfinite(ndwi_norm)] = 0
    ndwi_rgb = np.dstack([
        (1.0 - ndwi_norm) * 200,
        (1.0 - np.abs(ndwi_norm - 0.5) * 2.0) * 170,
        ndwi_norm * 255,
    ]).astype(np.uint8)

    rgb_img = Image.fromarray(rgb)
    ndwi_img = Image.fromarray(ndwi_rgb)

    mask_binary = (wetland_mask.astype(np.uint8) * 255)
    mask_alpha_img = Image.fromarray(mask_binary, mode="L").filter(ImageFilter.MedianFilter(size=3))
    mask_alpha_img = mask_alpha_img.filter(ImageFilter.GaussianBlur(radius=0.8))
    mask_alpha = np.array(mask_alpha_img, dtype=np.uint8)
    mask_alpha[mask_alpha < 40] = 0
    mask_alpha = (mask_alpha.astype(np.float32) * 0.65).astype(np.uint8)

    mask_rgba = np.zeros((*wetland_mask.shape, 4), dtype=np.uint8)
    mask_rgba[..., 0] = 30
    mask_rgba[..., 1] = 210
    mask_rgba[..., 2] = 180
    mask_rgba[..., 3] = mask_alpha
    mask_img = Image.fromarray(mask_rgba, mode="RGBA")

    if VISUAL_SCALE > 1:
        out_size = (rgb_img.width * VISUAL_SCALE, rgb_img.height * VISUAL_SCALE)
        rgb_img = rgb_img.resize(out_size, Image.Resampling.BICUBIC)
        ndwi_img = ndwi_img.resize(out_size, Image.Resampling.BICUBIC)
        mask_img = mask_img.resize(out_size, Image.Resampling.BICUBIC)

    rgb_img = rgb_img.filter(ImageFilter.UnsharpMask(radius=1.2, percent=120, threshold=3))

    rgb_name = f"{run_id}_wetland_rgb.png"
    ndwi_name = f"{run_id}_wetland_ndwi.png"
    mask_name = f"{run_id}_wetland_mask.png"

    rgb_img.save(os.path.join(OUTPUT_DIR, rgb_name))
    ndwi_img.save(os.path.join(OUTPUT_DIR, ndwi_name))
    mask_img.save(os.path.join(OUTPUT_DIR, mask_name))

    return {
        "rgb_preview_url": url_for("static", filename=f"outputs/{rgb_name}", _external=True),
        "ndwi_preview_url": url_for("static", filename=f"outputs/{ndwi_name}", _external=True),
        "wetland_mask_url": url_for("static", filename=f"outputs/{mask_name}", _external=True),
    }


def _compute_water_from_item(item, lat: float, lon: float, patch_size: int):
    signed = planetary_computer.sign(item)
    needed_assets = {"B02": "blue", "B03": "green", "B04": "red", "B08": "nir", "B11": "swir"}
    missing = [k for k in needed_assets if k not in signed.assets]
    if missing:
        raise ValueError(f"Selected scene missing required bands: {missing}")

    bands = {}
    pixel_area_m2 = None
    for key, name in needed_assets.items():
        arr, px_area = _read_band_patch(signed.assets[key].href, lon, lat, patch_size)
        bands[name] = arr
        if pixel_area_m2 is None:
            pixel_area_m2 = px_area

    # Sentinel bands can differ in native resolution (e.g., 10m vs 20m).
    # Use common intersection window to avoid fake interpolation assumptions.
    min_h = min(v.shape[0] for v in bands.values())
    min_w = min(v.shape[1] for v in bands.values())
    bands = {k: v[:min_h, :min_w] for k, v in bands.items()}

    ndwi = _safe_divide(bands["green"] - bands["nir"], bands["green"] + bands["nir"])
    mndwi = _safe_divide(bands["green"] - bands["swir"], bands["green"] + bands["swir"])
    ndvi = _safe_divide(bands["nir"] - bands["red"], bands["nir"] + bands["red"])

    valid = np.isfinite(ndwi) & np.isfinite(mndwi) & np.isfinite(ndvi)
    water_mask = valid & ((mndwi > 0.12) | ((ndwi > 0.15) & (ndvi < 0.30)))

    water_pixels = int(np.sum(water_mask))
    area_km2 = float(water_pixels * pixel_area_m2 / 1_000_000.0)

    return {
        "bands": bands,
        "indices": {"ndwi": ndwi, "mndwi": mndwi, "ndvi": ndvi},
        "water_mask": water_mask,
        "valid_pixels": int(np.sum(valid)),
        "water_pixels": water_pixels,
        "area_km2": area_km2,
        "pixel_area_m2": float(pixel_area_m2),
    }


def _index_summary(arr: np.ndarray) -> Dict[str, float]:
    valid = arr[np.isfinite(arr)]
    if valid.size == 0:
        return {"mean": np.nan, "p10": np.nan, "p90": np.nan}
    return {
        "mean": float(np.nanmean(valid)),
        "p10": float(np.nanpercentile(valid, 10)),
        "p90": float(np.nanpercentile(valid, 90)),
    }


def _confidence_label(score: float) -> str:
    if score >= 0.78:
        return "high"
    if score >= 0.55:
        return "medium"
    return "low"


def _water_interpretation(area_km2: float, confidence: str, water_pixels: int, valid_pixels: int) -> str:
    coverage = (water_pixels / valid_pixels) if valid_pixels else 0.0
    if area_km2 <= 0 or water_pixels == 0:
        return "No clear open water signal detected in the selected scene patch."
    if coverage >= 0.65:
        return f"Strong open-water signal with {confidence} confidence."
    if coverage >= 0.25:
        return f"Clear mixed water/shoreline signal with {confidence} confidence."
    return f"Small but real open-water signal with {confidence} confidence."


def _wetland_classification(wetland_area_km2: float, wetland_pixels: int, valid_pixels: int) -> str:
    coverage = (wetland_pixels / valid_pixels) if valid_pixels else 0.0
    if wetland_area_km2 <= 0 or wetland_pixels == 0:
        return "no significant wetland"
    if coverage < 0.03:
        return "small wetland signal"
    if coverage < 0.12:
        return "moderate wetland presence"
    return "strong wetland presence"


def _quality_label(ndwi_value: float, turbidity_value: float) -> str:
    if ndwi_value > 0.2 and turbidity_value < 0.9:
        return "Good"
    if ndwi_value > 0.0 and turbidity_value <= 1.2:
        return "Moderate"
    return "Poor"


def _seasonal_warning(lat: float, scene_date: str) -> str | None:
    season = _season(scene_date, lat)
    if season == "winter":
        return "Seasonal warning: winter/ice/snow can bias spectral water interpretation."
    return None


def _pixel_resolution_m(pixel_area_m2: float) -> float:
    return round(float(np.sqrt(pixel_area_m2)), 3)


def _quality_warnings(lat: float, scene_date: str, ndvi_mean: float, cloud_cover: float, scene_count: int) -> List[str]:
    warnings = []
    if scene_count < 2:
        warnings.append("Low scene availability in requested date range; robustness is reduced.")
    if cloud_cover > 20:
        warnings.append("Selected scene cloud cover is high; water area may be underestimated.")
    season = _season(scene_date, lat)
    if season == "winter":
        warnings.append("Winter season detected; snow/ice can bias spectral water metrics.")
    if abs(lat) >= 60 and season == "winter" and ndvi_mean > 0.55:
        warnings.append("Impossible-output check: unusually high NDVI for Arctic/sub-Arctic winter; review result.")
    return warnings


def _stac_item_to_dict(item):
    return {
        "id": item.id,
        "datetime": item.datetime.isoformat() if item.datetime else None,
        "cloud_cover": item.properties.get("eo:cloud_cover"),
        "collection": item.collection_id,
        "platform": item.properties.get("platform"),
    }


@app.route("/", methods=["GET", "HEAD"])
def root():
    return jsonify(
        {
            "service": "source-water-geoai",
            "status": "ok",
            "api_version": API_VERSION,
            "processing_mode": "mixed",
            "message": "Use /health and /capabilities for service metadata.",
        }
    )


@app.route("/health", methods=["GET"])
def health():
    return jsonify(
        {
            "status": "healthy",
            "service": "geoai-service",
            "timestamp": _now_iso(),
            "api_version": API_VERSION,
        }
    )


@app.route("/capabilities", methods=["GET"])
def capabilities():
    return jsonify(
        {
            "service": "source-water-geoai",
            "api_version": API_VERSION,
            "endpoints": {
                "detect-water": {
                    "mode": "rule_based",
                    "implementation_status": "real_computed",
                    "summary": "Sentinel-2 spectral water detection with NDWI/MNDWI thresholds",
                },
                "map-wetlands": {
                    "mode": "rule_based",
                    "implementation_status": "real_computed",
                    "summary": "Spectral wetland detection from NDWI and NDVI",
                },
                "detect-changes": {
                    "mode": "rule_based",
                    "implementation_status": "real_computed",
                    "summary": "Multi-temporal spectral change analysis",
                },
                "predict-quality": {
                    "mode": "rule_based",
                    "implementation_status": "real_computed",
                    "summary": "AI-assisted spectral water quality estimation from NDWI/NDVI/turbidity proxy",
                },
                "classify-landcover": {
                    "mode": "demo_placeholder",
                    "implementation_status": "not_implemented",
                    "summary": "Disabled until verified land-cover model inference path is wired",
                },
                "download-sentinel": {
                    "mode": "real_computed",
                    "implementation_status": "real_computed",
                    "summary": "Live STAC search for Sentinel-2 scenes",
                },
            },
        }
    )


@app.route("/api/geoai/download-sentinel", methods=["POST"])
def download_sentinel():
    started = time.time()
    payload = request.get_json(silent=True) or {}

    lat = _safe_float(payload.get("latitude"))
    lon = _safe_float(payload.get("longitude"))
    start_date = payload.get("date_start")
    end_date = payload.get("date_end")
    cloud = _safe_float(payload.get("max_cloud_cover", 20), 20)

    _validate_point(lat, lon)
    if not start_date or not end_date:
        raise ValueError("date_start and date_end are required")

    items = _search_items(lat, lon, start_date, end_date, cloud)

    duration = round(time.time() - started, 3)
    return jsonify(
        {
            "status": "success",
            "mode": "real_computed",
            "processing_mode": "real_computed",
            "implementation_status": "real_computed",
            "api_version": API_VERSION,
            "imagery_source": {
                "stac_api": PC_STAC_URL,
                "collection": COLLECTION,
            },
            "request": {
                "latitude": lat,
                "longitude": lon,
                "date_start": start_date,
                "date_end": end_date,
                "max_cloud_cover": cloud,
            },
            "scene_count": len(items),
            "scenes": [_stac_item_to_dict(i) for i in items[:20]],
            "warnings": ["No scenes found for filter constraints."] if not items else [],
            "processing_summary": {
                "duration_seconds": duration,
                "scene_ids": [i.id for i in items[:20]],
            },
        }
    )


@app.route("/api/geoai/detect-water", methods=["POST"])
def detect_water():
    started = time.time()
    payload = request.get_json(silent=True) or {}

    lat = _safe_float(payload.get("latitude"))
    lon = _safe_float(payload.get("longitude"))
    start_date = payload.get("date_start")
    end_date = payload.get("date_end")
    cloud = _safe_float(payload.get("max_cloud_cover", 20), 20)
    patch_size = int(payload.get("patch_size", DEFAULT_PATCH_SIZE))

    _validate_point(lat, lon)
    if not start_date or not end_date:
        raise ValueError("date_start and date_end are required")

    logger.info(
        "water_request lat=%s lon=%s start=%s end=%s cloud=%s",
        lat,
        lon,
        start_date,
        end_date,
        cloud,
    )

    items = _search_items(lat, lon, start_date, end_date, cloud)
    if not items:
        return jsonify(
            {
                "status": "no_imagery",
                "mode": "rule_based",
                "processing_mode": "rule_based",
                "implementation_status": "real_computed",
                "api_version": API_VERSION,
                "water_detected": False,
                "area_km2": 0.0,
                "scene_count": 0,
                "warnings": ["No Sentinel-2 scenes found for this location/date/cloud filter."],
                "uncertainty": {
                    "level": "high",
                    "reasons": ["imagery_unavailable"],
                },
            }
        )

    selected = items[0]
    computed = _compute_water_from_item(selected, lat, lon, patch_size)

    ndwi_summary = _index_summary(computed["indices"]["ndwi"])
    mndwi_summary = _index_summary(computed["indices"]["mndwi"])
    ndvi_summary = _index_summary(computed["indices"]["ndvi"])

    warnings = _quality_warnings(
        lat=lat,
        scene_date=(selected.datetime.date().isoformat() if selected.datetime else start_date),
        ndvi_mean=ndvi_summary["mean"],
        cloud_cover=float(selected.properties.get("eo:cloud_cover", np.nan)),
        scene_count=len(items),
    )

    run_id = uuid.uuid4().hex[:10]
    visuals = _save_visuals(
        red=computed["bands"]["red"],
        green=computed["bands"]["green"],
        blue=computed["bands"]["blue"],
        ndwi=computed["indices"]["ndwi"],
        water_mask=computed["water_mask"],
        run_id=run_id,
    )

    scene_date = selected.datetime.date().isoformat() if selected.datetime else start_date
    signal_strength = float(np.nanmean(np.clip(np.nan_to_num(computed["indices"]["ndwi"], nan=-1.0), 0.0, 1.0)[computed["water_mask"]])) if np.any(computed["water_mask"]) else 0.0
    confidence_score = float(
        np.clip(
            0.42
            + min(len(items), 8) * 0.05
            + min(float(computed["valid_pixels"]) / float(max(patch_size * patch_size, 1)), 1.0) * 0.25
            + max(0.0, signal_strength) * 0.18
            - max(0.0, float(selected.properties.get("eo:cloud_cover", 20.0)) / 100.0) * 0.18,
            0.0,
            1.0,
        )
    )
    confidence = _confidence_label(confidence_score)

    confidence_basis = {
        "scene_count": len(items),
        "selected_scene_cloud_cover": selected.properties.get("eo:cloud_cover"),
        "valid_pixel_ratio": (
            float(computed["valid_pixels"] / (patch_size * patch_size)) if patch_size > 0 else None
        ),
        "note": "No ML confidence score is used; basis is scene quality and valid-pixel coverage.",
    }

    duration = round(time.time() - started, 3)
    interpretation = _water_interpretation(computed["area_km2"], confidence, computed["water_pixels"], computed["valid_pixels"])
    seasonal_warning = _seasonal_warning(lat, scene_date)
    limitations = [
        "Spectral water detection only; not a bathymetry or flood-depth product.",
    ]
    if seasonal_warning:
        limitations.append(seasonal_warning)

    return jsonify(
        {
            "status": "success",
            "mode": "rule_based",
            "processing_mode": "rule_based",
            "implementation_status": "real_computed",
            "api_version": API_VERSION,
            "method": "rule_based spectral water detection",
            "summary_message": interpretation,
            "interpretation": interpretation,
            "plain_language_summary": interpretation,
            "confidence_label": confidence,
            "confidence_score": round(confidence_score, 3),
            "water_detected": bool(computed["water_pixels"] > 0),
            "area_km2": round(computed["area_km2"], 6),
            "scenes_used": len(items),
            "composite_mode": "single_scene_min_cloud",
            "pixel_resolution_m": _pixel_resolution_m(computed["pixel_area_m2"]),
            "spectral_indices": {
                "ndwi": ndwi_summary,
                "mndwi": mndwi_summary,
                "ndvi": ndvi_summary,
            },
            "threshold_info": {
                "water_rule": "(MNDWI > 0.12) OR (NDWI > 0.15 AND NDVI < 0.30)",
                "index_formulas": {
                    "ndwi": "(Green - NIR) / (Green + NIR)",
                    "mndwi": "(Green - SWIR1) / (Green + SWIR1)",
                    "ndvi": "(NIR - Red) / (NIR + Red)",
                },
            },
            "imagery_source": {
                "collection": COLLECTION,
                "stac_api": PC_STAC_URL,
                "selected_scene": _stac_item_to_dict(selected),
                "scene_count": len(items),
                "scene_date": scene_date,
                "scene_ids": [i.id for i in items[:12]],
                "cloud_filter": cloud,
                "composite_mode": "single_scene_min_cloud",
                "pixel_resolution_m": _pixel_resolution_m(computed["pixel_area_m2"]),
            },
            "visual_validation": visuals,
            "rgb_image": visuals["rgb_preview_url"],
            "water_mask_image": visuals["water_mask_url"],
            "ndwi_visual": visuals["ndwi_preview_url"],
            "technical_summary": {
                "ndwi_mean": ndwi_summary["mean"],
                "mndwi_mean": mndwi_summary["mean"],
                "ndvi_mean": ndvi_summary["mean"],
                "water_pixels": computed["water_pixels"],
                "valid_pixels": computed["valid_pixels"],
                "signal_strength": round(signal_strength, 6),
            },
            "warnings": warnings,
            "limitations": limitations,
            "confidence_basis": confidence_basis,
            "uncertainty": {
                "level": confidence,
                "reasons": ["seasonal_effects"] if warnings else [],
            },
            "processing_summary": {
                "duration_seconds": duration,
                "patch_size_px": patch_size,
                "water_pixels": computed["water_pixels"],
                "valid_pixels": computed["valid_pixels"],
            },
        }
    )


@app.route("/api/geoai/map-wetlands", methods=["POST"])
def map_wetlands():
    started = time.time()
    payload = request.get_json(silent=True) or {}
    lat = _safe_float(payload.get("latitude"))
    lon = _safe_float(payload.get("longitude"))
    start_date = payload.get("date_start")
    end_date = payload.get("date_end")
    cloud = _safe_float(payload.get("max_cloud_cover", 20), 20)

    _validate_point(lat, lon)
    if not start_date or not end_date:
        end_date = datetime.utcnow().date().isoformat()
        start_date = (datetime.utcnow().date().replace(day=1)).isoformat()

    items = _search_items(lat, lon, start_date, end_date, cloud)
    if not items:
        return jsonify(
            {
                "status": "no_imagery",
                "mode": "rule_based",
                "processing_mode": "rule_based",
                "implementation_status": "real_computed",
                "api_version": API_VERSION,
                "classification": "non-wetland",
                "wetland_area": 0.0,
                "wetland_presence": False,
                "warnings": ["No scenes found. Wetland detection could not run."],
            }
        )

    selected = items[0]
    computed = _compute_water_from_item(selected, lat, lon, DEFAULT_PATCH_SIZE)
    ndwi = computed["indices"]["ndwi"]
    ndvi = computed["indices"]["ndvi"]
    valid = np.isfinite(ndvi) & np.isfinite(ndwi)
    wetland_mask = valid & (ndwi > 0.0) & (ndvi > 0.2)

    wetland_pixels = int(np.sum(wetland_mask))
    wetland_area_km2 = float(wetland_pixels * computed["pixel_area_m2"] / 1_000_000.0)
    wetland_presence = wetland_pixels > 0
    wetland_classification = _wetland_classification(wetland_area_km2, wetland_pixels, computed["valid_pixels"])
    wetland_significant = wetland_pixels >= 25 and wetland_area_km2 >= 0.0009

    run_id = uuid.uuid4().hex[:10]
    visuals = _save_wetland_visuals(
        red=computed["bands"]["red"],
        green=computed["bands"]["green"],
        blue=computed["bands"]["blue"],
        ndwi=ndwi,
        wetland_mask=wetland_mask,
        run_id=run_id,
    )

    duration = round(time.time() - started, 3)
    scene_date = selected.datetime.date().isoformat() if selected.datetime else start_date
    signal_strength = float(np.nanmean(np.clip(np.nan_to_num(ndwi, nan=-1.0), 0.0, 1.0)[wetland_mask])) if np.any(wetland_mask) else 0.0
    confidence_score = float(
        np.clip(
            0.35
            + min(len(items), 8) * 0.04
            + min(float(computed["valid_pixels"]) / float(max(DEFAULT_PATCH_SIZE * DEFAULT_PATCH_SIZE, 1)), 1.0) * 0.20
            + max(0.0, signal_strength) * 0.20
            + min(wetland_area_km2 * 120.0, 0.15)
            - max(0.0, float(selected.properties.get("eo:cloud_cover", 20.0)) / 100.0) * 0.10,
            0.0,
            1.0,
        )
    )
    confidence = _confidence_label(confidence_score)
    seasonal_warning = _seasonal_warning(lat, scene_date)
    limitations = [
        "Spectral wetland proxy only; not a validated habitat classification model.",
        "Very small detections are down-weighted to avoid over-interpreting isolated pixels.",
    ]
    if seasonal_warning:
        limitations.append(seasonal_warning)

    summary_message = f"{wetland_classification.capitalize()} with {confidence} confidence."

    return jsonify(
        {
            "status": "success",
            "mode": "rule_based",
            "processing_mode": "rule_based",
            "implementation_status": "real_computed",
            "api_version": API_VERSION,
            "method": "spectral wetland detection",
            "summary_message": summary_message,
            "interpretation": summary_message,
            "plain_language_summary": summary_message,
            "confidence_label": confidence,
            "confidence_score": round(confidence_score, 3),
            "heuristic": "wetland := (NDWI > 0.0) AND (NDVI > 0.2)",
            "classification": "wetland" if wetland_presence else "non-wetland",
            "wetland_presence": wetland_presence,
            "wetland_significant": wetland_significant,
            "wetland_area": round(wetland_area_km2, 6),
            "wetland_area_km2": round(wetland_area_km2, 6),
            "scenes_used": len(items),
            "composite_mode": "single_scene_min_cloud",
            "pixel_resolution_m": _pixel_resolution_m(computed["pixel_area_m2"]),
            "imagery_source": {
                "collection": COLLECTION,
                "stac_api": PC_STAC_URL,
                "selected_scene": _stac_item_to_dict(selected),
                "scene_count": len(items),
                "scene_date": scene_date,
            },
            "rgb_image": visuals["rgb_preview_url"],
            "overlay_image": visuals["wetland_mask_url"],
            "wetland_overlay_image": visuals["wetland_mask_url"],
            "overlay_label": "Wetland Overlay",
            "ndwi_visual": visuals["ndwi_preview_url"],
            "visual_validation": visuals,
            "warnings": [
                "Computed from spectral indices only (no ML wetland model).",
            ],
            "limitations": limitations,
            "processing_summary": {
                "duration_seconds": duration,
                "wetland_pixels": wetland_pixels,
                "valid_pixels": computed["valid_pixels"],
                "significance_threshold_pixels": 25,
                "significance_threshold_area_km2": 0.0009,
                "wetland_classification": wetland_classification,
            },
        }
    )


@app.route("/api/geoai/detect-changes", methods=["POST"])
def detect_changes():
    started = time.time()
    payload = request.get_json(silent=True) or {}

    lat = _safe_float(payload.get("latitude"))
    lon = _safe_float(payload.get("longitude"))
    period_a_start = payload.get("period_a_start") or payload.get("date_start")
    period_a_end = payload.get("period_a_end")
    period_b_start = payload.get("period_b_start")
    period_b_end = payload.get("period_b_end") or payload.get("date_end")
    cloud = _safe_float(payload.get("max_cloud_cover", 20), 20)

    _validate_point(lat, lon)
    if period_a_start and period_b_end and (not period_a_end or not period_b_start):
        a_start_dt = datetime.fromisoformat(period_a_start)
        b_end_dt = datetime.fromisoformat(period_b_end)
        midpoint = a_start_dt + (b_end_dt - a_start_dt) / 2
        period_a_end = period_a_end or midpoint.date().isoformat()
        period_b_start = period_b_start or midpoint.date().isoformat()

    if not (period_a_start and period_a_end and period_b_start and period_b_end):
        raise ValueError("period_a_start, period_a_end, period_b_start, period_b_end are required")

    items_a = _search_items(lat, lon, period_a_start, period_a_end, cloud)
    items_b = _search_items(lat, lon, period_b_start, period_b_end, cloud)

    if not items_a or not items_b:
        return jsonify(
            {
                "status": "insufficient_imagery",
                "mode": "rule_based",
                "processing_mode": "rule_based",
                "implementation_status": "real_computed",
                "api_version": API_VERSION,
                "warnings": ["One or both periods returned no scenes."],
            }
        )

    a = _compute_water_from_item(items_a[0], lat, lon, DEFAULT_PATCH_SIZE)
    b = _compute_water_from_item(items_b[0], lat, lon, DEFAULT_PATCH_SIZE)

    area_a = a["area_km2"]
    area_b = b["area_km2"]
    delta = area_b - area_a

    before_after = {
        "period_a_scene": _stac_item_to_dict(items_a[0]),
        "period_b_scene": _stac_item_to_dict(items_b[0]),
        "water_area_period_a_km2": round(area_a, 6),
        "water_area_period_b_km2": round(area_b, 6),
        "change_km2": round(delta, 6),
        "change_percent": round((delta / area_a) * 100.0, 3) if area_a > 0 else None,
    }

    run_id = uuid.uuid4().hex[:10]
    visuals_a = _save_visuals(
        red=a["bands"]["red"],
        green=a["bands"]["green"],
        blue=a["bands"]["blue"],
        ndwi=a["indices"]["ndwi"],
        water_mask=a["water_mask"],
        run_id=f"{run_id}_a",
    )
    visuals_b = _save_visuals(
        red=b["bands"]["red"],
        green=b["bands"]["green"],
        blue=b["bands"]["blue"],
        ndwi=b["indices"]["ndwi"],
        water_mask=b["water_mask"],
        run_id=f"{run_id}_b",
    )

    duration = round(time.time() - started, 3)
    return jsonify(
        {
            "status": "success",
            "mode": "rule_based",
            "processing_mode": "rule_based",
            "implementation_status": "real_computed",
            "api_version": API_VERSION,
            "method": "multi-temporal spectral change analysis",
            "before_after": before_after,
            "visual_validation": {
                "period_a": visuals_a,
                "period_b": visuals_b,
            },
            "warnings": [
                "This endpoint does not use an ML change model; it compares spectral rule-based water masks.",
            ],
            "processing_summary": {
                "duration_seconds": duration,
                "scene_ids_period_a": [i.id for i in items_a[:8]],
                "scene_ids_period_b": [i.id for i in items_b[:8]],
            },
        }
    )


@app.route("/api/geoai/predict-quality", methods=["POST"])
def predict_quality():
    started = time.time()
    payload = request.get_json(silent=True) or {}

    lat = _safe_float(payload.get("latitude"))
    lon = _safe_float(payload.get("longitude"))
    start_date = payload.get("date_start")
    end_date = payload.get("date_end")
    cloud = _safe_float(payload.get("max_cloud_cover", 20), 20)

    _validate_point(lat, lon)
    if not start_date or not end_date:
        end_date = datetime.utcnow().date().isoformat()
        start_date = (datetime.utcnow().date().replace(day=1)).isoformat()

    items = _search_items(lat, lon, start_date, end_date, cloud)
    if not items:
        return jsonify(
            {
                "status": "no_imagery",
                "mode": "rule_based",
                "processing_mode": "rule_based",
                "implementation_status": "real_computed",
                "api_version": API_VERSION,
                "quality_label": "Poor",
                "ndwi": None,
                "ndvi": None,
                "turbidity_proxy": None,
                "method": "AI-assisted spectral water quality estimation",
                "warnings": ["No scenes found. Quality estimate could not run."],
            }
        )

    selected = items[0]
    computed = _compute_water_from_item(selected, lat, lon, DEFAULT_PATCH_SIZE)

    ndwi_arr = computed["indices"]["ndwi"]
    ndvi_arr = computed["indices"]["ndvi"]
    turbidity_arr = _safe_divide(computed["bands"]["red"], computed["bands"]["green"])
    valid = np.isfinite(ndwi_arr) & np.isfinite(ndvi_arr) & np.isfinite(turbidity_arr)
    focus_mask = valid & computed["water_mask"]
    if int(np.sum(focus_mask)) == 0:
        focus_mask = valid

    ndwi_value = float(np.nanmean(ndwi_arr[focus_mask])) if np.any(focus_mask) else float("nan")
    ndvi_value = float(np.nanmean(ndvi_arr[focus_mask])) if np.any(focus_mask) else float("nan")
    turbidity_value = float(np.nanmean(turbidity_arr[focus_mask])) if np.any(focus_mask) else float("nan")

    turbidity_band = "low" if turbidity_value < 0.9 else ("moderate" if turbidity_value <= 1.2 else "high")
    quality_label = _quality_label(ndwi_value, turbidity_value)
    scene_date = selected.datetime.date().isoformat() if selected.datetime else start_date
    seasonal_warning = _seasonal_warning(lat, scene_date)
    water_signal_strength = float(np.clip((ndwi_value + 0.2) / 1.2, 0.0, 1.0)) if np.isfinite(ndwi_value) else 0.0
    vegetation_context = "low" if np.isfinite(ndvi_value) and ndvi_value < 0.2 else ("moderate" if np.isfinite(ndvi_value) and ndvi_value < 0.35 else "high")
    turbidity_context = turbidity_band
    confidence_score = float(
        np.clip(
            0.40
            + min(len(items), 8) * 0.04
            + min(float(computed["valid_pixels"]) / float(max(DEFAULT_PATCH_SIZE * DEFAULT_PATCH_SIZE, 1)), 1.0) * 0.20
            + water_signal_strength * 0.20
            + (0.12 if turbidity_band == "low" else 0.05 if turbidity_band == "moderate" else -0.05)
            - max(0.0, float(selected.properties.get("eo:cloud_cover", 20.0)) / 100.0) * 0.10,
            0.0,
            1.0,
        )
    )
    confidence = _confidence_label(confidence_score)
    interpretation = f"{quality_label} satellite-derived surface condition signal with {confidence} confidence."
    limitations = [
        "This is a satellite-derived surface condition estimate, not laboratory water chemistry.",
    ]
    seasonal_warning_text = seasonal_warning
    if seasonal_warning_text:
        limitations.append(seasonal_warning_text)

    run_id = uuid.uuid4().hex[:10]
    visuals = _save_visuals(
        red=computed["bands"]["red"],
        green=computed["bands"]["green"],
        blue=computed["bands"]["blue"],
        ndwi=ndwi_arr,
        water_mask=computed["water_mask"],
        run_id=run_id,
    )

    duration = round(time.time() - started, 3)

    return jsonify(
        {
            "status": "success",
            "mode": "rule_based",
            "processing_mode": "rule_based",
            "implementation_status": "real_computed",
            "api_version": API_VERSION,
            "method": "AI-assisted spectral water quality estimation",
            "summary_message": interpretation,
            "interpretation": interpretation,
            "plain_language_summary": interpretation,
            "confidence_label": confidence,
            "confidence_score": round(confidence_score, 3),
            "quality_label": quality_label,
            "classification": quality_label,
            "ndwi": round(ndwi_value, 6),
            "ndvi": round(ndvi_value, 6),
            "turbidity_proxy": round(turbidity_value, 6),
            "water_signal_strength": round(water_signal_strength, 6),
            "vegetation_context": vegetation_context,
            "turbidity_context": turbidity_context,
            "imagery_source": {
                "collection": COLLECTION,
                "stac_api": PC_STAC_URL,
                "selected_scene": _stac_item_to_dict(selected),
                "scene_count": len(items),
                "scene_date": scene_date,
                "cloud_filter": cloud,
                "composite_mode": "single_scene_min_cloud",
                "pixel_resolution_m": _pixel_resolution_m(computed["pixel_area_m2"]),
            },
            "rgb_image": visuals["rgb_preview_url"],
            "water_mask_image": visuals["water_mask_url"],
            "overlay_image": visuals["water_mask_url"],
            "overlay_label": "Water Overlay",
            "ndwi_visual": visuals["ndwi_preview_url"],
            "visual_validation": visuals,
            "warnings": [
                "Quality is a spectral proxy estimate and not a laboratory water test.",
            ],
            "limitations": limitations,
            "seasonal_warning": seasonal_warning_text,
            "processing_summary": {
                "duration_seconds": duration,
                "focus_pixels": int(np.sum(focus_mask)),
                "turbidity_band": turbidity_band,
                "water_signal_strength": round(water_signal_strength, 6),
            },
        }
    )


@app.route("/api/geoai/classify-landcover", methods=["POST"])
def classify_landcover():
    return (
        jsonify(
            {
                "status": "not_implemented",
                "mode": "demo_placeholder",
                "processing_mode": "demo_placeholder",
                "implementation_status": "not_implemented",
                "api_version": API_VERSION,
                "message": "Land-cover classification is disabled until a verified model inference path is wired.",
                "warnings": ["No land-cover classes were computed."],
            }
        ),
        501,
    )


@app.errorhandler(Exception)
def handle_error(exc):
    logger.exception("request_failed: %s", exc)
    return (
        jsonify(
            {
                "status": "failed",
                "mode": "real_computed",
                "implementation_status": "real_computed",
                "api_version": API_VERSION,
                "error": str(exc),
            }
        ),
        400,
    )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    logger.info("GeoAI service starting on port %s", port)
    app.run(host="0.0.0.0", port=port, debug=False)
