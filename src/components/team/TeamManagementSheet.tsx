import React, { useState } from 'react';
import { ModalSheet } from '../common/ModalSheet';
import { useGoal } from '../../context/GoalContext';
import { NegotiationResult, TeamMember } from '../../types/goal';
import {
  Users,
  Plus,
  Trash2,
  Check,
  UserCheck,
  ChevronDown,
  Scale,
  Download,
  Share2,
  ShieldCheck,
  Lock,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { soundManager } from '../../services/sound';
import { androidBridge } from '../../services/androidBridge';

interface TeamManagementSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TeamManagementSheet: React.FC<TeamManagementSheetProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    teamMembers,
    addTeamMember,
    deleteTeamMember,
    activeGoal,
    executeTeammateNegotiation,
    applyTeammateNegotiation,
    shareFlightPlan,
    reassignMilestone,
    importFlightPlanJson,
  } = useGoal();

  const [showAddMember, setShowAddMember] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('Contributor');
  const roleSuggestions = ['Lead', 'Contributor', 'Coach', 'Researcher', 'Reviewer', 'Specialist', 'Partner'];

  const [negotiationResult, setNegotiationResult] = useState<NegotiationResult | null>(null);
  const [isNegotiating, setIsNegotiating] = useState(false);

  const [activeHandoverMilestoneId, setActiveHandoverMilestoneId] = useState<string | null>(null);

  // Import sub-sheet
  const [showImportBox, setShowImportBox] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);

  if (!isOpen) return null;

  const milestones = activeGoal?.milestones || [];

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    soundManager.playTick();
    androidBridge.triggerHaptic('selection');
    addTeamMember({ name: newName.trim(), role: newRole, avatar: '👤', isCurrentUser: false });
    setNewName('');
    setShowAddMember(false);
  };

  const handleStartNegotiation = async () => {
    soundManager.playTick();
    androidBridge.triggerHaptic('medium');
    setIsNegotiating(true);
    setNegotiationResult(null);

    setTimeout(() => {
      const res = executeTeammateNegotiation();
      setNegotiationResult(res);
      setIsNegotiating(false);
      soundManager.playCompleteChime();
      androidBridge.triggerHaptic('success');
    }, 900);
  };

  const handleApplyNegotiation = () => {
    if (!negotiationResult) return;
    soundManager.playCompleteChime();
    androidBridge.triggerHaptic('success');
    applyTeammateNegotiation(negotiationResult);
    setNegotiationResult(null);
  };

  const handleReassign = (milestoneId: string, newOwner: string) => {
    soundManager.playTick();
    androidBridge.triggerHaptic('success');
    reassignMilestone(milestoneId, newOwner, `Handed over to ${newOwner}`);
    setActiveHandoverMilestoneId(null);
  };

  const handleImportPlan = () => {
    if (!importJson.trim()) {
      setImportError('Please paste flight plan JSON before importing.');
      androidBridge.triggerHaptic('error');
      return;
    }

    try {
      const ok = importFlightPlanJson(importJson.trim());
      if (ok) {
        soundManager.playCompleteChime();
        androidBridge.triggerHaptic('success');
        setImportSuccess(true);
        setTimeout(() => {
          setImportSuccess(false);
          setShowImportBox(false);
          setImportJson('');
        }, 1200);
      } else {
        soundManager.playBlockerThud();
        androidBridge.triggerHaptic('error');
        setImportError('Invalid Tracer flight plan format. Ensure JSON contains "title" and "milestones".');
      }
    } catch {
      soundManager.playBlockerThud();
      androidBridge.triggerHaptic('error');
      setImportError('Could not parse JSON. Please check the syntax.');
    }
  };

  const handoverCrew = teamMembers.length > 0
    ? teamMembers
    : [{ id: 'tm_you', name: 'You', role: 'Lead', avatar: '👤', isCurrentUser: true }];

  return (
    <ModalSheet
      onClose={onClose}
      title="Crew & Flight Plan Management"
      subtitle="Configure collaborators, reassign milestones, and import plans"
      icon={Users}
      maxWidth="max-w-lg"
    >
      <div className="space-y-4 py-2 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] text-xs select-none">
        {/* Zero-Knowledge Privacy Sanctuary Note */}
        <div className="bg-bone-900/90 border border-sage/40 rounded-2xl p-3 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-sage shrink-0 mt-0.5" />
          <p className="text-[11px] text-bone-300 leading-relaxed">
            <span className="font-semibold text-bone-100">Zero-Knowledge Sanctuary:</span> Only milestone titles and target dates are shared. Reflections and private micro-moves remain encrypted on-device.
          </p>
        </div>

        {/* Crew Roster */}
        <div className="bg-bone-900/80 border border-white/[0.08] rounded-2xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="font-bold text-bone-100 text-sm flex items-center gap-1.5">
              <Users className="w-4 h-4 text-terracotta" />
              <span>Crew Roster ({teamMembers.length})</span>
            </div>
            <button
              type="button"
              onClick={() => setShowAddMember(!showAddMember)}
              className="min-h-[48px] px-3.5 py-2 rounded-xl bg-terracotta/15 text-terracotta font-semibold flex items-center gap-1 border border-terracotta/30 m3-press focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:outline-none"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showAddMember ? 'Cancel' : 'Add Member'}</span>
            </button>
          </div>

          {showAddMember && (
            <form onSubmit={handleAddMember} className="bg-bone-800/80 rounded-xl p-3 border border-white/10 space-y-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Teammate Name"
                className="w-full min-h-[48px] px-3 rounded-lg bg-bone-900 border border-white/10 text-bone-100 placeholder:text-bone-500 focus:outline-none focus:border-terracotta"
              />
              <input
                type="text"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                placeholder="Role (e.g. Lead, Coach, Specialist)"
                className="w-full min-h-[48px] px-3 rounded-lg bg-bone-900 border border-white/10 text-bone-100 placeholder:text-bone-500 focus:outline-none focus:border-terracotta text-xs"
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {roleSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setNewRole(suggestion)}
                    className={`min-h-[48px] px-3 py-1.5 rounded-full text-xs font-medium border transition-colors m3-press ${
                      newRole === suggestion
                        ? 'bg-terracotta/20 text-terracotta border-terracotta/40'
                        : 'bg-bone-900/60 text-bone-400 border-white/10 hover:text-bone-200'
                    }`}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
              <button
                type="submit"
                className="w-full min-h-[48px] rounded-lg bg-terracotta text-white font-semibold flex items-center justify-center gap-1.5 m3-press"
              >
                <Check className="w-4 h-4" /> Save Teammate
              </button>
            </form>
          )}

          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {teamMembers.map((member) => (
              <div
                key={member.id}
                className="bg-bone-800/60 border border-white/[0.06] rounded-xl p-2.5 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-base">{member.avatar}</span>
                  <div>
                    <div className="font-semibold text-bone-100 flex items-center gap-1.5">
                      <span>{member.name}</span>
                      {member.isCurrentUser && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-terracotta/20 text-terracotta font-semibold">
                          You
                        </span>
                      )}
                    </div>
                    <span className="text-bone-400 text-[11px]">{member.role}</span>
                  </div>
                </div>
                {!member.isCurrentUser && (
                  <button
                    type="button"
                    onClick={() => deleteTeamMember(member.id)}
                    className="min-h-[48px] min-w-[48px] p-2 text-bone-500 hover:text-rust m3-press flex items-center justify-center"
                    aria-label={`Remove ${member.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Milestone Handover Deliverables */}
        <div className="bg-bone-900/80 border border-white/[0.08] rounded-2xl p-3.5 space-y-2.5">
          <div className="font-bold text-bone-100 text-sm">
            Deliverable Assignments ({milestones.length})
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {milestones.map((m, idx) => {
              const currentOwner = m.owner || 'You';
              const isHandoverActive = activeHandoverMilestoneId === m.id;

              return (
                <div
                  key={m.id}
                  className="bg-bone-800/70 border border-white/[0.06] rounded-xl p-2.5 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-bone-400 font-mono text-[10px]">M{idx + 1}</span>
                        <p className="font-semibold text-bone-100 truncate">{m.title}</p>
                      </div>
                      <span className="text-[11px] text-bone-400">Due: {m.targetDate}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        soundManager.playTick();
                        androidBridge.triggerHaptic('selection');
                        setActiveHandoverMilestoneId(isHandoverActive ? null : m.id);
                      }}
                      className={`min-h-[48px] px-3 py-1.5 rounded-xl border flex items-center gap-1.5 font-semibold text-xs m3-press ${
                        isHandoverActive
                          ? 'bg-terracotta text-white border-terracotta'
                          : 'bg-terracotta/15 text-terracotta border-terracotta/30'
                      }`}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span className="truncate max-w-[80px]">{currentOwner}</span>
                      <ChevronDown
                        className={`w-3 h-3 transition-transform ${isHandoverActive ? 'rotate-180' : ''}`}
                      />
                    </button>
                  </div>

                  {isHandoverActive && (
                    <div className="pt-2 border-t border-white/[0.06] grid grid-cols-2 gap-1.5">
                      {handoverCrew.map((member) => {
                        const isSelected = currentOwner === member.name;
                        return (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() => handleReassign(m.id, member.name)}
                            className={`min-h-[48px] px-3 rounded-xl text-xs font-semibold flex items-center justify-between border m3-press ${
                              isSelected
                                ? 'bg-sage text-white border-sage'
                                : 'bg-bone-900 text-bone-200 border-white/10'
                            }`}
                          >
                            <span className="truncate">{member.name}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* AI Teammate Negotiation */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleStartNegotiation}
            disabled={isNegotiating}
            className="w-full min-h-[48px] rounded-2xl bg-terracotta hover:bg-terracotta-hover text-white font-bold flex items-center justify-center gap-2 m3-press disabled:opacity-50"
          >
            <Scale className={`w-4 h-4 ${isNegotiating ? 'animate-spin' : ''}`} />
            <span>{isNegotiating ? 'Balancing Workload...' : 'AI Team Role Balancing'}</span>
          </button>

          {negotiationResult && (
            <div className="bg-bone-900/90 border border-terracotta/40 rounded-2xl p-3 space-y-2">
              <p className="text-[11px] text-bone-300">{negotiationResult.summary}</p>
              <button
                type="button"
                onClick={handleApplyNegotiation}
                className="w-full min-h-[48px] rounded-xl bg-sage text-white font-bold flex items-center justify-center gap-1.5 m3-press"
              >
                <Check className="w-4 h-4 stroke-[3]" /> Accept & Reassign Milestones
              </button>
            </div>
          )}
        </div>

        {/* P2P Flight Plan Import & Share */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={() => setShowImportBox(!showImportBox)}
            className="min-h-[48px] px-3 py-2 rounded-xl bg-bone-800 text-bone-100 border border-white/10 flex items-center justify-center gap-2 font-semibold m3-press"
          >
            <Download className="w-4 h-4 text-terracotta" />
            <span>{showImportBox ? 'Hide Import' : 'Import JSON'}</span>
          </button>

          <button
            type="button"
            onClick={shareFlightPlan}
            className="min-h-[48px] px-3 py-2 rounded-xl bg-bone-800 text-bone-100 border border-white/10 flex items-center justify-center gap-2 font-semibold m3-press"
          >
            <Share2 className="w-4 h-4 text-sage" />
            <span>Share Plan</span>
          </button>
        </div>

        {showImportBox && (
          <div className="bg-bone-900/90 border border-white/10 rounded-2xl p-3 space-y-2">
            {importError && (
              <div className="p-2.5 bg-rust/20 border border-rust/40 rounded-xl text-rust text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{importError}</span>
              </div>
            )}
            {importSuccess && (
              <div className="p-2.5 bg-sage/20 border border-sage/40 rounded-xl text-sage text-xs flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>Plan imported successfully!</span>
              </div>
            )}
            <textarea
              value={importJson}
              onChange={(e) => {
                setImportJson(e.target.value);
                setImportError(null);
              }}
              placeholder='Paste Tracer flight plan JSON here...'
              rows={4}
              className="w-full p-2.5 rounded-xl bg-bone-950 border border-white/10 text-bone-100 font-mono text-xs focus:outline-none focus:border-terracotta resize-none"
            />
            <button
              type="button"
              onClick={handleImportPlan}
              className="w-full min-h-[48px] rounded-xl bg-terracotta text-white font-bold flex items-center justify-center gap-1.5 m3-press"
            >
              <Download className="w-4 h-4" /> Import Flight Plan
            </button>
          </div>
        )}
      </div>
    </ModalSheet>
  );
};
