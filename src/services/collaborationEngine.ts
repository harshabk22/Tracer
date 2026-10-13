/**
 * Lean Collaboration & A2A Teammate Negotiation Engine for Tracer.
 * Whitelisted flight plan sanitization, JSON import/export, native Android share sheet,
 * and Zero-Knowledge autonomous multi-agent teammate negotiation.
 */
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import {
  Goal,
  SprintMilestone,
  SharedGoalFlightPlan,
  SharedMilestoneContract,
  TeamMember,
  NegotiationDialogueTurn,
  NegotiationResult,
} from '../types/goal';

class CollaborationEngine {
  public sanitizeGoalForShare(goal: Goal): SharedGoalFlightPlan {
    const cleanMilestones: SharedMilestoneContract[] = (goal.milestones || [])
      .filter((m) => !m.isScopePruned)
      .map((m) => ({
        id: m.id,
        title: m.title.trim(),
        targetDate: m.targetDate,
        status: m.status,
        owner: m.owner || 'You',
        order: m.order,
      }));

    return {
      version: 'tracer.v2',
      exportedAt: new Date().toISOString(),
      title: goal.title.trim(),
      category: goal.category,
      targetDate: goal.vision?.targetDate || '',
      milestones: cleanMilestones,
    };
  }

  public exportFlightPlanJson(goal: Goal): string {
    const payload = this.sanitizeGoalForShare(goal);
    return JSON.stringify(payload, null, 2);
  }

  public importFlightPlanJson(jsonStr: string): SharedGoalFlightPlan | null {
    if (!jsonStr || typeof jsonStr !== 'string' || jsonStr.length > 512 * 1024) {
      return null;
    }

    try {
      const parsed = JSON.parse(jsonStr);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return null;
      }

      const trimmedTitle = typeof parsed.title === 'string' ? parsed.title.trim() : '';
      if (!trimmedTitle) {
        return null;
      }

      const validCategories = ['personal', 'fitness', 'study', 'business', 'technical'] as const;
      const category = validCategories.includes(parsed.category) ? parsed.category : 'personal';

      const safeTargetDate = typeof parsed.targetDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.targetDate)
        ? parsed.targetDate
        : '';

      if (!Array.isArray(parsed.milestones) || parsed.milestones.length === 0) {
        return null;
      }

      const validStatuses = ['pending', 'in_progress', 'completed', 'at_risk', 'delayed'] as const;
      const cleanMilestones = parsed.milestones.slice(0, 50).map((m: any, idx: number) => {
        if (!m || typeof m !== 'object') {
          return {
            id: `m_${idx + 1}`,
            title: `Milestone ${idx + 1}`,
            targetDate: safeTargetDate,
            status: 'pending' as const,
            owner: 'You',
            order: idx + 1,
          };
        }

        const msTitle = typeof m.title === 'string' && m.title.trim()
          ? m.title.trim().slice(0, 150)
          : `Milestone ${idx + 1}`;
        const msTargetDate = typeof m.targetDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(m.targetDate)
          ? m.targetDate
          : safeTargetDate;
        const msStatus = validStatuses.includes(m.status) ? m.status : 'pending';
        const msOwner = typeof m.owner === 'string' && m.owner.trim()
          ? m.owner.trim().slice(0, 50)
          : 'You';
        const msOrder = typeof m.order === 'number' && Number.isFinite(m.order) && m.order > 0
          ? m.order
          : idx + 1;

        return {
          id: typeof m.id === 'string' && m.id.trim() ? m.id.trim().slice(0, 50) : `m_${idx + 1}`,
          title: msTitle,
          targetDate: msTargetDate,
          status: msStatus,
          owner: msOwner,
          order: msOrder,
        };
      });

