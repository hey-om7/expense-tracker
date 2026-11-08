import React from 'react';
import { formatCurrency } from '../../utils/currency';
import CategoryIcon from '../ui/CategoryIcon';
import { groupByDay, dayLabel, isOutflow, isTrade } from './filters';

const TRADE_CATEGORY = { color: '#95CD41', icon: 'monitoring', name: 'Investment trade' };
const UNCATEGORIZED = { color: '#3D332B', icon: 'receipt', name: 'Uncategorized' };

const Row = ({ t, getCategory, onOpen, showDate }) => {
  const cat = isTrade(t) ? TRADE_CATEGORY : (getCategory(t.categoryId) || UNCATEGORIZED);
  const out = isOutflow(t);
  const meta = [isTrade(t) ? (t.type === 'buy_investment' ? 'Buy' : 'Sell') : cat.name];
  if (showDate) meta.push(new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }));

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(t)}
        className="group w-full flex items-center gap-3.5 px-2 py-3 rounded-xl text-left transition-colors duration-150 hover:bg-surface-container-low active:bg-surface-container focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
      >
        <CategoryIcon icon={cat.icon} color={cat.color} />
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-semibold text-on-surface truncate">{t.title}</span>
          <span className="block text-xs text-on-surface-variant truncate">
            {meta.join(' · ')}
            {t.notes && <span className="text-on-surface-variant/70"> · {t.notes}</span>}
          </span>
        </span>
        <span className="shrink-0 flex items-center gap-1">
          <span className={`font-headline font-bold tabular-nums text-[15px] ${out ? 'text-on-surface' : 'text-[#95CD41]'}`}>
            <span className="sr-only">{out ? 'Out ' : 'In '}</span>{out ? '−' : '+'}{formatCurrency(t.amount)}
          </span>
          <span className="material-symbols-outlined text-[18px] text-on-surface-variant/0 group-hover:text-on-surface-variant transition-colors hidden md:inline" aria-hidden="true">chevron_right</span>
        </span>
      </button>
    </li>
  );
};

// Date sorts are grouped by day with sticky day headers; amount sorts are a flat ranked list.
const TransactionList = ({ items, sort, getCategory, onOpen }) => {
  if (sort === 'highest' || sort === 'lowest') {
    return (
      <ul className="divide-y divide-outline/10">
        {items.map(t => <Row key={t.id} t={t} getCategory={getCategory} onOpen={onOpen} showDate />)}
      </ul>
    );
  }

  return (
    <div>
      {groupByDay(items).map(g => (
          <section key={g.key} aria-label={dayLabel(g.date)} className="pt-3 first:pt-0">
            {/* Day row: tinted band so each day reads as its own block. The page-colour
                padding behind it keeps rows from showing through while it's stuck. */}
            <div className="sticky top-[var(--history-sticky)] z-10 bg-[#1A120B] py-1.5">
              <h2 className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-surface-container-low text-xs">
                <span className="font-semibold text-on-surface">{dayLabel(g.date)}</span>
                <span className={`tabular-nums font-semibold ${g.in - g.out >= 0 ? 'text-[#95CD41]' : 'text-on-surface-variant'}`}>
                  <span className="sr-only">Net </span>{g.in - g.out >= 0 ? '+' : '−'}{formatCurrency(Math.abs(g.in - g.out))}
                </span>
              </h2>
            </div>
            <ul className="pb-3 divide-y divide-outline/[0.07]">
              {g.items.map(t => <Row key={t.id} t={t} getCategory={getCategory} onOpen={onOpen} />)}
            </ul>
          </section>
      ))}
    </div>
  );
};

export default TransactionList;
