#!/usr/bin/env python
"""Test API endpoints."""

import requests
import json

# Login
token = requests.post('http://localhost:8000/auth/login', json={'userId': 'system'}).json()['access_token']
headers = {'Authorization': f'Bearer {token}'}

print('='*50)
print('Testing API Endpoints')
print('='*50)

# Test cases endpoint
print('\n1. GET /cases')
response = requests.get('http://localhost:8000/cases', headers=headers)
print(f'   Status: {response.status_code}')
if response.status_code == 200:
    data = response.json()
    print(f'   Total: {data["total"]} cases')
    print(f'   Returned: {len(data["cases"])} cases')
    print(f'   Dedup stats: {data.get("dedup_stats")}')
    if data['cases']:
        print(f'   First: {data["cases"][0]["case_id"]} ({data["cases"][0]["state"]})')
else:
    print(f'   Error: {response.text}')

# Test dashboard endpoint
print('\n2. GET /dashboard/metrics')
response = requests.get('http://localhost:8000/dashboard/metrics', headers=headers)
print(f'   Status: {response.status_code}')
if response.status_code == 200:
    data = response.json()
    print(f'   Precision: {data["precision"]}')
    print(f'   Recall: {data["recall"]}')
    print(f'   KB Coverage: {data["kb_coverage"]}')
else:
    print(f'   Error: {response.text}')

# Test knowledge base
print('\n3. GET /knowledge-base/search?q=fraud')
response = requests.get('http://localhost:8000/knowledge-base/search', params={'q': 'fraud'}, headers=headers)
print(f'   Status: {response.status_code}')
if response.status_code == 200:
    data = response.json()
    if isinstance(data, list):
        print(f'   Results: {len(data)} entries')
    else:
        print(f'   Results: {len(data.get("results", []))} entries')
else:
    print(f'   Error: {response.text}')

# Test playbook rules
print('\n4. GET /playbook-rules')
response = requests.get('http://localhost:8000/playbook-rules', headers=headers)
print(f'   Status: {response.status_code}')
if response.status_code == 200:
    data = response.json()
    print(f'   Rules: {len(data.get("rules", []))} total')
else:
    print(f'   Error: {response.text}')

print('\n' + '='*50)
