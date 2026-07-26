/**
 * Playbook Rules Settings Page
 * Rule management (TEAM_LEAD only), REVIEWER read-only
 * 
 * Features:
 * - Rule list with edit/delete (TEAM_LEAD)
 * - Create/Edit modal using Card overlay
 * - JSON validation
 * - Role-based access control
 */

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { apiClient } from '../../lib/api';
import { Button, Card, CardContent, CardHeader, CardTitle } from '../../components/ui/index';
import { Trash2, Edit2, Plus, X } from 'lucide-react';

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

  // Handle Delete
  const handleDelete = async (ruleId: string) => {
    if (!window.confirm('Are you sure you want to delete this rule?')) {
      return;
    }

    try {
      await apiClient.deletePlaybookRule(ruleId);
      setRules(rules.filter((r) => r.id !== ruleId));
    } catch (err: any) {
      setError(err.message || 'Failed to delete rule');
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-gray-50">⚙️ Playbook Rules</h1>
        <div className="flex items-center justify-center py-12">
          <div className="animate-pulse text-gray-600 dark:text-gray-400">Loading rules...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50 mb-2">⚙️ Playbook Rules</h1>
          <p className="text-gray-600 dark:text-gray-400">
            {isTeamLead ? 'Manage anomaly detection rules' : 'View active rules (read-only)'}
          </p>
        </div>
        {isTeamLead && (
          <Button onClick={() => handleOpenModal()} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Rule
          </Button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Rules List */}
      {rules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-4">No rules defined yet</p>
            {isTeamLead && (
              <Button onClick={() => handleOpenModal()}>Create your first rule</Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {rules.map((rule) => (
            <Card key={rule.id} className="border border-gray-200 dark:border-gray-800">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Condition */}
                    <div className="mb-4">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50 mb-2">
                        Condition
                      </h3>
                      <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-3 font-mono text-sm text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-800 overflow-x-auto">
                        {JSON.stringify(rule.condition_json, null, 2)}
                      </div>
                    </div>

                    {/* Recommendation */}
                    <div className="mb-4">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50 mb-2">
                        Recommendation
                      </h3>
                      <p className="text-gray-700 dark:text-gray-300">{rule.recommendation}</p>
                    </div>

                    {/* Metadata */}
                    <div className="text-xs text-gray-500 dark:text-gray-500">
                      Created {new Date(rule.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Actions */}
                  {isTeamLead && (
                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenModal(rule)}
                        className="gap-1"
                      >
                        <Edit2 className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(rule.id)}
                        className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-gray-200 dark:border-gray-800">
              <CardTitle>
                {editingRule ? 'Edit Rule' : 'Create New Rule'}
              </CardTitle>
              <button
                onClick={handleCloseModal}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                disabled={isSubmitting}
              >
                <X className="h-5 w-5" />
              </button>
            </CardHeader>

            <CardContent className="p-6 space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Define the condition (JSON) and recommendation for this anomaly detection rule.
              </p>

              {/* Condition JSON */}
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-50 mb-2">
                  Condition (JSON Object)
                </label>
                <textarea
                  value={formData.conditionJson}
                  onChange={(e) => setFormData({ ...formData, conditionJson: e.target.value })}
                  placeholder={`{\n  "entity_type": "card",\n  "amount": { "$gt": 5000 }\n}`}
                  className="w-full h-32 p-3 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-50 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Recommendation */}
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-50 mb-2">
                  Recommendation
                </label>
                <textarea
                  value={formData.recommendation}
                  onChange={(e) => setFormData({ ...formData, recommendation: e.target.value })}
                  placeholder="What action should be taken? E.g., 'Block and review'"
                  className="w-full h-20 p-3 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Form Error */}
              {formError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3 text-sm text-red-700 dark:text-red-400">
                  {formError}
                </div>
              )}
            </CardContent>

            {/* Modal Actions */}
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
              <Button
                variant="outline"
                onClick={handleCloseModal}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : editingRule ? 'Update Rule' : 'Create Rule'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
