import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as api from '../services/api';
import { useAppContext } from '../context/AppContext';
import { useOnboarding } from '../context/OnboardingContext';
import useSettings from '../hooks/useSettings';
import SettingsSkeleton from '../components/ui/skeletons/SettingsSkeleton';
import FeatureTour from '../components/ui/FeatureTour';
import Toggle from '../components/ui/Toggle';
import { SettingsGroup, NavRow, InlineRow, secondaryBtn } from '../components/settings/SettingsUi';

const readPin = () => {
  const localPin = localStorage.getItem('vestor_app_pin');
  const cookieMatch = document.cookie.match(/(?:^|;\s*)vestor_app_pin=([^;]*)/);
  return !!(localPin || (cookieMatch && cookieMatch[1]));
};

// Number of distinct untracked cards (same grouping as Email Management).
const countCards = (pending) => new Set(pending.map((s) => `${s.senderDomain}|${s.last4 || ''}`)).size;

// Gmail summary for the Email Management row. Uses the Email Management snapshot when there is one.
const useGmailSummary = () => {
  const [summary, setSummary] = useState(() => {
    const snap = api.peekCache('gmail-panel');
    return snap ? { status: snap.status, review: snap.review.length, cards: countCards(snap.pending) } : null;
  });

  useEffect(() => {
    let alive = true;
    Promise.all([
      api.fetchGmailStatus(),
      api.fetchFinancialEmails('review').catch(() => []),
      api.fetchCardStatements({ status: 'pending' }).catch(() => []),
    ])
      .then(([status, review, pending]) => { if (alive) setSummary({ status, review: review.length, cards: countCards(pending) }); })
      .catch(() => { if (alive) setSummary((s) => s || { status: { connected: false }, review: 0, cards: 0 }); });
    return () => { alive = false; };
  }, []);

  return summary;
};

