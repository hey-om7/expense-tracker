import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchSettings, updateSettings, peekCache } from '../services/api';
import { useAppContext } from '../context/AppContext';
import Toggle from '../components/ui/Toggle';

const DEFAULTS = {
  browserNotificationsEnabled: true,
  emailAlertsEnabled: true,
  ccReminderDaysBefore: 1,
  ccReminderOnDueDate: false,
};
const LEAD_OPTIONS = [1, 2, 3, 4, 5, 7, 10];

const fromServer = (data) => ({
  browserNotificationsEnabled: data.browserNotificationsEnabled !== false,
  emailAlertsEnabled: data.emailAlertsEnabled !== false,
  ccReminderDaysBefore: Number.isInteger(data.ccReminderDaysBefore) ? data.ccReminderDaysBefore : 1,
  ccReminderOnDueDate: data.ccReminderOnDueDate === true,
});

// Lets other parts of the app (browser pop-ups in AppContext) pick up changes without a reload.
const broadcastSettings = (saved) => {
  window.dispatchEvent(new CustomEvent('vestor:settings-updated', { detail: saved }));
};

const browserPermission = () => ('Notification' in window ? Notification.permission : 'unsupported');

const PERMISSION_TEXT = {
  granted: 'Allowed in this browser.',
  default: 'This browser hasn’t been asked yet.',
  denied: 'Blocked in this browser. Allow notifications for this site in your browser’s site settings.',
  unsupported: 'This browser doesn’t support notifications.',
};

const leadLabel = (d) => (d === 1 ? '1 day before' : `${d} days before`);

// The whole row is the label, so clicking the text or the switch track toggles it
// (the switch's checkbox is visually hidden; only a label click reaches it).
const Row = ({ htmlFor, title, help, helpId, children }) => (
  <label htmlFor={htmlFor} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-6 cursor-pointer has-[:disabled]:cursor-not-allowed">
    <span className="min-w-0">
      <span className="block text-sm font-bold text-on-surface mb-1">{title}</span>
      <span id={helpId} className="block text-xs text-on-surface-variant max-w-md leading-relaxed">{help}</span>
    </span>
    {children}
  </label>
);

