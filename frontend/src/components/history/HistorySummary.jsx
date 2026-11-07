import React from 'react';
import { formatCurrency } from '../../utils/currency';

// Title with one quiet line of totals for the current filters.
const HistorySummary = ({ count, totals, scopeLabel }) => {
  const net = totals.in - totals.out;
  return (
    <header className="pb-6 md:pb-8">
      <h1 className="font-manrope font-extrabold text-[clamp(2rem,8vw,3rem)] leading-none tracking-[-0.04em] text-on-surface">History</h1>
      <p className="mt-2 text-sm text-on-surface-variant">
        <span className="tabular-nums text-on-surface">{count}</span> {count === 1 ? 'transaction' : 'transactions'} · {scopeLabel}
      </p>

      <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3 text-sm">
        <div className="flex items-baseline gap-2">
          <dt className="text-on-surface-variant">In</dt>
          <dd className="font-headline font-semibold tabular-nums text-[#95CD41]">{formatCurrency(totals.in)}</dd>
        </div>
        <div className="flex items-baseline gap-2">
          <dt className="text-on-surface-variant">Out</dt>
          <dd className="font-headline font-semibold tabular-nums text-on-surface">{formatCurrency(totals.out)}</dd>
        </div>
        <div className="flex items-baseline gap-2">
          <dt className="text-on-surface-variant">Net</dt>
          <dd className={`font-headline font-semibold tabular-nums ${net >= 0 ? 'text-primary' : 'text-error'}`}>
            {net >= 0 ? '+' : '−'}{formatCurrency(Math.abs(net))}
          </dd>
        </div>
      </dl>
    </header>
  );
};

export default HistorySummary;
