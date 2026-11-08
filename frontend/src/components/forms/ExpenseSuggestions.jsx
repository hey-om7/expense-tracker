import React, { useEffect, useState } from 'react';
import * as api from '../../services/api';

// Brand tint for the source badge. Unknown sources fall back to a neutral style.
const SOURCE_STYLE = {
  PhonePe: 'bg-[#5f259f]/20 text-[#c9a7f5]',
  Kotak: 'bg-[#ed1c24]/15 text-[#ff9a9e]',
};
const NEUTRAL_SOURCE = 'bg-surface-container-highest text-on-surface-variant';

const METHOD_LABEL = { upi: 'UPI', debit_card: 'Debit card', credit_card: 'Card', net_banking: 'Bank', wallet: 'Wallet' };
const METHOD_ICON = { upi: 'qr_code_2', debit_card: 'credit_card', credit_card: 'credit_card', net_banking: 'account_balance', wallet: 'account_balance_wallet' };

const formatAmount = (n) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const formatWhen = (d) => {
  const date = new Date(d);
  const today = new Date();
  const yesterday = new Date(Date.now() - 864e5);
  const time = date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  if (date.toDateString() === today.toDateString()) return `Today, ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

/**
 * Horizontal, swipeable list of recent PhonePe / Kotak debits detected from Gmail.
 * Tapping one calls onPick(suggestion) so the form can prefill itself.
 */
const ExpenseSuggestions = ({ selectedId, onPick }) => {
  const [items, setItems] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = () => api.fetchExpenseSuggestions()
      .then((rows) => { if (alive) setItems(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (alive) setItems((prev) => prev ?? []); });
    // Show what we already have, then check Gmail for anything newer and refresh.
    load();
    api.syncNewGmailEmails()
      .then((r) => { if (alive && r?.synced) load(); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const dismiss = (e, s) => {
    e.stopPropagation();
    setItems((prev) => prev.filter((x) => x.id !== s.id));
    if (selectedId === s.id) onPick(null);
    api.resolveExpenseSuggestion(s.ids, 'dismissed').catch(() => {});
  };

  if (!items || items.length === 0) return null;

  return (
    <section aria-label="Suggested expenses from your emails">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs text-on-surface-variant uppercase tracking-widest font-bold flex items-center gap-1.5">
          <span className="material-symbols-outlined text-sm text-primary">auto_awesome</span>
          From your emails
        </span>
        <span className="text-[10px] font-semibold text-on-surface-variant bg-surface-container-highest rounded-full px-2 py-0.5">
          {items.length} recent
        </span>
      </div>

      <div className="relative -mx-1">
        <div className="flex gap-2.5 overflow-x-auto snap-x snap-mandatory px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden overscroll-x-contain">
          {items.map((s) => {
            const active = s.id === selectedId;
            const primarySource = s.sources?.[0];
            const extraSources = (s.sources?.length || 0) - 1;
            const method = METHOD_LABEL[s.paymentMethod];
            const pick = () => onPick(active ? null : s);

            return (
              <div
                key={s.id}
                role="button"
                tabIndex={0}
                aria-pressed={active}
                onClick={pick}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } }}
                className={`group relative snap-start shrink-0 w-[168px] h-[124px] flex flex-col rounded-2xl border p-3 text-left cursor-pointer select-none transition-all duration-150 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary
                  ${active
                    ? 'border-primary bg-primary/10 shadow-[0_0_0_1px_var(--tw-shadow-color)] shadow-primary'
                    : 'border-outline/15 bg-surface-container-lowest hover:border-primary/40'}`}
              >
                {/* Header: source badge + dismiss / selected indicator */}
                <div className="flex items-center justify-between h-6">
                  {primarySource ? (
                    <span className={`inline-flex items-center h-5 px-2 rounded-md text-[10px] font-bold tracking-wide ${SOURCE_STYLE[primarySource] || NEUTRAL_SOURCE}`}>
                      {primarySource}{extraSources > 0 ? ` +${extraSources}` : ''}
                    </span>
                  ) : <span />}

                  {active ? (
                    <span className="w-6 h-6 flex items-center justify-center rounded-full bg-primary text-on-primary">
                      <span className="material-symbols-outlined text-sm">check</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => dismiss(e, s)}
                      aria-label="Hide suggestion"
                      className="-mr-1 w-7 h-7 flex items-center justify-center rounded-full text-on-surface-variant/60 hover:text-on-surface hover:bg-surface-container-highest"
                    >
                      <span className="material-symbols-outlined text-base">close</span>
                    </button>
                  )}
                </div>

                {/* Body: amount + payee */}
                <div className="mt-auto min-w-0">
                  <div className="text-lg font-bold font-manrope text-on-surface leading-none tabular-nums truncate">
                    {formatAmount(s.amount)}
                  </div>
                  <div className="text-[13px] text-on-surface truncate mt-1" title={s.merchant || ''}>
                    {s.merchant || <span className="text-on-surface-variant italic">Unknown payee</span>}
                  </div>
                </div>

                {/* Footer: when + method */}
                <div className="flex items-center gap-1 mt-1.5 text-[11px] text-on-surface-variant min-w-0">
                  {METHOD_ICON[s.paymentMethod] && (
                    <span className="material-symbols-outlined text-[13px] shrink-0">{METHOD_ICON[s.paymentMethod]}</span>
                  )}
                  <span className="truncate">
                    {formatWhen(s.date)}
                    {method ? ` · ${method}` : ''}
                    {s.last4 ? ` ••${String(s.last4).slice(-4)}` : ''}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        {/* Right-edge fade hints that the row scrolls */}
        <div className="pointer-events-none absolute top-0 right-0 h-full w-8 bg-gradient-to-l from-surface-container-high to-transparent" />
      </div>
    </section>
  );
};

export default ExpenseSuggestions;
