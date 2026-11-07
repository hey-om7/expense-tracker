import React from 'react';
import { formatCurrency } from '../../utils/currency';
import { getContrastingColor } from '../../utils/colorUtils';
import { panelClass, SectionHeader, SectionLink, EmptyState, relativeDay } from './dashboardUi';

const RecentActivity = ({ transactions, getCategory, onAdd, className = '' }) => (
  <section className={`${panelClass} ${className}`}>
    <SectionHeader title="Recent activity" action={transactions.length > 0 && <SectionLink to="/transactions">View all</SectionLink>} />

    {transactions.length === 0 ? (
      <div className="flex items-center justify-between gap-3">
        <EmptyState icon="receipt_long" title="No transactions yet" hint="Your latest five will appear here." />
        <button type="button" onClick={onAdd} className="shrink-0 min-h-[44px] px-4 rounded-full text-sm font-semibold text-primary border border-primary/30 hover:bg-primary/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          Add one
        </button>
      </div>
    ) : (
      <ul className="divide-y divide-outline/10 -mx-1">
        {transactions.map(t => {
          const cat = getCategory(t.categoryId);
          const isOut = t.type === 'expense' || t.type === 'buy_investment';
          return (
            <li key={t.id} className="flex items-center gap-3 px-1 py-3 first:pt-0 last:pb-0">
              <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: cat.color, color: getContrastingColor(cat.color) }} aria-hidden="true">
                <span className="material-symbols-outlined text-[19px]">{cat.icon}</span>
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-on-surface truncate">{t.title}</p>
                <p className="text-xs text-on-surface-variant truncate">{cat.name} · {relativeDay(t.date)}</p>
              </div>
              <span className={`shrink-0 font-headline font-bold text-sm tabular-nums ${isOut ? 'text-on-surface' : 'text-[#95CD41]'}`}>
                <span className="sr-only">{isOut ? 'Spent ' : 'Received '}</span>
                {isOut ? '−' : '+'}{formatCurrency(t.amount)}
              </span>
            </li>
          );
        })}
      </ul>
    )}
  </section>
);

export default RecentActivity;
