/**
 * Login Page
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { UserRole } from '../lib/constants.ts';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.REVIEWER);

  const handleLogin = () => {
    if (userId.trim()) {
      login(userId, role);
      navigate('/dashboard', { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 to-primary-900 flex items-center justify-center p-4">
      <div className="card p-8 w-full max-w-md bg-white dark:bg-gray-800">
        <h1 className="text-3xl font-bold text-primary-600 dark:text-primary-400 mb-2">🐦 EarlyBird</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Fraud Anomaly Detection
        </p>

        <div className="space-y-4">
          <div>
            <label className="label">
              User ID
            </label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Enter your user ID"
              className="input"
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
          </div>

          <div>
            <label className="label">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="input"
            >
              <option value={UserRole.REVIEWER}>Reviewer</option>
              <option value={UserRole.TEAM_LEAD}>Team Lead</option>
            </select>
          </div>

          <button
            onClick={handleLogin}
            className="btn-primary w-full"
          >
            Login
          </button>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400 mt-6 text-center">
          Demo: Use any user ID and select your role.
        </p>
      </div>
    </div>
  );
};
