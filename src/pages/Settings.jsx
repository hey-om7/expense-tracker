import React, { useState, useEffect } from 'react';
import { fetchSettings, updateSettings } from '../services/api';
import { useAppContext } from '../context/AppContext';
import SettingsSkeleton from '../components/ui/skeletons/SettingsSkeleton';

const SettingsScreen = () => {
  const { addNotification } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasPin, setHasPin] = useState(false); // ADDED: State to track if a PIN exists
  const [settings, setSettings] = useState({
    aiEnabled: true,
    aiModel: 'gemini-2.5-flash',
    geminiApiKey: '',
    groqApiKey: '',
    emailAlertsEnabled: true,
  });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await fetchSettings();
        if (data) {
          setSettings({
            aiEnabled: data.aiEnabled,
            aiModel: data.aiModel || 'gemini-2.5-flash',
            geminiApiKey: data.geminiApiKey || '',
            groqApiKey: data.groqApiKey || '', 
            emailAlertsEnabled: data.emailAlertsEnabled ?? true,
          });
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();

    // ADDED: Check if PIN exists in LocalStorage or Cookies
    const checkPinExists = () => {
      const localPin = localStorage.getItem('vestor_app_pin');
      const cookieMatch = document.cookie.match(/(?:^|;\s*)vestor_app_pin=([^;]*)/);
      setHasPin(!!(localPin || (cookieMatch && cookieMatch[1])));
    };
    checkPinExists();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // ADDED: Function to handle PIN reset
  const handleResetPin = () => {
    if (window.confirm('Are you sure you want to reset your App PIN? You will be prompted to create a new one next time the app locks.')) {
      // Clear LocalStorage
      localStorage.removeItem('vestor_app_pin');
      // Clear Cookie by expiring it
      document.cookie = "vestor_app_pin=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      // Clear Session Lock State
      sessionStorage.removeItem('vestor_is_locked');
      
      setHasPin(false);
      addNotification({
        title: 'PIN Reset',
        message: 'Your App PIN has been securely removed.'
      });
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();

    const isGroqModel = settings.aiModel.includes('llama') || settings.aiModel.includes('mixtral');

    // Validate the correct API key based on the selected model
    if (settings.aiEnabled) {
      if (isGroqModel && !settings.groqApiKey.trim()) {
        addNotification({
          title: 'API Key Required',
          message: 'Please enter your Groq API key to use Groq models.'
        });
        return;
      }
      if (!isGroqModel && !settings.geminiApiKey.trim()) {
        addNotification({
          title: 'API Key Required',
          message: 'Please enter your Gemini API key to use Gemini models.'
        });
        return;
      }
    }

    setSaving(true);
    try {
      await updateSettings(settings);
      addNotification({
        title: 'Settings Saved',
        message: 'Your preferences have been updated successfully.'
      });
      // Simple reload to ensure all app state using settings (like AI Chatbot) captures the update
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      console.error('Failed to save settings:', err);
      addNotification({
        title: 'Error',
        message: 'Failed to save settings. Please try again.'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <SettingsSkeleton />;
  }

  // Helper to determine which key UI to show
  const isGroqModel = settings.aiModel.includes('llama') || settings.aiModel.includes('mixtral');

  return (
    <main className="pt-24 pb-32 px-6 max-w-3xl mx-auto min-h-screen">
      <h1 className="font-headline font-extrabold text-4xl text-on-surface mb-8">Settings</h1>

      <form onSubmit={handleSave} className="flex flex-col gap-8">
        
        {/* Generative AI Settings */}
        <section className="bg-surface-container-low border border-outline/10 rounded-2xl p-6 md:p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl rounded-full"></div>
          
          <div className="flex items-center gap-3 mb-6">
            <span className="material-symbols-outlined text-primary text-3xl">auto_awesome</span>
            <h2 className="font-headline font-bold text-xl text-on-surface">AI Assistant Settings</h2>
          </div>

          <div className="flex flex-col gap-6">
            <label className="flex items-center justify-between cursor-pointer group">
              <div>
                <span className="block text-sm font-bold text-on-surface mb-1">Enable Vestor AI</span>
                <span className="block text-xs text-on-surface-variant max-w-md">Provides interactive chat using your financial context. If disabled, the AI chatbot icon is removed.</span>
              </div>
              <div className="relative">
                <input type="checkbox" name="aiEnabled" checked={settings.aiEnabled} onChange={handleChange} className="sr-only peer" />
                <div className="w-11 h-6 bg-surface-container-highest rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-on-surface after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary transition-all"></div>
              </div>
            </label>

            {settings.aiEnabled && (
              <div className="animate-[slideDown_0.2s_ease-out] flex flex-col gap-6 border-t border-outline/10 pt-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">AI Model</label>
                  <select name="aiModel" value={settings.aiModel} onChange={handleChange} className="w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-3 px-4 text-on-surface text-sm focus:outline-none focus:border-primary appearance-none cursor-pointer">
                    <optgroup label="Google Gemini">
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash (Fast)</option>
                      <option value="gemini-2.5-pro">Gemini 2.5 Pro (Higher Quality)</option>
                      <option value="gemini-pro-latest">Gemini Pro Latest (General)</option>
                    </optgroup>
                    <optgroup label="Groq (Ultra-Fast)">
                      <option value="llama-3.1-8b-instant">Llama 3.1 8B (Instant)</option>
                      <option value="llama-3.3-70b-versatile">Llama 3.3 70B (Versatile)</option>
                      <option value="mixtral-8x7b-32768">Mixtral 8x7B (Large Context)</option>
                    </optgroup>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                    {isGroqModel ? 'Groq API Key' : 'Gemini API Key'} <span className="text-error text-[10px] normal-case font-semibold">*Required</span>
                  </label>
                  <input 
                    type="password" 
                    name={isGroqModel ? "groqApiKey" : "geminiApiKey"} 
                    value={isGroqModel ? settings.groqApiKey : settings.geminiApiKey} 
                    onChange={handleChange} 
                    placeholder={isGroqModel ? "gsk_..." : "AIzaSy..."} 
                    required={settings.aiEnabled}
                    className={`w-full bg-surface-container-lowest border rounded-xl py-3 px-4 text-on-surface text-sm focus:outline-none focus:border-primary ${
                      settings.aiEnabled && (isGroqModel ? !settings.groqApiKey.trim() : !settings.geminiApiKey.trim())
                        ? 'border-error/40' 
                        : 'border-outline/20'
                    }`}
                  />
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-[10px] text-on-surface-variant">Your API key is stored securely in your database profile.</p>
                    <a 
                      href={isGroqModel ? "https://console.groq.com/keys" : "https://aistudio.google.com/app/api-keys/"} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:text-primary/80 transition-colors shrink-0"
                    >
                      <span className="material-symbols-outlined text-sm">open_in_new</span>
                      Get {isGroqModel ? 'Groq' : 'Gemini'} API Key
                    </a>
                  </div>
                  {settings.aiEnabled && (isGroqModel ? !settings.groqApiKey.trim() : !settings.geminiApiKey.trim()) && (
                    <div className="mt-3 flex items-start gap-2 bg-error-container/10 border border-error/15 rounded-lg px-3 py-2.5">
                      <span className="material-symbols-outlined text-error text-base mt-0.5">warning</span>
                      <p className="text-[11px] text-on-surface-variant leading-relaxed">
                        An API key is required for AI features. Get a free key from <a href={isGroqModel ? "https://console.groq.com/" : "https://ai.google.dev/"} target="_blank" rel="noopener noreferrer" className="text-primary underline">{isGroqModel ? 'console.groq.com' : 'ai.google.dev'}</a>.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Notification Settings */}
        <section className="bg-surface-container-low border border-outline/10 rounded-2xl p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="material-symbols-outlined text-primary text-3xl">mark_email_unread</span>
            <h2 className="font-headline font-bold text-xl text-on-surface">Notification Settings</h2>
          </div>

          <label className="flex items-center justify-between cursor-pointer group">
            <div>
              <span className="block text-sm font-bold text-on-surface mb-1">Email Alerts</span>
              <span className="block text-xs text-on-surface-variant max-w-md">Receive email reminders for upcoming subscription renewals and credit card bills.</span>
            </div>
            <div className="relative">
              <input type="checkbox" name="emailAlertsEnabled" checked={settings.emailAlertsEnabled} onChange={handleChange} className="sr-only peer" />
              <div className="w-11 h-6 bg-surface-container-highest rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-on-surface after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary transition-all"></div>
            </div>
          </label>
          <p className="text-[10px] text-outline mt-3 italic">Note: In-app notifications are always enabled and cannot be turned off.</p>
        </section>

        {/* ADDED: Security Settings */}
        <section className="bg-surface-container-low border border-outline/10 rounded-2xl p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="material-symbols-outlined text-primary text-3xl">lock_reset</span>
            <h2 className="font-headline font-bold text-xl text-on-surface">Security Settings</h2>
          </div>

          <div className="flex items-center justify-between gap-4">
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
              className="shrink-0 bg-error-container/20 text-error px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-error-container/40 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-error/20"
            >
              Reset PIN
            </button>
          </div>
        </section>

        {/* Save Button */}
        <div className="flex justify-end mt-4">
          <button 
            type="submit" 
            disabled={saving}
            className="bg-primary-container text-on-primary px-8 py-3.5 rounded-xl font-manrope font-bold shadow-xl shadow-primary-container/20 hover:brightness-110 active:scale-95 transition-all text-sm disabled:opacity-50 flex items-center justify-center min-w-[140px]"
          >
            {saving ? (
               <span className="w-5 h-5 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></span>
            ) : 'Save Changes'}
          </button>
        </div>

      </form>
    </main>
  );
};

export default SettingsScreen;