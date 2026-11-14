import React from 'react';
import { Link } from 'react-router-dom';

// "← Settings" link at the top of every settings subpage.
export const BackLink = ({ to = '/settings', children = 'Settings' }) => (
  <Link to={to} className="group inline-flex items-center gap-1 text-xs font-semibold text-on-surface-variant hover:text-on-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm">
    <span className="material-symbols-outlined text-sm transition-transform group-hover:-translate-x-0.5 motion-reduce:transition-none" aria-hidden="true">arrow_back</span>
    {children}
  </Link>
);

export const PageHeader = ({ title, children, aside }) => (
  <header className="mt-5 mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
    <div className="max-w-2xl">
      <h1 className="font-headline font-extrabold text-on-surface tracking-tight leading-[1.02] text-[clamp(2rem,4.2vw,3rem)]">{title}</h1>
      {children && <p className="mt-4 text-sm text-on-surface-variant leading-relaxed max-w-xl">{children}</p>}
    </div>
    {aside}
  </header>
);

// A labelled group of rows on the /settings hub.
export const SettingsGroup = ({ id, title, children }) => (
  <section aria-labelledby={id}>
    <h2 id={id} className="px-1 mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">{title}</h2>
    <ul className="bg-surface-container-low border border-outline/10 rounded-2xl divide-y divide-outline/10 overflow-hidden">
      {children}
    </ul>
  </section>
);

const RowText = ({ icon, title, subtitle, subtitleTone }) => (
  <>
    <span className="w-10 h-10 shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
      <span className="material-symbols-outlined text-[22px]" aria-hidden="true">{icon}</span>
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-bold text-on-surface">{title}</span>
      <span className={`block text-xs mt-0.5 leading-relaxed ${subtitleTone || 'text-on-surface-variant'}`}>{subtitle}</span>
    </span>
  </>
);

/**
 * Row that opens a subpage. `control` (e.g. a switch) sits outside the link so
 * using it never navigates.
 */
export const NavRow = ({ to, icon, title, subtitle, subtitleTone, badge, control, onboarding }) => (
  <li className="relative flex items-center gap-3 pr-4 hover:bg-on-surface/[0.03] transition-colors" data-onboarding={onboarding}>
    <Link to={to} className="group flex-1 min-w-0 flex items-center gap-4 pl-4 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary rounded-sm">
      <RowText icon={icon} title={title} subtitle={subtitle} subtitleTone={subtitleTone} />
      {badge > 0 && (
        <span className="shrink-0 min-w-[1.5rem] h-6 px-2 rounded-full bg-primary text-on-primary text-[11px] font-bold tabular-nums flex items-center justify-center" aria-label={`${badge} need attention`}>
          {badge}
        </span>
      )}
      {!control && <span className="material-symbols-outlined text-xl text-on-surface-variant transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true">chevron_right</span>}
    </Link>
    {control && (
      <>
        {control}
        <Link to={to} tabIndex={-1} aria-hidden="true" className="material-symbols-outlined text-xl text-on-surface-variant">chevron_right</Link>
      </>
    )}
  </li>
);

// Row with its own inline actions and no subpage.
export const InlineRow = ({ icon, title, subtitle, children, onboarding }) => (
  <li className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-4 py-4" data-onboarding={onboarding}>
    <span className="flex items-center gap-4 min-w-0 flex-1">
      <RowText icon={icon} title={title} subtitle={subtitle} />
    </span>
    <span className="flex flex-wrap gap-2 sm:shrink-0 pl-14 sm:pl-0">{children}</span>
  </li>
);

export const secondaryBtn = 'inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3.5 rounded-xl text-xs font-bold border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:cursor-not-allowed';

export const Card = ({ id, icon, title, children, className = '' }) => (
  <section aria-labelledby={id} className={`bg-surface-container-low border border-outline/10 rounded-2xl p-4 sm:p-6 ${className}`}>
    <div className="flex items-center gap-3 mb-5">
      <span className="material-symbols-outlined text-primary text-2xl" aria-hidden="true">{icon}</span>
      <h2 id={id} className="font-headline font-bold text-lg text-on-surface">{title}</h2>
    </div>
    {children}
  </section>
);
