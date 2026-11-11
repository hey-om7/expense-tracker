import React, { useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { buildAnalytics, monthLabel, shiftMonth } from '../components/analytics/analyticsData';
import MonthPace from '../components/analytics/MonthPace';
import SpendingRhythm from '../components/analytics/SpendingRhythm';
import CategoryShifts from '../components/analytics/CategoryShifts';
import CashFlow from '../components/analytics/CashFlow';
import FrequentPayees from '../components/analytics/FrequentPayees';
import Commitments from '../components/analytics/Commitments';

const MonthNav = ({ value, onChange, canGoNext }) => {
  const btn = 'w-10 h-10 inline-flex items-center justify-center rounded-full border border-outline/20 text-on-surface-variant hover:text-on-surface hover:border-outline/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed';
  return (
    <div className="flex items-center gap-2">
      <button type="button" className={btn} onClick={() => onChange(shiftMonth(value, -1))} aria-label="Previous month">
        <span className="material-symbols-outlined text-xl" aria-hidden="true">chevron_left</span>
      </button>
      <button type="button" className={btn} onClick={() => onChange(shiftMonth(value, 1))} disabled={!canGoNext} aria-label="Next month">
        <span className="material-symbols-outlined text-xl" aria-hidden="true">chevron_right</span>
      </button>
    </div>
  );
};

/**
 * Analytics: questions people ask day to day, for one month at a time.
 *  - Am I spending faster than last month? (pace)
 *  - Which days and weekdays cost me most? (rhythm)
 *  - What went up or down? (categories vs last month)
 *  - Am I keeping any of my income? (6-month cash flow)
 *  - Where does the money actually go? (payees)
 *  - What is already spoken for every month? (subscriptions)
 */
const AnalyticsScreen = () => {
  const { transactions, categories, subscriptions } = useAppContext();
  const now = new Date();
  const [month, setMonth] = useState({ y: now.getFullYear(), m: now.getMonth() });

  const data = useMemo(
    () => buildAnalytics({ transactions, categories, subscriptions, y: month.y, m: month.m }),
    [transactions, categories, subscriptions, month],
  );

  const monthName = monthLabel(month.y, month.m, { month: 'short' });
  const prev = shiftMonth(month, -1);
  const prevLabel = monthLabel(prev.y, prev.m, { month: 'long' });
  const canGoNext = !data.period.isCurrent && !data.period.isFuture;
  const { period } = data;

  return (
    <main className="pt-24 pb-32 px-4 sm:px-6 max-w-6xl w-full mx-auto min-h-screen max-md:pb-28">
      <header className="mb-8 md:mb-10 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">Analytics</p>
          <h1 className="mt-2 font-headline font-extrabold tracking-tight text-on-surface leading-none text-[clamp(2rem,5vw,3.25rem)]">
            {monthLabel(month.y, month.m, { month: 'long' })}
            <span className="text-outline font-bold"> {month.y}</span>
          </h1>
          <p className="mt-2 text-xs text-on-surface-variant">
            {period.isCurrent
              ? `Day ${period.elapsed} of ${period.totalDays} · ${period.daysLeft} day${period.daysLeft === 1 ? '' : 's'} left`
              : `${data.pace.count} expense${data.pace.count === 1 ? '' : 's'}`}
          </p>
        </div>
        <MonthNav value={month} onChange={setMonth} canGoNext={canGoNext} />
      </header>

      <div className="flex flex-col gap-10 md:gap-6">
        <MonthPace pace={data.pace} period={period} prevLabel={prevLabel} />

        <div className="flex flex-col gap-10 md:grid md:grid-cols-12 md:gap-6 md:items-start">
          <CategoryShifts className="md:col-span-7" shifts={data.categoryShifts} prevLabel={prevLabel} />
          <SpendingRhythm
            className="md:col-span-5"
            calendar={data.calendar}
            period={period}
            weekdays={data.weekdays}
            weekdayHasData={data.weekdayHasData}
            monthName={monthName}
          />
        </div>

        <CashFlow flow={data.flow} />

        <div className="flex flex-col gap-10 md:grid md:grid-cols-12 md:gap-6 md:items-start">
          <FrequentPayees className="md:col-span-7" payees={data.payees} biggest={data.biggest} monthName={monthName} />
          <Commitments className="md:col-span-5" commitments={data.commitments} committed={data.committed} committedShare={data.committedShare} />
        </div>
      </div>
    </main>
  );
};

export default AnalyticsScreen;
