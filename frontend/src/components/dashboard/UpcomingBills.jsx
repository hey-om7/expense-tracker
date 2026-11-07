import React from 'react';
import { formatCurrency } from '../../utils/currency';
import { panelClass, SectionHeader, SectionLink, EmptyState, daysUntil } from './dashboardUi';

const dueLabel = (days) => {
  if (days < 0) return { text: `Overdue ${Math.abs(days)}d`, urgent: true };
  if (days === 0) return { text: 'Due today', urgent: true };
  if (days === 1) return { text: 'Tomorrow', urgent: true };
  return { text: `In ${days} days`, urgent: days <= 3 };
};

// Mobile: a horizontal strip of tiles you can swipe. Desktop: a vertical list.
const UpcomingBills = ({ bills, className = '' }) => (
  <section className={`${panelClass} ${className}`}>
    <SectionHeader title="Coming up" action={<SectionLink to="/cyclic">Manage</SectionLink>} />

    {bills.length === 0 ? (
      <EmptyState icon="event_available" title="No bills due" hint="Subscriptions and card due dates show up here." />
    ) : (
      <ul className="flex md:flex-col gap-2.5 md:gap-0 overflow-x-auto md:overflow-visible snap-x snap-mandatory no-scrollbar -mx-4 px-4 md:mx-0 md:px-0 md:divide-y md:divide-outline/10">
        {bills.map(bill => {
          const due = dueLabel(daysUntil(bill.date));
          return (
            <li
              key={bill.id}
              className="snap-start shrink-0 w-[44%] min-w-[150px] md:w-auto md:min-w-0 flex flex-col md:flex-row md:items-center gap-3 p-3.5 md:px-0 md:py-3.5 md:first:pt-0 md:last:pb-0 rounded-2xl md:rounded-none bg-surface-container-low md:bg-transparent border border-outline/10 md:border-0"
            >
              <span className="w-9 h-9 rounded-full bg-surface-container-highest flex items-center justify-center shrink-0" style={{ color: bill.color }} aria-hidden="true">
                <span className="material-symbols-outlined text-[18px]">{bill.icon}</span>
              </span>
              <div className="min-w-0 md:flex-1">
                <p className="text-sm font-semibold text-on-surface truncate">{bill.title}</p>
                <p className={`mt-0.5 text-xs font-semibold flex items-center gap-1 ${due.urgent ? 'text-error' : 'text-on-surface-variant'}`}>
                  {due.urgent && <span className="material-symbols-outlined text-[14px]" aria-hidden="true">schedule</span>}
                  {due.text}
                </p>
              </div>
              <span className="text-sm font-headline font-bold tabular-nums text-on-surface md:shrink-0">
                {typeof bill.amount === 'number' ? formatCurrency(bill.amount) : <span className="text-xs font-semibold text-on-surface-variant">Amount pending</span>}
              </span>
            </li>
          );
        })}
      </ul>
    )}
  </section>
);

export default UpcomingBills;
