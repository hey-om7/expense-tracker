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

const GmailStatementsPanel = ({ creditCards, onCardsChanged }) => {
  const location = useLocation();
  const navigate = useNavigate();
  // Revisits paint the last snapshot instantly; load() then refreshes it.
  const [snapshot] = useState(() => api.peekCache('gmail-panel'));
  const [status, setStatus] = useState(snapshot?.status ?? null);
  const [pending, setPending] = useState(snapshot?.pending ?? []);
  const [history, setHistory] = useState(snapshot?.history ?? []);
  const [review, setReview] = useState(snapshot?.review ?? []);
  const [showHistory, setShowHistory] = useState(false);
  const [busy, setBusy] = useState('');
  const [banner, setBanner] = useState(null);
  const [addModal, setAddModal] = useState(null); // { statement, name, last4Digits }
  const [sheet, setSheet] = useState(null); // mobile: about | gmail | pending | review | history | saved
  const [saved, setSaved] = useState(snapshot?.saved ?? []);
  const [emailRules, setEmailRules] = useState(snapshot?.emailRules ?? []);
  const [showSaved, setShowSaved] = useState(false);
  const [analysis, setAnalysis] = useState(null); // { email, proposal }
  const [pwPrompt, setPwPrompt] = useState(null); // { email, filename, savedPasswordFailed, error }
  const [pdfPasswords, setPdfPasswords] = useState(snapshot?.pdfPasswords ?? []);

  const load = useCallback(async () => {
    try {
      // All in parallel instead of status first, then the lists.
      const [s, p, h, r, sv, rl, pw] = await Promise.all([
        api.fetchGmailStatus(),
        api.fetchCardStatements({ status: 'pending' }).catch(() => []),
        api.fetchCardStatements({ status: 'linked' }).catch(() => []),
        api.fetchFinancialEmails('review').catch(() => []),
        api.fetchSavedFinancialEmails().catch(() => []),
        api.fetchEmailRules().catch(() => []),
        api.fetchPdfPasswords().catch(() => []),
      ]);
      setStatus(s);
      setPending(p);
      setHistory(h);
      setReview(r);
      setSaved(sv);
      setEmailRules(rl);
      setPdfPasswords(pw);
      api.setCache('gmail-panel', { status: s, pending: p, history: h, review: r, saved: sv, emailRules: rl, pdfPasswords: pw });
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
      dismissed: 'Ignored.', recorded: 'Saved under Saved bank emails.',
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

  const btn = 'flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed max-md:text-xs max-md:px-2.5 max-md:py-1';

  return (
    <div className="mb-4 flex flex-col gap-3">
      {banner && (
        <div className={`p-3 rounded-xl border text-sm max-md:text-xs flex items-start gap-2 ${banner.ok ? 'bg-[#95CD41]/10 border-[#95CD41]/20 text-[#95CD41]' : 'bg-error/10 border-error/20 text-error'}`}>
          <span className="material-symbols-outlined text-base">{banner.ok ? 'check_circle' : 'error'}</span>
          <span className="flex-1">{banner.text}{banner.detail && <span className="block mt-1 opacity-80">{banner.detail}</span>}</span>
          <button onClick={() => setBanner(null)} className="opacity-70 hover:opacity-100" aria-label="Dismiss">
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      )}

      {/* Connection card (desktop) */}
      <div className="max-md:hidden bg-surface-container-low rounded-xl border border-outline/10 p-4">
        {!status.connected ? (
          <div className="flex items-center justify-between gap-3 max-md:flex-col max-md:items-start">
            <div>
              <p className="font-bold text-on-surface text-sm">Track statements from Gmail</p>
              <p className="text-xs text-on-surface-variant mt-1">
                With your permission, Vestor reads (never sends or deletes) credit card statement emails from known banks:
                the last 90 days now, then new ones about every 30 minutes and when you open the app. You get an email one day before each due date.
                Emails are read by built-in rules unless you turn on &quot;Allow AI to process my emails&quot; in Settings.
              </p>
            </div>
            <button onClick={handleConnect} disabled={!status.available || busy === 'connect'}
              className={`${btn} text-primary border border-primary/30 bg-primary/10 hover:bg-primary/20 shrink-0`}
              title={status.available ? '' : 'Gmail connection is not configured on the server'}>
              <span className="material-symbols-outlined text-sm">mark_email_read</span>
              {busy === 'connect' ? 'Opening Google…' : 'Connect Gmail'}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 max-md:flex-col max-md:items-start">
            <div className="min-w-0">
              <p className="font-bold text-on-surface text-sm truncate">
                Gmail connected · <span className="text-primary">{status.gmailAddress}</span>
              </p>
              <p className="text-xs text-on-surface-variant mt-1">
                {['pending', 'running'].includes(status.backfillStatus)
                  ? 'Scanning the last 90 days…'
                  : status.lastError || `Last scan: ${status.lastScannedAt ? new Date(status.lastScannedAt).toLocaleString('en-IN') : 'never'} · next daily scan at 6 AM`}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {status.status === 'revoked' ? (
                <button onClick={handleConnect} disabled={busy === 'connect'} className={`${btn} text-primary border border-primary/30 bg-primary/10`}>Reconnect</button>
              ) : (
                <button onClick={() => handleScan(false)} disabled={!!busy || ['pending', 'running'].includes(status.backfillStatus)}
                  className={`${btn} text-primary border border-primary/30 bg-primary/10 hover:bg-primary/20`}>
                  {busy === 'scan'
                    ? <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    : <span className="material-symbols-outlined text-sm">sync</span>}
                  Scan now
                </button>
              )}
              {status.status !== 'revoked' && (
                <button onClick={() => handleScan(true)} disabled={!!busy || ['pending', 'running'].includes(status.backfillStatus)}
                  title="Re-read the last 90 days. Statements already saved are not duplicated."
                  className={`${btn} text-on-surface-variant border border-outline/20`}>
                  {busy === 'rescan' ? 'Rescanning…' : 'Rescan 90 days'}
                </button>
              )}
              <button onClick={handleDisconnect} disabled={!!busy} className={`${btn} text-on-surface-variant border border-outline/20`}>
                Disconnect
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Untracked cards found in Gmail */}
      {pendingGroups.length > 0 && (
        <div className="max-md:hidden bg-primary/5 rounded-xl border border-primary/20 p-4">
          <p className="font-bold text-sm text-on-surface mb-1">We found statements for cards you don't track</p>
          <p className="text-xs text-on-surface-variant mb-3">Add a card to track its bills and due-date reminders from now on, or ignore it to skip its future statements.</p>
          <div className="flex flex-col gap-2">
            {pendingGroups.map((g) => (
              <div key={g.key} className="flex items-center justify-between gap-3 bg-surface-container-low rounded-lg p-3 border border-outline/10 max-md:flex-col max-md:items-start">
                <div className="min-w-0 text-xs">
                  <p className="font-bold text-sm text-on-surface">
                    {g.latest.bankName}{g.latest.last4 ? ` ····${g.latest.last4}` : ''}
                  </p>
                  <p className="text-on-surface-variant mt-0.5">
                    Latest: {g.latest.amount != null ? formatCurrency(g.latest.amount) : '—'} · due {fmtDate(g.latest.dueDate)}
                    {g.count > 1 ? ` · ${g.count} statements` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button disabled={!!busy}
                    onClick={() => setAddModal({ statement: g.latest, name: `${g.latest.bankName} Credit Card`, last4Digits: g.latest.last4 || '' })}
                    className={`${btn} text-on-primary bg-primary-container hover:brightness-110`}>
                    Add card
                  </button>
                  <button disabled={!!busy} onClick={() => handleIgnore(g)} className={`${btn} text-on-surface-variant border border-outline/20`}>
                    Ignore
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Emails that couldn't be read reliably */}
      {review.length > 0 && (
        <div className="max-md:hidden bg-surface-container-low rounded-xl border border-outline/10 p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="font-bold text-sm text-on-surface">Bank emails to review ({review.length})</p>
              <p className="text-xs text-on-surface-variant mt-1">Vestor couldn&apos;t read these on its own, so nothing was recorded from them. Analyze one with AI to save it and teach Vestor that type of email. Analysis sends that one email to Groq, with card and account numbers masked.</p>
            </div>
            <button disabled={!!busy} onClick={handleDismissAllReview} className={`${btn} text-on-surface-variant border border-outline/20 shrink-0`}>
              Dismiss all
            </button>
          </div>
          <div className="flex flex-col divide-y divide-outline/10">
            {review.map((e) => (
              <div key={e._id} className="py-2 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <p className="font-bold text-on-surface truncate">{e.subject || '(unreadable email)'}</p>
                  <p className="text-on-surface-variant">
                    {e.institutionName || e.senderDomain || 'Unknown sender'} · {fmtDate(e.receivedAt)}
                    {e.fields?.amount != null ? ` · ${formatCurrency(e.fields.amount)}?` : ''}
                    {REVIEW_NOTES[e.reason] || ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {e.reason !== 'unauthenticated_sender' && (
                    <button disabled={!!busy} onClick={() => handleAnalyze(e)} className={`${btn} text-primary border border-primary/30 bg-primary/10 hover:bg-primary/20`}>
                      {busy === `analyze-${e._id}`
                        ? <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                        : <span className="material-symbols-outlined text-sm" aria-hidden="true">auto_awesome</span>}
                      {busy === `analyze-${e._id}` ? 'Analyzing…' : 'Analyze with AI'}
                    </button>
                  )}
                  <button disabled={!!busy} onClick={() => handleDismissReview(e._id)} className={`${btn} text-on-surface-variant border border-outline/20`}>
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bank emails saved after review, and the email types Vestor remembers */}
      {(saved.length > 0 || emailRules.length > 0 || pdfPasswords.length > 0) && (
        <div className="max-md:hidden bg-surface-container-low rounded-xl border border-outline/10">
          <button onClick={() => setShowSaved((v) => !v)} aria-expanded={showSaved} className="w-full flex items-center justify-between p-4 text-sm font-bold text-on-surface">
            <span>Saved bank emails ({saved.length}){emailRules.length > 0 && <span className="font-normal text-on-surface-variant"> · {emailRules.length} remembered {emailRules.length === 1 ? 'type' : 'types'}</span>}</span>
            <span className="material-symbols-outlined text-base" aria-hidden="true">{showSaved ? 'expand_less' : 'expand_more'}</span>
          </button>
          {showSaved && (
            <div className="px-4 pb-4 flex flex-col gap-4">
              {saved.length > 0 && (
                <div className="flex flex-col divide-y divide-outline/10">
                  {saved.map((e) => (
                    <div key={e._id} className="py-2 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <p className="font-bold text-on-surface truncate">{e.subject}</p>
                        <p className="text-on-surface-variant">
                          {EMAIL_CATEGORY_LABELS[e.category] || 'Bank email'} · {e.institutionName || e.senderDomain} · {fmtDate(e.receivedAt)}
                        </p>
                      </div>
                      <span className="font-headline font-extrabold text-on-surface shrink-0">{e.fields?.amount != null ? formatCurrency(e.fields.amount) : ''}</span>
                    </div>
                  ))}
                </div>
              )}
              {emailRules.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] font-bold text-on-surface-variant mb-1">Remembered email types</p>
                  <div className="flex flex-col divide-y divide-outline/10">
                    {emailRules.map((rl) => (
                      <div key={rl._id} className="py-2 flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <p className="font-bold text-on-surface truncate">{rl.sampleSubject}</p>
                          <p className="text-on-surface-variant">
                            {rl.institutionName || rl.senderDomain} · {rl.category === 'not_financial' ? 'Skipped' : `Saved as ${(EMAIL_CATEGORY_LABELS[rl.category] || 'bank email').toLowerCase()}`}
                            {rl.timesApplied ? ` · used ${rl.timesApplied}×` : ''}
                          </p>
                        </div>
                        <button disabled={!!busy} onClick={() => handleForgetRule(rl)} className={`${btn} text-on-surface-variant border border-outline/20 shrink-0`}>
                          Forget
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {pdfPasswords.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] font-bold text-on-surface-variant mb-1">Saved PDF passwords</p>
                  <div className="flex flex-col divide-y divide-outline/10">
                    {pdfPasswords.map((pw) => (
                      <div key={pw._id} className="py-2 flex items-center justify-between gap-3 text-xs">
                        <p className="min-w-0 flex items-center gap-2 text-on-surface">
                          <span className="material-symbols-outlined text-sm text-on-surface-variant" aria-hidden="true">lock</span>
                          <span className="font-bold truncate">{pw.senderDomain}</span>
                          {pw.lastUsedAt && <span className="text-on-surface-variant">· last used {fmtDate(pw.lastUsedAt)}</span>}
                        </p>
                        <button disabled={!!busy} onClick={() => handleRemovePassword(pw)} className={`${btn} text-on-surface-variant border border-outline/20 shrink-0`}>
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Past statements */}
      {history.length > 0 && (
        <div className="max-md:hidden bg-surface-container-low rounded-xl border border-outline/10">
          <button onClick={() => setShowHistory((v) => !v)} className="w-full flex items-center justify-between p-4 max-md:p-3 text-sm font-bold text-on-surface">
            <span>Statement history ({history.length})</span>
            <span className="material-symbols-outlined text-base">{showHistory ? 'expand_less' : 'expand_more'}</span>
          </button>
          {showHistory && (
            <div className="px-4 pb-4 max-md:px-3 flex flex-col divide-y divide-outline/10">
              {history.map((s) => (
                <div key={s._id} className="py-2 flex items-center justify-between text-xs gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-on-surface truncate">{cardName(s.cardId)}</p>
                    <p className="text-on-surface-variant">Statement {fmtDate(s.statementDate)} · due {fmtDate(s.dueDate)}</p>
                  </div>
                  <span className="font-headline font-extrabold text-on-surface shrink-0">{s.amount != null ? formatCurrency(s.amount) : '—'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mobile: one compact list; each row opens a sheet with the details and actions */}
      <ul className="md:hidden rounded-2xl bg-surface-container-low divide-y divide-outline/10">
        <li className="flex items-center gap-3 px-4 py-3">
          <span className="material-symbols-outlined text-[22px] text-primary" aria-hidden="true">mark_email_read</span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold text-on-surface">{status.connected ? 'Gmail connected' : 'Track bills from Gmail'}</span>
            <span className="block text-xs text-on-surface-variant truncate">
              {!status.connected ? 'Statements and due dates, added for you'
                : scanning ? 'Scanning the last 90 days…'
                : status.status === 'revoked' ? 'Access was revoked. Reconnect to continue.'
                : status.lastError || `Last scan ${status.lastScannedAt ? new Date(status.lastScannedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'never'} · daily at 6 AM`}
            </span>
          </span>
          {status.connected ? (
            <button type="button" onClick={() => setSheet('gmail')} className="shrink-0 min-h-[40px] px-3.5 rounded-full text-xs font-semibold text-primary border border-primary/30 hover:bg-primary/10 transition-colors">Manage</button>
          ) : (
            <button type="button" onClick={() => setSheet('about')} className="shrink-0 min-h-[40px] px-3.5 rounded-full text-xs font-semibold text-on-primary bg-primary-container hover:brightness-110 transition-[filter]">Set up</button>
          )}
        </li>
        {[
          pendingGroups.length > 0 && { key: 'pending', icon: 'add_card', tone: 'text-primary', label: `${pendingGroups.length} untracked ${pendingGroups.length === 1 ? 'card' : 'cards'} found` },
          review.length > 0 && { key: 'review', icon: 'help', tone: 'text-on-surface-variant', label: `${review.length} bank ${review.length === 1 ? 'email' : 'emails'} to review` },
          history.length > 0 && { key: 'history', icon: 'history', tone: 'text-on-surface-variant', label: `Statement history · ${history.length}` },
          (saved.length > 0 || emailRules.length > 0 || pdfPasswords.length > 0) && { key: 'saved', icon: 'inventory_2', tone: 'text-on-surface-variant', label: `Saved bank emails · ${saved.length}` },
        ].filter(Boolean).map(row => (
          <li key={row.key}>
            <button type="button" onClick={() => setSheet(row.key)} className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-surface-container transition-colors">
              <span className={`material-symbols-outlined text-[22px] ${row.tone}`} aria-hidden="true">{row.icon}</span>
              <span className="flex-1 text-sm text-on-surface">{row.label}</span>
              <span className="material-symbols-outlined text-[20px] text-on-surface-variant" aria-hidden="true">chevron_right</span>
            </button>
          </li>
        ))}
      </ul>

      <Modal isOpen={sheet === 'about'} onClose={() => setSheet(null)} title="Track bills from Gmail"
        footer={<button type="button" onClick={handleConnect} disabled={!status.available || busy === 'connect'} className="w-full min-h-[48px] rounded-full bg-primary-container text-on-primary font-manrope font-bold text-[15px] disabled:opacity-50">{busy === 'connect' ? 'Opening Google…' : status.available ? 'Connect Gmail' : 'Not configured on the server'}</button>}>
        <ul className="flex flex-col gap-3 text-sm text-on-surface-variant">
          <li className="flex gap-3"><span className="material-symbols-outlined text-[20px] text-primary" aria-hidden="true">visibility</span>Vestor only reads credit card statement emails from known banks. It never sends or deletes anything.</li>
          <li className="flex gap-3"><span className="material-symbols-outlined text-[20px] text-primary" aria-hidden="true">schedule</span>It reads the last 90 days now, then new emails about every 30 minutes and when you open the app.</li>
          <li className="flex gap-3"><span className="material-symbols-outlined text-[20px] text-primary" aria-hidden="true">notifications</span>You get an email one day before each due date.</li>
          <li className="flex gap-3"><span className="material-symbols-outlined text-[20px] text-primary" aria-hidden="true">rule</span>Emails are read by built-in rules unless you turn on &quot;Allow AI to process my emails&quot; in Settings.</li>
        </ul>
      </Modal>

      <Modal isOpen={sheet === 'gmail'} onClose={() => setSheet(null)} title="Gmail">
        <p className="text-sm text-on-surface break-all">{status.gmailAddress}</p>
        <p className="mt-1 text-xs text-on-surface-variant">
          {scanning ? 'Scanning the last 90 days…' : status.lastError || `Last scan: ${status.lastScannedAt ? new Date(status.lastScannedAt).toLocaleString('en-IN') : 'never'} · next daily scan at 6 AM`}
        </p>
        <div className="mt-5 flex flex-col gap-2">
          {status.status === 'revoked' ? (
            <button type="button" onClick={handleConnect} disabled={busy === 'connect'} className="min-h-[48px] rounded-full bg-primary-container text-on-primary font-bold text-sm disabled:opacity-50">Reconnect Gmail</button>
          ) : (
            <>
              <button type="button" onClick={() => handleScan(false)} disabled={!!busy || scanning} className="min-h-[48px] rounded-full bg-primary-container text-on-primary font-bold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-50">
                {busy === 'scan' ? <span className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" /> : <span className="material-symbols-outlined text-[18px]">sync</span>}
                Scan now
              </button>
              <button type="button" onClick={() => handleScan(true)} disabled={!!busy || scanning} className="min-h-[48px] rounded-full border border-outline/20 text-sm font-semibold text-on-surface disabled:opacity-50">
                {busy === 'rescan' ? 'Rescanning…' : 'Rescan last 90 days'}
              </button>
            </>
          )}
          <button type="button" onClick={handleDisconnect} disabled={!!busy} className="min-h-[48px] rounded-full text-sm font-semibold text-error disabled:opacity-50">Disconnect</button>
        </div>
      </Modal>

      <Modal isOpen={sheet === 'pending'} onClose={() => setSheet(null)} title="Untracked cards">
        <p className="text-xs text-on-surface-variant mb-3">Add a card to track its bills and reminders, or ignore it to skip its future statements.</p>
        <ul className="divide-y divide-outline/10">
          {pendingGroups.map(g => (
            <li key={g.key} className="py-3">
              <p className="text-sm font-semibold text-on-surface">{g.latest.bankName}{g.latest.last4 ? ` ····${g.latest.last4}` : ''}</p>
              <p className="mt-0.5 text-xs text-on-surface-variant">
                {g.latest.amount != null ? formatCurrency(g.latest.amount) : '—'} · due {fmtDate(g.latest.dueDate)}{g.count > 1 ? ` · ${g.count} statements` : ''}
              </p>
              <div className="mt-2.5 flex gap-2">
                <button type="button" disabled={!!busy} onClick={() => { setSheet(null); setAddModal({ statement: g.latest, name: `${g.latest.bankName} Credit Card`, last4Digits: g.latest.last4 || '' }); }} className="flex-1 min-h-[40px] rounded-full bg-primary-container text-on-primary text-xs font-bold disabled:opacity-50">Add card</button>
                <button type="button" disabled={!!busy} onClick={() => handleIgnore(g)} className="flex-1 min-h-[40px] rounded-full border border-outline/20 text-xs font-semibold text-on-surface-variant disabled:opacity-50">Ignore</button>
              </div>
            </li>
          ))}
        </ul>
      </Modal>

      <Modal isOpen={sheet === 'review'} onClose={() => setSheet(null)} title="Emails to review"
        footer={<button type="button" disabled={!!busy} onClick={handleDismissAllReview} className="w-full min-h-[48px] rounded-full border border-outline/20 text-sm font-semibold text-on-surface disabled:opacity-50">Dismiss all</button>}>
        <p className="text-xs text-on-surface-variant mb-2">Vestor couldn&apos;t read these on its own. Analyze one with AI to save it and teach Vestor that type of email. This sends that one email to Groq, with card and account numbers masked.</p>
        <ul className="divide-y divide-outline/10">
          {review.map(e => (
            <li key={e._id} className="py-3">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-on-surface line-clamp-2">{e.subject || '(unreadable email)'}</p>
                  <p className="mt-0.5 text-xs text-on-surface-variant">
                    {e.institutionName || e.senderDomain || 'Unknown sender'} · {fmtDate(e.receivedAt)}
                    {e.fields?.amount != null ? ` · ${formatCurrency(e.fields.amount)}?` : ''}
                    {REVIEW_NOTES[e.reason] || ''}
                  </p>
                </div>
                <button type="button" disabled={!!busy} onClick={() => handleDismissReview(e._id)} aria-label="Dismiss" className="shrink-0 w-10 h-10 -mt-1 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest disabled:opacity-50">
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
              {e.reason !== 'unauthenticated_sender' && (
                <button type="button" disabled={!!busy} onClick={() => handleAnalyze(e)} className="mt-2 min-h-[40px] px-4 rounded-full border border-primary/30 text-primary text-xs font-bold inline-flex items-center gap-1.5 hover:bg-primary/10 transition-colors disabled:opacity-50">
                  {busy === `analyze-${e._id}`
                    ? <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                    : <span className="material-symbols-outlined text-[16px]" aria-hidden="true">auto_awesome</span>}
                  {busy === `analyze-${e._id}` ? 'Analyzing…' : 'Analyze with AI'}
                </button>
              )}
            </li>
          ))}
        </ul>
      </Modal>

      <Modal isOpen={sheet === 'saved'} onClose={() => setSheet(null)} title="Saved bank emails">
        {saved.length === 0 && <p className="text-sm text-on-surface-variant">Nothing saved yet.</p>}
        <ul className="divide-y divide-outline/10">
          {saved.map(e => (
            <li key={e._id} className="py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-on-surface line-clamp-2">{e.subject}</p>
                <p className="mt-0.5 text-xs text-on-surface-variant">{EMAIL_CATEGORY_LABELS[e.category] || 'Bank email'} · {fmtDate(e.receivedAt)}</p>
              </div>
              {e.fields?.amount != null && <span className="shrink-0 font-headline font-bold tabular-nums text-sm text-on-surface">{formatCurrency(e.fields.amount)}</span>}
            </li>
          ))}
        </ul>
        {emailRules.length > 0 && (
          <>
            <p className="mt-5 text-[11px] uppercase tracking-[0.14em] font-bold text-on-surface-variant">Remembered email types</p>
            <ul className="divide-y divide-outline/10">
              {emailRules.map(rl => (
                <li key={rl._id} className="py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-on-surface line-clamp-2">{rl.sampleSubject}</p>
                    <p className="mt-0.5 text-xs text-on-surface-variant">
                      {rl.category === 'not_financial' ? 'Skipped' : `Saved as ${(EMAIL_CATEGORY_LABELS[rl.category] || 'bank email').toLowerCase()}`}
                      {rl.timesApplied ? ` · used ${rl.timesApplied}×` : ''}
                    </p>
                  </div>
                  <button type="button" disabled={!!busy} onClick={() => handleForgetRule(rl)} className="shrink-0 min-h-[40px] px-3.5 rounded-full border border-outline/20 text-xs font-semibold text-on-surface-variant disabled:opacity-50">Forget</button>
                </li>
              ))}
            </ul>
          </>
        )}
        {pdfPasswords.length > 0 && (
          <>
            <p className="mt-5 text-[11px] uppercase tracking-[0.14em] font-bold text-on-surface-variant">Saved PDF passwords</p>
            <ul className="divide-y divide-outline/10">
              {pdfPasswords.map(pw => (
                <li key={pw._id} className="py-3 flex items-center gap-3">
                  <span className="material-symbols-outlined text-[20px] text-on-surface-variant" aria-hidden="true">lock</span>
                  <span className="flex-1 min-w-0 text-sm text-on-surface truncate">{pw.senderDomain}</span>
                  <button type="button" disabled={!!busy} onClick={() => handleRemovePassword(pw)} className="shrink-0 min-h-[40px] px-3.5 rounded-full border border-outline/20 text-xs font-semibold text-on-surface-variant disabled:opacity-50">Remove</button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Modal>
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

      <Modal isOpen={sheet === 'history'} onClose={() => setSheet(null)} title="Statement history">
        <ul className="divide-y divide-outline/10">
          {history.map(st => (
            <li key={st._id} className="py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-on-surface truncate">{cardName(st.cardId)}</p>
                <p className="mt-0.5 text-xs text-on-surface-variant">Statement {fmtDate(st.statementDate)} · due {fmtDate(st.dueDate)}</p>
              </div>
              <span className="shrink-0 font-headline font-bold tabular-nums text-sm text-on-surface">{st.amount != null ? formatCurrency(st.amount) : '—'}</span>
            </li>
          ))}
        </ul>
      </Modal>

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
