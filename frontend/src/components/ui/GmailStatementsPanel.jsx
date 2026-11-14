import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as api from '../../services/api';
import { formatCurrency } from '../../utils/currency';
import Modal from './Modal';
import EmailAnalysisModal, { EMAIL_CATEGORY_LABELS } from './EmailAnalysisModal';
import PdfPasswordModal from './PdfPasswordModal';

const REVIEW_NOTES = {
  unauthenticated_sender: ' · sender not verified',
  pdf_password_needed: ' · statement PDF needs its password',
  new_sender: ' · new sender, not in the bank list yet',
};

const fmtDate = (d) => {
  if (!d) return '—';
  const x = new Date(d);
  return isNaN(x.getTime()) ? '—' : x.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const CALLBACK_MESSAGES = {
  connected: { ok: true, text: 'Gmail connected. Scanning the last 90 days for statements. This can take a minute.' },
  denied: { ok: false, text: 'Gmail permission was not granted. Nothing was read.' },
  error: { ok: false, text: 'Could not connect Gmail. Please try again.' },
};

// Groups pending statements so each untracked card is asked about once.
const groupPending = (statements) => {
  const groups = new Map();
  statements.forEach((s) => {
    const key = `${s.senderDomain}|${s.last4 || ''}`;
    const g = groups.get(key) || { key, latest: s, count: 0 };
    g.count += 1;
    if (new Date(s.statementDate) > new Date(g.latest.statementDate)) g.latest = s;
    groups.set(key, g);
  });
  return [...groups.values()];
};

const ABOUT_POINTS = [
  ['visibility', 'Vestor only reads credit card statement emails from known banks. It never sends or deletes anything.'],
  ['schedule', 'It reads the last 90 days now, then checks for new emails every 30 minutes and when you open the app.'],
  ['notifications', 'You get an email before each due date (choose when in Settings → Notifications).'],
  ['rule', 'Emails are read by built-in rules unless you turn on "Allow AI to process my emails" in Settings → Vestor AI.'],
];

const Empty = ({ icon, title, text }) => (
  <div className="py-10 flex flex-col items-center text-center gap-2">
    <span className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
      <span className="material-symbols-outlined text-2xl" aria-hidden="true">{icon}</span>
    </span>
    <p className="font-headline font-bold text-on-surface">{title}</p>
    {text && <p className="text-xs text-on-surface-variant max-w-sm">{text}</p>}
  </div>
);

// Untracked email types (newest first). Each row can list the emails it hid and be undone.
const UntrackedList = ({ items, busy, openId, onToggle, onUndo, btn }) => (
  <ul className="flex flex-col divide-y divide-outline/10">
    {items.map((rl) => {
      const open = openId === rl._id;
      return (
        <li key={rl._id} className="py-2.5 text-xs">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-bold text-sm text-on-surface truncate">{rl.sampleSubject || '(no subject)'}</p>
              <p className="text-on-surface-variant">
                {rl.institutionName || rl.senderDomain} · untracked {fmtDate(rl.untrackedAt)}
                {rl.timesApplied ? ` · ${rl.timesApplied} skipped since` : ''}
              </p>
              {rl.emails.length > 0 && (
                <button type="button" onClick={() => onToggle(open ? null : rl._id)} aria-expanded={open}
                  className="mt-1 inline-flex items-center gap-0.5 text-[11px] font-semibold text-primary hover:underline underline-offset-2">
                  {open ? 'Hide' : 'Show'} {rl.emails.length} hidden email{rl.emails.length === 1 ? '' : 's'}
                  <span className="material-symbols-outlined text-sm" aria-hidden="true">{open ? 'expand_less' : 'expand_more'}</span>
                </button>
              )}
            </div>
            <button type="button" disabled={!!busy} onClick={() => onUndo(rl)} className={`${btn} text-primary border border-primary/30 bg-primary/10 hover:bg-primary/20 shrink-0`}>
              {busy === `undo-${rl._id}`
                ? <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                : <span className="material-symbols-outlined text-sm" aria-hidden="true">undo</span>}
              Undo
            </button>
          </div>
          {open && (
            <ul className="mt-2 ml-3 pl-3 border-l border-outline/15 flex flex-col gap-1.5">
              {rl.emails.map((e) => (
                <li key={e._id} className="flex items-center justify-between gap-3 text-on-surface-variant">
                  <span className="truncate">{e.subject || '(no subject)'}</span>
                  <span className="shrink-0 tabular-nums">{e.amount != null ? `${formatCurrency(e.amount)} · ` : ''}{fmtDate(e.receivedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </li>
      );
    })}
  </ul>
);

const GmailStatementsPanel = ({ creditCards, onCardsChanged }) => {
  const location = useLocation();
  const navigate = useNavigate();
  // Revisits paint the last snapshot instantly; load() then refreshes it.
  const [snapshot] = useState(() => api.peekCache('gmail-panel'));
  const [status, setStatus] = useState(snapshot?.status ?? null);
  const [pending, setPending] = useState(snapshot?.pending ?? []);
  const [history, setHistory] = useState(snapshot?.history ?? []);
  const [review, setReview] = useState(snapshot?.review ?? []);
  const [busy, setBusy] = useState('');
  const [banner, setBanner] = useState(null);
  const [addModal, setAddModal] = useState(null); // { statement, name, last4Digits }
  const [sheet, setSheet] = useState(null); // mobile: about (connect explainer)
  const [tab, setTab] = useState('action'); // action | tracked | rules | passwords
  const [trackedView, setTrackedView] = useState('statements'); // statements | emails
  const [saved, setSaved] = useState(snapshot?.saved ?? []);
  const [emailRules, setEmailRules] = useState(snapshot?.emailRules ?? []);
  const [analysis, setAnalysis] = useState(null); // { email, proposal }
  const [pwPrompt, setPwPrompt] = useState(null); // { email, filename, savedPasswordFailed, error }
  const [pdfPasswords, setPdfPasswords] = useState(snapshot?.pdfPasswords ?? []);
  const [untracked, setUntracked] = useState(snapshot?.untracked ?? []);
  const [openUntracked, setOpenUntracked] = useState(null); // rule id whose hidden emails are listed

  const load = useCallback(async () => {
    try {
      // All in parallel instead of status first, then the lists.
      const [s, p, h, r, sv, rl, pw, ut] = await Promise.all([
        api.fetchGmailStatus(),
        api.fetchCardStatements({ status: 'pending' }).catch(() => []),
        api.fetchCardStatements({ status: 'linked' }).catch(() => []),
        api.fetchFinancialEmails('review').catch(() => []),
        api.fetchFinancialEmails('recorded').catch(() => []),
        api.fetchEmailRules().catch(() => []),
        api.fetchPdfPasswords().catch(() => []),
        api.fetchUntrackedEmails().catch(() => []),
      ]);
      setStatus(s);
      setPending(p);
      setHistory(h);
      setReview(r);
      setSaved(sv);
      setEmailRules(rl);
      setPdfPasswords(pw);
      setUntracked(ut);
      api.setCache('gmail-panel', { status: s, pending: p, history: h, review: r, saved: sv, emailRules: rl, pdfPasswords: pw, untracked: ut });
      return s;
    } catch {
      setStatus({ connected: false, available: false });
      return null;
    }
  }, []);

  // Show the result of the Google redirect, then clean the URL.
  useEffect(() => {
    const result = new URLSearchParams(location.search).get('gmail');
    if (result && CALLBACK_MESSAGES[result]) {
      setBanner(CALLBACK_MESSAGES[result]);
      navigate(location.pathname, { replace: true });
    }
  }, [location.search, location.pathname, navigate]);

  useEffect(() => { load(); }, [load]);

  // While the first 90-day scan runs, poll until it finishes.
  useEffect(() => {
    if (!status?.connected || !['pending', 'running'].includes(status.backfillStatus)) return undefined;
    const t = setInterval(async () => {
      const s = await load();
      if (s && !['pending', 'running'].includes(s.backfillStatus)) onCardsChanged?.();
    }, 5000);
    return () => clearInterval(t);
  }, [status?.connected, status?.backfillStatus, load, onCardsChanged]);

  const pendingGroups = useMemo(() => groupPending(pending), [pending]);
  const cardName = useMemo(() => {
    const m = new Map(creditCards.map((c) => [String(c._id || c.id), c.name]));
    return (id) => m.get(String(id)) || 'Card';
  }, [creditCards]);

  const run = async (label, fn) => {
    setBusy(label);
    try { await fn(); } catch (err) { setBanner({ ok: false, text: err.message }); } finally { setBusy(''); }
  };

  const handleConnect = () => run('connect', async () => {
    const { url } = await api.connectGmail();
    window.location.assign(url);
  });

  const handleScan = (full = false) => run(full ? 'rescan' : 'scan', async () => {
    const r = await api.scanGmailBills(full);
    if (r.started) {
      setBanner({ ok: true, text: 'Rescanning the last 90 days in the background. New statements will appear here when it finishes.' });
      await load();
      return;
    }
    setBanner({
      ok: true,
      text: r.linked || r.pending
        ? `Found ${r.linked} statement(s) for tracked cards and ${r.pending} for untracked cards.`
        : 'No new statements since the last scan.',
      detail: [
        r.review ? `${r.review} bank email(s) couldn't be read reliably and are listed below for review.` : '',
        r.aiRequested && !r.aiAvailable ? 'AI email processing is on, but no Groq API key is set, so built-in rules were used.' : '',
      ].filter(Boolean).join(' '),
    });
    await load();
    if (r.linked) onCardsChanged?.();
  });

  const handleDisconnect = () => {
    if (!window.confirm('Disconnect Gmail? Vestor will lose access to your email. Statements already saved are kept.')) return;
    run('disconnect', async () => {
      const res = await api.disconnectGmail();
      setBanner({ ok: true, text: res?.message || 'Gmail disconnected.' });
      await load();
    });
  };

  const handleIgnore = (g) => run(`ignore-${g.key}`, async () => {
    await api.ignoreStatementCard(g.latest._id);
    await load();
  });

  const handleDismissReview = (id) => run(`dismiss-${id}`, async () => {
    await api.dismissFinancialEmail(id);
    await load();
  });

  const handleAnalyze = (email) => run(`analyze-${email._id}`, async () => {
    let proposal;
    try {
      proposal = await api.analyzeFinancialEmail(email._id);
    } finally {
      setSheet(null); // on mobile, close the sheet so the result or the error banner is visible
    }
    if (proposal.needsPassword) {
      setPwPrompt({ email, filename: proposal.filename, savedPasswordFailed: proposal.savedPasswordFailed, error: '' });
      return;
    }
    setAnalysis({ email, proposal });
  });

  // Retry the analysis with the PDF password. Errors stay inside the password dialog.
  const handlePasswordSubmit = async ({ password, rememberPassword }) => {
    const email = pwPrompt.email;
    setBusy('pdf-password');
    try {
      const proposal = await api.analyzeFinancialEmail(email._id, { password, rememberPassword });
      setPwPrompt(null);
      setAnalysis({ email, proposal });
      if (proposal.pdf?.passwordSaved) load();
    } catch (err) {
      setPwPrompt((p) => p && { ...p, error: err.message });
    } finally {
      setBusy('');
    }
  };

  const handleRemovePassword = (pw) => {
    if (!window.confirm(`Remove the saved statement password for ${pw.senderDomain}?`)) return;
    run(`pw-${pw._id}`, async () => {
      await api.deletePdfPassword(pw._id);
      await load();
    });
  };

  const handleConfirm = (data) => run('confirm', async () => {
    const r = await api.confirmFinancialEmail(analysis.email._id, data);
    setAnalysis(null);
    const what = {
      linked: 'Saved to your credit card.', pending: 'Saved. The card is listed under untracked cards.',
      dismissed: 'Ignored.', recorded: 'Saved under Tracked bank emails.',
    }[r.action] || 'Saved.';
    setBanner({
      ok: true,
      text: `${what}${r.remembered ? ' Vestor will handle emails like this on its own from now on.' : ''}`,
      detail: r.similarResolved ? `${r.similarResolved} similar email(s) waiting for review were handled the same way.` : '',
    });
    await load();
    if (['linked', 'pending'].includes(r.action)) onCardsChanged?.();
  });

  const handleForgetRule = (rule) => {
    if (!window.confirm(`Forget "${rule.sampleSubject}"? Emails like it will go through the normal checks again.`)) return;
    run(`forget-${rule._id}`, async () => {
      await api.deleteEmailRule(rule._id);
      await load();
    });
  };

  const handleUntrack = (email) => {
    const from = email.institutionName || email.senderDomain || 'this sender';
    if (!window.confirm(`Stop tracking emails like "${email.subject || '(no subject)'}" from ${from}? Saved emails of this kind are hidden too. You can undo this under Untracked emails.`)) return;
    run(`untrack-${email._id}`, async () => {
      const r = await api.untrackFinancialEmail(email._id);
      setSheet(null);
      setBanner({
        ok: true,
        text: 'Vestor will skip emails like this from now on.',
        detail: r.hidden > 1 ? `${r.hidden} saved emails of this kind were hidden. Undo it under Untracked emails.` : 'Undo it under Untracked emails.',
      });
      await load();
    });
  };

  const handleUndoUntrack = (rule) => run(`undo-${rule._id}`, async () => {
    const r = await api.undoUntrackEmails(rule._id);
    setBanner({ ok: true, text: `Tracking "${rule.sampleSubject}" again.`, detail: r.restored ? `${r.restored} email(s) restored.` : '' });
    await load();
  });

  const handleDismissAllReview = () => {
    if (!window.confirm('Dismiss all emails waiting for review?')) return;
    run('dismiss-all', async () => {
      await api.dismissAllFinancialEmails();
      await load();
    });
  };

  const handleAddSubmit = (e) => {
    e.preventDefault();
    run('add', async () => {
      await api.addCardFromStatement(addModal.statement._id, {
        name: addModal.name, last4Digits: addModal.last4Digits,
      });
      setAddModal(null);
      setBanner({ ok: true, text: 'Card added. Its statements and due dates will be tracked from now on.' });
      await load();
      onCardsChanged?.();
    });
  };

  if (!status) return null;
  const scanning = ['pending', 'running'].includes(status.backfillStatus);
  const revoked = status.status === 'revoked';
  const hasData = history.length > 0 || saved.length > 0 || emailRules.length > 0 || untracked.length > 0 || pdfPasswords.length > 0
    || review.length > 0 || pendingGroups.length > 0;

  const btn = 'inline-flex items-center gap-1.5 text-xs font-bold min-h-[36px] px-3 rounded-lg border transition-colors active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:cursor-not-allowed';
  const btnPrimary = `${btn} text-primary border-primary/30 bg-primary/10 hover:bg-primary/20`;
  const btnQuiet = `${btn} text-on-surface-variant border-outline/20 hover:text-on-surface hover:border-outline/40`;
  const btnDanger = `${btn} text-on-surface-variant border-outline/20 hover:text-error hover:border-error/30`;
  const spinner = <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" aria-hidden="true" />;
  const subhead = 'text-[11px] uppercase tracking-[0.14em] font-bold text-on-surface-variant';

  const lastScan = status.lastScannedAt ? new Date(status.lastScannedAt).toLocaleString('en-IN') : 'never';
  const scanLine = scanning ? 'Scanning the last 90 days…'
    : revoked ? 'Access was revoked. Reconnect to continue.'
    : status.lastError || `Last scan: ${lastScan} · checked every 30 minutes`;

  const tabs = [
    { id: 'action', label: 'Action Required', count: pendingGroups.length + review.length },
    { id: 'tracked', label: 'Tracked & Statements', count: saved.length },
    { id: 'rules', label: 'Rules & Ignored', count: emailRules.length + untracked.length },
    { id: 'passwords', label: 'PDF Passwords', count: pdfPasswords.length },
  ];

  // Arrow keys move between tabs (WAI-ARIA tabs pattern).
  const onTabKey = (e) => {
    const i = tabs.findIndex((t) => t.id === tab);
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const t = tabs[(next + tabs.length) % tabs.length];
    setTab(t.id);
    document.getElementById(`email-tab-${t.id}`)?.focus();
  };

  const row = 'py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 text-xs';

  return (
    <div className="flex flex-col gap-4">
      {banner && (
        <div role="status" className={`p-3 rounded-xl border text-sm max-md:text-xs flex items-start gap-2 ${banner.ok ? 'bg-[#95CD41]/10 border-[#95CD41]/20 text-[#95CD41]' : 'bg-error/10 border-error/20 text-error'}`}>
          <span className="material-symbols-outlined text-base" aria-hidden="true">{banner.ok ? 'check_circle' : 'error'}</span>
          <span className="flex-1">{banner.text}{banner.detail && <span className="block mt-1 opacity-80">{banner.detail}</span>}</span>
          <button type="button" onClick={() => setBanner(null)} className="opacity-70 hover:opacity-100" aria-label="Dismiss">
            <span className="material-symbols-outlined text-base" aria-hidden="true">close</span>
          </button>
        </div>
      )}

      {/* Connection card */}
      {!status.connected ? (
        <>
          <section aria-labelledby="gmail-connect-title" className="max-md:hidden bg-surface-container-low rounded-2xl border border-outline/10 p-6 lg:p-8">
            <div className="flex items-start justify-between gap-8">
              <div className="min-w-0">
                <h2 id="gmail-connect-title" className="font-headline font-bold text-xl text-on-surface">Track statements from Gmail</h2>
                <ul className="mt-5 grid grid-cols-2 gap-x-8 gap-y-4 text-sm text-on-surface-variant">
                  {ABOUT_POINTS.map(([icon, text]) => (
                    <li key={icon} className="flex gap-3 leading-relaxed">
                      <span className="material-symbols-outlined text-[20px] text-primary shrink-0" aria-hidden="true">{icon}</span>{text}
                    </li>
                  ))}
                </ul>
              </div>
              <button type="button" onClick={handleConnect} disabled={!status.available || busy === 'connect'}
                title={status.available ? '' : 'Gmail connection is not configured on the server'}
                className="shrink-0 inline-flex items-center gap-2 min-h-[44px] px-5 rounded-xl bg-primary-container text-on-primary font-bold text-sm hover:brightness-110 transition-[filter] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:cursor-not-allowed">
                <span className="material-symbols-outlined text-base" aria-hidden="true">mark_email_read</span>
                {busy === 'connect' ? 'Opening Google…' : 'Connect Gmail'}
              </button>
            </div>
          </section>
          <div className="md:hidden flex items-center gap-3 px-4 py-3 rounded-2xl bg-surface-container-low border border-outline/10">
            <span className="material-symbols-outlined text-[22px] text-primary" aria-hidden="true">mark_email_read</span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold text-on-surface">Track bills from Gmail</span>
              <span className="block text-xs text-on-surface-variant truncate">Statements and due dates, added for you</span>
            </span>
            <button type="button" onClick={() => setSheet('about')} className="shrink-0 min-h-[40px] px-3.5 rounded-full text-xs font-semibold text-on-primary bg-primary-container hover:brightness-110 transition-[filter]">Set up</button>
          </div>
        </>
      ) : (
        <section aria-label="Gmail connection" className="bg-surface-container-low rounded-2xl border border-outline/10 px-4 py-3 sm:px-5 sm:py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-3">
            <span className={`material-symbols-outlined text-[22px] shrink-0 ${revoked || status.lastError ? 'text-error' : 'text-primary'}`} aria-hidden="true">
              {revoked ? 'link_off' : scanning ? 'sync' : 'mark_email_read'}
            </span>
            <div className="min-w-0">
              <p className="font-bold text-on-surface text-sm truncate">Gmail connected · <span className="text-primary">{status.gmailAddress}</span></p>
              <p className="text-xs text-on-surface-variant mt-0.5">{scanLine}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {revoked ? (
              <button type="button" onClick={handleConnect} disabled={busy === 'connect'} className={btnPrimary}>
                {busy === 'connect' ? 'Opening Google…' : 'Reconnect'}
              </button>
            ) : (
              <>
                <button type="button" onClick={() => handleScan(false)} disabled={!!busy || scanning} className={btnPrimary}>
                  {busy === 'scan' ? spinner : <span className="material-symbols-outlined text-sm" aria-hidden="true">sync</span>}
                  Scan now
                </button>
                <button type="button" onClick={() => handleScan(true)} disabled={!!busy || scanning} className={btnQuiet}
                  title="Re-read the last 90 days. Statements already saved are not duplicated.">
                  {busy === 'rescan' ? 'Rescanning…' : 'Rescan 90 days'}
                </button>
              </>
            )}
            <button type="button" onClick={handleDisconnect} disabled={!!busy} className={btnDanger}>Disconnect</button>
          </div>
        </section>
      )}

      {/* Tabbed workspace */}
      {(status.connected || hasData) && (
        <section className="flex flex-col gap-4">
          <div role="tablist" aria-label="Email management" onKeyDown={onTabKey}
            className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0 md:gap-0 md:border-b md:border-outline/10">
            {tabs.map((t) => {
              const on = tab === t.id;
              return (
                <button key={t.id} id={`email-tab-${t.id}`} type="button" role="tab" aria-selected={on} aria-controls={`email-panel-${t.id}`}
                  tabIndex={on ? 0 : -1} onClick={() => setTab(t.id)}
                  className={`shrink-0 inline-flex items-center gap-2 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
                    max-md:min-h-[40px] max-md:px-4 max-md:rounded-full max-md:border
                    md:px-4 md:py-3 md:-mb-px md:border-b-2
                    ${on ? 'text-primary max-md:bg-primary/15 max-md:border-primary/40 md:border-primary' : 'text-on-surface-variant hover:text-on-surface max-md:border-outline/20 md:border-transparent'}`}>
                  {t.label}
                  {t.count > 0 && (
                    <span className={`min-w-[1.25rem] h-5 px-1.5 rounded-full text-[10px] font-bold tabular-nums flex items-center justify-center ${on ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-on-surface-variant'}`}>{t.count}</span>
                  )}
                </button>
              );
            })}
          </div>

          <div id={`email-panel-${tab}`} role="tabpanel" aria-labelledby={`email-tab-${tab}`} tabIndex={0}
            className="flex flex-col gap-4 focus-visible:outline-none">
            {tab === 'action' && (
              <>
                {pendingGroups.length === 0 && review.length === 0 && (
                  <div className="bg-surface-container-low rounded-2xl border border-outline/10">
                    <Empty icon="task_alt" title="All caught up!" text="No emails need review." />
                  </div>
                )}

                {pendingGroups.length > 0 && (
                  <div className="bg-primary/5 rounded-2xl border border-primary/20 p-4">
                    <p className="font-bold text-sm text-on-surface mb-1">We found statements for cards you don&apos;t track</p>
                    <p className="text-xs text-on-surface-variant mb-3">Add a card to track its bills and due-date reminders from now on, or ignore it to skip its future statements.</p>
                    <div className="flex flex-col gap-2">
                      {pendingGroups.map((g) => (
                        <div key={g.key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-container-low rounded-lg p-3 border border-outline/10">
                          <div className="min-w-0 text-xs">
                            <p className="font-bold text-sm text-on-surface">{g.latest.bankName}{g.latest.last4 ? ` ····${g.latest.last4}` : ''}</p>
                            <p className="text-on-surface-variant mt-0.5">
                              Latest: {g.latest.amount != null ? formatCurrency(g.latest.amount) : '—'} · due {fmtDate(g.latest.dueDate)}
                              {g.count > 1 ? ` · ${g.count} statements` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button type="button" disabled={!!busy}
                              onClick={() => setAddModal({ statement: g.latest, name: `${g.latest.bankName} Credit Card`, last4Digits: g.latest.last4 || '' })}
                              className={`${btn} border-transparent text-on-primary bg-primary-container hover:brightness-110`}>
                              Add card
                            </button>
                            <button type="button" disabled={!!busy} onClick={() => handleIgnore(g)} className={btnQuiet}>Ignore</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {review.length > 0 && (
                  <div className="bg-surface-container-low rounded-2xl border border-outline/10 p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <p className="font-bold text-sm text-on-surface">Bank emails to review ({review.length})</p>
                        <p className="text-xs text-on-surface-variant mt-1 max-w-xl">Vestor couldn&apos;t read these on its own, so nothing was recorded from them. Analyze one with AI to save it and teach Vestor that type of email. Analysis sends that one email to Groq, with card and account numbers masked.</p>
                      </div>
                      <button type="button" disabled={!!busy} onClick={handleDismissAllReview} className={`${btnQuiet} shrink-0`}>Dismiss all</button>
                    </div>
                    <ul className="flex flex-col divide-y divide-outline/10">
                      {review.map((e) => (
                        <li key={e._id} className={row}>
                          <div className="min-w-0">
                            <p className="font-bold text-sm text-on-surface truncate">{e.subject || '(unreadable email)'}</p>
                            <p className="text-on-surface-variant mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1">
                              <span>{e.institutionName || e.senderDomain || 'Unknown sender'} · {fmtDate(e.receivedAt)}{e.fields?.amount != null ? ` · ${formatCurrency(e.fields.amount)}?` : ''}</span>
                              {REVIEW_NOTES[e.reason] && (
                                <span className="px-1.5 py-0.5 rounded bg-surface-container-highest text-[10px] font-semibold text-on-surface-variant">{REVIEW_NOTES[e.reason].replace(' · ', '')}</span>
                              )}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            {e.reason !== 'unauthenticated_sender' && (
                              <button type="button" disabled={!!busy} onClick={() => handleAnalyze(e)} className={btnPrimary}>
                                {busy === `analyze-${e._id}` ? spinner : <span className="material-symbols-outlined text-sm" aria-hidden="true">auto_awesome</span>}
                                {busy === `analyze-${e._id}` ? 'Analyzing…' : 'Analyze with AI'}
                              </button>
                            )}
                            <button type="button" disabled={!!busy} onClick={() => handleUntrack(e)} title="Skip emails like this from now on" className={btnDanger}>
                              <span className="material-symbols-outlined text-sm" aria-hidden="true">block</span>
                              {busy === `untrack-${e._id}` ? 'Stopping…' : "Don't track"}
                            </button>
                            <button type="button" disabled={!!busy} onClick={() => handleDismissReview(e._id)} className={btnQuiet}>Dismiss</button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}

            {tab === 'tracked' && (
              <div className="bg-surface-container-low rounded-2xl border border-outline/10 p-4">
                <div role="group" aria-label="Show" className="inline-flex p-1 rounded-xl bg-surface-container-lowest border border-outline/10 mb-3">
                  {[['statements', `Statement History (${history.length})`], ['emails', `Tracked Bank Emails (${saved.length})`]].map(([id, label]) => (
                    <button key={id} type="button" aria-pressed={trackedView === id} onClick={() => setTrackedView(id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${trackedView === id ? 'bg-primary/15 text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>
                      {label}
                    </button>
                  ))}
                </div>

                {trackedView === 'statements' && (history.length === 0
                  ? <Empty icon="receipt_long" title="No statements yet" text="Statements for cards you track appear here after a scan." />
                  : (
                    <ul className="flex flex-col divide-y divide-outline/10">
                      {history.map((s) => (
                        <li key={s._id} className="py-3 flex items-center justify-between text-xs gap-3">
                          <div className="min-w-0">
                            <p className="font-bold text-sm text-on-surface truncate">{cardName(s.cardId)}</p>
                            <p className="text-on-surface-variant mt-0.5">Statement {fmtDate(s.statementDate)} · due {fmtDate(s.dueDate)}</p>
                          </div>
                          <span className="font-headline font-extrabold tabular-nums text-sm text-on-surface shrink-0">{s.amount != null ? formatCurrency(s.amount) : '—'}</span>
                        </li>
                      ))}
                    </ul>
                  ))}

                {trackedView === 'emails' && (saved.length === 0
                  ? <Empty icon="inventory_2" title="Nothing tracked yet" text="Bank emails Vestor records appear here." />
                  : (
                    <>
                      <p className="text-xs text-on-surface-variant mb-1">Latest {Math.min(saved.length, 200)} recorded emails.</p>
                      <ul className="flex flex-col divide-y divide-outline/10">
                        {saved.map((e) => {
                          const statement = e.category === 'credit_card_statement';
                          return (
                            <li key={e._id} className={row}>
                              <div className="min-w-0">
                                <p className="font-bold text-sm text-on-surface truncate">{e.subject}</p>
                                <p className="text-on-surface-variant mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1">
                                  <span className="px-1.5 py-0.5 rounded bg-surface-container-highest text-[10px] font-semibold">{EMAIL_CATEGORY_LABELS[e.category] || 'Bank email'}</span>
                                  <span>{e.institutionName || e.senderDomain} · {fmtDate(e.receivedAt)}</span>
                                </p>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                {e.fields?.amount != null && <span className="font-headline font-extrabold tabular-nums text-sm text-on-surface">{formatCurrency(e.fields.amount)}</span>}
                                {statement ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-outline" title="Monthly card statements can't be untracked here, so future statements and due dates aren't missed.">
                                    <span className="material-symbols-outlined text-sm" aria-hidden="true">lock</span>
                                    Statement, always tracked
                                  </span>
                                ) : (
                                  <button type="button" disabled={!!busy} onClick={() => handleUntrack(e)} title="Skip emails like this from now on" className={btnDanger}>
                                    <span className="material-symbols-outlined text-sm" aria-hidden="true">block</span>
                                    {busy === `untrack-${e._id}` ? 'Stopping…' : "Don't track"}
                                  </button>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  ))}
              </div>
            )}

            {tab === 'rules' && (
              <>
                <div className="bg-surface-container-low rounded-2xl border border-outline/10 p-4">
                  <p className={subhead}>Remembered email types</p>
                  {emailRules.length === 0
                    ? <p className="text-xs text-on-surface-variant mt-2">None yet. When you analyze an email with AI, Vestor remembers how to handle that type.</p>
                    : (
                      <ul className="flex flex-col divide-y divide-outline/10">
                        {emailRules.map((rl) => (
                          <li key={rl._id} className="py-3 flex items-center justify-between gap-3 text-xs">
                            <div className="min-w-0">
                              <p className="font-bold text-sm text-on-surface truncate">{rl.sampleSubject}</p>
                              <p className="text-on-surface-variant mt-0.5">
                                {rl.institutionName || rl.senderDomain} · {rl.category === 'not_financial' ? 'Skipped' : `Saved as ${(EMAIL_CATEGORY_LABELS[rl.category] || 'bank email').toLowerCase()}`}
                                {rl.timesApplied ? ` · used ${rl.timesApplied}×` : ''}
                              </p>
                            </div>
                            <button type="button" disabled={!!busy} onClick={() => handleForgetRule(rl)} className={`${btnQuiet} shrink-0`}>Forget</button>
                          </li>
                        ))}
                      </ul>
                    )}
                </div>
                <div className="bg-surface-container-low rounded-2xl border border-outline/10 p-4">
                  <p className={subhead}>Untracked emails</p>
                  {untracked.length === 0
                    ? <p className="text-xs text-on-surface-variant mt-2">Email types you stop tracking appear here, so you can undo it.</p>
                    : (
                      <>
                        <p className="text-xs text-on-surface-variant mt-1 mb-1">Vestor skips these kinds of email. Undo to track one again; its hidden emails come back as they were.</p>
                        <UntrackedList items={untracked} busy={busy} openId={openUntracked} onToggle={setOpenUntracked} onUndo={handleUndoUntrack} btn={btn} />
                      </>
                    )}
                </div>
              </>
            )}

            {tab === 'passwords' && (
              <div className="bg-surface-container-low rounded-2xl border border-outline/10 p-4">
                {pdfPasswords.length === 0
                  ? <Empty icon="lock_open" title="No saved PDF passwords" text="When you open a password-protected statement and choose to remember the password, it's stored encrypted here." />
                  : (
                    <>
                      <p className="text-xs text-on-surface-variant mb-1">Statement passwords are stored encrypted and used only to open that bank&apos;s statement PDFs.</p>
                      <ul className="flex flex-col divide-y divide-outline/10">
                        {pdfPasswords.map((pw) => (
                          <li key={pw._id} className="py-3 flex items-center justify-between gap-3 text-xs">
                            <p className="min-w-0 flex items-center gap-2 text-on-surface">
                              <span className="material-symbols-outlined text-base text-on-surface-variant" aria-hidden="true">lock</span>
                              <span className="font-bold text-sm truncate">{pw.senderDomain}</span>
                              {pw.lastUsedAt && <span className="text-on-surface-variant max-sm:hidden">· last used {fmtDate(pw.lastUsedAt)}</span>}
                            </p>
                            <button type="button" disabled={!!busy} onClick={() => handleRemovePassword(pw)} className={`${btnQuiet} shrink-0`}>Remove</button>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
              </div>
            )}
          </div>
        </section>
      )}

      <Modal isOpen={sheet === 'about'} onClose={() => setSheet(null)} title="Track bills from Gmail"
        footer={<button type="button" onClick={handleConnect} disabled={!status.available || busy === 'connect'} className="w-full min-h-[48px] rounded-full bg-primary-container text-on-primary font-manrope font-bold text-[15px] disabled:opacity-50">{busy === 'connect' ? 'Opening Google…' : status.available ? 'Connect Gmail' : 'Not configured on the server'}</button>}>
        <ul className="flex flex-col gap-3 text-sm text-on-surface-variant">
          {ABOUT_POINTS.map(([icon, text]) => (
            <li key={icon} className="flex gap-3"><span className="material-symbols-outlined text-[20px] text-primary" aria-hidden="true">{icon}</span>{text}</li>
          ))}
        </ul>
      </Modal>

      <EmailAnalysisModal
        analysis={analysis}
        saving={busy === 'confirm'}
        onClose={() => setAnalysis(null)}
        onConfirm={handleConfirm}
      />

      <PdfPasswordModal
        prompt={pwPrompt}
        busy={busy === 'pdf-password'}
        onClose={() => setPwPrompt(null)}
        onSubmit={handlePasswordSubmit}
      />

      <Modal isOpen={!!addModal} onClose={() => setAddModal(null)} title="Track this card">
        {addModal && (
          <form onSubmit={handleAddSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              Card name
              <input value={addModal.name} maxLength={100} required
                onChange={(e) => setAddModal({ ...addModal, name: e.target.value })}
                className="bg-surface-container-lowest border border-outline/20 rounded-xl py-3 px-4 text-on-surface text-sm normal-case font-normal focus:outline-none focus:border-primary" />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              Last 4 digits
              <input value={addModal.last4Digits} inputMode="numeric" pattern="\d{2,4}" maxLength={4} required
                onChange={(e) => setAddModal({ ...addModal, last4Digits: e.target.value.replace(/\D/g, '') })}
                className="bg-surface-container-lowest border border-outline/20 rounded-xl py-3 px-4 text-on-surface text-sm normal-case font-normal focus:outline-none focus:border-primary" />
            </label>
            <p className="text-xs text-on-surface-variant">
              Latest statement: {addModal.statement.amount != null ? formatCurrency(addModal.statement.amount) : '—'}, due {fmtDate(addModal.statement.dueDate)}.
            </p>
            <button type="submit" disabled={busy === 'add'}
              className="bg-primary-container text-on-primary font-bold py-3 rounded-xl hover:brightness-110 disabled:opacity-50">
              {busy === 'add' ? 'Adding…' : 'Add card'}
            </button>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default GmailStatementsPanel;
