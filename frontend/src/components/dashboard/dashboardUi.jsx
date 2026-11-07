import React from 'react';
import { Link } from 'react-router-dom';

// Shared pieces for the dashboard sections. Mobile sections sit directly on the page
// background (no boxes); from md up they become panels in the two-column grid.
export const panelClass = 'md:bg-surface-container-low md:border md:border-outline/10 md:rounded-2xl md:p-7';

export const SectionHeader = ({ title, caption, action }) => (
  <div className="flex items-end justify-between gap-4 mb-4">
    <div className="min-w-0">
      <h3 className="font-manrope font-bold text-[15px] md:text-lg text-on-surface tracking-tight">{title}</h3>
      {caption && <p className="text-xs text-on-surface-variant mt-0.5">{caption}</p>}
    </div>
    {action}
  </div>
);

export const SectionLink = ({ to, children }) => (
  <Link
    to={to}
    className="group shrink-0 inline-flex items-center gap-0.5 text-xs font-semibold text-primary min-h-[44px] -my-3 px-1 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
  >
    {children}
    <span className="material-symbols-outlined text-base transition-transform duration-200 group-hover:translate-x-0.5">chevron_right</span>
  </Link>
);

export const EmptyState = ({ icon, title, hint }) => (
  <div className="flex items-center gap-3 py-5 text-left">
    <span className="w-10 h-10 shrink-0 rounded-full bg-surface-container-highest/60 flex items-center justify-center text-on-surface-variant">
      <span className="material-symbols-outlined text-xl">{icon}</span>
    </span>
    <div>
      <p className="text-sm font-semibold text-on-surface">{title}</p>
      {hint && <p className="text-xs text-on-surface-variant mt-0.5">{hint}</p>}
    </div>
  </div>
);

const DAY_MS = 86400000;
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

// "Today", "Yesterday", or "7 Nov"
export const relativeDay = (date) => {
  const diff = Math.round((startOfDay(new Date()) - startOfDay(date)) / DAY_MS);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

export const daysUntil = (date) => Math.ceil((startOfDay(date) - startOfDay(new Date())) / DAY_MS);