const NotificationSettingsScreen = () => {
  const { addNotification } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [prefs, setPrefs] = useState(() => {
    const cached = peekCache('settings');
    return cached ? fromServer(cached) : DEFAULTS;
  });
  const [permission, setPermission] = useState(browserPermission);

  useEffect(() => {
    const cached = peekCache('settings');
    if (cached) setLoading(false);
    fetchSettings({ fresh: !!cached })
      .then((data) => { if (data) setPrefs(fromServer(data)); })
      .catch((err) => console.error('Failed to load settings:', err))
      .finally(() => setLoading(false));
  }, []);

  // Saves one change right away; on failure the UI goes back to the saved value.
  const save = async (field, patch, notice) => {
    const previous = prefs;
    setPrefs((p) => ({ ...p, ...patch }));
    setSaving(field);
    try {
      const saved = await updateSettings(patch);
      setPrefs(fromServer(saved));
      broadcastSettings(saved);
      if (notice) addNotification(notice);
    } catch (err) {
      setPrefs(previous);
      addNotification({ title: 'Error', message: err.message || 'Could not save the setting. Please try again.' });
    } finally {
      setSaving(null);
    }
  };

  const askPermission = async () => {
    if (!('Notification' in window)) return;
    try {
      setPermission(await Notification.requestPermission());
    } catch {
      setPermission(browserPermission());
    }
  };

  const handleBrowserToggle = async (e) => {
    const enabled = e.target.checked;
    await save('browser', { browserNotificationsEnabled: enabled });
    if (enabled && browserPermission() === 'default') askPermission();
  };

  const emailOff = !prefs.emailAlertsEnabled;
  const busy = loading || !!saving;

  return (
    <main className="pt-24 pb-32 px-4 sm:px-6 max-w-3xl w-full mx-auto min-h-screen">
      <Link to="/settings" className="group inline-flex items-center gap-1 text-xs font-semibold text-on-surface-variant hover:text-on-surface transition-colors">
        <span className="material-symbols-outlined text-sm transition-transform group-hover:-translate-x-0.5 motion-reduce:transition-none" aria-hidden="true">arrow_back</span>
        Settings
      </Link>

      <header className="mt-5 mb-8 max-w-2xl">
        <h1 className="font-headline font-extrabold text-on-surface tracking-tight leading-[1.02] text-[clamp(2rem,4.2vw,3rem)]">
          Notifications
        </h1>
        <p className="mt-4 text-sm text-on-surface-variant leading-relaxed max-w-xl">
          Choose how Vestor reaches you and when bill reminders arrive. Changes are saved automatically.
          The bell icon in the app always shows every notification.
        </p>
      </header>

      <div className="flex flex-col gap-8">
        {/* Browser */}
        <section aria-labelledby="notif-browser-title" className="bg-surface-container-low border border-outline/10 rounded-2xl p-4 sm:p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="material-symbols-outlined text-primary text-3xl" aria-hidden="true">web</span>
            <h2 id="notif-browser-title" className="font-headline font-bold text-xl text-on-surface">Browser notifications</h2>
          </div>

          <Row htmlFor="browserNotificationsEnabled" title="Pop-up notifications" helpId="browserHelp"
            help="Show a system pop-up when Vestor has something new while the app is open, such as a saved trade or a change you made.">
            <Toggle id="browserNotificationsEnabled" describedBy="browserHelp" checked={prefs.browserNotificationsEnabled}
              disabled={busy} onChange={handleBrowserToggle} />
          </Row>

          {prefs.browserNotificationsEnabled && (
            <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-outline/10 px-4 py-3">
              <p role="status" className="flex items-start gap-2 text-xs text-on-surface-variant">
                <span className={`material-symbols-outlined text-base ${permission === 'granted' ? 'text-primary' : permission === 'denied' ? 'text-error' : 'text-outline'}`} aria-hidden="true">
                  {permission === 'granted' ? 'check_circle' : permission === 'denied' ? 'block' : 'info'}
                </span>
                {PERMISSION_TEXT[permission]}
              </p>
              {permission === 'default' && (
                <button type="button" onClick={askPermission}
                  className="shrink-0 justify-center bg-primary/10 text-primary px-4 py-2 rounded-xl font-bold text-xs hover:bg-primary/20 transition-colors border border-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  Allow in this browser
                </button>
              )}
            </div>
          )}
        </section>

        {/* Email */}
        <section aria-labelledby="notif-email-title" className="bg-surface-container-low border border-outline/10 rounded-2xl p-4 sm:p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="material-symbols-outlined text-primary text-3xl" aria-hidden="true">mark_email_unread</span>
            <h2 id="notif-email-title" className="font-headline font-bold text-xl text-on-surface">Email notifications</h2>
          </div>

          <div className="flex flex-col gap-6">
            <Row htmlFor="emailAlertsEnabled" title="Email reminders" helpId="emailHelp"
              help="Emails for subscription renewals (one day before), credit card bills, and new statements found in Gmail.">
              <Toggle id="emailAlertsEnabled" describedBy="emailHelp" checked={prefs.emailAlertsEnabled} disabled={busy}
                onChange={(e) => save('email', { emailAlertsEnabled: e.target.checked }, {
                  title: e.target.checked ? 'Email reminders on' : 'Email reminders off',
                  message: e.target.checked ? 'You will get email reminders for renewals and bills.' : 'Email reminders have been turned off.',
                })} />
            </Row>

            <fieldset disabled={busy} className="border-t border-outline/10 pt-6 flex flex-col gap-6">
              <legend className="sr-only">Credit card bill reminders</legend>
              <p className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant -mb-2">Credit card bills</p>

              <Row htmlFor="ccReminderDaysBefore" title="First reminder" helpId="leadHelp"
                help="How early to remind you before a bill’s due date. Paid bills are skipped. The in-app reminder follows the same schedule.">
                <select id="ccReminderDaysBefore" aria-describedby="leadHelp" value={prefs.ccReminderDaysBefore}
                  onChange={(e) => {
                    const days = Number(e.target.value);
                    save('lead', { ccReminderDaysBefore: days }, { title: 'Reminder updated', message: `Bill reminders will arrive ${leadLabel(days).toLowerCase()} the due date.` });
                  }}
                  className="shrink-0 sm:w-44 bg-surface-container-lowest border border-outline/20 rounded-xl py-2.5 px-4 text-on-surface text-sm focus:outline-none focus:border-primary cursor-pointer disabled:cursor-not-allowed">
                  {LEAD_OPTIONS.map((d) => <option key={d} value={d}>{leadLabel(d)}</option>)}
                </select>
              </Row>

              <Row htmlFor="ccReminderOnDueDate" title="Remind again on the due date" helpId="dueDayHelp"
                help="Send one more email on the last day if the bill still isn’t marked paid.">
                <Toggle id="ccReminderOnDueDate" describedBy="dueDayHelp" checked={prefs.ccReminderOnDueDate} disabled={busy}
                  onChange={(e) => save('dueDay', { ccReminderOnDueDate: e.target.checked })} />
              </Row>
            </fieldset>

            {emailOff && (
              <p className="text-[11px] text-on-surface-variant">Email reminders are off, so bill reminders appear only in the app.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
};

export default NotificationSettingsScreen;
