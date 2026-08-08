/**
 * Login Page
 * Dark mode OLED aesthetic
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

import { EarlyBirdLogo } from '../components/ui/EarlyBirdLogo';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [userId, setUserId] = useState('1');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!userId.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      await login(userId.trim());
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: `linear-gradient(135deg, var(--color-background) 0%, var(--color-background-alt) 100%)`,
      }}
    >
      <div
        className="rounded-2xl p-8 w-full max-w-md shadow-2xl border"
        style={{
          backgroundColor: 'var(--color-background-alt)',
          borderColor: 'var(--color-border)',
          borderWidth: '1px',
        }}
      >
        {/* Logo & Title */}
        <div className="mb-8 text-center">
          <EarlyBirdLogo size={64} className="mx-auto mb-3" />
          <h1 className="text-3xl font-bold mb-1 tracking-tight text-white">
            EarlyBird
          </h1>
          <p className="text-xs text-slate-400">
            Real-Time Fraud & Anomaly Radar
          </p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          {/* User ID Input */}
          <div>
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: 'var(--color-foreground)' }}
            >
              User ID
            </label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Enter your user ID"
              className="w-full px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 border"
              style={{
                backgroundColor: 'var(--color-background)',
                color: 'var(--color-foreground)',
                borderColor: 'var(--color-border)',
                borderWidth: '1px',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-primary)';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(245, 158, 11, 0.1)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border)';
                e.currentTarget.style.boxShadow = 'none';
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setUserId('1')}
              className="rounded-md border px-3 py-2 text-sm"
              style={{
                backgroundColor: userId === '1' ? 'rgba(245, 158, 11, 0.12)' : 'var(--color-background)',
                borderColor: userId === '1' ? 'var(--color-primary)' : 'var(--color-border)',
                color: 'var(--color-foreground)',
              }}
            >
              Reviewer
            </button>
            <button
              type="button"
              onClick={() => setUserId('2')}
              className="rounded-md border px-3 py-2 text-sm"
              style={{
                backgroundColor: userId === '2' ? 'rgba(139, 92, 246, 0.14)' : 'var(--color-background)',
                borderColor: userId === '2' ? 'var(--color-accent)' : 'var(--color-border)',
                color: 'var(--color-foreground)',
              }}
            >
              Team Lead
            </button>
          </div>

          {error && (
            <p className="text-sm" style={{ color: 'var(--color-error)' }}>
              {error}
            </p>
          )}

          {/* Login Button */}
          <button
            onClick={handleLogin}
            disabled={isLoading || !userId.trim()}
            className="w-full py-3 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
            style={{
              backgroundColor: 'var(--color-accent)',
              color: 'white',
              opacity: isLoading || !userId.trim() ? 0.6 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isLoading && userId.trim()) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 10px 15px rgba(139, 92, 246, 0.3)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {isLoading ? (
              <>
                <span
                  className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full"
                  style={{
                    animation: 'spin 1s linear infinite',
                  }}
                />
                Logging in...
              </>
            ) : (
              'Login'
            )}
          </button>
        </div>

        {/* Demo Info */}
        <p className="text-xs mt-6 text-center" style={{ color: 'var(--color-text-muted)' }}>
          Demo Mode: user 1 is Reviewer, user 2 is Team Lead.
        </p>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
