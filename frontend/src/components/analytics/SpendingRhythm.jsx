import React, { useState } from 'react';
import { formatRupees as formatCurrency } from '../../utils/currency';
import { panelClass, SectionHeader } from '../dashboard/dashboardUi';
import { WEEKDAYS } from './analyticsData';

// Five intensity steps so heavy days stand out without a legend full of numbers.
const level = (amount, max) => (amount <= 0 || max <= 0 ? 0 : Math.min(4, Math.ceil((amount / max) * 4)));
const LEVEL_BG = ['transparent', 'rgba(255,215,150,0.14)', 'rgba(255,215,150,0.3)', 'rgba(255,215,150,0.52)', 'rgba(255,215,150,0.85)'];

// When money goes out: a day-by-day calendar for the month and the usual weekday pattern.
const SpendingRhythm = ({ calendar, period, weekdays, weekdayHasData, monthName, className = '' }) => {
  const [picked, setPicked] = useState(null);
  const { days, noSpendDays, maxDay } = calendar;
  const shown = picked ?? [...days].filter(d => !d.future).sort((a, b) => b.amount - a.amount)[0] ?? null;
  const maxWeekday = Math.max(0, ...weekdays.map(w => w.avg));
  const topWeekday = weekdayHasData ? weekdays.reduce((a, b) => (b.avg > a.avg ? b : a)) : null;

  return (
    <section className={`${panelClass} ${className}`} aria-labelledby="rhythm-title">
      <SectionHeader
        title={<span id="rhythm-title">When you spend</span>}
        caption={period.elapsed > 0 ? `${noSpendDays} no-spend day${noSpendDays === 1 ? '' : 's'} so far` : 'This month hasn’t started yet'}
      />

      <div className="grid grid-cols-7 gap-1 text-center" role="group" aria-label={`Daily spending in ${monthName}`}>
        {WEEKDAYS.map(w => <span key={w} className="text-[10px] font-semibold text-outline pb-1" aria-hidden="true">{w[0]}</span>)}
        {Array.from({ length: period.firstWeekday }, (_, i) => <span key={`pad-${i}`} aria-hidden="true" />)}
        {days.map((d) => {
          const lv = level(d.amount, maxDay);
          const active = shown?.day === d.day;
          return (
            <button
              key={d.day}
              type="button"
              disabled={d.future}
              onClick={() => setPicked(d)}
              aria-label={`${d.day} ${monthName}: ${d.amount ? formatCurrency(d.amount) : 'no spending'}`}
              aria-pressed={active}
              className={`aspect-square rounded-[4px] text-[11px] tabular-nums flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
                ${d.future ? 'text-outline/40 cursor-default' : lv >= 3 ? 'text-on-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'}
                ${active ? 'ring-1 ring-on-surface/70' : ''} ${d.today ? 'underline underline-offset-2' : ''}`}
              style={{ backgroundColor: d.future ? 'transparent' : LEVEL_BG[lv], boxShadow: !d.future && lv === 0 ? 'inset 0 0 0 1px rgba(154,143,128,0.18)' : undefined }}
            >
              {d.day}
            </button>
          );
        })}
      </div>

      <p className="mt-3 min-h-[1.25rem] text-xs text-on-surface-variant" aria-live="polite">
        {shown && (
          <>
            <span className="text-on-surface font-semibold">{shown.day} {monthName}</span>
            {' · '}{shown.amount ? formatCurrency(shown.amount) : 'no spending'}
            {!picked && shown.amount > 0 && <span className="text-outline"> · highest day</span>}
          </>
        )}
      </p>

      <div className="mt-6 pt-5 border-t border-outline/10">
        <p className="text-xs text-on-surface-variant mb-3">
          {topWeekday
            ? <>Average by weekday, last 8 weeks. <span className="text-on-surface font-semibold">{topWeekday.name}</span> costs you most.</>
            : 'Weekday pattern appears after a few weeks of expenses.'}
        </p>
        <ul className="grid grid-cols-7 gap-1.5 items-end h-24" aria-label="Average spending by weekday">
          {weekdays.map((w) => {
            const h = maxWeekday > 0 ? Math.max(4, (w.avg / maxWeekday) * 100) : 4;
            const top = topWeekday?.name === w.name;
            return (
              <li key={w.name} className="flex flex-col items-center justify-end h-full gap-1.5" title={`${w.name}: ${formatCurrency(Math.round(w.avg))} on average`}>
                <span className={`w-full rounded-t-[3px] ${top ? 'bg-primary' : 'bg-on-surface/15'}`} style={{ height: `${h}%` }} aria-hidden="true" />
                <span className={`text-[10px] ${top ? 'text-primary font-bold' : 'text-outline'}`}>{w.name}</span>
                <span className="sr-only">{formatCurrency(Math.round(w.avg))} on average</span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
};

export default SpendingRhythm;
