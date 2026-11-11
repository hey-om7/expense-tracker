import React from 'react';
import { formatRupees as formatCurrency } from '../../utils/currency';
import { panelClass, SectionHeader, EmptyState } from '../dashboard/dashboardUi';

const Change = ({ c }) => {
  if (c.before === 0) return <span className="text-[11px] font-semibold text-on-surface-variant">new</span>;
  if (c.now === 0) return <span className="text-[11px] font-semibold text-tertiary">none this month</span>;
  const up = c.diff > 0;
  const pct = Math.round(Math.abs(c.change));
  if (pct === 0) return <span className="text-[11px] text-outline">same</span>;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums ${up ? 'text-error' : 'text-tertiary'}`}>
      <span className="material-symbols-outlined text-[14px]" aria-hidden="true">{up ? 'arrow_upward' : 'arrow_downward'}</span>
      {pct}%<span className="sr-only">{up ? ' more' : ' less'} than last month</span>
    </span>
  );
};

// Each category this month against last month. Bars share one scale so sizes compare.
const CategoryShifts = ({ shifts, prevLabel, className = '' }) => {
  const max = Math.max(1, ...shifts.map(s => Math.max(s.now, s.before)));
  const mover = [...shifts].filter(s => s.before > 0 && s.now > 0).sort((a, b) => b.diff - a.diff)[0];

  return (
    <section className={`${panelClass} ${className}`} aria-labelledby="shifts-title">
      <SectionHeader
        title={<span id="shifts-title">What changed</span>}
        caption={mover && mover.diff > 0
          ? `${mover.name} is up ${formatCurrency(mover.diff)} on ${prevLabel}`
          : `By category, compared with ${prevLabel}`}
      />
      {shifts.length === 0 ? (
        <EmptyState icon="category" title="No expenses in these two months" hint="Category changes appear once you add expenses." />
      ) : (
        <ul className="flex flex-col divide-y divide-outline/10">
          {shifts.slice(0, 8).map(c => (
            <li key={c.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-baseline gap-3">
                <span className="w-2 h-2 rounded-full shrink-0 translate-y-[-1px]" style={{ backgroundColor: c.color }} aria-hidden="true" />
                <span className="flex-1 min-w-0 truncate text-sm text-on-surface">{c.name}</span>
                <Change c={c} />
                <span className="w-24 text-right font-headline font-bold text-sm tabular-nums text-on-surface">{formatCurrency(c.now)}</span>
              </div>
              <div className="mt-2 ml-5 flex flex-col gap-1" aria-hidden="true">
                <span className="h-1.5 rounded-full" style={{ width: `${(c.now / max) * 100}%`, backgroundColor: c.color, minWidth: c.now ? 4 : 0 }} />
                <span className="h-px bg-outline/50" style={{ width: `${(c.before / max) * 100}%` }} />
              </div>
              <p className="sr-only">{prevLabel}: {formatCurrency(c.before)}</p>
            </li>
          ))}
        </ul>
      )}
      {shifts.length > 0 && (
        <p className="mt-4 flex items-center gap-4 text-[11px] text-outline">
          <span className="flex items-center gap-1.5"><span className="w-4 h-1.5 rounded-full bg-on-surface-variant" aria-hidden="true" />This month</span>
          <span className="flex items-center gap-1.5"><span className="w-4 h-px bg-outline" aria-hidden="true" />{prevLabel}</span>
        </p>
      )}
    </section>
  );
};

export default CategoryShifts;
