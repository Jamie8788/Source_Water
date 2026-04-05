#!/usr/bin/env python3
import requests
import json

# Upload file
url = "http://localhost:8002/upload"
with open(r"c:\Users\algom\source-water\analysis-service\sample_water_data.csv", 'rb') as f:
    files = {'file': f}
    data = {'description': 'Water quality monitoring data from wells, springs, and rivers'}
    r = requests.post(url, files=files, data=data)

print("=== UPLOAD & ML ANALYSIS RESPONSE ===")
print(f"Status: {r.status_code}")
response = r.json()
print(json.dumps(response, indent=2))
print(f"\n✅ File ID: {response.get('file_id')}")