const SettingsScreen = () => {
  const { addNotification } = useAppContext();
  const { replayTutorial, resetTutorial, onboardingData } = useOnboarding();
  const navigate = useNavigate();
  const { loading, settings, savedKey, savingField, toggleAi } = useSettings();
  const gmail = useGmailSummary();
  const [hasPin, setHasPin] = useState(readPin);
  const [resetting, setResetting] = useState(false);

  if (loading) return <SettingsSkeleton />;

  // AI row
  const aiSubtitle = !settings.aiEnabled ? 'Off'
    : savedKey ? `On · ${settings.aiModel} · Key active`
    : 'Action required: Groq API key missing';
  const aiTone = settings.aiEnabled && !savedKey ? 'text-amber-400 font-semibold' : undefined;

  // Email row
  const connected = gmail?.status?.connected;
  const emailSubtitle = !gmail ? 'Checking Gmail…'
    : connected ? `Connected (${gmail.status.gmailAddress}) · ${gmail.review} to review`
    : 'Connect Gmail to auto-track statements';
  const emailBadge = gmail ? gmail.review + gmail.cards : 0;

  // Notifications row
  const notifSubtitle = `Browser pop-ups ${settings.browserNotificationsEnabled ? 'on' : 'off'} · Email ${settings.emailAlertsEnabled
    ? `on, bills ${settings.ccReminderDaysBefore === 1 ? '1 day' : `${settings.ccReminderDaysBefore} days`} before${settings.ccReminderOnDueDate ? ' and on the due date' : ''}`
    : 'off'}`;

  // Tutorial row
  const allSeen = onboardingData.dashboardSeen && onboardingData.historySeen && onboardingData.investmentsSeen
    && onboardingData.cyclicSeen && onboardingData.aiSeen && onboardingData.settingsSeen;

  const handleResetPin = () => {
    if (!window.confirm('Are you sure you want to reset your App PIN? You will be prompted to create a new one next time the app locks.')) return;
    localStorage.removeItem('vestor_app_pin');
    document.cookie = 'vestor_app_pin=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    sessionStorage.removeItem('vestor_is_locked');
    setHasPin(false);
    addNotification({ title: 'PIN Reset', message: 'Your App PIN has been securely removed.' });
  };

  const handleReplay = () => {
    replayTutorial();
    addNotification({ title: 'Tutorial Restarted', message: 'The onboarding tutorial will guide you through the app again.' });
    navigate('/');
  };

  const handleResetTutorial = async () => {
    if (!window.confirm('Reset all tutorial progress? You will see the onboarding guides again on each page.')) return;
    setResetting(true);
    try {
      await resetTutorial();
      addNotification({ title: 'Tutorial Reset', message: 'All onboarding progress has been cleared.' });
    } catch (err) {
      console.error('Failed to reset tutorial:', err);
    } finally {
      setResetting(false);
    }
  };

  return (
    <main className="pt-24 pb-32 px-4 sm:px-6 max-w-3xl w-full mx-auto min-h-screen">
      <h1 className="font-headline font-extrabold text-4xl text-on-surface mb-2">Settings</h1>
      <p className="text-xs text-on-surface-variant mb-8">Changes are saved automatically.</p>

      <div className="flex flex-col gap-8">
        <SettingsGroup id="settings-group-ai" title="Intelligence & Automation">
          <NavRow
            to="/settings/ai"
            icon="auto_awesome"
            title="Vestor AI"
            subtitle={aiSubtitle}
            subtitleTone={aiTone}
            onboarding="settings-ai"
            control={(
              <label htmlFor="aiEnabled" className="shrink-0 cursor-pointer p-1" onClick={(e) => e.stopPropagation()}>
                <span className="sr-only">Enable Vestor AI</span>
                <Toggle id="aiEnabled" checked={settings.aiEnabled} disabled={savingField === 'aiEnabled'}
                  onChange={(e) => toggleAi(e.target.checked)} />
              </label>
            )}
          />
          <NavRow to="/settings/email" icon="inbox" title="Email Management" subtitle={emailSubtitle} badge={emailBadge} />
          <NavRow to="/settings/ai-training" icon="school" title="Teach Vestor Your Emails"
            subtitle="Train custom extraction rules for bank & UPI alerts" />
        </SettingsGroup>

        <SettingsGroup id="settings-group-alerts" title="Alerts & Schedule">
          <NavRow to="/settings/notifications" icon="notifications" title="Notifications" subtitle={notifSubtitle} onboarding="settings-notifications" />
        </SettingsGroup>

        <SettingsGroup id="settings-group-device" title="Device Security & Help">
          <InlineRow icon="lock" title="App Lock PIN" subtitle={hasPin ? 'PIN active on this browser' : 'No PIN set on this device'}>
            <button type="button" onClick={handleResetPin} disabled={!hasPin}
              className={`${secondaryBtn} text-error border-error/20 bg-error-container/20 hover:bg-error-container/40`}>
              Reset PIN
            </button>
          </InlineRow>
          <InlineRow icon="help" title="App Guide & Walkthroughs" onboarding="settings-tutorial"
            subtitle={allSeen ? 'All guides completed' : 'Guides appear as you visit each section'}>
            <button type="button" onClick={handleReplay}
              className={`${secondaryBtn} text-primary border-primary/15 bg-primary/10 hover:bg-primary/20`}>
              <span className="material-symbols-outlined text-base" aria-hidden="true">replay</span>
              Replay Tour
            </button>
            <button type="button" onClick={handleResetTutorial} disabled={resetting}
              className={`${secondaryBtn} text-on-surface-variant border-outline/20 hover:text-on-surface hover:border-outline/40`}>
              {resetting
                ? <span className="w-4 h-4 border-2 border-on-surface-variant border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                : <span className="material-symbols-outlined text-base" aria-hidden="true">restart_alt</span>}
              Reset Progress
            </button>
          </InlineRow>
        </SettingsGroup>
      </div>

      <footer className="mt-10 px-1">
        <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold">
          <Link to="/privacy" className="text-on-surface-variant hover:text-on-surface underline underline-offset-4 decoration-outline/40 hover:decoration-on-surface transition-colors">Privacy Policy</Link>
          <Link to="/terms" className="text-on-surface-variant hover:text-on-surface underline underline-offset-4 decoration-outline/40 hover:decoration-on-surface transition-colors">Terms of Service</Link>
        </nav>
        <p className="mt-3 text-[11px] text-outline leading-relaxed max-w-xl">
          Vestor uses your data only to run the app: tracking, Gmail statement reading and, if you turn them on, AI features.
          Vestor is a tracking tool and does not give financial advice.
        </p>
      </footer>

      <FeatureTour section="settings" />
    </main>
  );
};

export default SettingsScreen;
