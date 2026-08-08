#!/usr/bin/env python
"""Test playbook endpoint with error details."""

import sys
sys.path.insert(0, '.')

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

# Login
login_response = client.post('/auth/login', json={'userId': 'system'})
token = login_response.json()['access_token']
print(f'Token: {token}')

# Test endpoint
headers = {'Authorization': f'Bearer {token}'}
response = client.get('/api/playbook-rules', headers=headers)
print(f'Status: {response.status_code}')
print(f'Response: {response.text}')
