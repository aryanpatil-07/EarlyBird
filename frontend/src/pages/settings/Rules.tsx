/**
 * Playbook Rules Settings Page
 * Rule management (TEAM_LEAD only), REVIEWER read-only
 * 
 * Features:
 * - Rule list with edit/delete (TEAM_LEAD)
 * - Create/Edit modal using Card overlay
 * - JSON validation
 * - Role-based access control
 * 
 * Dark fintech aesthetic: slate-800/30 cards, indigo-600 accents, slate-400 muted text
 */

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { apiClient } from '../../lib/api';
import { Button, Card, CardContent, CardHeader, CardTitle } from '../../components/ui/index';
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
  const [formData, setFormData] = useState({ conditionJson: '', recommendation: '' });
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
        setRules(Array.isArray(data) ? data : data.rules || []);
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
        conditionJson: JSON.stringify(rule.condition_json, null, 2),
        recommendation: rule.recommendation,
      });
    } else {
      setEditingRule(null);
      setFormData({ conditionJson: '', recommendation: '' });
    }
    setFormError(null);
    setIsModalOpen(true);
  };

  // Handle modal close
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRule(null);
    setFormData({ conditionJson: '', recommendation: '' });
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

    // Validate recommendation
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
      const payload: CreateRulePayload = {
        condition_json: conditionJson,
        recommendation: formData.recommendation,
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
        <h1 className="text-3xl font-bold text-slate-100">⚙️ Playbook Rules</h1>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin">
            <div className="border-4 border-slate-500/30 border-t-slate-400 rounded-full h-8 w-8" />
          </div>
          <span className="ml-3 text-slate-400">Loading rules...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100 mb-1">⚙️ Playbook Rules</h1>
          <p className="text-sm text-slate-400">
            {isTeamLead ? 'Manage anomaly detection rules' : 'View active rules (read-only)'}
          </p>
        </div>
        {isTeamLead && (
          <Button
            onClick={() => handleOpenModal()}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-4"
          >
            <Plus className="h-4 w-4" />
            Create Rule
          </Button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <Card className="bg-red-500/10 border-red-900/30">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Rules List */}
      {rules.length === 0 ? (
        <Card className="bg-slate-800/30 border-slate-700/60">
          <CardContent className="py-12 text-center">
            <p className="text-slate-400 mb-4">No rules defined yet</p>
            {isTeamLead && (
              <Button
                onClick={() => handleOpenModal()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Create your first rule
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <Card
              key={rule.id}
              className="bg-slate-800/30 border-slate-700/60 hover:border-slate-600/80 transition-colors"
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Condition */}
                    <div className="mb-3">
                      <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-2">
                        Condition
                      </h4>
                      <div className="bg-slate-900/40 rounded-md p-3 font-mono text-xs text-slate-300 border border-slate-700/40 overflow-x-auto max-h-20">
                        {JSON.stringify(rule.condition_json, null, 2)}
                      </div>
                    </div>

                    {/* Recommendation */}
                    <div className="mb-3">
                      <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-2">
                        Recommendation
                      </h4>
                      <p className="text-sm text-slate-300">{rule.recommendation}</p>
                    </div>

                    {/* Metadata */}
                    <p className="text-xs text-slate-500">
                      Created {new Date(rule.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Actions (TEAM_LEAD only) */}
                  {isTeamLead && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleOpenModal(rule)}
                        className="flex items-center gap-1.5 px-3 py-2 h-9 rounded-md text-xs font-medium bg-slate-700/40 hover:bg-slate-700/60 text-slate-200 hover:text-slate-100 transition-colors"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(rule.id)}
                        className="flex items-center gap-1.5 px-3 py-2 h-9 rounded-md text-xs font-medium bg-red-500/10 hover:bg-red-500/20 text-red-500 hover:text-red-400 transition-colors"
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
                        className="flex items-center gap-1.5 px-3 py-2 h-9 rounded-md text-xs font-medium bg-slate-700/20 text-slate-500 opacity-50 cursor-not-allowed"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        disabled
                        className="flex items-center gap-1.5 px-3 py-2 h-9 rounded-md text-xs font-medium bg-slate-700/20 text-slate-500 opacity-50 cursor-not-allowed"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>

                {/* Delete Confirmation (inline) */}
                {deleteConfirm === rule.id && (
                  <div className="mt-4 p-3 rounded-md bg-red-500/10 border border-red-900/30">
                    <p className="text-sm text-red-600 dark:text-red-400 mb-3">
                      Are you sure you want to delete this rule? This action cannot be undone.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDelete(rule.id)}
                        className="flex-1 px-3 py-2 text-xs font-medium rounded-md bg-red-600 hover:bg-red-700 text-white transition-colors"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="flex-1 px-3 py-2 text-xs font-medium rounded-md bg-slate-700/40 hover:bg-slate-700/60 text-slate-200 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-800 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-slate-700 p-5">
              <CardTitle className="text-slate-100">
                {editingRule ? 'Edit Rule' : 'Create New Rule'}
              </CardTitle>
              <button
                onClick={handleCloseModal}
                disabled={isSubmitting}
                className="text-slate-400 hover:text-slate-300 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </CardHeader>

            <CardContent className="p-6 space-y-5">
              <p className="text-sm text-slate-400">
                Define the condition (JSON) and recommendation for this anomaly detection rule.
              </p>

              {/* Condition JSON */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide mb-2">
                  Condition (JSON Object)
                </label>
                <textarea
                  value={formData.conditionJson}
                  onChange={(e) => setFormData({ ...formData, conditionJson: e.target.value })}
                  placeholder={`{\n  "entity_type": "card",\n  "amount": { "$gt": 5000 }\n}`}
                  className="w-full h-32 p-3 rounded-md border border-slate-700 bg-slate-900/40 text-slate-100 font-mono text-sm focus:ring-2 focus:ring-indigo-600/50 focus:border-transparent"
                />
              </div>

              {/* Recommendation */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide mb-2">
                  Recommendation
                </label>
                <textarea
                  value={formData.recommendation}
                  onChange={(e) => setFormData({ ...formData, recommendation: e.target.value })}
                  placeholder="What action should be taken? E.g., 'Block and review'"
                  className="w-full h-20 p-3 rounded-md border border-slate-700 bg-slate-900/40 text-slate-100 focus:ring-2 focus:ring-indigo-600/50 focus:border-transparent"
                />
              </div>

              {/* Form Error */}
              {formError && (
                <div className="bg-red-500/10 border border-red-900/30 rounded-md p-3 text-sm text-red-600 dark:text-red-400 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}
            </CardContent>

            {/* Modal Actions */}
            <div className="flex justify-end gap-3 p-5 border-t border-slate-700 bg-slate-900/40">
              <button
                onClick={handleCloseModal}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium rounded-md bg-slate-700/40 hover:bg-slate-700/60 text-slate-200 hover:text-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Saving...' : editingRule ? 'Update Rule' : 'Create Rule'}
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
