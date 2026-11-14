import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchTrainingTypes, fetchTrainingEmail, trainEmail, resetEmailTraining, invalidateCache,
} from '../services/api';
import { formatCurrency } from '../utils/currency';

/**
 * Settings → AI training.
 * Lists the email types that feed expense suggestions (one sample email per bank + subject
 * shape). The user opens a sample, checks what Vestor read, marks the right text for any
 * wrong value and saves. Vestor learns a pattern from the text around each mark and
 * re-reads that type's emails with it; AI is no longer needed for that type.
 */

// Each field has its own color AND underline style, so marks are distinguishable without color.
const FIELDS = [
  { id: 'amount', label: 'Amount', mark: 'bg-primary/25 decoration-primary decoration-solid', dot: 'bg-primary' },
  { id: 'merchant', label: 'Merchant', mark: 'bg-tertiary/25 decoration-tertiary decoration-dashed', dot: 'bg-tertiary' },
  { id: 'transactionDate', label: 'Date', mark: 'bg-secondary-fixed/20 decoration-secondary-fixed decoration-dotted', dot: 'bg-secondary-fixed' },
  { id: 'last4', label: 'Card / account', mark: 'bg-error/20 decoration-error decoration-double', dot: 'bg-error' },
];
const fieldById = Object.fromEntries(FIELDS.map(f => [f.id, f]));

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null);
const fmtValue = (field, v) => {
  if (v == null || v === '') return null;
  if (field === 'amount') return formatCurrency(v);
  if (field === 'transactionDate') return fmtDate(v);
  if (field === 'last4') return `•• ${v}`;
  return v;
};

// Character offset of (node, offset) inside container's text.
const offsetIn = (container, node, offset) => {
  const range = document.createRange();
  range.setStart(container, 0);
  range.setEnd(node, offset);
  return range.toString().length;
};

const withoutOverlap = (marks, field, span) => {
  const next = { ...marks };
  Object.entries(next).forEach(([f, s]) => {
    if (f !== field && s && s.start < span.end && span.start < s.end) next[f] = null;
  });
  next[field] = span;
  return next;
};

// ─── Email type list ───
const TypeList = ({ types, activeId, onOpen }) => (
  <ol className="flex flex-col divide-y divide-outline/10 border-y border-outline/10">
    {types.map((t, i) => {
      const active = t.sample.id === activeId;
      return (
        <li key={t.key}>
          <button
            type="button"
            onClick={() => onOpen(t.sample.id)}
            aria-current={active ? 'true' : undefined}
            className={`group w-full text-left py-4 pl-3 pr-2 flex gap-4 items-baseline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm ${active ? 'bg-primary/[0.06]' : 'hover:bg-on-surface/[0.03]'}`}
          >
            <span className={`font-headline text-xs tabular-nums w-5 shrink-0 ${active ? 'text-primary' : 'text-outline'}`}>{String(i + 1).padStart(2, '0')}</span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className={`font-headline font-bold text-sm truncate ${active ? 'text-primary' : 'text-on-surface'}`}>{t.institutionName}</span>
                {t.trainedAt && (
                  <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-tertiary">
                    <span className="material-symbols-outlined text-xs" aria-hidden="true">check</span>Trained
                  </span>
                )}
              </span>
              <span className="block text-xs text-on-surface-variant truncate mt-0.5">{t.sample.subject || '(no subject)'}</span>
              <span className="block text-[11px] text-outline mt-1">
                {t.count} email{t.count === 1 ? '' : 's'}
                {t.missingMerchant > 0 && <> · {t.missingMerchant} without merchant</>}
              </span>
            </span>
            <span className="material-symbols-outlined text-base text-outline transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true">chevron_right</span>
          </button>
        </li>
      );
    })}
  </ol>
);

