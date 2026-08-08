/**
 * Authentication Context
 * 
 * Manages user login state, role, and token globally.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole } from '../lib/constants';
import { apiClient } from '../lib/api';

export interface User {
  userId: string;
  role: UserRole;
  name: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (userId: string) => Promise<void>;
  switchRole: (targetRole?: UserRole) => Promise<void>;
  logout: () => void;
  setTokenRefreshCallback: (callback: () => void) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      const token = localStorage.getItem('authToken');
      if (!token) {
        setIsLoading(false);
        return;
      }

      apiClient.setToken(token);
      try {
        const session = await apiClient.getSession();
        if (!cancelled) {
          localStorage.setItem('userId', session.userId);
          localStorage.setItem('userRole', session.role);
          localStorage.setItem('userName', session.name);
          setUser({
            userId: session.userId,
            role: session.role as UserRole,
            name: session.name,
          });
        }
      } catch {
        if (!cancelled) {
          apiClient.clearAuth();
          localStorage.removeItem('userId');
          localStorage.removeItem('userRole');
          localStorage.removeItem('userName');
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (userId: string) => {
    const session = await apiClient.login(userId);
    localStorage.setItem('authToken', session.accessToken);
    localStorage.setItem('userId', session.userId);
    localStorage.setItem('userRole', session.role);
    localStorage.setItem('userName', session.name);
    apiClient.setToken(session.accessToken);
    setUser({
      userId: session.userId,
      role: session.role as UserRole,
      name: session.name,
    });
  };

  const switchRole = async (targetRole?: UserRole) => {
    const nextRole = targetRole || (user?.role === UserRole.REVIEWER ? UserRole.TEAM_LEAD : UserRole.REVIEWER);
    const targetUserId = nextRole === UserRole.TEAM_LEAD ? '2' : '1';
    await login(targetUserId);
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userId');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    apiClient.clearAuth();
    setUser(null);
  };

  const setTokenRefreshCallback = (callback: () => void) => {
    apiClient.setTokenRefreshCallback(callback);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        switchRole,
        logout,
        setTokenRefreshCallback,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
