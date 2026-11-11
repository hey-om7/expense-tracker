import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { formatRupees as formatCurrency } from '../../utils/currency';
import { panelClass } from '../dashboard/dashboardUi';
import { chartTooltip, axisTick, compactRupees } from './chartTheme';

const Stat = ({ label, value, note }) => (
  <div className="min-w-0">
    <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">{label}</dt>
    <dd className="mt-1 font-headline font-bold text-lg md:text-xl tabular-nums text-on-surface truncate">{value}</dd>
    {note && <dd className="text-[11px] text-outline mt-0.5">{note}</dd>}
  </div>
);

// How this month's spending is tracking against the same days of last month.
const MonthPace = ({ pace, period, prevLabel }) => {
  const { spent, change, prevToSameDay, dailyAvg, projected, prevTotal, income, saved, savingsRate, series } = pace;
  const ahead = change != null && change > 0;
  const diff = Math.abs(spent - prevToSameDay);
  const sameDayText = period.isCurrent ? `by day ${period.elapsed} of ${prevLabel}` : `than ${prevLabel}`;

  return (
    <section className={`${panelClass} md:p-8`} aria-labelledby="pace-title">
      <div className="grid md:grid-cols-12 gap-8 md:gap-10 items-end">
        <div className="md:col-span-5 flex flex-col gap-6">
          <div>
            <h2 id="pace-title" className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">
              {period.isCurrent ? 'Spent so far' : 'Spent'}
            </h2>
            <p className="mt-2 font-headline font-extrabold tracking-tight text-on-surface tabular-nums leading-none text-[clamp(2.4rem,7vw,3.75rem)]">
              {formatCurrency(spent)}
            </p>
            {prevToSameDay > 0 ? (
              <p className={`mt-3 text-sm flex items-start gap-1.5 ${ahead ? 'text-error' : 'text-tertiary'}`}>
                <span className="material-symbols-outlined text-base mt-px" aria-hidden="true">{ahead ? 'trending_up' : 'trending_down'}</span>
                <span>
                  {formatCurrency(diff)} {ahead ? 'more' : 'less'} {sameDayText}
                  <span className="text-on-surface-variant"> ({ahead ? '+' : '−'}{Math.abs(Math.round(change))}%)</span>
                </span>
              </p>
            ) : (
              <p className="mt-3 text-sm text-on-surface-variant">No spending in {prevLabel} to compare with.</p>
            )}
          </div>

          <dl className="grid grid-cols-3 gap-4 border-t border-outline/10 pt-5">
            <Stat label="Per day" value={formatCurrency(Math.round(dailyAvg))} note={`over ${period.elapsed} day${period.elapsed === 1 ? '' : 's'}`} />
            {projected != null
              ? <Stat label="Month end" value={formatCurrency(Math.round(projected))} note="at this pace" />
              : <Stat label={prevLabel} value={formatCurrency(prevTotal)} note="whole month" />}
            {income > 0
              ? <Stat label={saved >= 0 ? 'Saved' : 'Overspent'} value={formatCurrency(Math.abs(saved))} note={`${savingsRate}% of income`} />
              : <Stat label="Income" value="—" note="none recorded" />}
          </dl>
        </div>

        <figure className="md:col-span-7 m-0">
          <div className="h-48 md:h-60 -ml-2" role="img" aria-label={`Cumulative spending by day, this month compared with ${prevLabel}`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#4e4539" strokeOpacity={0.5} vertical={false} />
                <XAxis dataKey="day" tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={compactRupees} width={44} />
                <Tooltip {...chartTooltip} labelFormatter={(d) => `Day ${d}`} formatter={(v, n) => [formatCurrency(v), n === 'current' ? 'This month' : prevLabel]} />
                <Line type="monotone" dataKey="previous" stroke="#9a8f80" strokeWidth={1.5} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="current" stroke="#ffd796" strokeWidth={2.5} dot={false} connectNulls={false} animationDuration={600} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <figcaption className="mt-3 flex gap-5 text-[11px] text-on-surface-variant">
            <span className="flex items-center gap-2"><span className="w-4 h-0.5 bg-primary" aria-hidden="true" />This month</span>
            <span className="flex items-center gap-2"><span className="w-4 border-t border-dashed border-outline" aria-hidden="true" />{prevLabel}</span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
};

export default MonthPace;