// ─── Email body with marks ───
const EmailBody = React.forwardRef(({ text, marks }, ref) => {
  const segments = useMemo(() => {
    const list = Object.entries(marks).filter(([, s]) => s).sort((a, b) => a[1].start - b[1].start);
    const out = [];
    let i = 0;
    list.forEach(([field, s]) => {
      if (s.start < i) return;
      if (s.start > i) out.push({ text: text.slice(i, s.start) });
      out.push({ text: text.slice(s.start, s.end), field });
      i = s.end;
    });
    out.push({ text: text.slice(i) });
    return out;
  }, [text, marks]);

  return (
    <div
      ref={ref}
      className="whitespace-pre-wrap break-words text-[13px] leading-6 text-on-surface/90 selection:bg-primary/40 selection:text-on-surface max-h-[60vh] overflow-y-auto pr-2"
    >
      {segments.map((s, i) => (s.field ? (
        <mark
          key={i}
          title={fieldById[s.field].label}
          className={`text-on-surface rounded-[2px] underline underline-offset-4 decoration-2 ${fieldById[s.field].mark}`}
        >
          {s.text}
        </mark>
      ) : <React.Fragment key={i}>{s.text}</React.Fragment>))}
    </div>
  );
});
EmailBody.displayName = 'EmailBody';

