#!/usr/bin/env python3
import requests
import json

# Get file ID from previous upload
file_id = "295c0537-4985-44f9-a10c-6800a16eb69f"

# Test /ask endpoint with AI analysis
data = {
    "file_id": file_id,
    "query": "What's the most concerning water quality issue detected?"
}

r = requests.post("http://localhost:8002/ask", json=data)

print("=== AI ANALYSIS RESPONSE ===")
print(f"Status: {r.status_code}")
response = r.json()
print(json.dumps(response, indent=2))
