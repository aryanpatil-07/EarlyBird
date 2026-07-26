/**
 * useAuth Hook - Authentication Context
 * Returns current user and auth state from context.
 * 
 * TODO: Implement with Auth Context provider in App.tsx
 * For now, returns mock data to allow screens to compile.
 */

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'REVIEWER' | 'TEAM_LEAD';
}

export interface AuthContext {
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

export const useAuth = (): AuthContext => {
  // TODO: Replace with actual context hook
  // Mock user for development
  return {
    user: {
      id: '1',
      email: 'reviewer@earlybird.local',
      name: 'Alice Reviewer',
      role: 'REVIEWER',
    },
    isLoading: false,
    error: null,
  };
};
