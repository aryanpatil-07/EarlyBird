/**
 * Utility Functions
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { CaseSeverity, SLA_WINDOW_MS, SLA_STATUS } from './constants';

/**
 * Merge Tailwind CSS classes safely (clsx + tailwind-merge)
 * Handles class name conflicts automatically
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Format currency (USD)
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

/**
 * Format date and time
 */
export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format date only
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format time elapsed (e.g., "2 mins ago", "3 hours ago")
 */
export function formatTimeAgo(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const elapsedMs = now.getTime() - d.getTime();
  const elapsedSecs = Math.floor(elapsedMs / 1000);
  const elapsedMins = Math.floor(elapsedSecs / 60);
  const elapsedHours = Math.floor(elapsedMins / 60);
  const elapsedDays = Math.floor(elapsedHours / 24);

  if (elapsedSecs < 60) return 'just now';
  if (elapsedMins < 60) return `${elapsedMins}m ago`;
  if (elapsedHours < 24) return `${elapsedHours}h ago`;
  return `${elapsedDays}d ago`;
}

/**
 * Calculate remaining SLA time
 * Returns: { remainingMs, status, displayText }
 */
export function calculateSLA(createdAt: string | Date) {
  const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  const now = new Date();
  const elapsedMs = now.getTime() - created.getTime();
  const remainingMs = SLA_WINDOW_MS - elapsedMs;

  let status: typeof SLA_STATUS[keyof typeof SLA_STATUS] = SLA_STATUS.HEALTHY;
  if (remainingMs < 0) {
    status = SLA_STATUS.BREACHED;
  } else if (remainingMs < 60 * 60 * 1000) {
    // < 1 hour
    status = SLA_STATUS.WARNING;
  }

  // Format remaining time
  let displayText = 'SLA Breached';
  if (remainingMs > 0) {
    const totalMins = Math.floor(remainingMs / (60 * 1000));
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    if (hours > 0) {
      displayText = `${hours}h ${mins}m left`;
    } else {
      displayText = `${mins}m left`;
    }
  }

  return { remainingMs, status, displayText };
}

/**
 * Map z-score to severity
 */
export function getSeverity(zScore: number): CaseSeverity {
  if (zScore > 5) return CaseSeverity.CRITICAL;
  if (zScore > 3.5) return CaseSeverity.HIGH;
  if (zScore > 2.5) return CaseSeverity.MEDIUM;
  return CaseSeverity.LOW;
}

/**
 * Format z-score for display
 */
export function formatZScore(zScore: number): string {
  return `${zScore.toFixed(1)}σ`;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;

  return function debounced(...args: Parameters<T>) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delayMs);
  };
}

/**
 * Clamp number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * JSON stringify with indentation
 */
export function formatJSON(obj: any): string {
  return JSON.stringify(obj, null, 2);
}

/**
 * Parse JSON safely
 */
export function parseJSON(jsonStr: string): any {
  try {
    return JSON.parse(jsonStr);
  } catch (error) {
    return null;
  }
}

/**
 * Check if user is TEAM_LEAD
 */
export function isTeamLead(role: string): boolean {
  return role === 'TEAM_LEAD';
}

/**
 * Check if user is REVIEWER
 */
export function isReviewer(role: string): boolean {
  return role === 'REVIEWER';
}

/**
 * Generate transaction ID (short display version)
 */
export function formatTransactionId(id: string): string {
  return id.substring(0, 8).toUpperCase();
}

/**
 * Generate case ID (short display version)
 */
export function formatCaseId(id: string): string {
  return `C-${id.substring(0, 4).toUpperCase()}`;
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
}
