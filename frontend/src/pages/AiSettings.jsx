import React, { useEffect, useState } from 'react';
import { fetchGroqModels } from '../services/api';
import { useAppContext } from '../context/AppContext';
import useSettings, { DEFAULT_MODEL, isMasked } from '../hooks/useSettings';
import Toggle from '../components/ui/Toggle';
import { BackLink, PageHeader, Card } from '../components/settings/SettingsUi';

// Settings → Vestor AI: master switch, Groq key, model, and email processing privacy.
const AiSettingsScreen = () => {
  const { addNotification } = useAppContext();
  const { loading, settings, savedKey, savingField, saveField, toggleAi } = useSettings();
  const [keyInput, setKeyInput] = useState('');
  const [models, setModels] = useState([]);
  const [keyStatus, setKeyStatus] = useState({ state: 'idle', message: '' }); // idle | testing | ok | error
  const [autoLoaded, setAutoLoaded] = useState(false);

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
      if (list.length && !list.some((m) => m.id === settings.aiModel)) {
        patch.aiModel = list.some((m) => m.id === DEFAULT_MODEL) ? DEFAULT_MODEL : list[0].id;
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

  // Silent key test once a saved key is known, to populate the model list.
  useEffect(() => {
    if (!loading && savedKey && settings.aiEnabled && !autoLoaded) {
      setAutoLoaded(true);
      testKey({ silent: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, savedKey, settings.aiEnabled, autoLoaded]);

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

  const hasKey = Boolean(savedKey);
  const testing = keyStatus.state === 'testing';
  const keyProblem = !hasKey || keyStatus.state === 'error';
  // Show the saved model even before the list loads, so the select isn't empty.
  const modelOptions = models.length ? models : [{ id: settings.aiModel, ownedBy: '', contextWindow: null }];

  return (
    <main className="pt-24 pb-32 px-4 sm:px-6 max-w-3xl w-full mx-auto min-h-screen">
      <BackLink />
      <PageHeader title="Vestor AI">
        Turn the assistant on or off, connect your Groq key, choose a model and decide whether AI may read your emails.
        Changes are saved automatically.
      </PageHeader>

      <div className="flex flex-col gap-6" aria-busy={loading || undefined}>
        {/* Card 1: master switch */}
        <section aria-label="Vestor AI" className="bg-surface-container-low border border-outline/10 rounded-2xl p-4 sm:p-6">
          <label htmlFor="aiEnabled" className="flex items-center justify-between gap-4 cursor-pointer">
            <span className="min-w-0">
              <span className="block font-headline font-bold text-lg text-on-surface">Enable Vestor AI</span>
              <span id="aiEnabledHelp" className="block text-xs text-on-surface-variant mt-1 max-w-md">Enable the financial chat assistant and AI-powered features.</span>
            </span>
            <Toggle id="aiEnabled" describedBy="aiEnabledHelp" checked={settings.aiEnabled}
              disabled={loading || savingField === 'aiEnabled'} onChange={(e) => toggleAi(e.target.checked)} />
          </label>
        </section>

        {settings.aiEnabled && (
          <>
            {/* Card 2: Groq connection */}
            <Card id="ai-groq-title" icon="key" title="Groq API Connection" className="motion-safe:animate-[slideDown_0.2s_ease-out]">
              <label htmlFor="groqApiKey" className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                Groq API Key <span className="text-error text-[10px] normal-case font-semibold">*Required</span>
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="groqApiKey"
                  type="password"
                  autoComplete="off"
                  value={keyInput}
                  onChange={(e) => { setKeyInput(e.target.value); if (!testing) setKeyStatus({ state: 'idle', message: '' }); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); testKey(); } }}
                  placeholder={hasKey ? `Saved key ${savedKey} (type to replace)` : 'gsk_...'}
                  aria-invalid={keyProblem || undefined}
                  className={`flex-1 min-w-0 bg-surface-container-lowest border rounded-xl py-3 px-4 text-on-surface text-sm focus:outline-none focus:border-primary ${keyProblem ? 'border-error/40' : 'border-outline/20'}`}
                />
                <button
                  type="button"
                  onClick={() => testKey()}
                  disabled={testing || (!keyInput.trim() && !hasKey)}
                  className="shrink-0 justify-center bg-primary/10 text-primary px-5 py-3 rounded-xl font-bold text-sm hover:bg-primary/20 active:translate-y-px transition-colors border border-primary/15 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {testing
                    ? <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                    : <span className="material-symbols-outlined text-base" aria-hidden="true">network_check</span>}
                  {keyInput.trim() ? 'Test & Save' : 'Test Key'}
                </button>
              </div>

              <div role="status" aria-live="polite">
                {keyStatus.state === 'ok' && (
                  <p className="mt-3 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2.5 text-xs font-semibold text-primary">
                    <span className="material-symbols-outlined text-base" aria-hidden="true">check_circle</span>
                    {keyStatus.message}
                  </p>
                )}
                {(keyStatus.state === 'error' || (!hasKey && keyStatus.state !== 'testing')) && (
                  <div className="mt-3 flex items-start gap-2 bg-error-container/10 border border-error/20 rounded-lg px-3 py-2.5">
                    <span className="material-symbols-outlined text-error text-base mt-0.5" aria-hidden="true">warning</span>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      {keyStatus.state === 'error' && <span className="block font-semibold text-error mb-0.5">{keyStatus.message}</span>}
                      An API key is required for AI features. Get a free key from{' '}
                      <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">console.groq.com/keys</a>.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between mt-3 gap-2">
                <p className="text-[11px] text-on-surface-variant">A new key is saved (encrypted) once Groq accepts it.</p>
                <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:text-primary/80 transition-colors">
                  Get Groq API Key ↗
                </a>
              </div>
            </Card>

            {/* Card 3: model */}
            <Card id="ai-model-title" icon="neurology" title="Model Selection">
              <label htmlFor="aiModel" className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">AI Model</label>
              <select
                id="aiModel"
                value={settings.aiModel}
                onChange={handleModelChange}
                disabled={!models.length || savingField === 'aiModel'}
                aria-describedby="aiModelHelp"
                className="w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-3 px-4 text-on-surface text-sm focus:outline-none focus:border-primary cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {modelOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id}{m.ownedBy ? ` · ${m.ownedBy}` : ''}{m.contextWindow ? ` · ${Math.round(m.contextWindow / 1000)}K context` : ''}
                  </option>
                ))}
              </select>
              <p id="aiModelHelp" className="text-[11px] text-on-surface-variant mt-2">
                {models.length
                  ? 'Live list of models Groq currently has active for your key. Saved as soon as you pick one.'
                  : hasKey ? 'Test your key to load the active Groq models.' : 'Add a working Groq key to choose a model.'}
              </p>
            </Card>
          </>
        )}

        {/* Card 4: email processing privacy */}
        <Card id="ai-email-title" icon="mail_lock" title="Email Processing Privacy">
          <label htmlFor="aiEmailProcessingEnabled" className="flex items-center justify-between gap-4 cursor-pointer">
            <span className="min-w-0">
              <span className="block text-sm font-bold text-on-surface mb-1">Allow AI to process my emails</span>
              <span id="aiEmailProcessingHelp" className="block text-xs text-on-surface-variant max-w-md leading-relaxed">
                When off, emails are read only by Vestor&apos;s built-in rules and never sent to an AI service. When on,
                financial emails from your connected Gmail are analyzed with Groq for better classification and
                transaction extraction, with card and account numbers masked first.
              </span>
            </span>
            <Toggle id="aiEmailProcessingEnabled" describedBy="aiEmailProcessingHelp" checked={settings.aiEmailProcessingEnabled}
              disabled={loading || savingField === 'aiEmailProcessingEnabled'} onChange={handleEmailAiToggle} />
          </label>
          {settings.aiEmailProcessingEnabled && !hasKey && (
            <p className="text-xs text-on-surface-variant mt-4 rounded-lg border border-outline/15 px-3 py-2.5">
              AI email processing uses a Groq API key. If the server has none configured, add your own Groq key above;
              until then, emails are processed with the built-in rules.
            </p>
          )}
          <p className="text-[11px] text-outline mt-4">
            Applies from the next Gmail scan. Emails that can&apos;t be read reliably are listed for review in Email Management instead of being recorded.
          </p>
        </Card>
      </div>
    </main>
  );
};

export default AiSettingsScreen;
