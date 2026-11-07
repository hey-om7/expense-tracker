import React from 'react';
import { formatCurrency } from '../../utils/currency';
import { panelClass, SectionHeader, SectionLink } from './dashboardUi';

const Change = ({ label, value }) => {
  const up = value >= 0;
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-on-surface-variant">{label}</dt>
      <dd className={`mt-0.5 flex items-center gap-0.5 font-headline font-bold text-sm tabular-nums truncate ${up ? 'text-[#95CD41]' : 'text-error'}`}>
        <span className="material-symbols-outlined text-base" aria-hidden="true">{up ? 'arrow_upward' : 'arrow_downward'}</span>
        {up ? '+' : ''}{formatCurrency(value)}
      </dd>
    </div>
  );
};

const PortfolioSnapshot = ({ value, unrealized, realized, className = '' }) => (
  <section className={`${panelClass} ${className}`}>
    <SectionHeader title="Portfolio" action={<SectionLink to="/investments">Holdings</SectionLink>} />
    <p className="font-manrope font-extrabold text-[clamp(1.75rem,8vw,2.25rem)] tracking-tight text-primary leading-none break-words">{formatCurrency(value)}</p>
    <dl className="mt-5 grid grid-cols-2 gap-4 pt-4 border-t border-outline/10">
      <Change label="Unrealized P/L" value={unrealized} />
      <Change label="Realized" value={realized} />
    </dl>
  </section>
);

export default PortfolioSnapshot;
