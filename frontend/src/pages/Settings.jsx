import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchSettings, updateSettings, fetchGroqModels, peekCache } from '../services/api';
import { useAppContext } from '../context/AppContext';
import { useOnboarding } from '../context/OnboardingContext';
import SettingsSkeleton from '../components/ui/skeletons/SettingsSkeleton';
import FeatureTour from '../components/ui/FeatureTour';

// ─── Tutorial & Help Section (extracted for clarity) ───
const TutorialSection = () => {
  const { replayTutorial, resetTutorial, onboardingData } = useOnboarding();
  const { addNotification } = useAppContext();
  const navigate = useNavigate();
  const [resetting, setResetting] = useState(false);

  const allSeen = onboardingData.dashboardSeen && onboardingData.historySeen && 
    onboardingData.investmentsSeen && onboardingData.cyclicSeen && 
    onboardingData.aiSeen && onboardingData.settingsSeen;

  const handleReplay = () => {
    replayTutorial();
    addNotification({
      title: 'Tutorial Restarted',
      message: 'The onboarding tutorial will guide you through the app again.'
    });
    navigate('/');
  };

  const handleReset = async () => {
    if (!window.confirm('Reset all tutorial progress? You will see the onboarding guides again on each page.')) return;
    setResetting(true);
    try {
      await resetTutorial();
      addNotification({
        title: 'Tutorial Reset',
        message: 'All onboarding progress has been cleared.'
      });
    } catch (err) {
      console.error('Failed to reset tutorial:', err);
    } finally {
      setResetting(false);
    }
  };

  return (
    <section className="bg-surface-container-low border border-outline/10 rounded-2xl p-4 sm:p-6 md:p-8 mt-8" data-onboarding="settings-tutorial">
      <div className="flex items-center gap-3 mb-6">
        <span className="material-symbols-outlined text-primary text-3xl">school</span>
        <h2 className="font-headline font-bold text-xl text-on-surface">Tutorial & Help</h2>
      </div>

      <div className="flex flex-col gap-5">
        {/* Replay Tutorial */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <span className="block text-sm font-bold text-on-surface mb-1">Replay Tutorial</span>
            <span className="block text-xs text-on-surface-variant max-w-md">
              Re-watch the onboarding guides from the beginning. You'll be taken to the Dashboard to start.
            </span>
          </div>
          <button
            type="button"
            onClick={handleReplay}
            className="shrink-0 justify-center bg-primary/10 text-primary px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-primary/20 active:scale-95 transition-all border border-primary/15 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-base">replay</span>
            Replay
          </button>
        </div>

        <div className="h-px bg-outline/10" />

        {/* Reset Tutorial Progress */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <span className="block text-sm font-bold text-on-surface mb-1">Reset Tutorial Progress</span>
            <span className="block text-xs text-on-surface-variant max-w-md">
              {allSeen 
                ? 'All sections have been completed. Reset to see the guides again on each page visit.'
                : 'Clear your progress and the tutorial will appear again as you visit each section.'}
            </span>
          </div>
          <button
            type="button"
            onClick={handleReset}
            disabled={resetting}
            className="shrink-0 justify-center bg-error-container/20 text-error px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-error-container/40 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-error/20 flex items-center gap-2"
          >
            {resetting ? (
              <span className="w-4 h-4 border-2 border-error border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span className="material-symbols-outlined text-base">restart_alt</span>
                Reset
              </>
            )}
          </button>
        </div>
      </div>
    </section>
  );
};

const MASK_PREFIX = '••••••••';
const isMasked = (key) => typeof key === 'string' && key.startsWith(MASK_PREFIX);
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

// Lets other components (e.g. the AI chatbot) pick up changes without a reload.
const broadcastSettings = (saved) => {
  window.dispatchEvent(new CustomEvent('vestor:settings-updated', { detail: saved }));
};

const Toggle = ({ id, checked, disabled, onChange, describedBy }) => (
  <div className="relative shrink-0">
    <input
      type="checkbox"
      role="switch"
      id={id}
      aria-describedby={describedBy}
      aria-checked={checked}
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      className="sr-only peer"
    />
    <div className="w-11 h-6 bg-surface-container-highest rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-on-surface after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-disabled:opacity-60 transition-all"></div>
  </div>
);

const SettingsScreen = () => {
  const { addNotification } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [savingField, setSavingField] = useState(null);
  const [hasPin, setHasPin] = useState(false);
  const [settings, setSettings] = useState({
    aiEnabled: true,
    aiModel: DEFAULT_MODEL,
    groqApiKey: '',
    emailAlertsEnabled: true,
    aiEmailProcessingEnabled: false,
  });
  // Masked form of the key stored on the server ('' if none).
  const [savedKey, setSavedKey] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [models, setModels] = useState([]);
  const [keyStatus, setKeyStatus] = useState({ state: 'idle', message: '' }); // idle | testing | ok | error

  const applySaved = (data) => {
    setSettings({
      aiEnabled: data.aiEnabled !== false,
      aiModel: data.aiModel || DEFAULT_MODEL,
      groqApiKey: data.groqApiKey || '',
      emailAlertsEnabled: data.emailAlertsEnabled ?? true,
      aiEmailProcessingEnabled: data.aiEmailProcessingEnabled === true,
    });
    setSavedKey(data.groqApiKey || '');
  };

  // Saves one change right away; on failure the UI goes back to the saved value.
  const saveField = async (field, patch, successNotice) => {
    const previous = settings;
    setSettings(prev => ({ ...prev, ...patch }));
    setSavingField(field);
    try {
      const saved = await updateSettings(patch);
      applySaved(saved);
      broadcastSettings(saved);
      if (successNotice) addNotification(successNotice);
      return saved;
    } catch (err) {
      console.error(`Failed to save ${field}:`, err);
      setSettings(previous);
      addNotification({ title: 'Error', message: err.message || 'Could not save the setting. Please try again.' });
      return null;
    } finally {
      setSavingField(null);
    }
  };

  // Loads the active models for the saved key, or tests a newly typed one.
  // A new key is saved only after Groq accepts it.
  const testKey = async ({ silent = false } = {}) => {
    const typed = keyInput.trim();
    const newKey = typed && !isMasked(typed) ? typed : '';
    if (!newKey && !savedKey) {
      setKeyStatus({ state: 'error', message: 'Enter a Groq API key first.' });
      return;
    }
    setKeyStatus({ state: 'testing', message: '' });
    try {
      const { models: list } = await fetchGroqModels(newKey || undefined);
      setModels(list);
      const patch = {};
      if (newKey) patch.groqApiKey = newKey;
      // Keep the chosen model if Groq still serves it, otherwise pick a current one.
      if (list.length && !list.some(m => m.id === settings.aiModel)) {
        patch.aiModel = list.some(m => m.id === DEFAULT_MODEL) ? DEFAULT_MODEL : list[0].id;
      }
      if (Object.keys(patch).length) {
        const saved = await saveField('groqApiKey', patch);
        if (!saved) {
          setKeyStatus({ state: 'error', message: 'The key works, but it could not be saved.' });
          return;
        }
        setKeyInput('');
      }
      setKeyStatus({ state: 'ok', message: `Key works. ${list.length} active model${list.length === 1 ? '' : 's'} available.` });
      if (!silent) {
        addNotification({ title: 'API key works', message: newKey ? 'Your Groq API key was verified and saved.' : 'Your Groq API key is valid.' });
      }
    } catch (err) {
      setModels([]);
      setKeyStatus({ state: 'error', message: err.message || 'Could not verify the key.' });
    }
  };

  useEffect(() => {
    // Revisits paint from the last loaded settings, then refresh quietly.
    const cached = peekCache('settings');
    if (cached) {
      applySaved(cached);
      setLoading(false);
    }
    const loadSettings = async () => {
      try {
        const data = await fetchSettings({ fresh: !!cached });
        if (data) applySaved(data);
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();

    const localPin = localStorage.getItem('vestor_app_pin');
    const cookieMatch = document.cookie.match(/(?:^|;\s*)vestor_app_pin=([^;]*)/);
    setHasPin(!!(localPin || (cookieMatch && cookieMatch[1])));
  }, []);

  // Fetch the model list once a saved key is known.
  const [autoLoaded, setAutoLoaded] = useState(false);
  useEffect(() => {
    if (!loading && savedKey && settings.aiEnabled && !autoLoaded) {
      setAutoLoaded(true);
      testKey({ silent: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, savedKey, settings.aiEnabled, autoLoaded]);

  const handleAiToggle = (e) => {
    const enabled = e.target.checked;
    saveField('aiEnabled', { aiEnabled: enabled }, {
      title: enabled ? 'Vestor AI on' : 'Vestor AI off',
      message: enabled ? 'The AI assistant is available again.' : 'The AI assistant has been turned off.',
    });
  };

  const handleEmailAlertsToggle = (e) => {
    const enabled = e.target.checked;
    saveField('emailAlertsEnabled', { emailAlertsEnabled: enabled }, {
      title: enabled ? 'Email alerts on' : 'Email alerts off',
      message: enabled ? 'You will get email reminders for renewals and bills.' : 'Email reminders have been turned off.',
    });
  };

  const handleEmailAiToggle = (e) => {
    const enabled = e.target.checked;
    saveField('aiEmailProcessingEnabled', { aiEmailProcessingEnabled: enabled }, {
      title: enabled ? 'AI email processing on' : 'AI email processing off',
      message: enabled
        ? 'Financial emails will be analyzed with AI from the next Gmail scan.'
        : 'Emails will be read only by built-in rules and not sent to AI.',
    });
  };

  const handleModelChange = (e) => {
    const id = e.target.value;
    saveField('aiModel', { aiModel: id }, { title: 'AI model updated', message: `Vestor AI now uses ${id}.` });
  };

  const handleResetPin = () => {
    if (window.confirm('Are you sure you want to reset your App PIN? You will be prompted to create a new one next time the app locks.')) {
      localStorage.removeItem('vestor_app_pin');
      document.cookie = "vestor_app_pin=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      sessionStorage.removeItem('vestor_is_locked');
      setHasPin(false);
      addNotification({
        title: 'PIN Reset',
        message: 'Your App PIN has been securely removed.'
      });
    }
  };

  if (loading) {
    return <SettingsSkeleton />;
  }

  const hasKey = Boolean(savedKey);
  const testing = keyStatus.state === 'testing';
  // Show the saved model even before the list loads, so the select isn't empty.
  const modelOptions = models.length
    ? models
    : [{ id: settings.aiModel, ownedBy: '', contextWindow: null }];

  return (
    <main className="pt-24 pb-32 px-4 sm:px-6 max-w-3xl w-full mx-auto min-h-screen">
      <h1 className="font-headline font-extrabold text-4xl text-on-surface mb-2">Settings</h1>
      <p className="text-xs text-on-surface-variant mb-8">Changes are saved automatically.</p>

      <div className="flex flex-col gap-8">
        
        {/* Generative AI Settings */}
        <section className="bg-surface-container-low border border-outline/10 rounded-2xl p-4 sm:p-6 md:p-8 relative overflow-hidden" data-onboarding="settings-ai">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl rounded-full"></div>
          
          <div className="flex items-center gap-3 mb-6">
            <span className="material-symbols-outlined text-primary text-3xl">auto_awesome</span>
            <h2 className="font-headline font-bold text-xl text-on-surface">AI Assistant Settings</h2>
          </div>

          <div className="flex flex-col gap-6">
            <label htmlFor="aiEnabled" className="flex items-center justify-between gap-4 cursor-pointer group">
              <div>
                <span className="block text-sm font-bold text-on-surface mb-1">Enable Vestor AI</span>
                <span className="block text-xs text-on-surface-variant max-w-md">Provides interactive chat using your financial context. If disabled, the AI chatbot icon is removed.</span>
              </div>
              <Toggle id="aiEnabled" checked={settings.aiEnabled} disabled={savingField === 'aiEnabled'} onChange={handleAiToggle} />
            </label>

            {settings.aiEnabled && (
              <div className="animate-[slideDown_0.2s_ease-out] flex flex-col gap-6 border-t border-outline/10 pt-6">
                <div>
                  <label htmlFor="groqApiKey" className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                    Groq API Key <span className="text-error text-[10px] normal-case font-semibold">*Required</span>
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      id="groqApiKey"
                      type="password"
                      autoComplete="off"
                      value={keyInput}
                      onChange={(e) => { setKeyInput(e.target.value); if (keyStatus.state !== 'testing') setKeyStatus({ state: 'idle', message: '' }); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); testKey(); } }}
                      placeholder={hasKey ? `Saved key ${savedKey} (type to replace)` : 'gsk_...'}
                      className={`flex-1 min-w-0 bg-surface-container-lowest border rounded-xl py-3 px-4 text-on-surface text-sm focus:outline-none focus:border-primary ${
                        !hasKey || keyStatus.state === 'error' ? 'border-error/40' : 'border-outline/20'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => testKey()}
                      disabled={testing || (!keyInput.trim() && !hasKey)}
                      className="shrink-0 justify-center bg-primary/10 text-primary px-5 py-3 rounded-xl font-bold text-sm hover:bg-primary/20 active:scale-95 transition-all border border-primary/15 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {testing ? (
                        <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <span className="material-symbols-outlined text-base">network_check</span>
                      )}
                      {keyInput.trim() ? 'Test & Save' : 'Test Key'}
                    </button>
                  </div>
                  {keyStatus.message && (
                    <p role="status" className={`mt-2 text-[11px] font-semibold flex items-center gap-1 ${keyStatus.state === 'ok' ? 'text-primary' : 'text-error'}`}>
                      <span className="material-symbols-outlined text-sm">{keyStatus.state === 'ok' ? 'check_circle' : 'error'}</span>
                      {keyStatus.message}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-2 gap-2">
                    <p className="text-[10px] text-on-surface-variant">A new key is saved (encrypted) once Groq accepts it.</p>
                    <a
                      href="https://console.groq.com/keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:text-primary/80 transition-colors shrink-0"
                    >
                      <span className="material-symbols-outlined text-sm">open_in_new</span>
                      Get Groq API Key
                    </a>
                  </div>
                  {!hasKey && (
                    <div className="mt-3 flex items-start gap-2 bg-error-container/10 border border-error/15 rounded-lg px-3 py-2.5">
                      <span className="material-symbols-outlined text-error text-base mt-0.5">warning</span>
                      <p className="text-[11px] text-on-surface-variant leading-relaxed">
                        An API key is required for AI features. Get a free key from <a href="https://console.groq.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline">console.groq.com</a>.
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="aiModel" className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">AI Model</label>
                  <select
                    id="aiModel"
                    value={settings.aiModel}
                    onChange={handleModelChange}
                    disabled={!models.length || savingField === 'aiModel'}
                    className="w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-3 px-4 text-on-surface text-sm focus:outline-none focus:border-primary appearance-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {modelOptions.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.id}{m.ownedBy ? ` · ${m.ownedBy}` : ''}{m.contextWindow ? ` · ${Math.round(m.contextWindow / 1000)}K context` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-on-surface-variant mt-2">
                    {models.length
                      ? 'Live list of models Groq currently has active for your key.'
                      : hasKey ? 'Test your key to load the active Groq models.' : 'Add a working Groq key to choose a model.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
        {/* Notification Settings */}
        <section className="bg-surface-container-low border border-outline/10 rounded-2xl p-4 sm:p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="material-symbols-outlined text-primary text-3xl">mark_email_unread</span>
            <h2 className="font-headline font-bold text-xl text-on-surface">Notification Settings</h2>
          </div>

          <label htmlFor="emailAlertsEnabled" className="flex items-center justify-between gap-4 cursor-pointer group">
            <div>
              <span className="block text-sm font-bold text-on-surface mb-1">Email Alerts</span>
              <span className="block text-xs text-on-surface-variant max-w-md">Receive email reminders for upcoming subscription renewals and credit card bills.</span>
            </div>
            <Toggle id="emailAlertsEnabled" checked={settings.emailAlertsEnabled} disabled={savingField === 'emailAlertsEnabled'} onChange={handleEmailAlertsToggle} />
          </label>
          <p className="text-[10px] text-outline mt-3 italic">Note: In-app notifications are always enabled and cannot be turned off.</p>
        </section>

        {/* Email Processing (Gmail) */}
        <section className="bg-surface-container-low border border-outline/10 rounded-2xl p-4 sm:p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="material-symbols-outlined text-primary text-3xl">mail_lock</span>
            <h2 className="font-headline font-bold text-xl text-on-surface">Email Processing</h2>
          </div>

          <label htmlFor="aiEmailProcessingEnabled" className="flex items-center justify-between gap-4 cursor-pointer group">
            <div>
              <span className="block text-sm font-bold text-on-surface mb-1">Allow AI to process my emails</span>
              <span id="aiEmailProcessingHelp" className="block text-xs text-on-surface-variant max-w-md">
                When on, financial emails from your connected Gmail are analyzed with AI (Groq) for better classification
                and transaction extraction. Card and account numbers are masked first. When off, emails are read only
                by Vestor&apos;s built-in rules and never sent to an AI service.
              </span>
            </div>
            <Toggle
              id="aiEmailProcessingEnabled"
              describedBy="aiEmailProcessingHelp"
              checked={settings.aiEmailProcessingEnabled}
              disabled={savingField === 'aiEmailProcessingEnabled'}
              onChange={handleEmailAiToggle}
            />
          </label>
          {settings.aiEmailProcessingEnabled && !savedKey && (
            <p className="text-[11px] text-on-surface-variant mt-3">
              AI email processing uses a Groq API key. If the server has none configured, add your own Groq key above;
              until then, emails are processed with the built-in rules.
            </p>
          )}
          <p className="text-[10px] text-outline mt-3 italic">Applies from the next Gmail scan. Emails that can&apos;t be read reliably are listed for review in Email management instead of being recorded.</p>
          <Link to="/settings/email" className="group mt-6 flex items-center gap-3 px-4 py-3 rounded-xl border border-outline/15 hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors">
            <span className="material-symbols-outlined text-lg text-primary" aria-hidden="true">inbox</span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-on-surface">Email management</span>
              <span className="block text-xs text-on-surface-variant">Connect and scan Gmail, review bank emails, and stop tracking promotional or unrelated ones.</span>
            </span>
            <span className="material-symbols-outlined text-base text-on-surface-variant ml-auto transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true">arrow_forward</span>
          </Link>
          <Link to="/settings/ai-training" className="group mt-3 flex items-center gap-3 px-4 py-3 rounded-xl border border-outline/15 hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors">
            <span className="material-symbols-outlined text-lg text-primary" aria-hidden="true">school</span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-on-surface">AI training</span>
              <span className="block text-xs text-on-surface-variant">See which emails feed expense suggestions and correct how they&apos;re read.</span>
            </span>
            <span className="material-symbols-outlined text-base text-on-surface-variant ml-auto transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true">arrow_forward</span>
          </Link>
        </section>

        {/* ADDED: Security Settings */}
        <section className="bg-surface-container-low border border-outline/10 rounded-2xl p-4 sm:p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="material-symbols-outlined text-primary text-3xl">lock_reset</span>
            <h2 className="font-headline font-bold text-xl text-on-surface">Security Settings</h2>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div>
              <span className="block text-sm font-bold text-on-surface mb-1">App Lock PIN</span>
              <span className="block text-xs text-on-surface-variant max-w-md">
                {hasPin 
                  ? 'A PIN is currently set to protect your app from unauthorized access.' 
                  : 'No PIN is currently set. The app will prompt you to create one after inactivity.'}
              </span>
            </div>
            <button
              type="button"
              onClick={handleResetPin}
              disabled={!hasPin}
              className="shrink-0 justify-center bg-error-container/20 text-error px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-error-container/40 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-error/20"
            >
              Reset PIN
            </button>
          </div>
        </section>

      </div>

      {/* Tutorial & Help Section */}
      <TutorialSection />

      {/* Privacy & Legal */}
      <section className="bg-surface-container-low border border-outline/10 rounded-2xl p-4 sm:p-6 md:p-8 mt-8" aria-labelledby="settings-legal-title">
        <div className="flex items-center gap-3 mb-6">
          <span className="material-symbols-outlined text-primary text-3xl" aria-hidden="true">policy</span>
          <h2 id="settings-legal-title" className="font-headline font-bold text-xl text-on-surface">Privacy & Legal</h2>
        </div>
        <p className="text-xs text-on-surface-variant max-w-xl mb-5">
          What Vestor collects, how Gmail and AI features use your data, and the terms of using the app.
          Vestor is a tracking tool and does not give financial advice.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          {[['/privacy', 'shield_person', 'Privacy Policy'], ['/terms', 'gavel', 'Terms of Service']].map(([to, icon, label]) => (
            <Link key={to} to={to} className="group flex items-center gap-3 px-4 py-3 rounded-xl border border-outline/15 hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors text-sm font-semibold text-on-surface">
              <span className="material-symbols-outlined text-lg text-primary" aria-hidden="true">{icon}</span>
              {label}
              <span className="material-symbols-outlined text-base text-on-surface-variant ml-auto sm:ml-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true">arrow_forward</span>
            </Link>
          ))}
        </div>
      </section>

      <FeatureTour section="settings" />
    </main>
  );
};

export default SettingsScreen;