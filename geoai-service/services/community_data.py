from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Dict, Iterable, List, Optional, Tuple


@dataclass
class CommunityObservation:
    id: str
    lat: float
    lon: float
    timestamp: str
    parameters: Dict[str, Optional[float]]
    source: str
    organization: str
    site_name: str
    notes: str


# Seed dataset structured for extension to a live provider later.
_RAW_COMMUNITY_OBSERVATIONS: List[dict] = [
    {
        "id": "wr-like-001",
        "lat": 46.5201,
        "lon": -84.3292,
        "timestamp": "2026-04-05T14:20:00Z",
        "parameters": {
            "ph": 7.6,
            "turbidity": 2.1,
            "temperature": 8.3,
            "dissolved_oxygen": 9.8,
            "conductivity": 312.0,
        },
        "source": "community",
        "organization": "Lakewatch Sault",
        "site_name": "St. Marys Mouth",
        "notes": "Spring melt influence observed along shoreline.",
    },
    {
        "id": "wr-like-002",
        "lat": 46.3460,
        "lon": -83.9917,
        "timestamp": "2026-04-08T10:05:00Z",
        "parameters": {
            "ph": 7.2,
            "turbidity": 5.9,
            "temperature": 7.1,
            "dissolved_oxygen": 8.7,
            "conductivity": 442.0,
        },
        "source": "community",
        "organization": "North Channel Guardians",
        "site_name": "Echo Bay Inlet",
        "notes": "Turbidity spike after overnight rainfall event.",
    },
    {
        "id": "wr-like-003",
        "lat": 47.2386,
        "lon": -84.6488,
        "timestamp": "2026-04-09T12:40:00Z",
        "parameters": {
            "ph": 6.8,
            "turbidity": 3.2,
            "temperature": 5.6,
            "dissolved_oxygen": 10.4,
            "conductivity": 198.0,
        },
        "source": "community",
        "organization": "Superior Basin Collective",
        "site_name": "Batchawana River Delta",
        "notes": "Strong river discharge signal with moderate suspended sediment.",
    },
    {
        "id": "wr-like-004",
        "lat": 46.8406,
        "lon": -84.2155,
        "timestamp": "2026-04-11T16:12:00Z",
        "parameters": {
            "ph": 8.1,
            "turbidity": 1.4,
            "temperature": 6.9,
            "dissolved_oxygen": 10.1,
            "conductivity": 280.0,
        },
        "source": "community",
        "organization": "Garden River Monitors",
        "site_name": "Garden River Estuary",
        "notes": "Clear conditions, stable chemistry compared to previous week.",
    },
    {
        "id": "wr-like-005",
        "lat": 45.9290,
        "lon": -84.7268,
        "timestamp": "2026-04-12T09:35:00Z",
        "parameters": {
            "ph": 7.0,
            "turbidity": 6.8,
            "temperature": 9.2,
            "dissolved_oxygen": 7.5,
            "conductivity": 515.0,
        },
        "source": "community",
        "organization": "Straits Water Stewards",
        "site_name": "Mackinac Nearshore",
        "notes": "Reduced clarity and elevated conductivity near marina runoff.",
    },
    {
        "id": "wr-like-006",
        "lat": 44.2312,
        "lon": -76.4936,
        "timestamp": "2026-04-13T11:18:00Z",
        "parameters": {
            "ph": 7.7,
            "turbidity": 2.8,
            "temperature": 10.1,
            "dissolved_oxygen": 8.6,
            "conductivity": 362.0,
        },
        "source": "community",
        "organization": "Kingston Harbor Labs",
        "site_name": "Lake Ontario Basin Point",
        "notes": "Harbor-influenced reading; moderate nutrient concern pending follow-up.",
    },
]


def _parse_iso(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def normalize_observation(record: dict) -> dict:
    params = record.get("parameters") or {}
    return {
        "id": str(record.get("id", "")),
        "lat": float(record.get("lat", 0.0)),
        "lon": float(record.get("lon", 0.0)),
        "timestamp": str(record.get("timestamp", "")),
        "parameters": {
            "ph": _to_float(params.get("ph")),
            "turbidity": _to_float(params.get("turbidity")),
            "temperature": _to_float(params.get("temperature")),
            "dissolved_oxygen": _to_float(params.get("dissolved_oxygen")),
            "conductivity": _to_float(params.get("conductivity")),
        },
        "source": str(record.get("source", "community")),
        "organization": str(record.get("organization", "Unknown")),
        "site_name": str(record.get("site_name", "Unknown site")),
        "notes": str(record.get("notes", "")),
    }


def _to_float(value: Optional[float]) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value)
    except Exception:
        return None


def _within_bbox(lat: float, lon: float, bbox: Optional[Tuple[float, float, float, float]]) -> bool:
    if not bbox:
        return True
    min_lon, min_lat, max_lon, max_lat = bbox
    return min_lat <= lat <= max_lat and min_lon <= lon <= max_lon


def _within_dates(ts: str, start_date: Optional[str], end_date: Optional[str]) -> bool:
    if not start_date and not end_date:
        return True
    point_dt = _parse_iso(ts)
    if start_date:
        start_dt = _parse_iso(f"{start_date}T00:00:00Z")
        if point_dt < start_dt:
            return False
    if end_date:
        end_dt = _parse_iso(f"{end_date}T23:59:59Z")
        if point_dt > end_dt:
            return False
    return True


def get_community_observations(
    *,
    bbox: Optional[Tuple[float, float, float, float]] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    organization: Optional[str] = None,
    limit: int = 250,
) -> List[dict]:
    normalized = [normalize_observation(item) for item in _RAW_COMMUNITY_OBSERVATIONS]

    filtered = [
        obs
        for obs in normalized
        if _within_bbox(obs["lat"], obs["lon"], bbox)
        and _within_dates(obs["timestamp"], start_date, end_date)
        and (not organization or obs["organization"].lower() == organization.lower())
    ]

    filtered.sort(key=lambda x: x["timestamp"], reverse=True)
    return filtered[: max(1, int(limit))]


def to_geojson(observations: Iterable[dict]) -> dict:
    features = []
    for obs in observations:
        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [obs["lon"], obs["lat"]]},
                "properties": {
                    "id": obs["id"],
                    "timestamp": obs["timestamp"],
                    "parameters": obs["parameters"],
                    "source": obs["source"],
                    "organization": obs["organization"],
                    "site_name": obs["site_name"],
                    "notes": obs["notes"],
                },
            }
        )

    return {"type": "FeatureCollection", "features": features}
