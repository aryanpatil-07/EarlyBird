import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [apiStatus, setApiStatus] = useState('checking...');

  useEffect(() => {
    // Check backend health on mount
    fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/health`)
      .then(res => res.json())
      .then(data => setApiStatus('connected'))
      .catch(err => setApiStatus('disconnected: ' + err.message));
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>🐦 EarlyBird</h1>
        <p>Fraud Detection Platform (Phase 0 — Scaffolding)</p>
        <div className="status">
          <p>Backend Status: <strong>{apiStatus}</strong></p>
        </div>
        <p className="subtitle">
          Features coming in Phase 1+...
        </p>
      </header>
    </div>
  );
}

export default App;
