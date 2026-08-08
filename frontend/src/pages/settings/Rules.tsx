/**
 * Playbook Rules Settings Page
 * Rule management with design system CSS variables for dark mode OLED styling
 */

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { apiClient } from '../../lib/api';
import { Trash2, Edit2, Plus, X, AlertCircle } from 'lucide-react';

interface PlaybookRule {
  id: string;
  condition_json: Record<string, any>;
  recommendation: string;
  created_at: string;
  updated_at: string;
}

interface CreateRulePayload {
  condition_json: Record<string, any>;
  recommendation: string;
}

export const Settings: React.FC = () => {
  const { user } = useAuth();
  const userRole = user?.role || 'REVIEWER';
  const [rules, setRules] = useState<PlaybookRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<PlaybookRule | null>(null);
  const [formData, setFormData] = useState({ name: '', conditionJson: '', recommendation: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const isTeamLead = userRole === 'TEAM_LEAD';

  // Fetch rules
  useEffect(() => {
    const fetchRules = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiClient.getPlaybookRules();
        setRules(Array.isArray(data) ? data : data.rules || data.items || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load rules');
      } finally {
        setLoading(false);
      }
    };

    fetchRules();
  }, []);

  // Handle Create/Edit modal open
  const handleOpenModal = (rule?: PlaybookRule) => {
    if (rule) {
      setEditingRule(rule);
      setFormData({
        name: (rule as any).name || 'Rule ' + rule.id,
        conditionJson: JSON.stringify(rule.condition_json, null, 2),
        recommendation: rule.recommendation,
      });
    } else {
      setEditingRule(null);
      setFormData({ name: '', conditionJson: '{\n  "amount_min": 1000\n}', recommendation: '' });
    }
    setFormError(null);
    setIsModalOpen(true);
  };

  // Handle modal close
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRule(null);
    setFormData({ name: '', conditionJson: '', recommendation: '' });
    setFormError(null);
  };

  // Validate and parse JSON condition
  const parseConditionJson = (jsonString: string): Record<string, any> | null => {
    try {
      const parsed = JSON.parse(jsonString);
      if (typeof parsed !== 'object' || parsed === null) {
        setFormError('Condition must be a valid JSON object');
        return null;
      }
      return parsed;
    } catch (err: any) {
      setFormError(`Invalid JSON: ${err.message}`);
      return null;
    }
  };

  // Handle Create/Update
  const handleSubmit = async () => {
    setFormError(null);

    // Validate name & recommendation
    if (!formData.name.trim()) {
      setFormError('Rule name is required');
      return;
    }
    if (!formData.recommendation.trim()) {
      setFormError('Recommendation text is required');
      return;
    }

    // Validate and parse condition JSON
    const conditionJson = parseConditionJson(formData.conditionJson);
    if (!conditionJson) {
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        condition_json: conditionJson,
        recommendation: formData.recommendation.trim(),
      };

      if (editingRule) {
        // Update existing rule
        const updated = await apiClient.updatePlaybookRule(editingRule.id, payload);
        setRules(rules.map((r) => (r.id === editingRule.id ? updated : r)));
      } else {
        // Create new rule
        const created = await apiClient.createPlaybookRule(payload);
        setRules([...rules, created]);
      }

      handleCloseModal();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save rule');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete with confirmation
  const handleDelete = async (ruleId: string) => {
    setDeleteConfirm(null);
    try {
      await apiClient.deletePlaybookRule(ruleId);
      setRules(rules.filter((r) => r.id !== ruleId));
    } catch (err: any) {
      setError(err.message || 'Failed to delete rule');
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          Playbook Rules
        </h1>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin">
            <div
              className="border-4 border-t rounded-full h-8 w-8"
              style={{
                borderColor: 'var(--color-border)',
                borderTopColor: 'var(--color-text-secondary)',
              }}
            />
          </div>
          <span className="ml-3" style={{ color: 'var(--color-text-muted)' }}>
            Loading rules...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-1">
            Playbook Rules
          </h1>
          <p className="text-xs text-slate-400">
            {isTeamLead ? 'Manage automated anomaly detection rules and thresholds' : 'Active playbook rules (read-only mode)'}
          </p>
        </div>
        {isTeamLead && (
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white shadow-lg shadow-sky-500/25 border border-sky-400/20 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>Create Rule</span>
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5 text-rose-400" />
          <p className="text-xs text-rose-300">
            {error}
          </p>
        </div>
      )}

      {/* Rules List */}
      {rules.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-[#111218] p-12 text-center shadow-xl">
          <p className="mb-4 text-xs text-slate-400">
            No playbook rules defined yet
          </p>
          {isTeamLead && (
            <button
              onClick={() => handleOpenModal()}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 text-white shadow-lg shadow-sky-500/25 cursor-pointer"
            >
              Create your first rule
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="rounded-2xl border border-white/[0.06] bg-[#111218] p-5 shadow-lg transition-colors hover:border-white/[0.12]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Condition */}
                  <div className="mb-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                      Condition
                    </h4>
                    <div
                      className="rounded-md p-3 font-mono text-xs border overflow-x-auto max-h-20"
                      style={{
                        backgroundColor: 'var(--color-background-muted)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      {JSON.stringify(rule.condition_json, null, 2)}
                    </div>
                  </div>

                  {/* Recommendation */}
                  <div className="mb-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                      Recommendation
                    </h4>
                    <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                      {rule.recommendation}
                    </p>
                  </div>

                  {/* Metadata */}
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    Created {new Date(rule.created_at).toLocaleDateString()}
                  </p>
                </div>

                {/* Actions (TEAM_LEAD only) */}
                {isTeamLead && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleOpenModal(rule)}
                      className="flex items-center gap-1.5 px-3 py-2 h-9 rounded-md text-xs font-medium transition-colors"
                      style={{
                        backgroundColor: 'var(--color-background-muted)',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(rule.id)}
                      className="flex items-center gap-1.5 px-3 py-2 h-9 rounded-md text-xs font-medium transition-colors"
                      style={{
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        color: 'var(--color-error)',
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                )}

                {/* REVIEWER: Muted/disabled state */}
                {!isTeamLead && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      disabled
                      className="flex items-center gap-1.5 px-3 py-2 h-9 rounded-md text-xs font-medium opacity-50 cursor-not-allowed"
                      style={{
                        backgroundColor: 'var(--color-background-muted)',
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      disabled
                      className="flex items-center gap-1.5 px-3 py-2 h-9 rounded-md text-xs font-medium opacity-50 cursor-not-allowed"
                      style={{
                        backgroundColor: 'var(--color-background-muted)',
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                )}
              </div>

              {/* Delete Confirmation (inline) */}
              {deleteConfirm === rule.id && (
                <div
                  className="mt-4 p-3 rounded-md border"
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderColor: 'rgba(139, 0, 0, 0.3)',
                  }}
                >
                  <p className="text-sm mb-3" style={{ color: 'var(--color-error)' }}>
                    Are you sure you want to delete this rule? This action cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDelete(rule.id)}
                      className="flex-1 px-3 py-2 text-xs font-medium rounded-md text-white transition-colors"
                      style={{
                        backgroundColor: '#DC2626',
                      }}
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors"
                      style={{
                        backgroundColor: 'var(--color-background-muted)',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal Overlay */}
      {isModalOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border"
            style={{
              backgroundColor: 'var(--color-background-alt)',
              borderColor: 'var(--color-border)',
            }}
          >
            {/* Modal Header */}
            <div
              className="flex flex-row items-center justify-between p-5 border-b"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {editingRule ? 'Edit Rule' : 'Create New Rule'}
              </h2>
              <button
                onClick={handleCloseModal}
                disabled={isSubmitting}
                className="text-sm transition-colors disabled:opacity-50"
                style={{ color: 'var(--color-text-muted)' }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-5">
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Define the condition (JSON) and recommendation for this anomaly detection rule.
              </p>

              {/* Rule Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  Rule Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="E.g., High Value Transaction Baseline Spike"
                  className="w-full p-2.5 rounded-md border text-sm focus:ring-2 focus:border-transparent transition-all mb-4"
                  style={{
                    backgroundColor: 'var(--color-background-muted)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text-primary)',
                  }}
                />
              </div>

              {/* Condition JSON */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  Condition (JSON Object)
                </label>
                <textarea
                  value={formData.conditionJson}
                  onChange={(e) => setFormData({ ...formData, conditionJson: e.target.value })}
                  placeholder={`{\n  "entity_type": "card",\n  "amount": { "$gt": 5000 }\n}`}
                  className="w-full h-32 p-3 rounded-md border font-mono text-sm focus:ring-2 focus:border-transparent transition-all"
                  style={{
                    backgroundColor: 'var(--color-background-muted)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text-primary)',
                  }}
                />
              </div>

              {/* Recommendation */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                  Recommendation
                </label>
                <textarea
                  value={formData.recommendation}
                  onChange={(e) => setFormData({ ...formData, recommendation: e.target.value })}
                  placeholder="What action should be taken? E.g., 'Block and review'"
                  className="w-full h-20 p-3 rounded-md border focus:ring-2 focus:border-transparent transition-all"
                  style={{
                    backgroundColor: 'var(--color-background-muted)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text-primary)',
                  }}
                />
              </div>

              {/* Form Error */}
              {formError && (
                <div
                  className="rounded-md p-3 text-sm flex items-start gap-2 border"
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderColor: 'rgba(139, 0, 0, 0.3)',
                    color: 'var(--color-error)',
                  }}
                >
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div
              className="flex justify-end gap-3 p-5 border-t"
              style={{
                backgroundColor: 'var(--color-background-muted)',
                borderColor: 'var(--color-border)',
              }}
            >
              <button
                onClick={handleCloseModal}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: 'var(--color-background-alt)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium rounded-md text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: 'var(--color-primary)',
                }}
              >
                {isSubmitting ? 'Saving...' : editingRule ? 'Update Rule' : 'Create Rule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
