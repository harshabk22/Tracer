/**
 * Lean Export Engine for Tracer.
 * Produces clean Markdown briefings, JSON/CSV exports, and native Android share payloads.
 */
import { Goal } from '../types/goal';
import { collaborationEngine } from './collaborationEngine';
import { formatExecutiveDate } from './scheduleEngine';

export const exportEngine = {
  generateMarkdownBriefing(goal: Goal, isPrivateMode = false): string {
    const today = new Date().toISOString().split('T')[0];
    const moves = goal.microMoves || [];
    const completedMoves = moves.filter((m) => m.status === 'completed').length;
    const completionPct = moves.length > 0 ? Math.round((completedMoves / moves.length) * 100) : 0;

    let md = `# 🎯 Tracer Roadmap: ${goal.title}\n`;
    md += `*Generated: ${today} • Status: ${goal.status.toUpperCase()}*\n\n`;

    md += `## 📋 Overview\n`;
    md += `- **Outcome**: ${goal.vision?.coreOutcome || goal.title}\n`;
    md += `- **Target Date**: ${formatExecutiveDate(goal.vision?.targetDate || '')}\n`;
    md += `- **Progress**: ${completedMoves}/${moves.length} micro-moves completed (${completionPct}%)\n`;
    md += `- **Velocity**: ${goal.velocityFactor || 1.0}x\n\n`;

    md += `## 🏁 Milestones\n`;
    (goal.milestones || []).forEach((m, idx) => {
      const mark = m.status === 'completed' ? '[x]' : '[ ]';
      md += `${idx + 1}. ${mark} **${m.title}** (Target: ${formatExecutiveDate(m.targetDate)}) — *${m.owner || 'You'}*\n`;
    });

    if (!isPrivateMode && moves.length > 0) {
      md += `\n## ⚡ Immediate Micro-Moves\n`;
      moves.slice(0, 5).forEach((mm) => {
        const mark = mm.status === 'completed' ? '[x]' : '[ ]';
        md += `- ${mark} ${mm.title} (${mm.estimatedMinutes}m)\n`;
      });
    }

    return md;
  },

  generateJsonExport(goal: Goal): string {
    return collaborationEngine.exportFlightPlanJson(goal);
  },

  generateCsvExport(goal: Goal): string {
    const headers = 'Milestone,Target Date,Owner,Status\n';
    const rows = (goal.milestones || [])
      .map((m) => `"${m.title}","${m.targetDate}","${m.owner || 'You'}","${m.status}"`)
      .join('\n');
    return headers + rows;
  },

  downloadFile(content: string, filename: string, mimeType: string): void {
    if (typeof document === 'undefined') return;
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  downloadGoalJson(goal: Goal): void {
    const json = this.generateJsonExport(goal);
    this.downloadFile(json, `${goal.title.toLowerCase().replace(/\s+/g, '_')}_roadmap.json`, 'application/json');
  },

  downloadGoalCsv(goal: Goal): void {
    const csv = this.generateCsvExport(goal);
    this.downloadFile(csv, `${goal.title.toLowerCase().replace(/\s+/g, '_')}_milestones.csv`, 'text/csv');
  },

  downloadBriefingMarkdown(goal: Goal, isPrivateMode = false): void {
    const md = this.generateMarkdownBriefing(goal, isPrivateMode);
    this.downloadFile(md, `${goal.title.toLowerCase().replace(/\s+/g, '_')}_briefing.md`, 'text/markdown');
  },

  importFlightPlanJson(jsonStr: string) {
    return collaborationEngine.importFlightPlanJson(jsonStr);
  },

  async shareFlightPlanMarkdown(goal: Goal): Promise<boolean> {
    return collaborationEngine.shareFlightPlan(goal);
  },
};
