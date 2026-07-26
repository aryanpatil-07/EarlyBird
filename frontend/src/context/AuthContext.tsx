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
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (userId: string, role: UserRole) => void;
  logout: () => void;
  setTokenRefreshCallback: (callback: () => void) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize from localStorage
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const userId = localStorage.getItem('userId');
    const role = localStorage.getItem('userRole');

    if (token && userId && role) {
      setUser({ userId, role: role as UserRole });
      apiClient.setToken(token);
    }
    setIsLoading(false);
  }, []);

  const login = (userId: string, role: UserRole) => {
    // In a real app, you'd call an auth endpoint here
    // For now, simulate with a JWT-like token
    const token = btoa(`${userId}:${role}`);

    localStorage.setItem('authToken', token);
    localStorage.setItem('userId', userId);
    localStorage.setItem('userRole', role);

    apiClient.setToken(token);
    setUser({ userId, role });
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userId');
    localStorage.removeItem('userRole');
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
