import React from 'react';
import { TYPE_OPTIONS } from './filters';

// Text tabs with an underline for the active type. Kept outside the filter menus
// because it's the most-used filter.
const TypeTabs = ({ value, onChange, counts }) => (
  <div role="tablist" aria-label="Transaction type" className="flex gap-5 sm:gap-6 overflow-x-auto no-scrollbar">
    {TYPE_OPTIONS.map(opt => {
      const active = value === opt.value;
      return (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={active}
          onClick={() => onChange(opt.value)}
          className={`relative shrink-0 inline-flex items-baseline gap-1.5 h-11 text-sm whitespace-nowrap transition-colors duration-150 focus:outline-none focus-visible:text-on-surface
            after:absolute after:left-0 after:right-0 after:-bottom-px after:h-0.5 after:rounded-full after:transition-colors
            ${active ? 'text-on-surface font-semibold after:bg-primary' : 'text-on-surface-variant hover:text-on-surface after:bg-transparent'}`}
        >
          <span className="self-center">{opt.label}</span>
          {counts && <span className="self-center text-[11px] tabular-nums text-on-surface-variant/60">{counts[opt.value]}</span>}
        </button>
      );
    })}
  </div>
);

export default TypeTabs;