      return {
        version: typeof parsed.version === 'string' ? parsed.version.slice(0, 20) : 'tracer.v2',
        exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : new Date().toISOString(),
        title: trimmedTitle.slice(0, 200),
        category,
        targetDate: safeTargetDate,
        milestones: cleanMilestones,
      };
    } catch {
      return null;
    }
  }

  public async shareFlightPlan(goal: Goal): Promise<boolean> {
    const plan = this.sanitizeGoalForShare(goal);
    const text = `🎯 ${plan.title} [Tracer Roadmap]\nTarget: ${plan.targetDate}\n\n` +
      plan.milestones.map((m) => `${m.status === 'completed' ? '✅' : '⏳'} ${m.title} (${m.targetDate}) - ${m.owner}`).join('\n');

    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          title: plan.title,
          text,
          dialogTitle: 'Share Tracer Flight Plan',
        });
        return true;
      } else if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: plan.title, text });
        return true;
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) {
      console.warn('[CollaborationEngine] Share failed:', e);
    }
    return false;
  }

  /**
   * Autonomous Teammate Negotiation (A2A Agent-to-Agent Simulation)
   * Strictly enforces Zero-Knowledge Sanctuary: peer agents inspect ONLY
   * sanitized milestone contracts ({ id, title, targetDate, status, owner }).
   * Private micro-moves, reflections, and failure notes are 100% blocked on-device.
   */
  public getFallbackArchetypes(category?: string): TeamMember[] {
    const cat = (category || 'default').toLowerCase();
    if (cat === 'fitness') {
      return [
        { id: 'tm_lead', name: 'You (Goal Owner)', role: 'Lead Athlete', avatar: 'YOU', isCurrentUser: true },
        { id: 'tm_coach', name: 'Performance Coach', role: 'Strategy & Cadence', avatar: 'PC', isCurrentUser: false },
        { id: 'tm_physio', name: 'Sports Physio', role: 'Recovery & Form', avatar: 'SP', isCurrentUser: false },
        { id: 'tm_nutrition', name: 'Nutrition Specialist', role: 'Fueling & Pacing', avatar: 'NS', isCurrentUser: false },
      ];
    }
    if (cat === 'study' || cat.includes('academic')) {
      return [
        { id: 'tm_lead', name: 'You (Goal Owner)', role: 'Lead Scholar', avatar: 'YOU', isCurrentUser: true },
        { id: 'tm_advisor', name: 'Academic Advisor', role: 'Strategy & Curriculum', avatar: 'AA', isCurrentUser: false },
        { id: 'tm_peer', name: 'Peer Reviewer', role: 'QA & Critique', avatar: 'PR', isCurrentUser: false },
        { id: 'tm_research', name: 'Research Partner', role: 'Data & Literature', avatar: 'RP', isCurrentUser: false },
      ];
    }
    if (cat === 'business') {
      return [
        { id: 'tm_lead', name: 'You (Goal Owner)', role: 'Founder & Lead', avatar: 'YOU', isCurrentUser: true },
        { id: 'tm_strat', name: 'Commercial Strategist', role: 'Strategy & Validation', avatar: 'CS', isCurrentUser: false },
        { id: 'tm_ops', name: 'Operations Lead', role: 'Delivery & Systems', avatar: 'OL', isCurrentUser: false },
        { id: 'tm_growth', name: 'Growth Architect', role: 'Review & Distribution', avatar: 'GA', isCurrentUser: false },
      ];
    }
    if (cat === 'creative') {
      return [
        { id: 'tm_lead', name: 'You (Goal Owner)', role: 'Creative Lead', avatar: 'YOU', isCurrentUser: true },
        { id: 'tm_dir', name: 'Creative Director', role: 'Creative Director & Vision', avatar: 'CD', isCurrentUser: false },
        { id: 'tm_edit', name: 'Senior Editor', role: 'Senior Editor & Polish', avatar: 'SE', isCurrentUser: false },
        { id: 'tm_prod', name: 'Executive Producer', role: 'Coordination & Delivery', avatar: 'EP', isCurrentUser: false },
      ];
    }
    if (cat === 'technical') {
      return [
        { id: 'tm_lead', name: 'You (Goal Owner)', role: 'Tech Lead', avatar: 'YOU', isCurrentUser: true },
        { id: 'tm_arch', name: 'System Architect', role: 'Architecture & Strategy', avatar: 'SA', isCurrentUser: false },
        { id: 'tm_eng', name: 'Core Engineer', role: 'Implementation & Delivery', avatar: 'CE', isCurrentUser: false },
        { id: 'tm_qa', name: 'QA & Security Engineer', role: 'Review & Resilience', avatar: 'QA', isCurrentUser: false },
      ];
    }
    return [
      { id: 'tm_lead', name: 'You (Goal Owner)', role: 'Lead', avatar: 'YOU', isCurrentUser: true },
      { id: 'tm_strat', name: 'Lead Strategist', role: 'Strategy & Planning', avatar: 'LS', isCurrentUser: false },
      { id: 'tm_spec', name: 'Domain Specialist', role: 'Core Delivery', avatar: 'DS', isCurrentUser: false },
      { id: 'tm_rev', name: 'Quality Reviewer', role: 'QA & Verification', avatar: 'QR', isCurrentUser: false },
    ];
  }

  /**
   * Autonomous Teammate Negotiation (A2A Agent-to-Agent Simulation)
   * Strictly enforces Zero-Knowledge Sanctuary: peer agents inspect ONLY
   * sanitized milestone contracts ({ id, title, targetDate, status, owner }).
   * Private micro-moves, reflections, and failure notes are 100% blocked on-device.
   */
  public simulateTeammateNegotiation(goal: Goal, teamMembers: TeamMember[]): NegotiationResult {
    // 1. ZK Privacy Firewall: Sanitize roadmap to public contract
    const sanitizedPlan = this.sanitizeGoalForShare(goal);
    const contracts = sanitizedPlan.milestones;

    // Fallback crew if user has no additional team members (user-defined teammates take precedence)
    const members: TeamMember[] = teamMembers && teamMembers.length > 0
      ? teamMembers
      : this.getFallbackArchetypes(goal.category);

    const dialogue: NegotiationDialogueTurn[] = [];
    const proposed = [...(goal.milestones || [])];
    const now = new Date();

    const formatTurnTime = (offsetSec: number) => {
      const d = new Date(now.getTime() + offsetSec * 1000);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    // Lead kick-off turn
    const lead = members.find((m) => m.isCurrentUser || m.role.toLowerCase().includes('lead')) || members[0];
    dialogue.push({
      senderId: lead.id,
      senderName: lead.name,
      role: lead.role,
      avatar: lead.avatar,
      message: `Analyzing roadmap "${goal.title}" with ${contracts.length} milestones. Initiating role-based distribution.`,
      timestamp: formatTurnTime(1),
    });

    // Match each milestone to the most suitable teammate
    let turnOffset = 3;
    const reassignments: { milestoneTitle: string; ownerName: string }[] = [];

    contracts.forEach((contract, idx) => {
      const lowerTitle = contract.title.toLowerCase();
      let bestCandidate = members[0];

      if (
        lowerTitle.includes('design') ||
        lowerTitle.includes('vision') ||
        lowerTitle.includes('strategy') ||
        lowerTitle.includes('curriculum') ||
        lowerTitle.includes('spec') ||
        lowerTitle.includes('plan') ||
        lowerTitle.includes('architecture')
      ) {
        bestCandidate = members.find((m) => !m.isCurrentUser && (m.role.toLowerCase().includes('strat') || m.role.toLowerCase().includes('coach') || m.role.toLowerCase().includes('advisor') || m.role.toLowerCase().includes('dir') || m.role.toLowerCase().includes('arch'))) || members[1] || members[0];
      } else if (
        lowerTitle.includes('delivery') ||
        lowerTitle.includes('implement') ||
        lowerTitle.includes('build') ||
        lowerTitle.includes('core') ||
        lowerTitle.includes('ops') ||
        lowerTitle.includes('physio') ||
        lowerTitle.includes('edit') ||
        lowerTitle.includes('eng')
      ) {
        bestCandidate = members.find((m) => !m.isCurrentUser && (m.role.toLowerCase().includes('delivery') || m.role.toLowerCase().includes('physio') || m.role.toLowerCase().includes('ops') || m.role.toLowerCase().includes('edit') || m.role.toLowerCase().includes('eng') || m.role.toLowerCase().includes('spec'))) || members[2] || members[0];
      } else if (
        lowerTitle.includes('test') ||
        lowerTitle.includes('audit') ||
        lowerTitle.includes('review') ||
        lowerTitle.includes('peer') ||
        lowerTitle.includes('qa') ||
        lowerTitle.includes('growth') ||
        lowerTitle.includes('nutrition') ||
        lowerTitle.includes('prod')
      ) {
        bestCandidate = members.find((m) => !m.isCurrentUser && (m.role.toLowerCase().includes('review') || m.role.toLowerCase().includes('qa') || m.role.toLowerCase().includes('growth') || m.role.toLowerCase().includes('nutrition') || m.role.toLowerCase().includes('prod'))) || members[3] || members[0];
      } else {
        // Distribute round-robin among non-lead teammates if possible
        const nonLead = members.filter((m) => !m.isCurrentUser);
        bestCandidate = nonLead.length > 0 ? nonLead[idx % nonLead.length] : members[idx % members.length];
      }

      // Update proposed milestone owner
      const targetMilestone = proposed.find((m) => m.id === contract.id);
      if (targetMilestone) {
        targetMilestone.owner = bestCandidate.name;
      }

      dialogue.push({
        senderId: bestCandidate.id,
        senderName: bestCandidate.name,
        role: bestCandidate.role,
        avatar: bestCandidate.avatar,
        message: `I'll take ownership of "${contract.title}" (target ${contract.targetDate}). Matches my capacity and domain focus.`,
        timestamp: formatTurnTime(turnOffset),
        suggestedReassignment: {
          milestoneId: contract.id,
          milestoneTitle: contract.title,
          toOwner: bestCandidate.name,
        },
      });

      reassignments.push({ milestoneTitle: contract.title, ownerName: bestCandidate.name });
      turnOffset += 2;
    });

    // Consensus confirmation turn
    dialogue.push({
      senderId: lead.id,
      senderName: lead.name,
      role: lead.role,
      avatar: lead.avatar,
      message: `Consensus ratified. All ${contracts.length} milestones successfully delegated across crew. Ready to execute.`,
      timestamp: formatTurnTime(turnOffset),
    });

    const summary = `Allocated ${contracts.length} milestones across ${members.length} teammates with zero data leakage.`;

    return {
      dialogue,
      proposedMilestones: proposed,
      summary,
    };
  }
}

export const collaborationEngine = new CollaborationEngine();
