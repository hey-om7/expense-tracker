import React from 'react';
import { formatRupees as formatCurrency } from '../../utils/currency';
import { panelClass, SectionHeader, EmptyState } from '../dashboard/dashboardUi';

// The places money goes to most this month, and the single biggest expense.
const FrequentPayees = ({ payees, biggest, monthName, className = '' }) => {
  const max = Math.max(1, ...payees.map(p => p.total));
  return (
    <section className={`${panelClass} ${className}`} aria-labelledby="payees-title">
      <SectionHeader title={<span id="payees-title">Where it goes</span>} caption={`Top places by amount in ${monthName}`} />
      {payees.length === 0 ? (
        <EmptyState icon="storefront" title="No expenses this month" hint="Expenses with a title are grouped here." />
      ) : (
        <ol className="flex flex-col gap-4">
          {payees.map((p, i) => (
            <li key={p.name} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] gap-x-3 items-baseline">
              <span className="font-headline text-xs tabular-nums text-outline">{String(i + 1).padStart(2, '0')}</span>
              <span className="min-w-0">
                <span className="block text-sm text-on-surface truncate">{p.name}</span>
                <span className="block mt-1.5 h-1 rounded-full bg-on-surface/[0.06] overflow-hidden" aria-hidden="true">
                  <span className="block h-full rounded-full" style={{ width: `${(p.total / max) * 100}%`, backgroundColor: p.color }} />
                </span>
              </span>
              <span className="text-right">
                <span className="block font-headline font-bold text-sm tabular-nums text-on-surface">{formatCurrency(p.total)}</span>
                <span className="block text-[11px] text-outline">{p.count}×</span>
              </span>
            </li>
          ))}
        </ol>
      )}
      {biggest && (
        <p className="mt-6 pt-4 border-t border-outline/10 text-xs text-on-surface-variant">
          Biggest single expense: <span className="text-on-surface font-semibold">{biggest.title || 'Untitled'}</span>,{' '}
          {formatCurrency(biggest.amount)} on {new Date(biggest.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
        </p>
      )}
    </section>
  );
};

export default FrequentPayees;
