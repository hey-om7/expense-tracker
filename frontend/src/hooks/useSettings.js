import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchSettings, updateSettings, peekCache } from '../services/api';
import { useAppContext } from '../context/AppContext';

export const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
export const MASK_PREFIX = '••••••••';
export const isMasked = (key) => typeof key === 'string' && key.startsWith(MASK_PREFIX);

export const fromServer = (data) => ({
  aiEnabled: data.aiEnabled !== false,
  aiModel: data.aiModel || DEFAULT_MODEL,
  groqApiKey: data.groqApiKey || '',
  emailAlertsEnabled: data.emailAlertsEnabled ?? true,
  aiEmailProcessingEnabled: data.aiEmailProcessingEnabled === true,
  browserNotificationsEnabled: data.browserNotificationsEnabled !== false,
  ccReminderDaysBefore: data.ccReminderDaysBefore || 1,
  ccReminderOnDueDate: data.ccReminderOnDueDate === true,
});

const DEFAULTS = fromServer({});

// Lets other parts of the app (AI chatbot, browser pop-ups) pick up changes without a reload.
export const broadcastSettings = (saved) => {
  window.dispatchEvent(new CustomEvent('vestor:settings-updated', { detail: saved }));
};

/**
 * Settings state shared by /settings and /settings/ai.
 * Paints from the cached settings on revisit, refreshes quietly, and saves one
 * change at a time with an optimistic update that rolls back on failure.
 */
const useSettings = () => {
  const { addNotification } = useAppContext();
  const [loading, setLoading] = useState(() => !peekCache('settings'));
  const [savingField, setSavingField] = useState(null);
  const [settings, setSettings] = useState(() => {
    const cached = peekCache('settings');
    return cached ? fromServer(cached) : DEFAULTS;
  });
  // Masked form of the key stored on the server ('' if none).
  const [savedKey, setSavedKey] = useState(() => peekCache('settings')?.groqApiKey || '');
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const applySaved = useCallback((data) => {
    setSettings(fromServer(data));
    setSavedKey(data.groqApiKey || '');
  }, []);

  useEffect(() => {
    const cached = peekCache('settings');
    fetchSettings({ fresh: !!cached })
      .then((data) => { if (data) applySaved(data); })
      .catch((err) => console.error('Failed to load settings:', err))
      .finally(() => setLoading(false));
  }, [applySaved]);

  const saveField = useCallback(async (field, patch, successNotice) => {
    const previous = settingsRef.current;
    setSettings((prev) => ({ ...prev, ...patch }));
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
  }, [addNotification, applySaved]);

  const toggleAi = useCallback((enabled) => saveField('aiEnabled', { aiEnabled: enabled }, {
    title: enabled ? 'Vestor AI on' : 'Vestor AI off',
    message: enabled ? 'The AI assistant is available again.' : 'The AI assistant has been turned off.',
  }), [saveField]);

  return { loading, settings, savedKey, savingField, saveField, toggleAi };
};

export default useSettings;
