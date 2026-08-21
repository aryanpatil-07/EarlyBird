/**
 * Application Constants
 */

export const APP_NAME = 'EarlyBird';
export const APP_VERSION = '0.1.0';

// User roles
export enum UserRole {
  REVIEWER = 'REVIEWER',
  TEAM_LEAD = 'TEAM_LEAD',
}

// Case states
export enum CaseState {
  NEW = 'NEW',
  ACCEPTED = 'ACCEPTED',
  RESOLVED = 'RESOLVED',
  ESCALATED = 'ESCALATED',
}

// Case severity (derived from z-score)
export enum CaseSeverity {
  LOW = 'LOW',           // 1.5–2.5 σ
  MEDIUM = 'MEDIUM',     // 2.5–3.5 σ
  HIGH = 'HIGH',         // 3.5–5 σ
  CRITICAL = 'CRITICAL', // >5 σ
}

// SLA (2 hours in milliseconds)
export const SLA_WINDOW_MS = 2 * 60 * 60 * 1000;
export const SLA_WINDOW_HOURS = 2;

// Pagination defaults
export const DEFAULT_PAGE_SIZE = 20;
export const KB_PAGE_SIZE = 10;

// UI constants
export const TOAST_DURATION_MS = 5000;
export const DEBOUNCE_DELAY_MS = 300;
export const API_TIMEOUT_MS = 10000;

// API response error codes
export const ERROR_CODES = {
  STALE_CASE_STATE: 'STALE_CASE_STATE',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  INVALID_REQUEST: 'INVALID_REQUEST',
  SERVER_ERROR: 'SERVER_ERROR',
} as const;

// Severity color mapping
export const SEVERITY_COLORS = {
  [CaseSeverity.LOW]: '#10B981',       // Emerald
  [CaseSeverity.MEDIUM]: '#F59E0B',    // Amber
  [CaseSeverity.HIGH]: '#F59E0B',      // Amber (darker)
  [CaseSeverity.CRITICAL]: '#EF4444',  // Red
} as const;

// State badge colors
export const STATE_BADGE_COLORS = {
  [CaseState.NEW]: '#DBEAFE',          // Blue
  [CaseState.ACCEPTED]: '#FEF3C7',     // Amber
  [CaseState.RESOLVED]: '#D1FAE5',     // Green
  [CaseState.ESCALATED]: '#FEE2E2',    // Red
} as const;

// SLA status
export const SLA_STATUS = {
  HEALTHY: 'HEALTHY',       // <1 hour left
  WARNING: 'WARNING',        // 1–2 hours left
  BREACHED: 'BREACHED',      // >2 hours or escalated
} as const;

// Audit log actions
export const AUDIT_ACTIONS = {
  CASE_CREATED: 'CASE_CREATED',
  CASE_ACCEPTED: 'CASE_ACCEPTED',
  CASE_RESOLVED: 'CASE_RESOLVED',
  CASE_ESCALATED: 'CASE_ESCALATED',
  CASE_VIEWED: 'CASE_VIEWED',
  KB_ENTRY_CREATED: 'KB_ENTRY_CREATED',
  RULE_CREATED: 'RULE_CREATED',
  RULE_UPDATED: 'RULE_UPDATED',
  RULE_DELETED: 'RULE_DELETED',
} as const;
