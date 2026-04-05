#!/usr/bin/env python3
import pandas as pd
import requests
import json

# Create sample water quality data
data = {
    'Location': ['Well_1', 'Well_1', 'Well_2', 'Well_2', 'Spring_1', 'Spring_1', 'River_1', 'River_1'],
    'pH': [7.2, 7.1, 6.8, 6.9, 7.4, 7.5, 7.6, 7.5],
    'Turbidity': [0.5, 0.6, 1.2, 1.5, 0.3, 0.2, 3.2, 4.1],
    'DissolvedOxygen': [8.1, 7.9, 6.5, 6.2, 9.1, 9.3, 7.2, 6.9],
    'Conductivity': [450, 460, 520, 540, 380, 370, 650, 680],
    'Temperature': [22.5, 24.2, 23.1, 25.5, 19.5, 21.2, 20.5, 22.8],
    'Phosphorus': [0.02, 0.03, 0.05, 0.08, 0.01, 0.01, 0.12, 0.15],
    'Nitrates': [5, 6, 12, 15, 2, 1, 25, 30],
}
df = pd.DataFrame(data)
df.to_csv('analysis_test.csv', index=False)

# Upload and analyze
with open('analysis_test.csv', 'rb') as f:
    resp = requests.post('http://localhost:8002/upload', files={'file': f})

result = resp.json()
print('=' * 60)
print('✓ UPLOAD SUCCESSFUL')
print('=' * 60)
print(f'Status Code: {resp.status_code}')
print(f'File ID: {result.get("id")}')
print(f'Filename: {result.get("filename")}')
print(f'Risk Score: {result.get("risk", {}).get("score")}/100')
print(f'Risk Level: {result.get("risk", {}).get("level")}')
print(f'Violations Found: {len(result.get("risk", {}).get("violations", []))}')
print(f'Anomalies: {result.get("anomalies", {}).get("anomaly_rate")}%')
print('\nViolations:')
for v in result.get('risk', {}).get('violations', []):
    print(f'  - {v["column"]}: {v["issue"]} ({v.get("severity")})')
