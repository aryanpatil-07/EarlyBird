/**
 * Playbook Rules Settings Page
 * Full rule authoring, editing & management for Team Lead
 * Dark mode OLED aesthetic with rich design tokens
 */

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../lib/api';
import { Trash2, Edit3, Plus, X, AlertCircle, Shield, ShieldAlert, Check, Sliders, Zap } from 'lucide-react';

interface PlaybookRule {
  id: number | string;
  name: string;
  description?: string;
  condition_json: Record<string, any>;
  recommendation: string;
  priority: number;
  enabled?: number;
  created_at?: string;
  updated_at?: string;
}

export const Settings: React.FC = () => {
  const { user } = useAuth();
  const userRole = user?.role || 'REVIEWER';
  const isTeamLead = userRole === 'TEAM_LEAD';

  const [rules, setRules] = useState<PlaybookRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<PlaybookRule | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    priority: 5,
    conditionJson: '',
    recommendation: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | string | null>(null);

  // Fetch rules from API
  const fetchRules = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getPlaybookRules();
      const rulesList = Array.isArray(data) ? data : data.rules || data.items || [];
      // Sort by priority DESC
      rulesList.sort((a: PlaybookRule, b: PlaybookRule) => (b.priority || 0) - (a.priority || 0));
      setRules(rulesList);
    } catch (err: any) {
      setError(err.message || 'Failed to load playbook rules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  // Handle opening modal for create or edit
  const handleOpenModal = (rule?: PlaybookRule) => {
    if (rule) {
      setEditingRule(rule);
      setFormData({
        name: rule.name || `Rule #${rule.id}`,
        description: rule.description || '',
        priority: rule.priority || 5,
        conditionJson: JSON.stringify(rule.condition_json, null, 2),
        recommendation: rule.recommendation || '',
      });
    } else {
      setEditingRule(null);
      setFormData({
        name: '',
        description: '',
        priority: 5,
        conditionJson: '{\n  "z_score": {\n    "$gte": 3.0\n  }\n}',
        recommendation: '',
      });
    }
    setFormError(null);
    setIsModalOpen(true);
  };

  // Handle closing modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRule(null);
    setFormData({ name: '', description: '', priority: 5, conditionJson: '', recommendation: '' });
    setFormError(null);
  };

  // Parse condition JSON safely
  const parseConditionJson = (jsonString: string): Record<string, any> | null => {
    try {
      const parsed = JSON.parse(jsonString);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        setFormError('Condition must be a valid JSON object (key-value dictionary)');
        return null;
      }
      return parsed;
    } catch (err: any) {
      setFormError(`Invalid JSON condition: ${err.message}`);
      return null;
    }
  };

  // Submit create / edit form
  const handleSubmit = async () => {
    setFormError(null);

    if (!formData.name.trim()) {
      setFormError('Rule Name is required');
      return;
    }
    if (!formData.recommendation.trim()) {
      setFormError('Recommendation action text is required');
      return;
    }

    const conditionJson = parseConditionJson(formData.conditionJson);
    if (!conditionJson) {
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        condition_json: conditionJson,
        recommendation: formData.recommendation.trim(),
        priority: Number(formData.priority) || 5,
      };

      if (editingRule) {
        await apiClient.updatePlaybookRule(String(editingRule.id), payload);
        setSuccessMsg(`Rule "${payload.name}" updated successfully`);
      } else {
        await apiClient.createPlaybookRule(payload);
        setSuccessMsg(`Rule "${payload.name}" created successfully`);
      }

      await fetchRules();
      handleCloseModal();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save playbook rule');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle rule delete
  const handleDelete = async (ruleId: number | string) => {
    setDeleteConfirm(null);
    try {
      await apiClient.deletePlaybookRule(String(ruleId));
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
      setSuccessMsg('Rule deactivated successfully');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete rule');
    }
  };

  const getPriorityBadgeColor = (priority: number) => {
    if (priority >= 9) return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
    if (priority >= 6) return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Playbook Rule Engine
            </h1>
            <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30">
              {rules.length} Rules Active
            </span>
          </div>
          <p className="text-xs text-slate-400">
            {isTeamLead
              ? 'Author, edit, and configure automated playbook recommendations that guide reviewer triage'
              : 'Active anomaly triage rules and playbook recommendations (read-only mode for reviewers)'}
          </p>
        </div>

        {isTeamLead && (
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white shadow-lg shadow-sky-500/25 border border-sky-400/20 flex items-center gap-2 transition-all cursor-pointer active:scale-95 flex-shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Create Rule</span>
          </button>
        )}
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 flex items-center justify-between text-xs text-emerald-300 shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-white cursor-pointer">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 flex items-start gap-3 text-xs text-rose-300">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Role Notice Banner if Reviewer */}
      {!isTeamLead && (
        <div className="rounded-xl border border-white/[0.08] bg-[#111218] px-4 py-3 flex items-center gap-3 text-xs text-slate-400">
          <Shield className="h-4 w-4 text-amber-400 flex-shrink-0" />
          <span>
            You are logged in as a <strong>Reviewer</strong>. Playbook rules are applied automatically during alert scoring. Only <strong>Team Leads</strong> have write access to edit or author rules.
          </span>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="rounded-2xl border border-white/[0.06] bg-[#111218] p-12 text-center shadow-xl">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-sky-500/30 border-t-sky-500 mb-3" />
          <p className="text-xs text-slate-400">Loading playbook rules...</p>
        </div>
      ) : rules.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-[#111218] p-12 text-center shadow-xl">
          <Sliders className="h-10 w-10 mx-auto text-slate-600 mb-3" />
          <h3 className="text-sm font-bold text-white mb-1">No Playbook Rules Defined</h3>
          <p className="text-xs text-slate-400 mb-4">
            Playbook rules match incoming anomalies and provide guided resolution recommendations.
          </p>
          {isTeamLead && (
            <button
              onClick={() => handleOpenModal()}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-sky-500 hover:bg-sky-400 text-white cursor-pointer inline-flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              <span>Create First Rule</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="rounded-2xl border border-white/[0.06] bg-[#111218] p-5 shadow-lg transition-all hover:border-white/[0.12] relative overflow-hidden"
            >
              {/* Card Header: Name, Priority Badge, Actions */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-white/[0.06] pb-3 mb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                    <h3 className="text-sm font-bold text-white tracking-wide">
                      {rule.name}
                    </h3>
                    <span
                      className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${getPriorityBadgeColor(
                        rule.priority || 5
                      )}`}
                    >
                      Priority: {rule.priority || 5}/10
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      ID: #{rule.id}
                    </span>
                  </div>
                  {rule.description && (
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {rule.description}
                    </p>
                  )}
                </div>

                {/* Team Lead Actions */}
                {isTeamLead && (
                  <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-start">
                    <button
                      onClick={() => handleOpenModal(rule)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/25 transition-all cursor-pointer active:scale-95"
                      title="Edit Playbook Rule"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>Edit Rule</span>
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(rule.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/25 transition-all cursor-pointer active:scale-95"
                      title="Deactivate Rule"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Card Body: Condition & Recommendation */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Condition Box */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Zap className="h-3 w-3 text-amber-400" />
                    Trigger Condition (JSON Filter)
                  </span>
                  <pre className="p-3 rounded-xl bg-[#090A0E] border border-white/[0.04] text-sky-300 font-mono text-[11px] overflow-x-auto leading-tight">
                    {JSON.stringify(rule.condition_json, null, 2)}
                  </pre>
                </div>

                {/* Recommendation Box */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Check className="h-3 w-3 text-emerald-400" />
                    Recommended Action Guidance
                  </span>
                  <div className="p-3 rounded-xl bg-[#090A0E] border border-white/[0.04] text-slate-200 text-xs leading-relaxed">
                    {rule.recommendation}
                  </div>
                </div>
              </div>

              {/* Inline Delete Confirmation */}
              {deleteConfirm === rule.id && (
                <div className="mt-4 p-3.5 rounded-xl border border-rose-500/30 bg-rose-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
                  <div className="flex items-center gap-2 text-xs text-rose-200">
                    <AlertCircle className="h-4 w-4 text-rose-400 flex-shrink-0" />
                    <span>Deactivate rule <strong>"{rule.name}"</strong>? Incoming anomalies will no longer evaluate this rule.</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleDelete(rule.id)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-500 text-white cursor-pointer transition-all"
                    >
                      Confirm Delete
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-slate-300 cursor-pointer transition-all"
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

      {/* Create / Edit Rule Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/[0.1] bg-[#111218] shadow-2xl space-y-5"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <Sliders className="h-5 w-5 text-sky-400" />
                <h2 className="text-base font-bold text-white">
                  {editingRule ? `Edit Rule: ${editingRule.name}` : 'Create New Playbook Rule'}
                </h2>
              </div>
              <button
                onClick={handleCloseModal}
                disabled={isSubmitting}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <div className="p-6 space-y-4">
              {/* Form Error */}
              {formError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-3.5 flex items-start gap-2.5 text-xs text-rose-300">
                  <AlertCircle className="h-4 w-4 text-rose-400 flex-shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Rule Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Rule Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Extreme Amount Outlier Spike"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[#090A0E] border border-white/[0.08] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500/60 transition-all font-medium"
                />
              </div>

              {/* Description & Priority in 2-column grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Description
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="e.g. Flags transactions with deviation > 5σ from baseline"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[#090A0E] border border-white/[0.08] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500/60 transition-all font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Priority (1-10) *
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[#090A0E] border border-white/[0.08] text-slate-100 focus:outline-none focus:border-sky-500/60 transition-all cursor-pointer font-mono"
                  >
                    <option value={10}>10 — Critical / Urgent</option>
                    <option value={9}>9 — Very High</option>
                    <option value={8}>8 — High</option>
                    <option value={7}>7 — Moderately High</option>
                    <option value={6}>6 — Medium-High</option>
                    <option value={5}>5 — Medium (Default)</option>
                    <option value={4}>4 — Low-Medium</option>
                    <option value={3}>3 — Low</option>
                    <option value={2}>2 — Very Low</option>
                    <option value={1}>1 — Lowest</option>
                  </select>
                </div>
              </div>

              {/* Condition JSON */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                    Trigger Condition (JSON Object) *
                  </label>
                  <span className="text-[10px] text-slate-500">
                    Keys: amount_min, z_score, high_z_score, merchant_mismatch, velocity_count
                  </span>
                </div>
                <textarea
                  value={formData.conditionJson}
                  onChange={(e) => setFormData({ ...formData, conditionJson: e.target.value })}
                  rows={5}
                  placeholder={'{\n  "z_score": {\n    "$gte": 4.0\n  }\n}'}
                  className="w-full p-3 text-xs rounded-xl bg-[#090A0E] border border-white/[0.08] text-sky-300 font-mono placeholder-slate-600 focus:outline-none focus:border-sky-500/60 transition-all leading-relaxed"
                />
              </div>

              {/* Recommendation Action */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Recommendation Action Guidance *
                </label>
                <textarea
                  value={formData.recommendation}
                  onChange={(e) => setFormData({ ...formData, recommendation: e.target.value })}
                  rows={3}
                  placeholder="e.g. Immediately freeze card and initiate SMS callback verification with cardholder."
                  className="w-full p-3 text-xs rounded-xl bg-[#090A0E] border border-white/[0.08] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500/60 transition-all leading-relaxed"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-5 border-t border-white/[0.08] bg-[#0A0B0F] rounded-b-2xl">
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white shadow-lg shadow-sky-500/25 border border-sky-400/20 transition-all cursor-pointer active:scale-95 disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Saving Rule...</span>
                  </>
                ) : (
                  <span>{editingRule ? 'Save Changes' : 'Create Playbook Rule'}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
