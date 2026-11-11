import React from 'react';
import { formatRupees as formatCurrency } from '../../utils/currency';
import { panelClass, SectionHeader, SectionLink, EmptyState } from '../dashboard/dashboardUi';

const PERIOD = { weekly: 'weekly', monthly: 'monthly', yearly: 'yearly' };

// Money that leaves every month before any choice is made: active subscriptions,
// with weekly and yearly ones converted to a monthly figure.
const Commitments = ({ commitments, committed, committedShare, className = '' }) => (
  <section className={`${panelClass} ${className}`} aria-labelledby="commit-title">
    <SectionHeader
      title={<span id="commit-title">Fixed every month</span>}
      caption={committedShare != null ? `${committedShare}% of your average income` : 'Active subscriptions, per month'}
      action={<SectionLink to="/cyclic">Manage</SectionLink>}
    />
    {commitments.length === 0 ? (
      <EmptyState icon="autorenew" title="No active subscriptions" hint="Recurring payments you add appear here." />
    ) : (
      <>
        <p className="font-headline font-extrabold text-3xl tabular-nums text-on-surface">
          {formatCurrency(Math.round(committed))}<span className="text-sm font-semibold text-on-surface-variant"> /month</span>
        </p>
        {committedShare != null && (
          <div className="mt-3 h-1.5 rounded-full bg-on-surface/[0.06] overflow-hidden" aria-hidden="true">
            <span className="block h-full bg-primary-container rounded-full" style={{ width: `${Math.min(100, committedShare)}%` }} />
          </div>
        )}
        <ul className="mt-5 divide-y divide-outline/10">
          {commitments.slice(0, 6).map(c => (
            <li key={c.id} className="flex items-baseline gap-3 py-2.5 first:pt-0 last:pb-0">
              <span className="flex-1 min-w-0 truncate text-sm text-on-surface">{c.name}</span>
              {c.period !== 'monthly' && (
                <span className="text-[11px] text-outline tabular-nums">{formatCurrency(c.amount)} {PERIOD[c.period]}</span>
              )}
              <span className="w-20 text-right text-sm font-headline font-bold tabular-nums text-on-surface">{formatCurrency(Math.round(c.monthly))}</span>
            </li>
          ))}
        </ul>
        {commitments.length > 6 && <p className="mt-3 text-[11px] text-outline">and {commitments.length - 6} more</p>}
      </>
    )}
  </section>
);

export default Commitments;
