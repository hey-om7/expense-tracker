import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import Modal from '../components/ui/Modal';
import AddTransactionForm from '../components/forms/AddTransactionForm';
import InvestmentTradeForm from '../components/forms/InvestmentTradeForm';
import FeatureTour from '../components/ui/FeatureTour';
import HistorySummary from '../components/history/HistorySummary';
import TypeTabs from '../components/history/TypeTabs';
import FilterPanel, { PeriodMenu, CategoryMenu, SortMenu } from '../components/history/FilterPanel';
import FilterMenuButton from '../components/history/FilterMenuButton';
import TransactionList from '../components/history/TransactionList';
import {
  DEFAULT_FILTERS, PERIOD_OPTIONS, SORT_OPTIONS, applyFilters, summarize, activeChips, isTrade,
} from '../components/history/filters';

const PAGE_SIZE = 50;
const HEADER_PX = 64; // fixed app header height (h-16)

const TransactionsScreen = () => {
  const { transactions, getCategory, categories, investments } = useAppContext();

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editModal, setEditModal] = useState({ isOpen: false, data: null });
  const [tradeModal, setTradeModal] = useState({ isOpen: false, data: null, investment: null });
  const toolbarRef = useRef(null);
  const [stickyTop, setStickyTop] = useState(HEADER_PX);

  const update = (patch) => { setFilters(f => ({ ...f, ...patch })); setVisible(PAGE_SIZE); };
  const resetAll = () => { setFilters(f => ({ ...DEFAULT_FILTERS, search: f.search })); setVisible(PAGE_SIZE); };

  // Day headers stick just below the toolbar, so track its height.
  useEffect(() => {
    const el = toolbarRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setStickyTop(HEADER_PX + el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const filtered = useMemo(() => applyFilters(transactions, filters), [transactions, filters]);
  const totals = useMemo(() => summarize(filtered), [filtered]);

  // Counts shown on the type tabs, computed with every other filter applied.
  const typeCounts = useMemo(() => {
    const base = applyFilters(transactions, { ...filters, type: 'all' });
    return {
      all: base.length,
      expense: base.filter(t => t.type === 'expense').length,
      income: base.filter(t => t.type === 'income').length,
      trade: base.filter(isTrade).length,
    };
  }, [transactions, filters]);

  const chips = activeChips(filters, categories);
  const panelFilterCount = chips.length;
  const scopeLabel = filters.period === 'custom' && chips.find(c => c.key === 'period')
    ? chips.find(c => c.key === 'period').label
    : PERIOD_OPTIONS.find(p => p.value === filters.period)?.label.toLowerCase().replace(/^custom$/, 'all time');

  const periodChip = chips.find(c => c.key === 'period');
  const periodValue = filters.period === 'all' ? 'All time' : periodChip?.label || 'Custom';
  const categoryValue = filters.categoryIds.length === 0 ? 'All'
    : filters.categoryIds.length === 1 ? (categories.find(c => c.id === filters.categoryIds[0])?.name || '1 selected')
    : `${filters.categoryIds.length} selected`;
  const sortValue = SORT_OPTIONS.find(o => o.value === filters.sort)?.label;

  const openTransaction = (t) => {
    if (isTrade(t)) {
      const inv = investments.find(i => i.id === t.investmentId);
      if (inv) setTradeModal({ isOpen: true, data: t, investment: inv });
    } else {
      setEditModal({ isOpen: true, data: t });
    }
  };

  const hasAny = transactions.length > 0;

  return (
    <main
      className="pt-20 md:pt-24 pb-32 md:pb-16 px-4 sm:px-6 max-w-4xl mx-auto w-full min-h-screen"
      style={{ '--history-sticky': `${stickyTop}px` }}
    >
      <HistorySummary count={filtered.length} totals={totals} scopeLabel={scopeLabel} />

      {/* Toolbar: search + type tabs stay pinned under the app header while scrolling */}
      <div
        ref={toolbarRef}
        data-onboarding="history-filters"
        className="sticky top-16 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-2 lg:pt-0 bg-[#1A120B]/95 backdrop-blur-md border-b border-outline/10"
      >
        {/* Mobile / tablet: search + filters button above the tabs */}
        <div className="lg:hidden flex gap-2 pb-1">
          <SearchField value={filters.search} onChange={search => update({ search })} />
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-label={`Filters${panelFilterCount ? `, ${panelFilterCount} active` : ''}`}
            className={`relative shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary
              ${panelFilterCount ? 'text-primary bg-primary/10' : 'text-on-surface-variant bg-surface-container-low hover:text-on-surface'}`}
          >
            <span className="material-symbols-outlined text-[22px]">tune</span>
            {panelFilterCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-on-primary text-[10px] font-bold flex items-center justify-center">{panelFilterCount}</span>
            )}
          </button>
        </div>

        {/* One row: tabs on the left; on desktop the menus and search sit on the right */}
        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <TypeTabs value={filters.type} onChange={type => update({ type })} counts={typeCounts} />
          </div>
          <div className="hidden lg:flex items-center gap-1 shrink-0">
            <FilterMenuButton label="Period" value={periodValue} active={filters.period !== 'all'}>
              {close => <PeriodMenu filters={filters} onChange={update} onDone={close} />}
            </FilterMenuButton>
            <FilterMenuButton label="Category" value={categoryValue} active={filters.categoryIds.length > 0}>
              <CategoryMenu filters={filters} onChange={update} categories={categories} />
            </FilterMenuButton>
            <FilterMenuButton label="Sort" value={sortValue} active={filters.sort !== 'latest'} align="right">
              {close => <SortMenu filters={filters} onChange={update} onDone={close} />}
            </FilterMenuButton>
            {panelFilterCount > 0 && (
              <button type="button" onClick={resetAll} aria-label="Reset filters" title="Reset filters" className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors">
                <span className="material-symbols-outlined text-[18px]">restart_alt</span>
              </button>
            )}
            <div className="w-56 ml-2 py-2"><SearchField compact value={filters.search} onChange={search => update({ search })} /></div>
          </div>
        </div>

        {/* Mobile: active filters as removable chips (desktop shows them in the menu labels) */}
        {chips.length > 0 && (
          <div className="lg:hidden py-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
            {chips.map(c => (
              <button
                key={c.key}
                type="button"
                onClick={() => update(c.clear)}
                aria-label={`Remove filter ${c.label}`}
                className="shrink-0 inline-flex items-center gap-1.5 h-8 pl-3 pr-2 rounded-full bg-surface-container text-xs font-medium text-on-surface hover:bg-surface-container-high transition-colors"
              >
                {c.color && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} aria-hidden="true" />}
                {c.label}
                <span className="material-symbols-outlined text-[15px] text-on-surface-variant" aria-hidden="true">close</span>
              </button>
            ))}
            <button type="button" onClick={resetAll} className="shrink-0 h-8 px-2 text-xs font-semibold text-primary hover:underline underline-offset-2">Clear all</button>
          </div>
        )}
      </div>

      <div className="mt-4 lg:mt-6">
        {/* List */}
        <div className="min-w-0" data-onboarding="history-list">
          {!hasAny ? (
            <EmptyView icon="receipt_long" title="No transactions yet" text="Everything you add from the dashboard or by voice will be listed here." />
          ) : filtered.length === 0 ? (
            <EmptyView
              icon="filter_alt_off"
              title="Nothing matches these filters"
              text="Try a wider period, fewer categories or a different search."
              action={<button type="button" onClick={() => { setFilters(DEFAULT_FILTERS); setVisible(PAGE_SIZE); }} className="mt-5 min-h-[44px] px-5 rounded-full border border-primary/40 text-sm font-semibold text-primary hover:bg-primary/10 transition-colors">Reset filters</button>}
            />
          ) : (
            <>
              <TransactionList items={filtered.slice(0, visible)} sort={filters.sort} getCategory={getCategory} onOpen={openTransaction} />
              {filtered.length > visible && (
                <div className="pt-4 flex flex-col items-center gap-2">
                  <button type="button" onClick={() => setVisible(v => v + PAGE_SIZE)} className="min-h-[44px] px-6 rounded-full bg-surface-container-low border border-outline/15 text-sm font-semibold text-on-surface hover:bg-surface-container transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                    Show more
                  </button>
                  <span className="text-xs text-on-surface-variant tabular-nums">Showing {visible} of {filtered.length}</span>
                </div>
              )}
            </>
          )}
        </div>

      </div>

      {/* Mobile / tablet filters: bottom sheet */}
      <Modal
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Filters"
        footer={(
          <div className="flex gap-2">
            <button type="button" onClick={resetAll} disabled={!panelFilterCount} className="min-h-[48px] px-5 rounded-full text-sm font-semibold text-on-surface-variant hover:text-on-surface disabled:opacity-40 transition-colors">
              Reset
            </button>
            <button type="button" onClick={() => setSheetOpen(false)} className="flex-1 min-h-[48px] rounded-full bg-primary-container text-on-primary font-manrope font-bold text-[15px] hover:brightness-110 active:translate-y-px transition-[filter,transform]">
              Show {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
            </button>
          </div>
        )}
      >
        <FilterPanel filters={filters} onChange={update} categories={categories} />
      </Modal>

      <Modal isOpen={editModal.isOpen} onClose={() => setEditModal({ isOpen: false, data: null })} title="Edit transaction">
        <AddTransactionForm initialData={editModal.data} onClose={() => setEditModal({ isOpen: false, data: null })} />
      </Modal>

      <Modal isOpen={tradeModal.isOpen} onClose={() => setTradeModal({ isOpen: false, data: null, investment: null })} title="Edit trade">
        {tradeModal.data && <InvestmentTradeForm initialTradeData={tradeModal.data} investment={tradeModal.investment} onClose={() => setTradeModal({ isOpen: false, data: null, investment: null })} />}
      </Modal>

      <FeatureTour section="history" />
    </main>
  );
};

const SearchField = ({ value, onChange, compact }) => (
  <label className="relative flex-1 min-w-0 block">
    <span className="sr-only">Search transactions</span>
    <span className={`material-symbols-outlined absolute top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none ${compact ? 'left-3 text-[18px]' : 'left-3.5 text-[20px]'}`} aria-hidden="true">search</span>
    <input
      type="search"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={compact ? 'Search' : 'Search title or notes'}
      className={`w-full rounded-full bg-surface-container-low border border-transparent text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary/50 transition-colors [&::-webkit-search-cancel-button]:hidden
        ${compact ? 'h-9 pl-9 pr-8 text-[13px]' : 'h-11 pl-11 pr-10 text-[15px]'}`}
    />
    {value && (
      <button type="button" onClick={() => onChange('')} aria-label="Clear search" className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface">
        <span className="material-symbols-outlined text-[16px]">close</span>
      </button>
    )}
  </label>
);

const EmptyView = ({ icon, title, text, action }) => (
  <div className="py-16 md:py-24 flex flex-col items-center text-center">
    <span className="w-14 h-14 rounded-full bg-surface-container-low border border-outline/10 flex items-center justify-center text-on-surface-variant">
      <span className="material-symbols-outlined text-[26px]" aria-hidden="true">{icon}</span>
    </span>
    <p className="mt-4 font-manrope font-bold text-lg text-on-surface">{title}</p>
    <p className="mt-1 max-w-xs text-sm text-on-surface-variant">{text}</p>
    {action}
  </div>
);

export default TransactionsScreen;
