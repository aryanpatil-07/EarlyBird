/**
 * API Client Library
 * 
 * Axios wrapper with:
 * - Bearer token injection
 * - 401 handling (expired token)
 * - Request/response logging
 * - Error normalization
 */

import axios, { AxiosInstance, AxiosError } from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

export interface ApiError {
  status: number;
  message: string;
  code?: string;
  data?: any;
}

class ApiClient {
  private client: AxiosInstance;
  private tokenRefreshCallback: (() => void) | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Inject token before requests
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Handle responses
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        // 401 Unauthorized - token expired
        if (error.response?.status === 401) {
          localStorage.removeItem('authToken');
          localStorage.removeItem('userRole');
          if (this.tokenRefreshCallback) {
            this.tokenRefreshCallback();
          }
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Set callback for token expiration
   */
  setTokenRefreshCallback(callback: () => void) {
    this.tokenRefreshCallback = callback;
  }

  /**
   * Set authentication token
   */
  setToken(token: string) {
    localStorage.setItem('authToken', token);
  }

  /**
   * Clear authentication
   */
  clearAuth() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userId');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
  }

  /**
   * Normalize error response
   */
  private normalizeError(error: any): ApiError {
    if (error.response) {
      const envelope = error.response.data?.error;
      return {
        status: error.response.status,
        code: envelope?.code,
        message: envelope?.message || error.response.data?.message || error.response.data?.detail || error.message,
        data: error.response.data,
      };
    }
    return {
      status: 0,
      message: error.message || 'Unknown error',
    };
  }

  async login(userId: string) {
    try {
      const response = await this.client.post('/auth/login', { userId });
      return response.data;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  async getSession() {
    try {
      const response = await this.client.get('/auth/session');
      return response.data;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  // Cases endpoints
  async getCases(
    params?: { status?: string; state?: string; page?: number; pageSize?: number; limit?: number; offset?: number }
  ) {
    try {
      const response = await this.client.get('/cases', { params });
      return response.data;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  async getCaseDetail(caseId: string) {
    try {
      const response = await this.client.get(`/cases/${caseId}`);
      return response.data;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  async acceptCase(
    caseId: string,
    version: number,
    options?: {
      note?: string;
      category?: string;
      verification_methods?: string[];
      follow_up_action?: string;
    }
  ) {
    try {
      const response = await this.client.post(`/cases/${caseId}/accept`, {
        version,
        note: options?.note,
        category: options?.category,
        verification_methods: options?.verification_methods,
        follow_up_action: options?.follow_up_action,
      });
      return response.data;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  async resolveCase(
    caseId: string,
    version: number,
    rationale?: string,
    options?: {
      category?: string;
      verification_methods?: string[];
      follow_up_action?: string;
    }
  ) {
    return this.actOnCase(caseId, version, 'ACCEPTED', rationale, options?.category, options?.verification_methods, options?.follow_up_action);
  }

  async actOnCase(
    caseId: string,
    version: number,
    decision: 'ACCEPTED' | 'REJECTED' | 'MODIFIED' = 'ACCEPTED',
    rationale?: string,
    category?: string,
    verification_methods?: string[],
    follow_up_action?: string,
    note?: string
  ) {
    try {
      const response = await this.client.post(`/cases/${caseId}/action`, {
        version,
        decision,
        rationale: rationale || note,
        note: note || rationale,
        category,
        verification_methods,
        follow_up_action,
      });
      return response.data;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  async escalateCase(
    caseId: string,
    version: number,
    reason: string,
    options?: {
      category?: string;
      verification_methods?: string[];
      priority_level?: string;
      note?: string;
    }
  ) {
    try {
      const response = await this.client.post(`/cases/${caseId}/escalate`, {
        version,
        reason,
        note: options?.note || reason,
        category: options?.category,
        verification_methods: options?.verification_methods,
        priority_level: options?.priority_level,
      });
      return response.data;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  async triggerDetection() {
    try {
      const response = await this.client.post('/cases/trigger-detection');
      return response.data;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  async getAuditLog(params?: { page?: number; pageSize?: number; entity_type?: string; entity_id?: string }) {
    try {
      const response = await this.client.get('/audit-log', { params });
      return response.data;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  // Knowledge Base endpoints
  async searchKB(query: string = '', limit: number = 20, offset: number = 0) {
    try {
      const page = Math.floor(offset / limit) + 1;
      const response = await this.client.get('/knowledge-base', {
        params: { search: query, pageSize: limit, page },
      });
      return response.data;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  async getKBEntry(entryId: string) {
    try {
      const response = await this.client.get(`/knowledge-base/${entryId}`);
      return response.data;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  // Dashboard endpoints
  async getDashboardMetrics() {
    try {
      const response = await this.client.get('/dashboard/metrics');
      return response.data;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  async getSLAHealth() {
    try {
      const response = await this.client.get('/dashboard/sla-health');
      return response.data;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  async getCaseTrends(params: { days?: number } = {}) {
    return {
      cases_processed: [],
      detection_rate: [],
      sla_compliance: [],
      false_positive_rate: [],
    };
  }

  // Playbook rules endpoints
  async getPlaybookRules() {
    try {
      const response = await this.client.get('/playbook-rules');
      return response.data;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  async createPlaybookRule(data: {
    name: string;
    description?: string;
    condition_json: any;
    recommendation: string;
    priority?: number;
  }) {
    try {
      const response = await this.client.post('/playbook-rules', data);
      return response.data;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  async updatePlaybookRule(
    ruleId: string,
    data: {
      name?: string;
      description?: string;
      condition_json?: any;
      recommendation?: string;
      priority?: number;
      enabled?: number;
    }
  ) {
    try {
      const response = await this.client.patch(`/playbook-rules/${ruleId}`, data);
      return response.data;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  async deletePlaybookRule(ruleId: string) {
    try {
      const response = await this.client.delete(`/playbook-rules/${ruleId}`);
      return response.data;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  // Health check
  async health() {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }
}

export const apiClient = new ApiClient();