// ─── Workspace for one sample email ───
const Trainer = ({ id, onTrained }) => {
  const [email, setEmail] = useState(null);
  const [error, setError] = useState('');
  const [marks, setMarks] = useState({});
  const [touched, setTouched] = useState({});
  const [active, setActive] = useState('amount');
  const [typed, setTyped] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const bodyRef = useRef(null);

  useEffect(() => {
    let alive = true;
    setEmail(null); setError(''); setStatus(null); setTouched({}); setTyped('');
    fetchTrainingEmail(id)
      .then((data) => { if (!alive) return; setEmail(data); setMarks(data.spans || {}); })
      .catch((err) => alive && setError(err.message || 'Could not load this email.'));
    return () => { alive = false; };
  }, [id]);

  const setMark = useCallback((field, span) => {
    setMarks(m => withoutOverlap(m, field, span));
    setTouched(t => ({ ...t, [field]: true }));
    setStatus(null);
  }, []);

  // Selecting text in the body marks it for the active field.
  const handleSelection = () => {
    const sel = window.getSelection();
    const box = bodyRef.current;
    if (!sel || sel.isCollapsed || !box || !box.contains(sel.anchorNode) || !box.contains(sel.focusNode)) return;
    const r = sel.getRangeAt(0);
    let start = offsetIn(box, r.startContainer, r.startOffset);
    let end = offsetIn(box, r.endContainer, r.endOffset);
    const raw = email.text.slice(start, end);
    start += raw.length - raw.trimStart().length;
    end -= raw.length - raw.trimEnd().length;
    if (end <= start || end - start > 120) return;
    setMark(active, { start, end });
    sel.removeAllRanges();
  };

  // Keyboard alternative: type the exact text and find it in the email.
  const handleFind = (e) => {
    e.preventDefault();
    const q = typed.trim();
    if (!q) return;
    const i = email.text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) { setStatus({ tone: 'error', text: `"${q}" isn't in this email. Copy it exactly as written.` }); return; }
    setMark(active, { start: i, end: i + q.length });
    setTyped('');
  };

  const clearMark = (field) => {
    setMarks(m => ({ ...m, [field]: null }));
    setTouched(t => ({ ...t, [field]: true }));
  };

  const save = async () => {
    const payload = Object.fromEntries(Object.keys(touched).map(f => [f, marks[f] || null]));
    setSaving(true); setStatus(null);
    try {
      const r = await trainEmail(id, payload);
      setEmail(e => ({ ...e, fields: r.fields }));
      setMarks(r.spans || marks);
      setTouched({});
      invalidateCache('expense-suggestions');
      setStatus({ tone: 'ok', text: `Learned ${r.learned.length ? r.learned.map(f => fieldById[f].label.toLowerCase()).join(', ') : 'your changes'}. ${r.updated} email${r.updated === 1 ? '' : 's'} of this type re-read.` });
      onTrained?.();
    } catch (err) {
      setStatus({ tone: 'error', text: err.message || 'Could not save. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setSaving(true); setStatus(null);
    try {
      await resetEmailTraining(id);
      setStatus({ tone: 'ok', text: 'Training removed. New emails of this type use the standard rules again.' });
      onTrained?.();
    } catch (err) {
      setStatus({ tone: 'error', text: err.message || 'Could not reset.' });
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return (
      <div className="py-16 flex flex-col items-start gap-3">
        <span className="material-symbols-outlined text-error text-3xl" aria-hidden="true">mail_off</span>
        <p className="text-sm text-on-surface max-w-sm">{error}</p>
      </div>
    );
  }
  if (!email) {
    return (
      <div className="py-6 flex flex-col gap-3 motion-safe:animate-pulse" aria-busy="true" aria-label="Loading email">
        <div className="h-5 w-2/3 bg-on-surface/10 rounded-sm" />
        <div className="h-3 w-1/3 bg-on-surface/10 rounded-sm mb-6" />
        {[92, 85, 97, 60, 88, 40].map((w, i) => <div key={i} className="h-3 bg-on-surface/[0.07] rounded-sm" style={{ width: `${w}%` }} />)}
      </div>
    );
  }

  const dirty = Object.keys(touched).length > 0;
  const markedText = (f) => (marks[f] ? email.text.slice(marks[f].start, marks[f].end) : null);

  const activeLabel = fieldById[active].label.toLowerCase();
  const changed = Object.keys(touched).map(f => fieldById[f].label).join(', ');

  return (
    <div className="flex flex-col motion-safe:animate-[modalFade_0.25s_ease-out]">
      <header className="pb-5 border-b border-outline/10">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-outline">{email.institutionName} · {fmtDate(email.receivedAt)}</p>
        <h2 className="font-headline font-bold text-lg sm:text-xl text-on-surface mt-1.5 leading-snug">{email.subject}</h2>
        <p className="text-xs text-on-surface-variant mt-1 truncate">{email.from}</p>
      </header>

      {/* Step 1: what Vestor read, and which value the next mark sets */}
      <fieldset className="pt-5">
        <legend className="flex items-baseline gap-2 text-xs text-on-surface-variant mb-3">
          <span className="font-headline font-bold text-primary tabular-nums">1</span>
          Check each value. Pick the one that&apos;s wrong.
        </legend>
        <div className="grid grid-cols-2 xl:grid-cols-4 border-t border-l border-outline/10">
          {FIELDS.map((f) => {
            const on = active === f.id;
            const read = fmtValue(f.id, email.fields?.[f.id]);
            const marked = markedText(f.id);
            return (
              <label key={f.id} className={`relative cursor-pointer px-3 py-3 min-h-[5.5rem] flex flex-col gap-1 border-r border-b border-outline/10 transition-colors ${on ? 'bg-primary/[0.07]' : 'hover:bg-on-surface/[0.03]'}`}>
                <input type="radio" name="trainField" value={f.id} checked={on} onChange={() => setActive(f.id)} className="sr-only peer" />
                <span className="absolute inset-0 peer-focus-visible:ring-2 peer-focus-visible:ring-inset peer-focus-visible:ring-primary pointer-events-none" aria-hidden="true" />
                <span className={`absolute left-0 right-0 top-0 h-0.5 transition-opacity ${on ? 'bg-primary opacity-100' : 'opacity-0'}`} aria-hidden="true" />
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  <span className={`w-1.5 h-1.5 rounded-full ${f.dot}`} aria-hidden="true" />{f.label}
                </span>
                <span className={`font-headline font-bold text-base truncate ${read ? 'text-on-surface' : 'text-outline italic font-normal text-sm'}`}>{read || 'not found'}</span>
                <span className="text-[11px] text-outline truncate mt-auto">
                  {marked ? <>marked <span className="text-on-surface-variant">“{marked}”</span></> : touched[f.id] ? 'mark cleared' : 'not marked'}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* Step 2: mark the right text */}
      <div className="pt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-3">
          <p className="flex items-baseline gap-2 text-xs text-on-surface-variant">
            <span className="font-headline font-bold text-primary tabular-nums">2</span>
            <span>Select the <span className="font-bold text-on-surface">{activeLabel}</span> in the email.</span>
          </p>
          {marks[active] && (
            <button type="button" onClick={() => clearMark(active)} className="text-[11px] font-semibold text-on-surface-variant underline underline-offset-4 decoration-outline/50 hover:text-on-surface hover:decoration-on-surface transition-colors">
              Clear {activeLabel} mark
            </button>
          )}
        </div>
        <div
          className="bg-surface-container-lowest border border-outline/10 rounded-lg px-4 sm:px-6 py-5"
          onMouseUp={handleSelection} onTouchEnd={handleSelection} onKeyUp={handleSelection}
        >
          <EmailBody ref={bodyRef} text={email.text} marks={marks} />
        </div>
        <form onSubmit={handleFind} className="mt-3 flex gap-2">
          <label htmlFor="trainFind" className="sr-only">Type the exact {activeLabel} text</label>
          <input
            id="trainFind"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={`Or type the ${activeLabel} exactly as written`}
            className="flex-1 min-w-0 bg-transparent border border-outline/20 rounded-lg py-2.5 px-3 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary"
          />
          <button type="submit" disabled={!typed.trim()} className="shrink-0 px-4 py-2.5 rounded-lg text-sm font-bold text-primary border border-primary/30 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors disabled:text-on-surface-variant disabled:border-outline/20 disabled:cursor-not-allowed">
            Mark
          </button>
        </form>
      </div>

      {/* Step 3: save. Right padding keeps the button clear of the floating AI chat button. */}
      <div className="mt-8 pt-5 border-t border-outline/10 flex flex-col gap-4 lg:pr-24">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="group shrink-0 inline-flex items-center justify-center gap-2 bg-primary text-on-primary px-5 py-3 rounded-lg font-bold text-sm hover:bg-primary-fixed active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-primary transition-colors disabled:bg-on-surface/10 disabled:text-on-surface-variant disabled:cursor-not-allowed"
          >
            {saving
              ? <span className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              : <span className="material-symbols-outlined text-base" aria-hidden="true">school</span>}
            {saving ? 'Learning…' : 'Save and re-read emails'}
          </button>
          <p role="status" aria-live="polite" className={`text-xs leading-relaxed ${status?.tone === 'error' ? 'text-error' : status ? 'text-tertiary' : 'text-outline'}`}>
            {status?.text || (dirty ? `Changed: ${changed}.` : 'Nothing changed yet.')}
          </p>
        </div>
        <button type="button" onClick={reset} disabled={saving} className="self-start text-xs font-semibold text-on-surface-variant underline underline-offset-4 decoration-outline/50 hover:text-on-surface hover:decoration-on-surface transition-colors disabled:opacity-40">
          Remove training for this type
        </button>
      </div>
    </div>
  );
};

// ─── Page ───
const AiTrainingScreen = () => {
  const [types, setTypes] = useState(null);
  const [error, setError] = useState('');
  const [activeId, setActiveId] = useState(null);
  const workspaceRef = useRef(null);

  const load = useCallback(() => fetchTrainingTypes()
    .then((list) => { setTypes(list); setActiveId(cur => cur || list[0]?.sample.id || null); })
    .catch((err) => setError(err.message || 'Could not load tracked emails.')), []);

  useEffect(() => { load(); }, [load]);

  const open = (id) => {
    setActiveId(id);
    if (window.matchMedia('(max-width: 1023px)').matches) {
      requestAnimationFrame(() => workspaceRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }));
    }
  };

  const total = types?.reduce((n, t) => n + t.count, 0) || 0;
  const [filter, setFilter] = useState('all');
  const filters = useMemo(() => {
    const list = types || [];
    return [
      { id: 'all', label: 'All', items: list },
      { id: 'needs', label: 'Needs Training / Missing Merchant', items: list.filter(t => !t.trainedAt || t.missingMerchant > 0) },
      { id: 'trained', label: 'Trained', items: list.filter(t => t.trainedAt) },
    ];
  }, [types]);
  const shown = filters.find(f => f.id === filter).items;

  return (
    <main className="pt-24 pb-32 px-4 sm:px-6 max-w-6xl w-full mx-auto min-h-screen">
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-on-surface-variant">
          <li><Link to="/settings" className="hover:text-on-surface underline-offset-4 hover:underline transition-colors">Settings</Link></li>
          <li aria-hidden="true" className="text-outline">/</li>
          <li><Link to="/settings/email" className="hover:text-on-surface underline-offset-4 hover:underline transition-colors">Email Management</Link></li>
          <li aria-hidden="true" className="text-outline">/</li>
          <li aria-current="page" className="text-on-surface">AI Training</li>
        </ol>
      </nav>

      <header className="mt-5 mb-10 max-w-2xl">
        <h1 className="font-headline font-extrabold text-on-surface tracking-tight leading-[1.02] text-[clamp(2rem,4.2vw,3rem)]">
          Teach Vestor <br className="hidden sm:block" /><span className="text-primary whitespace-nowrap">your bank emails.</span>
        </h1>
        <p className="mt-4 text-sm text-on-surface-variant leading-relaxed max-w-xl">
          These emails become expense suggestions. Open one of each kind, check what was read, and mark the right
          text where it&apos;s wrong. Vestor learns the words around your mark and reads every email of that kind the
          same way, without AI. Bodies are read from Gmail when you open them and never stored.
        </p>
      </header>

      {error && <p role="alert" className="text-sm text-error">{error}</p>}

      {!types && !error && (
        <div className="flex flex-col gap-4 motion-safe:animate-pulse max-w-sm" aria-busy="true" aria-label="Loading">
          {[0, 1, 2, 3].map(i => <div key={i} className="h-12 bg-on-surface/[0.06] rounded-sm" />)}
        </div>
      )}

      {types && types.length === 0 && (
        <section className="border-t border-outline/10 pt-10 max-w-lg">
          <h2 className="font-headline font-bold text-xl text-on-surface">No expense emails yet</h2>
          <p className="text-sm text-on-surface-variant mt-2 leading-relaxed">
            Once Gmail is connected and a scan finds card or UPI spend alerts, each kind of email shows up here.
          </p>
          <Link to="/settings/email" className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-primary underline underline-offset-4 decoration-primary/40 hover:decoration-primary transition-colors">
            Open Email management to connect or scan Gmail
          </Link>
        </section>
      )}

      {types && types.length > 0 && (
        <div className="grid lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] gap-10 lg:gap-12 items-start">
          <aside className="lg:sticky lg:top-24">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-outline mb-3">
              {types.length} kind{types.length === 1 ? '' : 's'} · {total} email{total === 1 ? '' : 's'}, last 90 days
            </p>
            <div role="group" aria-label="Filter email types" className="flex flex-wrap gap-1.5 mb-4">
              {filters.map(f => (
                <button key={f.id} type="button" onClick={() => setFilter(f.id)} aria-pressed={filter === f.id}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${filter === f.id ? 'bg-primary/15 border-primary/40 text-primary' : 'border-outline/20 text-on-surface-variant hover:text-on-surface hover:border-outline/40'}`}>
                  {f.label} ({f.items.length})
                </button>
              ))}
            </div>
            {shown.length > 0
              ? <TypeList types={shown} activeId={activeId} onOpen={open} />
              : <p className="text-xs text-on-surface-variant border-y border-outline/10 py-6">{filter === 'trained' ? 'No email types trained yet.' : 'Every email type is trained and has a merchant.'}</p>}
          </aside>
          <section ref={workspaceRef} aria-label="Selected email" className="min-w-0 scroll-mt-24">
            {activeId && <Trainer key={activeId} id={activeId} onTrained={load} />}
          </section>
        </div>
      )}
    </main>
  );
};

export default AiTrainingScreen;
