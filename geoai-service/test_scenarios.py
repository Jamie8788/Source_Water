import json
from datetime import date

from main import app


def run_case(client, name, payload):
    resp = client.post("/api/geoai/detect-water", json=payload)
    body = resp.get_json(silent=True) or {}
    return {
        "name": name,
        "status_code": resp.status_code,
        "status": body.get("status"),
        "mode": body.get("mode"),
        "implementation_status": body.get("implementation_status"),
        "area_km2": body.get("area_km2"),
        "scene_count": body.get("scene_count") or body.get("imagery_source", {}).get("scene_count"),
        "selected_scene": body.get("imagery_source", {}).get("selected_scene", {}).get("id"),
        "warnings": body.get("warnings", []),
        "payload": payload,
    }


def main():
    cases = [
        (
            "obvious_water_body",
            {
                "latitude": 46.5,
                "longitude": -84.3,
                "date_start": "2024-06-01",
                "date_end": "2024-08-31",
                "max_cloud_cover": 20,
            },
        ),
        (
            "mostly_dry_land",
            {
                "latitude": 23.4162,
                "longitude": 25.6628,
                "date_start": "2024-06-01",
                "date_end": "2024-08-31",
                "max_cloud_cover": 20,
            },
        ),
        (
            "arctic_winter",
            {
                "latitude": 69.6492,
                "longitude": 18.9553,
                "date_start": "2024-12-01",
                "date_end": "2025-02-28",
                "max_cloud_cover": 35,
            },
        ),
        (
            "wetland_rich_region",
            {
                "latitude": 25.2866,
                "longitude": -80.8987,
                "date_start": "2024-06-01",
                "date_end": "2024-10-01",
                "max_cloud_cover": 25,
            },
        ),
        (
            "high_cloud_scenario",
            {
                "latitude": 46.5,
                "longitude": -84.3,
                "date_start": "2024-06-01",
                "date_end": "2024-08-31",
                "max_cloud_cover": 85,
            },
        ),
    ]

    with app.test_client() as client:
        results = [run_case(client, name, payload) for name, payload in cases]

        # Same date, two coordinates.
        p_a = {
            "latitude": 46.5,
            "longitude": -84.3,
            "date_start": "2024-07-01",
            "date_end": "2024-08-01",
            "max_cloud_cover": 20,
        }
        p_b = {
            "latitude": 23.4162,
            "longitude": 25.6628,
            "date_start": "2024-07-01",
            "date_end": "2024-08-01",
            "max_cloud_cover": 20,
        }
        compare_coords = {
            "name": "compare_two_coordinates_same_dates",
            "a": run_case(client, "coord_a", p_a),
            "b": run_case(client, "coord_b", p_b),
        }

        # Same coordinate, different seasons.
        p_summer = {
            "latitude": 46.5,
            "longitude": -84.3,
            "date_start": "2024-07-01",
            "date_end": "2024-08-01",
            "max_cloud_cover": 20,
        }
        p_winter = {
            "latitude": 46.5,
            "longitude": -84.3,
            "date_start": "2024-12-01",
            "date_end": "2025-02-01",
            "max_cloud_cover": 35,
        }
        compare_seasons = {
            "name": "compare_same_coordinate_summer_vs_winter",
            "summer": run_case(client, "summer", p_summer),
            "winter": run_case(client, "winter", p_winter),
        }

    report = {
        "generated_on": date.today().isoformat(),
        "cases": results,
        "comparisons": [compare_coords, compare_seasons],
    }

    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
