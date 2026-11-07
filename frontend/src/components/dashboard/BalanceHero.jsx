import React from 'react';
import { formatCurrency } from '../../utils/currency';

// Splits "₹1,23,456.78" into "₹1,23,456" and ".78" so the paise can be set smaller.
const splitAmount = (text) => {
  const i = text.lastIndexOf('.');
  return i > 0 && text.length - i <= 3 ? [text.slice(0, i), text.slice(i)] : [text, ''];
};

const BalanceHero = ({ balance, monthIncome, monthSpent, onQuickAdd, onAdd }) => {
  const balanceText = formatCurrency(balance);
  const [whole, fraction] = splitAmount(balanceText);
  // Shrink the display size for long amounts so it never wraps on a 320px screen.
  const sizeClass = whole.length > 12
    ? 'text-[clamp(2rem,9vw,4rem)]'
    : whole.length > 9
      ? 'text-[clamp(2.4rem,11vw,4.75rem)]'
      : 'text-[clamp(2.75rem,13vw,5.5rem)]';

  const flowTotal = monthIncome + monthSpent;
  const inShare = flowTotal > 0 ? (monthIncome / flowTotal) * 100 : 50;
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  const monthName = new Date().toLocaleDateString('en-IN', { month: 'long' });

  return (
    <section className="relative pb-7 md:pb-10 mb-7 md:mb-10 border-b border-outline/10">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-7 lg:gap-12">
        <div className="min-w-0" data-onboarding="dashboard-balance">
          <p className="text-xs text-on-surface-variant">{today}</p>
          <p className="mt-5 md:mt-6 text-[11px] uppercase tracking-[0.22em] font-semibold text-primary/80">Available liquidity</p>
          <h2 className={`mt-1 font-manrope font-extrabold text-on-surface tracking-[-0.045em] leading-[0.95] whitespace-nowrap ${sizeClass}`}>
            {whole}
            {fraction && <span className="text-on-surface-variant/60 text-[0.45em] tracking-tight align-baseline">{fraction}</span>}
          </h2>

          {/* This month's money in vs out */}
          <div className="mt-6 max-w-md">
            <div className="flex justify-between gap-4 text-xs">
              <span className="text-on-surface-variant">
                In <span className="ml-1 font-headline font-bold text-[#95CD41]">{formatCurrency(monthIncome)}</span>
              </span>
              <span className="text-on-surface-variant text-right">
                Out <span className="ml-1 font-headline font-bold text-error">{formatCurrency(monthSpent)}</span>
              </span>
            </div>
            <div className="mt-2 flex h-1.5 gap-1" role="img" aria-label={`${monthName}: ${formatCurrency(monthIncome)} in, ${formatCurrency(monthSpent)} out`}>
              <span className="h-full rounded-full bg-[#95CD41]/80 transition-[width] duration-700 ease-out" style={{ width: `${inShare}%` }} />
              <span className="h-full flex-1 rounded-full bg-error/70" />
            </div>
            <p className="mt-1.5 text-[10px] uppercase tracking-wider text-on-surface-variant/70">{monthName} so far</p>
          </div>
        </div>

        <div className="flex gap-2.5 lg:shrink-0" data-onboarding="dashboard-actions">
          <button
            type="button"
            onClick={onQuickAdd}
            className="group flex-1 lg:flex-none inline-flex items-center justify-center gap-2.5 min-h-[56px] pl-4 pr-6 rounded-full bg-primary-container text-on-primary font-manrope font-bold text-[15px] shadow-lg shadow-black/20 transition-[filter,transform] duration-150 hover:brightness-110 active:translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1A120B] focus-visible:ring-primary"
          >
            <span className="w-9 h-9 rounded-full bg-on-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>mic</span>
            </span>
            <span className="text-left leading-tight">
              Quick Add
              <span className="block text-[11px] font-medium opacity-70">Speak or type it</span>
            </span>
          </button>
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex flex-col lg:flex-row items-center justify-center gap-0.5 lg:gap-2 min-h-[56px] min-w-[76px] px-4 lg:px-6 rounded-full border border-primary/30 text-primary font-manrope font-bold text-xs lg:text-[15px] transition-colors duration-150 hover:bg-primary/10 active:translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="material-symbols-outlined text-[22px]">add</span>
            Add
          </button>
        </div>
      </div>
    </section>
  );
};

export default BalanceHero;
