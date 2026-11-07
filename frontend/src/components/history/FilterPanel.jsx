import React from 'react';
import { PERIOD_OPTIONS, SORT_OPTIONS } from './filters';

export const Chip = ({ active, onClick, children, color }) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    className={`inline-flex items-center gap-2 min-h-[36px] px-3.5 rounded-full text-[13px] font-medium border transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary
      ${active ? 'bg-primary/15 border-primary/50 text-primary' : 'border-outline/20 text-on-surface-variant hover:border-outline/40 hover:text-on-surface'}`}
  >
    {color && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} aria-hidden="true" />}
    {children}
  </button>
);

// Single-choice list used inside desktop popovers (period, sort).
const OptionList = ({ options, value, onSelect }) => (
  <ul role="listbox" className="py-1">
    {options.map(o => {
      const active = o.value === value;
      return (
        <li key={o.value}>
          <button
            type="button"
            role="option"
            aria-selected={active}
            onClick={() => onSelect(o.value)}
            className={`w-full flex items-center justify-between gap-6 px-3 py-2.5 rounded-lg text-sm text-left transition-colors focus:outline-none focus-visible:bg-surface-container-highest
              ${active ? 'text-primary' : 'text-on-surface hover:bg-surface-container-highest/70'}`}
          >
            {o.label}
            {active && <span className="material-symbols-outlined text-[18px]" aria-hidden="true">check</span>}
          </button>
        </li>
      );
    })}
  </ul>
);

const dateInput = 'w-full min-w-0 bg-surface-container-lowest border border-outline/20 rounded-lg py-2 px-3 text-sm text-on-surface focus:outline-none focus:border-primary [color-scheme:dark]';

const CustomRange = ({ filters, onChange }) => (
  <div className="grid grid-cols-2 gap-2">
    <label className="min-w-0">
      <span className="block text-[11px] text-on-surface-variant mb-1">From</span>
      <input type="date" value={filters.from} max={filters.to || undefined} onChange={e => onChange({ from: e.target.value })} className={dateInput} />
    </label>
    <label className="min-w-0">
      <span className="block text-[11px] text-on-surface-variant mb-1">To</span>
      <input type="date" value={filters.to} min={filters.from || undefined} onChange={e => onChange({ to: e.target.value })} className={dateInput} />
    </label>
  </div>
);

export const PeriodMenu = ({ filters, onChange, onDone }) => (
  <div className="w-64">
    <OptionList options={PERIOD_OPTIONS} value={filters.period} onSelect={(period) => { onChange({ period }); if (period !== 'custom') onDone?.(); }} />
    {filters.period === 'custom' && <div className="px-3 pt-2 pb-3 border-t border-outline/10"><CustomRange filters={filters} onChange={onChange} /></div>}
  </div>
);

export const SortMenu = ({ filters, onChange, onDone }) => (
  <div className="w-52">
    <OptionList options={SORT_OPTIONS} value={filters.sort} onSelect={(sort) => { onChange({ sort }); onDone?.(); }} />
  </div>
);

export const CategoryMenu = ({ filters, onChange, categories }) => {
  const toggle = (id) => onChange({
    categoryIds: filters.categoryIds.includes(id) ? filters.categoryIds.filter(x => x !== id) : [...filters.categoryIds, id],
  });
  if (categories.length === 0) return <p className="w-56 px-3 py-3 text-sm text-on-surface-variant">No categories yet.</p>;
  return (
    <div className="w-64">
      <ul className="py-1 max-h-72 overflow-y-auto no-scrollbar">
        {categories.map(c => {
          const on = filters.categoryIds.includes(c.id);
          return (
            <li key={c.id}>
              <button type="button" role="menuitemcheckbox" aria-checked={on} onClick={() => toggle(c.id)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left text-on-surface hover:bg-surface-container-highest/70 transition-colors focus:outline-none focus-visible:bg-surface-container-highest">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} aria-hidden="true" />
                <span className="flex-1 truncate">{c.name}</span>
                <span className={`w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center transition-colors ${on ? 'bg-primary border-primary text-on-primary' : 'border-outline/40'}`} aria-hidden="true">
                  {on && <span className="material-symbols-outlined text-[14px]">check</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {filters.categoryIds.length > 0 && (
        <div className="px-3 py-2 border-t border-outline/10">
          <button type="button" onClick={() => onChange({ categoryIds: [] })} className="text-xs font-semibold text-primary hover:underline underline-offset-2">Clear selection</button>
        </div>
      )}
    </div>
  );
};

const Group = ({ title, children }) => (
  <fieldset className="py-5 first:pt-0 last:pb-0 border-b border-outline/10 last:border-0">
    <legend className="mb-3 text-[11px] uppercase tracking-[0.18em] font-semibold text-on-surface-variant">{title}</legend>
    {children}
  </fieldset>
);

// Full filter set for the mobile/tablet bottom sheet.
const FilterPanel = ({ filters, onChange, categories }) => {
  const toggleCategory = (id) => onChange({
    categoryIds: filters.categoryIds.includes(id) ? filters.categoryIds.filter(x => x !== id) : [...filters.categoryIds, id],
  });
  return (
    <div>
      <Group title="Period">
        <div className="flex flex-wrap gap-2">
          {PERIOD_OPTIONS.map(p => <Chip key={p.value} active={filters.period === p.value} onClick={() => onChange({ period: p.value })}>{p.label}</Chip>)}
        </div>
        {filters.period === 'custom' && <div className="mt-3"><CustomRange filters={filters} onChange={onChange} /></div>}
      </Group>
      <Group title="Categories">
        {categories.length === 0 ? <p className="text-sm text-on-surface-variant">No categories yet.</p> : (
          <div className="flex flex-wrap gap-2">
            {categories.map(c => <Chip key={c.id} color={c.color} active={filters.categoryIds.includes(c.id)} onClick={() => toggleCategory(c.id)}>{c.name}</Chip>)}
          </div>
        )}
      </Group>
      <Group title="Sort by">
        <div className="flex flex-wrap gap-2">
          {SORT_OPTIONS.map(s => <Chip key={s.value} active={filters.sort === s.value} onClick={() => onChange({ sort: s.value })}>{s.label}</Chip>)}
        </div>
      </Group>
    </div>
  );
};

export default FilterPanel;
