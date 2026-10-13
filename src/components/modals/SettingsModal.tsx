import React, { useState } from 'react';
import { useGoal } from '../../context/GoalContext';
import { ModalSheet } from '../common/ModalSheet';
import {
  Key,
  ShieldCheck,
  Compass,
  Trash2,
  Volume2,
  VolumeX,
  Sparkles,
  Share2,
  Bell,
  Lock,
  Unlock,
  Check,
  Plus,
  Activity,
  Server,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  History,
  Vibrate,
} from 'lucide-react';
import { soundManager } from '../../services/sound';
import { androidBridge } from '../../services/androidBridge';
import { feedback } from '../../services/feedback';
import { notificationEngine } from '../../services/notificationEngine';
import { useVaultSecurity } from '../../hooks/useVaultSecurity';
import { AutoLockInterval, AIProvider, TrajectoryRecord } from '../../types/goal';
import { storage } from '../../services/storage';
import { testAIConnection } from '../../services/aiEngine';
import { TrajectorySheet } from './TrajectorySheet';

interface SettingsModalProps {
  onClose: () => void;
  onOpenAuthModal?: (options?: { actionType?: 'unlock' | 'destructive' | 'setup'; title?: string; description?: string; onSuccess?: () => void }) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, onOpenAuthModal }) => {
  const {
    goals,
    activeGoal,
    setActiveGoalId,
    deleteGoal,
    apiKey,
    setApiKey,
    aiProvider: contextAiProvider,
    setAiProvider: setContextAiProvider,
    deepSeekApiKey: contextDeepSeekApiKey,
    setDeepSeekApiKey: setContextDeepSeekApiKey,
    openAIApiKey: contextOpenAIApiKey,
    setOpenAIApiKey: setContextOpenAIApiKey,
    anthropicApiKey: contextAnthropicApiKey,
    setAnthropicApiKey: setContextAnthropicApiKey,
    customApiKey: contextCustomApiKey,
    setCustomApiKey: setContextCustomApiKey,
    customBaseUrl: contextCustomBaseUrl,
    setCustomBaseUrl: setContextCustomBaseUrl,
    aiModelName: contextAiModelName,
    setAiModelName: setContextAiModelName,
    trajectory,
    clearTrajectory,
    purgeAllAgentData,
    soundMuted,
    setSoundMuted,
    soundVolume,
    setSoundVolume,
    shareFlightPlan,
    setActiveTab,
  } = useGoal();

  const {
    isShieldEnabled,
    isShielded,
    autoLockInterval,
    setAutoLockInterval,
    lock,
    unlock,
  } = useVaultSecurity();

  const [aiProvider, setAiProvider] = useState<AIProvider>(() => contextAiProvider || storage.getAiProvider());
  const [geminiKey, setGeminiKey] = useState<string>(apiKey || storage.getApiKey());
  const [deepSeekKey, setDeepSeekKey] = useState<string>(() => contextDeepSeekApiKey || storage.getDeepSeekApiKey());
  const [openAIKey, setOpenAIKey] = useState<string>(() => contextOpenAIApiKey || storage.getOpenAIApiKey());
  const [anthropicKey, setAnthropicKey] = useState<string>(() => contextAnthropicApiKey || storage.getAnthropicApiKey());
  const [customBaseUrlState, setCustomBaseUrlState] = useState<string>(() => storage.getAiBaseUrl('custom') || 'http://localhost:11434/v1');
  const [customModelNameState, setCustomModelNameState] = useState<string>(() => storage.getAiModelName('custom') || 'llama3.3');
  const [customApiKeyInput, setCustomApiKeyInput] = useState<string>(() => storage.getCustomApiKey() || '');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showDeepSeekKey, setShowDeepSeekKey] = useState(false);
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showCustomKey, setShowCustomKey] = useState(false);
  const [savedKeySuccess, setSavedKeySuccess] = useState(false);
  const [showTrajectoryLedger, setShowTrajectoryLedger] = useState(false);
  const [showFullTrajectorySheet, setShowFullTrajectorySheet] = useState(false);
  const [hapticsEnabled, setHapticsEnabled] = useState<boolean>(() => storage.getHapticsEnabled());
  const [testResult, setTestResult] = useState<{
    testing: boolean;
    provider?: AIProvider;
    success?: boolean;
    message?: string;
    latencyMs?: number;
  }>({ testing: false });
  const [hasNotificationPermission, setHasNotificationPermission] = useState<boolean>(() => notificationEngine.isSupported());

  const handleSelectProvider = (prov: AIProvider) => {
    soundManager.playTick();
    androidBridge.triggerHaptic('selection');
    setAiProvider(prov);
    setContextAiProvider(prov);
    storage.saveAiProvider(prov);
  };

  const handleSaveKeys = (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.playTick();
    androidBridge.triggerHaptic('selection');
    setApiKey(geminiKey.trim());
    storage.saveApiKey(geminiKey.trim());
    setContextDeepSeekApiKey(deepSeekKey.trim());
    storage.saveDeepSeekApiKey(deepSeekKey.trim());
    setContextOpenAIApiKey(openAIKey.trim());
    storage.saveOpenAIApiKey(openAIKey.trim());
    setContextAnthropicApiKey(anthropicKey.trim());
    storage.saveAnthropicApiKey(anthropicKey.trim());
    setContextCustomApiKey(customApiKeyInput.trim());
    storage.saveCustomApiKey(customApiKeyInput.trim());
    setContextCustomBaseUrl(customBaseUrlState.trim());
    storage.saveAiBaseUrl(customBaseUrlState.trim());
    setContextAiModelName(customModelNameState.trim());
    storage.saveAiModelName(customModelNameState.trim());
    setContextAiProvider(aiProvider);
    storage.saveAiProvider(aiProvider);
    setSavedKeySuccess(true);
    setTimeout(() => setSavedKeySuccess(false), 2500);
  };

  const handleTestConnection = async (prov: AIProvider) => {
    soundManager.playTick();
    androidBridge.triggerHaptic('medium');
    let keyToTest = '';
    if (prov === 'gemini') keyToTest = geminiKey.trim();
    else if (prov === 'deepseek') keyToTest = deepSeekKey.trim();
    else if (prov === 'openai') keyToTest = openAIKey.trim();
    else if (prov === 'anthropic') keyToTest = anthropicKey.trim();
    else keyToTest = customApiKeyInput.trim();

    setTestResult({ testing: true, provider: prov });
    const res = await testAIConnection(prov, keyToTest, customBaseUrlState, customModelNameState);
    if (res.success) {
      soundManager.playCompleteChime();
      androidBridge.triggerHaptic('success');
    } else {
      soundManager.playBlockerThud();
      androidBridge.triggerHaptic('error');
    }
    setTestResult({
      testing: false,
      provider: prov,
      success: res.success,
      message: res.message,
      latencyMs: res.latencyMs,
    });
  };

  const handlePurgeAgentTables = () => {
    soundManager.playTick();
    androidBridge.triggerHaptic('warning');
    const confirmed = confirm(
      'Clean Slate: Purge all agent tables, execution trajectory ledger, reflections, and generated history from device storage?'
    );
    if (!confirmed) return;
    purgeAllAgentData();
    window.location.reload();
  };

  const handlePurgeAllData = () => {
    soundManager.playTick();
    androidBridge.triggerHaptic('warning');
    const confirmed = confirm(
      'Are you sure you want to permanently purge all flight plans, trajectory ledger history, reflections, and credentials from device storage? This cannot be undone.'
    );
    if (!confirmed) return;

    soundManager.playBlockerThud();
    androidBridge.triggerHaptic('error');
    storage.purgeAllData();
    window.location.reload();
  };

  const handleClearTrajectory = () => {
    soundManager.playTick();
    androidBridge.triggerHaptic('light');
    clearTrajectory();
  };

  const handleRequestNotification = async () => {
    soundManager.playTick();
    androidBridge.triggerHaptic('selection');
    const granted = await notificationEngine.requestPermission();
    setHasNotificationPermission(granted);
  };

  const handleTestNotification = async () => {
    soundManager.playTick();
    androidBridge.triggerHaptic('notification');
    await notificationEngine.notify({
      title: activeGoal ? activeGoal.title : 'Tracer Milestone',
      body: 'Autonomous execution check-in ready.',
    });
  };

  const handleDeleteGoal = (goalId: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    soundManager.playTick();
    if (confirm(`Delete "${title}"?`)) {
      deleteGoal(goalId);
    }
  };

  return (
    <ModalSheet
      onClose={onClose}
      title="System Preferences"
      subtitle="Configure Android ergonomics and intelligence"
      icon={Compass}
      iconBgColor="bg-terracotta/15 text-terracotta border border-terracotta/30"
      maxWidth="max-w-md"
      maxHeight="max-h-[88vh]"
    >
      <div className="space-y-4 py-2 select-none text-xs">
        {/* Objectives Management */}
        <div className="p-4 rounded-2xl bg-bone-900/80 border border-white/[0.08] space-y-3 shadow-surface">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-bone-100 uppercase tracking-wider text-[11px]">Objectives</span>
            <button
              onClick={() => {
                onClose();
                setActiveTab('intake');
              }}
              className="min-h-[48px] px-3.5 py-2 rounded-xl bg-terracotta/15 text-terracotta font-semibold flex items-center gap-1 border border-terracotta/30 m3-press"
            >
              <Plus className="w-3.5 h-3.5" /> New Objective
            </button>
          </div>

          <div className="space-y-2 max-h-40 overflow-y-auto">
            {goals.map(g => (
              <div
                key={g.id}
                onClick={() => {
                  soundManager.playTick();
                  androidBridge.triggerHaptic('selection');
                  setActiveGoalId(g.id);
                }}
                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                  activeGoal?.id === g.id
                    ? 'bg-terracotta/15 border-terracotta/40 text-bone-100'
                    : 'bg-bone-800/60 border-white/5 text-bone-300 hover:border-white/10'
                }`}
              >
                <div className="min-w-0 flex-1 pr-2">
                  <p className="font-semibold text-sm truncate">{g.title}</p>
                  <span className="text-[11px] text-bone-400 font-mono">
                    {g.milestones?.length || 0} milestones • {g.weeklyCapacityHours}h/wk
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {activeGoal?.id === g.id && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-terracotta text-white">
                      Active
                    </span>
                  )}
                  {goals.length > 1 && (
                    <button
                      onClick={e => handleDeleteGoal(g.id, g.title, e)}
                      className="min-h-[48px] min-w-[48px] p-2 text-bone-500 hover:text-rust m3-press flex items-center justify-center"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Provider Intelligence Switcher (Gemini / DeepSeek / OpenAI / Anthropic / Custom) */}
        <div className="p-4 rounded-2xl bg-bone-900/80 border border-white/[0.08] space-y-3 shadow-surface">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-bone-100">
              <Key className="w-4 h-4 text-terracotta" />
              <span>AI Engine & Frontier Gateway</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-terracotta/15 text-terracotta border border-terracotta/30 font-bold capitalize">
              {aiProvider}
            </span>
          </div>
          <p className="text-bone-400 text-[11px] leading-relaxed">
            Select your frontier model or custom local engine for live plan decomposition and Socratic intake.
          </p>

          {/* M3 5-Way Segmented Provider Switcher */}
          <div className="grid grid-cols-5 gap-1 p-1 bg-bone-800 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => handleSelectProvider('gemini')}
              className={`min-h-[48px] rounded-lg text-[11px] font-semibold flex items-center justify-center p-1 m3-press transition-all ${
                aiProvider === 'gemini'
                  ? 'bg-terracotta text-white shadow-surface'
                  : 'text-bone-300 hover:text-bone-100'
              }`}
            >
              <span>Gemini</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectProvider('deepseek')}
              className={`min-h-[48px] rounded-lg text-[11px] font-semibold flex items-center justify-center p-1 m3-press transition-all ${
                aiProvider === 'deepseek'
                  ? 'bg-terracotta text-white shadow-surface'
                  : 'text-bone-300 hover:text-bone-100'
              }`}
            >
              <span>DeepSeek</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectProvider('openai')}
              className={`min-h-[48px] rounded-lg text-[11px] font-semibold flex items-center justify-center p-1 m3-press transition-all ${
                aiProvider === 'openai'
                  ? 'bg-terracotta text-white shadow-surface'
                  : 'text-bone-300 hover:text-bone-100'
              }`}
            >
              <span>OpenAI</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectProvider('anthropic')}
              className={`min-h-[48px] rounded-lg text-[11px] font-semibold flex items-center justify-center p-1 m3-press transition-all ${
                aiProvider === 'anthropic'
                  ? 'bg-terracotta text-white shadow-surface'
                  : 'text-bone-300 hover:text-bone-100'
              }`}
            >
              <span>Claude</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectProvider('custom')}
              className={`min-h-[48px] rounded-lg text-[11px] font-semibold flex items-center justify-center p-1 m3-press transition-all ${
                aiProvider === 'custom'
                  ? 'bg-terracotta text-white shadow-surface'
                  : 'text-bone-300 hover:text-bone-100'
              }`}
            >
              <span>Custom</span>
            </button>
          </div>

          <form onSubmit={handleSaveKeys} className="space-y-2.5 pt-1">
            {aiProvider === 'gemini' ? (
              <div className="space-y-1.5">
                <label className="text-[11px] text-bone-300 font-medium">Gemini API Key:</label>
                <div className="relative">
                  <input
                    type={showGeminiKey ? 'text' : 'password'}
                    value={geminiKey}
                    onChange={e => setGeminiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full min-h-[48px] px-3 pr-20 rounded-xl bg-bone-800 border border-white/10 text-bone-100 text-xs font-mono focus:outline-none focus:border-terracotta"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGeminiKey(!showGeminiKey)}
                    className="absolute right-0 top-0 bottom-0 min-h-[48px] px-3 flex items-center justify-center text-xs text-bone-400 hover:text-bone-200 m3-press"
                  >
                    {showGeminiKey ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
            ) : aiProvider === 'deepseek' ? (
              <div className="space-y-1.5">
                <label className="text-[11px] text-bone-300 font-medium">DeepSeek API Key:</label>
                <div className="relative">
                  <input
                    type={showDeepSeekKey ? 'text' : 'password'}
                    value={deepSeekKey}
                    onChange={e => setDeepSeekKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full min-h-[48px] px-3 pr-20 rounded-xl bg-bone-800 border border-white/10 text-bone-100 text-xs font-mono focus:outline-none focus:border-terracotta"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDeepSeekKey(!showDeepSeekKey)}
                    className="absolute right-0 top-0 bottom-0 min-h-[48px] px-3 flex items-center justify-center text-xs text-bone-400 hover:text-bone-200 m3-press"
                  >
                    {showDeepSeekKey ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
            ) : aiProvider === 'openai' ? (
              <div className="space-y-1.5">
                <label className="text-[11px] text-bone-300 font-medium">OpenAI API Key:</label>
                <div className="relative">
                  <input
                    type={showOpenAIKey ? 'text' : 'password'}
                    value={openAIKey}
                    onChange={e => setOpenAIKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full min-h-[48px] px-3 pr-20 rounded-xl bg-bone-800 border border-white/10 text-bone-100 text-xs font-mono focus:outline-none focus:border-terracotta"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOpenAIKey(!showOpenAIKey)}
                    className="absolute right-0 top-0 bottom-0 min-h-[48px] px-3 flex items-center justify-center text-xs text-bone-400 hover:text-bone-200 m3-press"
                  >
                    {showOpenAIKey ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
            ) : aiProvider === 'anthropic' ? (
              <div className="space-y-1.5">
                <label className="text-[11px] text-bone-300 font-medium">Anthropic API Key:</label>
                <div className="relative">
                  <input
                    type={showAnthropicKey ? 'text' : 'password'}
                    value={anthropicKey}
                    onChange={e => setAnthropicKey(e.target.value)}
                    placeholder="sk-ant-..."
                    className="w-full min-h-[48px] px-3 pr-20 rounded-xl bg-bone-800 border border-white/10 text-bone-100 text-xs font-mono focus:outline-none focus:border-terracotta"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                    className="absolute right-0 top-0 bottom-0 min-h-[48px] px-3 flex items-center justify-center text-xs text-bone-400 hover:text-bone-200 m3-press"
                  >
                    {showAnthropicKey ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="space-y-1.5">
                  <label className="text-[11px] text-bone-300 font-medium">Base URL (Ollama / Local / vLLM / Groq):</label>
                  <input
                    type="text"
                    value={customBaseUrlState}
                    onChange={e => setCustomBaseUrlState(e.target.value)}
                    placeholder="http://localhost:11434/v1"
                    className="w-full min-h-[48px] px-3 rounded-xl bg-bone-800 border border-white/10 text-bone-100 text-xs font-mono focus:outline-none focus:border-terracotta"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] text-bone-300 font-medium">Model Name:</label>
                  <input
                    type="text"
                    value={customModelNameState}
                    onChange={e => setCustomModelNameState(e.target.value)}
                    placeholder="llama3.3 or mistral"
                    className="w-full min-h-[48px] px-3 rounded-xl bg-bone-800 border border-white/10 text-bone-100 text-xs font-mono focus:outline-none focus:border-terracotta"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] text-bone-300 font-medium">Optional API Key / Bearer Token:</label>
                  <div className="relative">
                    <input
                      type={showCustomKey ? 'text' : 'password'}
                      value={customApiKeyInput}
                      onChange={e => setCustomApiKeyInput(e.target.value)}
                      placeholder="sk-... (leave empty for Ollama)"
                      className="w-full min-h-[48px] px-3 pr-20 rounded-xl bg-bone-800 border border-white/10 text-bone-100 text-xs font-mono focus:outline-none focus:border-terracotta"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCustomKey(!showCustomKey)}
                      className="absolute right-0 top-0 bottom-0 min-h-[48px] px-3 flex items-center justify-center text-xs text-bone-400 hover:text-bone-200 m3-press"
                    >
                      {showCustomKey ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Test Connection Button & Status */}
            <div className="pt-1 flex items-center gap-2">
              <button
                type="button"
                disabled={testResult.testing}
                onClick={() => handleTestConnection(aiProvider)}
                className="flex-1 min-h-[48px] rounded-xl bg-bone-800/90 hover:bg-bone-700/90 border border-white/10 text-bone-200 font-semibold text-xs flex items-center justify-center gap-1.5 m3-press disabled:opacity-40 capitalize"
              >
                <span>⚡ Test {aiProvider} Connection</span>
              </button>
            </div>

            {testResult.provider === aiProvider && testResult.message && (
              <div
                className={`p-2.5 rounded-xl border text-xs font-mono flex items-center justify-between ${
                  testResult.success
                    ? 'bg-sage/15 border-sage/30 text-sage'
                    : 'bg-rust/15 border-rust/30 text-rust'
                }`}
              >
                <span>{testResult.success ? '🟢' : '🔴'} {testResult.message}</span>
                {testResult.latencyMs && (
                  <span className="font-bold">{testResult.latencyMs}ms</span>
                )}
              </div>
            )}

            <button
              type="submit"
              className="min-h-[48px] w-full rounded-xl bg-terracotta hover:bg-terracotta-hover text-white font-semibold text-xs flex items-center justify-center gap-1.5 m3-press shadow-surface"
            >
              {savedKeySuccess ? <Check className="w-4 h-4 text-white" /> : <Key className="w-4 h-4" />}
              <span>{savedKeySuccess ? 'Configuration Saved' : 'Save AI Configuration'}</span>
            </button>
          </form>
        </div>

        {/* Trajectory Ledger Viewer & Launcher */}
        <div className="p-4 rounded-2xl bg-bone-900/80 border border-white/[0.08] space-y-3 shadow-surface">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-bone-100">
              <Activity className="w-4 h-4 text-terracotta" />
              <span>HITL Trajectory Ledger</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-bone-800 text-bone-300 border border-white/10 font-bold">
              {trajectory.length} actions
            </span>
          </div>
          <p className="text-bone-400 text-[11px] leading-relaxed">
            Every autonomous agent recommendation is logged here for explicit human approval or rejection.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                soundManager.playTick();
                androidBridge.triggerHaptic('medium');
                setShowFullTrajectorySheet(true);
              }}
              className="flex-1 min-h-[48px] rounded-xl bg-terracotta/20 hover:bg-terracotta/30 text-terracotta border border-terracotta/30 font-semibold text-xs flex items-center justify-center gap-1.5 m3-press"
            >
              <History className="w-4 h-4" />
              <span>Open Trajectory Audit Sheet</span>
            </button>
            {trajectory.length > 0 && (
              <button
                type="button"
                onClick={clearTrajectory}
                className="min-h-[48px] px-3 rounded-xl bg-bone-800 text-rust hover:bg-rust/10 border border-white/10 font-semibold text-xs m3-press"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Device Notifications */}
        <div className="p-4 rounded-2xl bg-bone-900/80 border border-white/[0.08] space-y-2 shadow-surface">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-bone-100">
              <Bell className="w-4 h-4 text-amber" />
              <span>Android Notifications</span>
            </div>
            <button
              onClick={handleRequestNotification}
              className="min-h-[48px] px-3 py-1.5 rounded-xl bg-bone-800 border border-white/10 text-bone-200 font-semibold m3-press text-[11px]"
            >
              {hasNotificationPermission ? 'Enabled' : 'Request Permission'}
            </button>
          </div>
          <button
            onClick={handleTestNotification}
            className="min-h-[48px] w-full rounded-xl bg-bone-800/80 hover:bg-bone-700/80 border border-white/10 text-bone-200 font-semibold text-xs m3-press"
          >
            Send Test Android Alarm Notification
          </button>
        </div>

        {/* Biometric Vault & Security */}
        <div className="p-4 rounded-2xl bg-bone-900/80 border border-white/[0.08] space-y-3 shadow-surface">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-bone-100">
              <ShieldCheck className="w-4 h-4 text-sage" />
              <span>Biometric Memory Vault</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sage/15 text-sage border border-sage/30">
              {isShieldEnabled ? 'Protected' : 'Off'}
            </span>
          </div>
          <p className="text-bone-400 text-[11px]">
            AES-256 device-only encryption for personal reflection remarks and private friction logs.
          </p>
          <div className="flex items-center gap-2">
            <label className="text-bone-300 font-medium text-[11px]">Auto-Lock Interval:</label>
            <select
              value={autoLockInterval}
              onChange={e => setAutoLockInterval(e.target.value as AutoLockInterval)}
              className="min-h-[48px] px-2 py-1 rounded-xl bg-bone-800 border border-white/10 text-bone-200 text-xs focus:outline-none"
            >
              <option value="immediate">Immediate</option>
              <option value="1min">1 Minute</option>
              <option value="5min">5 Minutes</option>
              <option value="15min">15 Minutes</option>
              <option value="never">Never</option>
            </select>
          </div>
        </div>

        {/* Audio & Haptics Feedback */}
        <div className="p-4 rounded-2xl bg-bone-900/80 border border-white/[0.08] flex items-center justify-between shadow-surface">
          <div className="flex items-center gap-2">
            {soundMuted ? <VolumeX className="w-4 h-4 text-bone-400" /> : <Volume2 className="w-4 h-4 text-terracotta" />}
            <span className="font-semibold text-bone-100">Tactile Audio Chimes</span>
          </div>
          <button
            onClick={() => {
              feedback.selection();
              setSoundMuted(!soundMuted);
              if (soundMuted) feedback.complete();
            }}
            className={`min-h-[48px] px-3.5 py-1.5 rounded-xl font-semibold text-xs m3-press border ${
              !soundMuted
                ? 'bg-terracotta/20 text-terracotta border-terracotta/30'
                : 'bg-bone-800 text-bone-400 border-white/10'
            }`}
          >
            {soundMuted ? 'Muted' : 'Enabled'}
          </button>
        </div>

        {/* Tactile Haptics Feedback */}
        <div className="p-4 rounded-2xl bg-bone-900/80 border border-white/[0.08] flex items-center justify-between shadow-surface">
          <div className="flex items-center gap-2">
            <Vibrate className="w-4 h-4 text-terracotta" />
            <span className="font-semibold text-bone-100">Tactile Haptic Feedback</span>
          </div>
          <button
            onClick={() => {
              const next = !hapticsEnabled;
              setHapticsEnabled(next);
              storage.saveHapticsEnabled(next);
              if (next) feedback.selection();
            }}
            className={`min-h-[48px] px-3.5 py-1.5 rounded-xl font-semibold text-xs m3-press border ${
              hapticsEnabled
                ? 'bg-terracotta/20 text-terracotta border-terracotta/30'
                : 'bg-bone-800 text-bone-400 border-white/10'
            }`}
          >
            {hapticsEnabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        {/* Agent Table Management & Clean Slate */}
        <div className="p-4 rounded-2xl bg-rust/10 border border-rust/25 space-y-3 shadow-surface">
          <div className="flex items-center gap-2 text-rust font-semibold text-xs">
            <AlertTriangle className="w-4 h-4" />
            <span>Agent Governance • Clean Slate</span>
          </div>
          <p className="text-bone-400 text-[11px] leading-relaxed">
            Purge all agent tables, crew rosters, and autonomous trajectory history back to zero dummy data.
          </p>
          <div className="space-y-2">
            <button
              type="button"
              onClick={handlePurgeAgentTables}
              className="w-full min-h-[52px] rounded-2xl bg-rust/90 hover:bg-rust text-white font-bold text-xs flex items-center justify-center gap-2 m3-press shadow-surface transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>🧹 Purge Agent Tables & History</span>
            </button>
            <button
              type="button"
              onClick={handlePurgeAllData}
              className="w-full min-h-[48px] rounded-xl bg-bone-800/80 hover:bg-bone-700/80 text-bone-400 font-medium text-[11px] flex items-center justify-center gap-1.5 m3-press transition-colors"
            >
              <span>Hard Factory Reset (All Goals & Keys)</span>
            </button>
          </div>
        </div>
      </div>

      {showFullTrajectorySheet && (
        <TrajectorySheet onClose={() => setShowFullTrajectorySheet(false)} />
      )}
    </ModalSheet>
  );
};
