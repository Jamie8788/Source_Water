from __future__ import annotations

from datetime import datetime
from typing import Dict, Iterable, List, Optional


def _season(ts_iso: str) -> str:
    month = datetime.fromisoformat(ts_iso.replace("Z", "+00:00")).month
    if month in (12, 1, 2):
        return "winter"
    if month in (3, 4, 5):
        return "spring"
    if month in (6, 7, 8):
        return "summer"
    return "autumn"


def _clip01(value: float) -> float:
    return max(0.0, min(1.0, value))


def _confidence(score: float) -> str:
    if score >= 0.72:
        return "high"
    if score >= 0.46:
        return "medium"
    return "low"


def _risk_from_parameters(parameters: dict, seasonal_context: str) -> float:
    # Rule-based scoring using transparent thresholds.
    score = 0.0

    ph = parameters.get("ph")
    if ph is not None:
        if ph < 6.5 or ph > 8.5:
            score += 0.24
        elif ph < 6.8 or ph > 8.2:
            score += 0.12

    turbidity = parameters.get("turbidity")
    if turbidity is not None:
        if turbidity > 6:
            score += 0.30
        elif turbidity > 3:
            score += 0.16

    do = parameters.get("dissolved_oxygen")
    if do is not None:
        if do < 5:
            score += 0.28
        elif do < 7:
            score += 0.14

    conductivity = parameters.get("conductivity")
    if conductivity is not None:
        if conductivity > 500:
            score += 0.22
        elif conductivity > 380:
            score += 0.11

    temp = parameters.get("temperature")
    if temp is not None and seasonal_context == "summer" and temp > 22:
        score += 0.08

    return _clip01(score)


def _validation_from_satellite(satellite_context: Optional[dict], risk_score: float) -> str:
    if not satellite_context:
        return "no-satellite-context"

    ndwi = satellite_context.get("ndwi")
    cloud_cover = satellite_context.get("cloud_cover")

    if cloud_cover is not None and float(cloud_cover) > 30:
        return "uncertain"

    if ndwi is None:
        return "partial"

    ndwi = float(ndwi)
    if ndwi > 0.1 and risk_score < 0.35:
        return "aligned"
    if ndwi < 0.0 and risk_score > 0.6:
        return "disagreement"
    return "uncertain"


def _trend_prediction(risk_score: float, seasonal_context: str) -> str:
    if risk_score >= 0.65:
        return "increasing risk"
    if risk_score <= 0.25:
        return "stable"
    if seasonal_context in ("spring", "autumn"):
        return "watch seasonal transition"
    return "monitoring advised"


def enrich_observation(observation: dict, satellite_context: Optional[dict] = None) -> dict:
    params = observation.get("parameters") or {}
    season = _season(observation.get("timestamp", datetime.utcnow().isoformat() + "Z"))

    risk_score = _risk_from_parameters(params, season)
    anomaly_flag = risk_score >= 0.62
    satellite_validation = _validation_from_satellite(satellite_context, risk_score)
    trend_prediction = _trend_prediction(risk_score, season)

    # Confidence uses data completeness and satellite support when available.
    completeness = sum(v is not None for v in params.values()) / max(len(params), 1)
    sat_bonus = 0.12 if satellite_validation == "aligned" else (-0.08 if satellite_validation == "uncertain" else 0.0)
    confidence_score = _clip01(0.35 + completeness * 0.45 + sat_bonus)
    confidence_label = _confidence(confidence_score)

    if anomaly_flag:
        summary_message = "Field and model signals indicate elevated monitoring priority at this site."
    elif risk_score >= 0.35:
        summary_message = "Moderate signal detected; continue routine checks and compare with next pass."
    else:
        summary_message = "Current field signals appear stable with no immediate anomaly trigger."

    return {
        "ai_risk_score": round(risk_score, 3),
        "anomaly_flag": anomaly_flag,
        "satellite_validation": satellite_validation,
        "trend_prediction": trend_prediction,
        "confidence_label": confidence_label,
        "summary_message": summary_message,
        "methodology": "rule-based cross-signal enrichment (community parameters + optional satellite context)",
        "data_sources": ["community observations"] + (["satellite spectral context"] if satellite_context else []),
        "confidence_explanation": "Confidence increases with parameter completeness and aligned satellite context.",
        "limitations": [
            "Rule-based scoring is not a lab replacement or calibrated hydrodynamic model.",
            "Satellite cross-check can be degraded by cloud cover and revisit timing.",
        ],
        "technical_summary": "Risk score combines pH, turbidity, dissolved oxygen, conductivity, and seasonal context using deterministic thresholds.",
        "plain_language_summary": summary_message,
    }


def enrich_observations(observations: Iterable[dict], satellite_context: Optional[Dict[str, dict]] = None) -> List[dict]:
    enriched: List[dict] = []
    satellite_context = satellite_context or {}
    for obs in observations:
        obs_id = obs.get("id")
        ctx = satellite_context.get(obs_id) if obs_id else None
        enriched.append({**obs, "ai_enrichment": enrich_observation(obs, ctx)})
    return enriched
