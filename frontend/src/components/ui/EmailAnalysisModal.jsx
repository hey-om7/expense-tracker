import React, { useEffect, useState } from 'react';
import Modal from './Modal';

export const EMAIL_CATEGORY_LABELS = {
  credit_card_statement: 'Credit card statement',
  account_statement: 'Bank account statement',
  transaction_alert: 'Transaction alert',
  other_financial: 'Other financial email',
  not_financial: 'Not useful (ignore these)',
};

const toInputDate = (d) => {
  if (!d) return '';
  const x = new Date(d);
  return isNaN(x.getTime()) ? '' : x.toISOString().slice(0, 10);
};

const CONFIDENCE_TEXT = { high: 'AI is confident', medium: 'AI is fairly sure', low: 'AI is unsure, please check' };

/**
 * Shows the AI's reading of one review email and lets the user correct it,
 * save it, and remember the email type so it is read without AI next time.
 * analysis: { email, proposal: { category, confidence, fields, learnable } }
 */
const EmailAnalysisModal = ({ analysis, saving, onClose, onConfirm }) => {
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (!analysis) { setForm(null); return; }
    const { category, fields } = analysis.proposal;
    setForm({
      category,
      amount: fields.amount ?? '',
      dueDate: toInputDate(fields.dueDate),
      statementDate: toInputDate(fields.statementDate),
      last4: fields.last4 ?? '',
      remember: true,
    });
  }, [analysis]);

  if (!analysis || !form) return null;

  const { email, proposal } = analysis;
  const ignore = form.category === 'not_financial';
  const isCard = form.category === 'credit_card_statement';
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const learnable = Object.entries(proposal.learnable || {}).filter(([, ok]) => ok).map(([f]) => f);
  const fieldNames = { amount: 'amount', dueDate: 'due date', statementDate: 'statement date', transactionDate: 'transaction date', last4: 'card digits' };

  const submit = (e) => {
    e.preventDefault();
    onConfirm({
      category: form.category,
      amount: form.amount === '' ? null : Number(form.amount),
      dueDate: form.dueDate || null,
      statementDate: form.statementDate || null,
      last4: form.last4 || null,
      remember: form.remember,
    });
  };

  const input = 'w-full bg-surface-container-lowest border border-outline/20 rounded-xl py-3 px-4 text-on-surface text-sm font-normal normal-case tracking-normal focus:outline-none focus:border-primary disabled:opacity-50';
  const label = 'flex flex-col gap-1.5 text-[11px] font-bold text-on-surface-variant uppercase tracking-[0.14em]';

  return (
    <Modal isOpen onClose={onClose} title="What AI found">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <p className="text-sm font-semibold text-on-surface line-clamp-2">{email.subject}</p>
          <p className="mt-0.5 text-xs text-on-surface-variant">
            {email.institutionName || email.senderDomain} · {CONFIDENCE_TEXT[proposal.confidence] || 'Check the details'}
          </p>
          {proposal.pdf && (
            <p className={`mt-2 text-xs font-semibold flex items-center gap-1.5 ${proposal.pdf.read ? 'text-[#95CD41]' : 'text-on-surface-variant'}`}>
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">{proposal.pdf.read ? 'picture_as_pdf' : 'warning'}</span>
              {proposal.pdf.read
                ? `Read from the attached PDF${proposal.pdf.passwordSaved ? '. Password saved.' : ''}`
                : 'The attached PDF has no readable text (it may be a scanned image), so only the email was read.'}
            </p>
          )}
        </div>

        <label className={label}>
          Email type
          <select value={form.category} onChange={set('category')} className={input}>
            {Object.entries(EMAIL_CATEGORY_LABELS).map(([id, text]) => <option key={id} value={id}>{text}</option>)}
          </select>
        </label>

        {!ignore && (
          <div className="grid grid-cols-2 gap-3 max-[360px]:grid-cols-1">
            <label className={label}>
              Amount (₹)
              <input type="number" inputMode="decimal" min="0" step="0.01" value={form.amount} onChange={set('amount')} placeholder="Not found" className={input} />
            </label>
            <label className={label}>
              {isCard ? 'Due date' : 'Statement date'}
              <input type="date" value={isCard ? form.dueDate : form.statementDate} onChange={set(isCard ? 'dueDate' : 'statementDate')} className={input} />
            </label>
            {isCard && (
              <label className={label}>
                Card last digits
                <input inputMode="numeric" maxLength={4} value={form.last4} onChange={(e) => setForm({ ...form, last4: e.target.value.replace(/\D/g, '') })} placeholder="Not found" className={input} />
              </label>
            )}
          </div>
        )}

        <label className="flex items-start gap-3 rounded-xl border border-outline/15 p-3 cursor-pointer">
          <input type="checkbox" checked={form.remember} onChange={set('remember')} className="mt-0.5 w-4 h-4 accent-[#E5BA73]" />
          <span className="text-xs text-on-surface-variant">
            <span className="block text-sm font-semibold text-on-surface">Remember this email type</span>
            {ignore
              ? `Future emails like this from ${email.institutionName || 'this bank'} will be skipped.`
              : `Future emails like this from ${email.institutionName || 'this bank'} will be saved automatically, without AI.`}
            {!ignore && form.remember && (learnable.length
              ? ` Vestor will read the ${learnable.map(f => fieldNames[f]).join(', ')} from them.`
              : ' Vestor will save them for you to check, but can’t read values from them yet.')}
          </span>
        </label>

        <div className="flex gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="flex-1 min-h-[48px] rounded-full border border-outline/20 text-sm font-semibold text-on-surface hover:bg-surface-container-highest transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="flex-1 min-h-[48px] rounded-full bg-primary-container text-on-primary text-sm font-bold hover:brightness-110 active:brightness-95 transition-[filter] inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-wait focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            {saving && <span className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" aria-hidden="true" />}
            {saving ? 'Saving…' : ignore ? 'Ignore email' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default EmailAnalysisModal;
