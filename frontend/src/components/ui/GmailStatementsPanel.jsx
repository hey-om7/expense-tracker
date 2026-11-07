import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as api from '../../services/api';
import { formatCurrency } from '../../utils/currency';
import Modal from './Modal';

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
  const [status, setStatus] = useState(null);
  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState([]);
  const [review, setReview] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [busy, setBusy] = useState('');
  const [banner, setBanner] = useState(null);
  const [addModal, setAddModal] = useState(null); // { statement, name, last4Digits }

  const load = useCallback(async () => {
    try {
      const s = await api.fetchGmailStatus();
      setStatus(s);
      if (s.connected || s.pendingCount > 0 || s.reviewCount > 0) {
        const [p, h, r] = await Promise.all([
          api.fetchCardStatements({ status: 'pending' }),
          api.fetchCardStatements({ status: 'linked' }),
          api.fetchFinancialEmails('review'),
        ]);
        setPending(p);
        setHistory(h);
        setReview(r);
      }
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
    if (!window.confirm('Disconnect Gmail? Wallo will lose access to your email. Statements already saved are kept.')) return;
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

      {/* Connection card */}
      <div className="bg-surface-container-low rounded-xl border border-outline/10 p-4 max-md:p-3">
        {!status.connected ? (
          <div className="flex items-center justify-between gap-3 max-md:flex-col max-md:items-start">
            <div>
              <p className="font-bold text-on-surface text-sm">Track statements from Gmail</p>
              <p className="text-xs text-on-surface-variant mt-1">
                With your permission, Wallo reads (never sends or deletes) credit card statement emails from known banks:
                the last 90 days now, then new ones every day at 6 AM. You get an email one day before each due date.
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
        <div className="bg-primary/5 rounded-xl border border-primary/20 p-4 max-md:p-3">
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
        <div className="bg-surface-container-low rounded-xl border border-outline/10 p-4 max-md:p-3">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="font-bold text-sm text-on-surface">Bank emails to review ({review.length})</p>
              <p className="text-xs text-on-surface-variant mt-1">Wallo couldn&apos;t read these reliably, so nothing was recorded from them. Check them in Gmail and add anything relevant by hand.</p>
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
                    {e.reason === 'unauthenticated_sender' ? ' · sender not verified' : ''}
                  </p>
                </div>
                <button disabled={!!busy} onClick={() => handleDismissReview(e._id)} className={`${btn} text-on-surface-variant border border-outline/20 shrink-0`}>
                  Dismiss
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past statements */}
      {history.length > 0 && (
        <div className="bg-surface-container-low rounded-xl border border-outline/10">
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
