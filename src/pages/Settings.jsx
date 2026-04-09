import React, { useState, useEffect } from 'react';
import { fetchSettings, updateSettings } from '../services/api';
import { useAppContext } from '../context/AppContext';

const SettingsScreen = () => {
  const { addNotification } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    aiEnabled: true,
    aiModel: 'gemini-1.5-flash',
    geminiApiKey: '',
    emailAlertsEnabled: true,
  });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await fetchSettings();
        if (data) {
          setSettings({
            aiEnabled: data.aiEnabled,
            aiModel: data.aiModel || 'gemini-1.5-flash',
            geminiApiKey: data.geminiApiKey || '',
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
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
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
    return (
      <main className="pt-24 pb-32 px-6 max-w-3xl mx-auto min-h-screen">
        <div className="animate-pulse flex flex-col gap-4">
          <div className="h-10 w-48 bg-surface-container-highest rounded-lg mb-8"></div>
          <div className="h-64 w-full bg-surface-container-lowest rounded-2xl"></div>
        </div>
      </main>
    );
  }

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
                <span className="block text-sm font-bold text-on-surface mb-1">Enable Wallo AI</span>
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
                    <option value="gemini-1.5-flash">Gemini 1.5 Flash (Fast)</option>
                    <option value="gemini-1.5-pro">Gemini 1.5 Pro (Advanced)</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Custom Gemini API Key <span className="text-[10px] text-outline normal-case font-normal">(Optional)</span></label>
                  <input 
                    type="password" 
                    name="geminiApiKey" 
                    value={settings.geminiApiKey} 
                    onChange={handleChange} 
                    placeholder="AIzaSy..." 
                    className="w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-3 px-4 text-on-surface text-sm focus:outline-none focus:border-primary"
                  />
                  <p className="text-[10px] text-outline mt-2">Leave blank to use the default system API key. Your custom key is stored securely in your database profile.</p>
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
          <p className="text-[10px] text-outline mt-3 italice">Note: In-app notifications are always enabled and cannot be turned off.</p>
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
