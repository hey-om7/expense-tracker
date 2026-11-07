import React from 'react';
import { formatCurrency } from '../../utils/currency';
import { panelClass, SectionHeader, SectionLink, EmptyState } from './dashboardUi';

const TOP_N = 5;

// One stacked bar for the whole month, then a ranked list of categories.
const SpendingBreakdown = ({ categories, total, className = '' }) => {
  const top = categories.slice(0, TOP_N);
  const rest = categories.slice(TOP_N);
  const restTotal = rest.reduce((s, c) => s + c.spent, 0);
  const sum = categories.reduce((s, c) => s + c.spent, 0) || 1;
  const segments = restTotal > 0 ? [...top, { id: 'other', name: `${rest.length} more`, color: '#5c5047', spent: restTotal }] : top;

  return (
    <section className={`${panelClass} ${className}`}>
      <SectionHeader
        title="Where it went"
        caption="Spending by category this month"
        action={<span className="font-headline font-extrabold text-lg md:text-2xl text-on-surface whitespace-nowrap">{formatCurrency(total)}</span>}
      />

      {categories.length === 0 ? (
        <EmptyState icon="savings" title="Nothing spent yet this month" hint="Expenses you add show up here by category." />
      ) : (
        <>
          <div className="flex h-3 w-full gap-[3px] overflow-hidden rounded-full" aria-hidden="true">
            {segments.map(c => (
              <span key={c.id} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(c.spent / sum) * 100}%`, backgroundColor: c.color }} />
            ))}
          </div>

          <ul className="mt-5 divide-y divide-outline/10">
            {segments.map(c => {
              const pct = Math.round((c.spent / sum) * 100);
              return (
                <li key={c.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} aria-hidden="true" />
                  <span className="flex-1 min-w-0 truncate text-sm text-on-surface">{c.name}</span>
                  <span className="text-xs tabular-nums text-on-surface-variant w-9 text-right">{pct}%</span>
                  <span className="text-sm font-headline font-bold tabular-nums text-on-surface w-24 text-right">{formatCurrency(c.spent)}</span>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex justify-end">
            <SectionLink to="/analytics">Full analytics</SectionLink>
          </div>
        </>
      )}
    </section>
  );
};

export default SpendingBreakdown;
