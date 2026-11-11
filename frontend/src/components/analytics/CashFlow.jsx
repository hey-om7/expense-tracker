import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { formatRupees as formatCurrency } from '../../utils/currency';
import { panelClass, SectionHeader } from '../dashboard/dashboardUi';
import { chartTooltip, axisTick, compactRupees } from './chartTheme';

// Month name with the share of income kept underneath, so the two always line up.
const FlowTick = ({ x, y, payload, flow }) => {
  const f = flow.find(r => r.key === payload.value);
  if (!f) return null;
  const color = f.rate == null ? '#9a8f80' : f.rate < 0 ? '#ffb4ab' : '#f1dfd3';
  return (
    <g transform={`translate(${x},${y})`}>
      <text dy={12} textAnchor="middle" fill="#9a8f80" fontSize={11}>{f.name}</text>
      <text dy={29} textAnchor="middle" fill={color} fontSize={12} fontWeight={600}>{f.rate == null ? '—' : `${f.rate}%`}</text>
    </g>
  );
};

// Six months of income against spending, with what share of income was kept.
const CashFlow = ({ flow, className = '' }) => {
  const rated = flow.filter(f => f.rate != null);
  const avgRate = rated.length ? Math.round(rated.reduce((s, f) => s + f.rate, 0) / rated.length) : null;
  const hasData = flow.some(f => f.Income > 0 || f.Expense > 0);

  return (
    <section className={`${panelClass} ${className}`} aria-labelledby="flow-title">
      <SectionHeader
        title={<span id="flow-title">Money in, money out</span>}
        caption={avgRate != null ? `You kept ${avgRate}% of income on average over these months` : 'Last six months'}
        action={(
          <span className="flex gap-4 text-[11px] text-on-surface-variant shrink-0">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[2px] bg-tertiary" aria-hidden="true" />In</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[2px] bg-primary-container" aria-hidden="true" />Out</span>
          </span>
        )}
      />
      {!hasData ? (
        <p className="py-10 text-sm text-on-surface-variant">Add income and expenses to see how they compare month to month.</p>
      ) : (
        <>
          <div className="h-56 md:h-64 -ml-2" role="img" aria-label="Income and spending for the last six months">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={flow} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barGap={3} barCategoryGap="28%">
                <CartesianGrid stroke="#4e4539" strokeOpacity={0.5} vertical={false} />
                <XAxis dataKey="key" tick={<FlowTick flow={flow} />} axisLine={false} tickLine={false} height={42} interval={0} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={compactRupees} width={44} />
                <Tooltip {...chartTooltip} cursor={chartTooltip.cursor} formatter={(v, n) => [formatCurrency(v), n === 'Income' ? 'In' : 'Out']} labelFormatter={(k) => flow.find(r => r.key === k)?.name || k} />
                <Bar dataKey="Income" fill="#95CD41" radius={[3, 3, 0, 0]} maxBarSize={28} />
                <Bar dataKey="Expense" fill="#e5ba73" radius={[3, 3, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-[11px] text-outline">Percentage under each month: share of income kept.</p>
        </>
      )}
    </section>
  );
};

export default CashFlow;
