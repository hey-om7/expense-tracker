import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { getLastRefresh, setLastRefresh, isStale, timeAgo } from '../utils/investCache';
import { formatCurrency } from '../utils/currency';
import Modal from '../components/ui/Modal';
import AddInvestmentForm from '../components/forms/AddInvestmentForm';
import InvestmentTradeForm from '../components/forms/InvestmentTradeForm';
import InvestmentAnalytics from '../components/ui/InvestmentAnalytics';

import * as api from '../services/api';
import FeatureTour from '../components/ui/FeatureTour';

const DetailRow = ({ label, children, tone }) => (
  <div className="flex items-baseline justify-between gap-4 py-3 border-b border-outline/10 last:border-0">
    <dt className="text-sm text-on-surface-variant">{label}</dt>
    <dd className={`text-sm font-semibold tabular-nums text-right ${tone || 'text-on-surface'}`}>{children}</dd>
  </div>
);

const signed = (v) => `${v >= 0 ? '+' : '−'}${formatCurrency(Math.abs(v))}`;

// Everything about one holding, shown in the mobile bottom sheet.
const HoldingDetail = ({ inv }) => {
  const value = inv.shares * inv.currentPrice;
  const invested = inv.shares * inv.avgCost;
  const pl = value - invested;
  const pct = invested > 0 ? (pl / invested) * 100 : 0;
  const realized = inv.realizedProfit || 0;
  const plTone = (v) => (v >= 0 ? 'text-[#95CD41]' : 'text-error');
  return (
    <div>
      <p className="text-xs text-on-surface-variant">{inv.type}{inv.symbol ? ` · ${inv.symbol}` : ''}</p>
      <p className="mt-1 font-manrope font-extrabold text-[2rem] leading-none tracking-tight text-on-surface">{formatCurrency(value)}</p>
      <p className={`mt-1.5 text-sm font-semibold tabular-nums ${plTone(pl)}`}>
        {signed(pl)} ({pl >= 0 ? '+' : '−'}{Math.abs(pct).toFixed(1)}%) <span className="font-normal text-on-surface-variant">unrealized</span>
      </p>
      <dl className="mt-5">
        <DetailRow label="Units">{inv.shares}</DetailRow>
        <DetailRow label="Average cost">{formatCurrency(inv.avgCost)}</DetailRow>
        <DetailRow label="Current price">{formatCurrency(inv.currentPrice)}</DetailRow>
        <DetailRow label="Invested">{formatCurrency(invested)}</DetailRow>
        <DetailRow label="Realized P/L" tone={plTone(realized)}>{signed(realized)}</DetailRow>
      </dl>
      {inv.comments && (
        <div className="mt-4">
          <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-on-surface-variant">Note</p>
          <p className="mt-1 text-sm text-on-surface whitespace-pre-line break-words">{inv.comments}</p>
        </div>
      )}
    </div>
  );
};

const RefreshStatus = ({ at, refreshing, onRefresh }) => (
  <div className="flex items-center gap-1.5 text-xs text-on-surface-variant" aria-live="polite">
    {refreshing ? (
      <>
        <span className="w-3 h-3 rounded-full border-2 border-primary/30 border-t-primary animate-spin" aria-hidden="true" />
        <span>Updating live prices…</span>
      </>
    ) : (
      <>
        <span className="material-symbols-outlined text-[14px]" aria-hidden="true">schedule</span>
        <span title={at ? new Date(at).toLocaleString('en-IN') : undefined}>Prices updated {timeAgo(at)}</span>
        <button
          type="button"
          onClick={onRefresh}
          className="ml-1 inline-flex items-center gap-0.5 min-h-[32px] px-2 rounded-full font-semibold text-primary hover:bg-primary/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="material-symbols-outlined text-[14px]" aria-hidden="true">refresh</span>
          Refresh
        </button>
      </>
    )}
  </div>
);

const InvestmentsScreen = () => {
  const { investments, updateInvestment } = useAppContext();

  const [profileModal, setProfileModal] = useState({ isOpen: false, data: null });
  const [tradeModal, setTradeModal] = useState({ isOpen: false, data: null });
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');

  const [searchQuery, setSearchQuery] = useState('');
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const detailInv = detailId ? investments.find(i => i.id === detailId) : null;
  const [sortConfig, setSortConfig] = useState({ key: 'value', direction: 'desc' });

  const { user } = useAuth();
  const userId = user?.id || user?._id || user?.email;
  const [lastRefresh, setLastRefreshState] = useState(() => getLastRefresh(userId));
  const [refreshing, setRefreshing] = useState(false);
  const [, setTick] = useState(0);
  const hasCheckedPrices = useRef(false);
  const investmentsRef = useRef(investments);
  investmentsRef.current = investments;

  // Re-render every minute so "Updated N min ago" stays current.
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const refreshPrices = useCallback(async () => {
    const autoUpdateInvestments = investmentsRef.current.filter(inv => (inv.type === 'Mutual Fund' || inv.type === 'Stock') && inv.symbol);
    if (autoUpdateInvestments.length === 0) return;
    setRefreshing(true);
    let succeeded = 0;

    for (const inv of autoUpdateInvestments) {
        try {
          let latestPrice = null;

          if (inv.type === 'Mutual Fund') {
            const response = await fetch(`https://api.mfapi.in/mf/${inv.symbol}/latest`);
            const data = await response.json();
            if (data && data.data && data.data.length > 0) {
              latestPrice = parseFloat(data.data[0].nav);
            }
          } else if (inv.type === 'Stock') {
            try {
              const data = await api.fetchStockQuote(inv.symbol);
              if (data && data.price) {
                latestPrice = parseFloat(data.price);
              }
            } catch (err) {
              console.error(`Failed to fetch stock quote for ${inv.symbol}:`, err);
            }
          }

          if (latestPrice) succeeded += 1;
          if (latestPrice && latestPrice !== inv.currentPrice) {
            await updateInvestment(inv.id, { currentPrice: latestPrice });
          }
        } catch (e) {
          console.error(`Failed to fetch live price for ${inv.name}`, e);
        }
    }

    // Only start the 3-hour window if at least one price actually came back.
    if (succeeded > 0) setLastRefreshState(setLastRefresh(userId));
    setRefreshing(false);
  }, [updateInvestment, userId]);

  // On opening the page: refresh only if the last refresh is older than 3 hours.
  useEffect(() => {
    if (investments.length === 0 || hasCheckedPrices.current) return;
    hasCheckedPrices.current = true;
    if (isStale(getLastRefresh(userId))) refreshPrices();
  }, [investments.length, userId, refreshPrices]);

  const processedInvestments = useMemo(() => {
    let results = investments.filter(inv => activeFilter === 'All' || inv.type === activeFilter);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      results = results.filter(inv =>
        (inv.name && inv.name.toLowerCase().includes(q)) ||
        (inv.symbol && inv.symbol.toLowerCase().includes(q)) ||
        (inv.comments && inv.comments.toLowerCase().includes(q))
      );
    }

    results.sort((a, b) => {
      let valA, valB;
      switch (sortConfig.key) {
        case 'name':
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
          break;
        case 'invested':
          valA = a.shares * a.avgCost;
          valB = b.shares * b.avgCost;
          break;
        case 'pl':
          valA = (a.currentPrice - a.avgCost) * a.shares;
          valB = (b.currentPrice - b.avgCost) * b.shares;
          break;
        case 'value':
        default:
          valA = a.shares * a.currentPrice;
          valB = b.shares * b.currentPrice;
          break;
      }
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return results;
  }, [investments, activeFilter, searchQuery, sortConfig]);

  const visiblePortfolioValue = processedInvestments.reduce((acc, curr) => acc + (curr.shares * curr.currentPrice), 0);
  const visibleRealizedProfit = processedInvestments.reduce((acc, curr) => acc + (curr.realizedProfit || 0), 0);
  const visibleInvested = processedInvestments.reduce((acc, curr) => acc + (curr.shares * curr.avgCost), 0);
  const visibleUnrealizedProfit = processedInvestments.reduce((acc, curr) => acc + ((curr.currentPrice - curr.avgCost) * curr.shares), 0);

  const toggleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  return (
    <main className="pt-20 md:pt-24 pb-32 px-4 sm:px-6 max-w-7xl mx-auto min-h-screen w-full">
      <section className="mb-12 max-md:mb-0">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-12 md:bg-surface-container-low md:rounded-lg md:p-8 relative md:overflow-hidden flex flex-col justify-between md:min-h-[320px]">

            {/* ===== DESKTOP HERO (unchanged) ===== */}
            <div className="hidden md:flex justify-between items-start">
              <div>
                <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-2 block">
                  {activeFilter === 'All' ? 'Total Portfolio Value' : `${activeFilter} Portfolio Value`}
                </span>
                <h2 className="font-headline font-extrabold text-5xl md:text-6xl text-primary tracking-tighter mb-2 transition-all">
                  {formatCurrency(visiblePortfolioValue)}
                </h2>
                <RefreshStatus at={lastRefresh} refreshing={refreshing} onRefresh={refreshPrices} />
                <div className="flex items-center gap-6 mt-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest mb-1">Unrealized P/L</span>
                    <span className={`text-md font-bold font-body ${visibleUnrealizedProfit >= 0 ? 'text-[#95CD41]' : 'text-error'}`}>
                      {visibleUnrealizedProfit >= 0 ? '+' : ''}{formatCurrency(visibleUnrealizedProfit)}
                    </span>
                  </div>
                  <div className="flex flex-col border-l border-outline/20 pl-6">
                    <span className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest mb-1">Realized P/L (Cash)</span>
                    <span className={`text-md font-bold font-body ${visibleRealizedProfit >= 0 ? 'text-[#95CD41]' : 'text-error'}`}>
                      {visibleRealizedProfit >= 0 ? '+' : ''}{formatCurrency(visibleRealizedProfit)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setAnalyticsOpen(true)} className="flex items-center gap-1.5 bg-surface-container-highest text-on-surface-variant border border-outline/20 py-2 px-4 rounded-lg font-manrope font-bold text-sm hover:text-on-surface hover:border-outline/40 transition-all active:scale-95">
                  <span className="material-symbols-outlined text-base">bar_chart</span>
                  Analytics
                </button>
                <button onClick={() => setProfileModal({ isOpen: true, data: null })} className="bg-primary-container text-on-primary py-2 px-4 rounded-lg font-manrope font-bold text-sm shadow-xl shadow-[#E5BA73]/10 hover:brightness-110 transition-all active:scale-95">
                  + New Profile
                </button>
              </div>
            </div>

            {/* ===== MOBILE HERO ===== */}
            <div className="md:hidden pb-6 border-b border-outline/10">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-[0.22em] font-semibold text-primary/80">
                  {activeFilter === 'All' ? 'Portfolio' : activeFilter}
                </span>
                <div className="flex items-center gap-1 -mr-2">
                  <button type="button" onClick={() => setAnalyticsOpen(true)} aria-label="Analytics" className="w-11 h-11 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors">
                    <span className="material-symbols-outlined text-[22px]">bar_chart</span>
                  </button>
                  <button type="button" onClick={() => setProfileModal({ isOpen: true, data: null })} aria-label="Track new investment" className="w-11 h-11 rounded-full flex items-center justify-center bg-primary-container text-on-primary hover:brightness-110 transition-[filter]">
                    <span className="material-symbols-outlined text-[22px]">add</span>
                  </button>
                </div>
              </div>

              {/* Tap the summary for the full breakdown */}
              <button
                type="button"
                onClick={() => setSummaryOpen(true)}
                aria-label="Show portfolio breakdown"
                className="group mt-2 w-full text-left rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="block font-manrope font-extrabold text-[clamp(2.25rem,11vw,3.25rem)] leading-none tracking-[-0.04em] text-on-surface break-words">
                  {formatCurrency(visiblePortfolioValue)}
                </span>
                <span className="mt-2.5 flex items-center justify-between gap-3">
                  <span className={`text-sm font-semibold tabular-nums ${visibleUnrealizedProfit >= 0 ? 'text-[#95CD41]' : 'text-error'}`}>
                    {visibleUnrealizedProfit >= 0 ? '+' : '−'}{formatCurrency(Math.abs(visibleUnrealizedProfit))}
                    {visibleInvested > 0 && <span className="ml-1 opacity-80">({visibleUnrealizedProfit >= 0 ? '+' : '−'}{Math.abs((visibleUnrealizedProfit / visibleInvested) * 100).toFixed(1)}%)</span>}
                  </span>
                  <span className="shrink-0 inline-flex items-center text-xs font-semibold text-primary">
                    Details
                    <span className="material-symbols-outlined text-[18px] transition-transform group-hover:translate-x-0.5" aria-hidden="true">chevron_right</span>
                  </span>
                </span>
              </button>
              <p className="mt-2 flex items-center gap-1 text-xs text-on-surface-variant">
                {refreshing ? (
                  <><span className="w-3 h-3 rounded-full border-2 border-primary/30 border-t-primary animate-spin" aria-hidden="true" /> Updating prices…</>
                ) : (
                  <>Updated {timeAgo(lastRefresh)}
                    <button type="button" onClick={refreshPrices} aria-label="Refresh prices" className="w-8 h-8 -my-2 rounded-full inline-flex items-center justify-center text-primary hover:bg-primary/10 transition-colors">
                      <span className="material-symbols-outlined text-[16px]">refresh</span>
                    </button>
                  </>
                )}
              </p>
            </div>

            {/* ===== HOLDINGS SECTION ===== */}
            <div className="mt-10 max-md:mt-4" data-onboarding="investments-holdings">

              {/* ===== MOBILE: heading, type tabs, sort and search ===== */}
              <div className="md:hidden sticky top-16 z-20 -mx-4 px-4 bg-[#1A120B]/95 backdrop-blur-md border-b border-outline/10 mb-1">
                <div className="flex items-center justify-between gap-2 pt-1">
                  <h3 className="font-manrope font-bold text-base text-on-surface">
                    Holdings <span className="ml-1 text-sm font-normal text-on-surface-variant tabular-nums">{processedInvestments.length}</span>
                  </h3>
                  <div className="flex items-center gap-1 -mr-2">
                    <label className="relative inline-flex items-center h-11 pl-3 pr-1 rounded-full text-[13px] text-on-surface-variant hover:bg-surface-container-low">
                      <span className="sr-only">Sort holdings</span>
                      <span className="material-symbols-outlined text-[18px] mr-1" aria-hidden="true">sort</span>
                      <select
                        value={sortConfig.key}
                        onChange={(e) => setSortConfig({ key: e.target.value, direction: e.target.value === 'name' ? 'asc' : 'desc' })}
                        className="appearance-none bg-transparent pr-2 font-semibold text-on-surface focus:outline-none"
                      >
                        <option value="value">Value</option>
                        <option value="pl">P/L</option>
                        <option value="invested">Invested</option>
                        <option value="name">Name</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() => { setShowMobileSearch(v => !v); if (showMobileSearch) setSearchQuery(''); }}
                      aria-label={showMobileSearch ? 'Close search' : 'Search holdings'}
                      aria-expanded={showMobileSearch}
                      className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${showMobileSearch || searchQuery ? 'text-primary bg-primary/10' : 'text-on-surface-variant hover:bg-surface-container-low'}`}
                    >
                      <span className="material-symbols-outlined text-[22px]">{showMobileSearch ? 'close' : 'search'}</span>
                    </button>
                  </div>
                </div>

                {showMobileSearch && (
                  <div className="relative pb-2 animate-[slideDown_0.15s_ease-out]">
                    <span className="material-symbols-outlined absolute left-3.5 top-[22px] -translate-y-1/2 text-[20px] text-on-surface-variant pointer-events-none" aria-hidden="true">search</span>
                    <input
                      type="search"
                      autoFocus
                      placeholder="Name, symbol or note"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full h-11 pl-11 pr-4 rounded-full bg-surface-container-low border border-transparent text-[15px] text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary/50"
                    />
                  </div>
                )}

                <div role="tablist" aria-label="Investment type" className="flex gap-5 overflow-x-auto no-scrollbar">
                  {[['All', 'All'], ['Stock', 'Stocks'], ['Mutual Fund', 'Mutual funds'], ['Crypto', 'Crypto'], ['FD', 'FDs']].map(([value, label]) => {
                    const active = activeFilter === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setActiveFilter(value)}
                        className={`relative shrink-0 h-11 text-sm whitespace-nowrap transition-colors after:absolute after:left-0 after:right-0 after:-bottom-px after:h-0.5 after:rounded-full
                          ${active ? 'text-on-surface font-semibold after:bg-primary' : 'text-on-surface-variant after:bg-transparent'}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ===== DESKTOP: Search + Filters (unchanged) ===== */}
              <div className="hidden md:flex flex-row flex-wrap items-center justify-between mb-4 gap-4">
                <h3 className="text-lg font-bold">Current Holdings</h3>
                <div className="flex flex-row flex-wrap gap-3">
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
                    <input
                      type="text"
                      placeholder="Search investments..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 pr-4 py-1.5 bg-surface-container-highest border border-outline/10 text-sm rounded-lg focus:outline-none focus:border-primary transition-colors text-on-surface w-full md:w-64"
                    />
                  </div>
                  <div className="flex bg-surface-container-highest p-1 rounded-lg">
                    {['All', 'Stock', 'Mutual Fund', 'Crypto', 'FD'].map(f => (
                      <button
                        key={f}
                        onClick={() => setActiveFilter(f)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${activeFilter === f ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* ===== DESKTOP: Sort header (unchanged) ===== */}
              <div className="hidden md:flex gap-4 mb-4 items-center bg-surface-container-lowest px-4 py-2 rounded-lg border border-outline/5 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                <div className="flex-1 cursor-pointer flex items-center gap-1 hover:text-primary transition-colors" onClick={() => toggleSort('name')}>
                  Name {sortConfig.key === 'name' && (sortConfig.direction === 'desc' ? '↓' : '↑')}
                </div>
                <div className="hidden md:flex gap-8 w-[350px] justify-end">
                  <div className="cursor-pointer hover:text-primary transition-colors" onClick={() => toggleSort('invested')}>
                    Invested {sortConfig.key === 'invested' && (sortConfig.direction === 'desc' ? '↓' : '↑')}
                  </div>
                  <div className="cursor-pointer hover:text-primary transition-colors text-right" onClick={() => toggleSort('pl')}>
                    P/L {sortConfig.key === 'pl' && (sortConfig.direction === 'desc' ? '↓' : '↑')}
                  </div>
                  <div className="cursor-pointer hover:text-primary transition-colors text-right" onClick={() => toggleSort('value')}>
                    Value {sortConfig.key === 'value' && (sortConfig.direction === 'desc' ? '↓' : '↑')}
                  </div>
                </div>
              </div>

              {processedInvestments.length === 0 ? (
                <div className="py-14 flex flex-col items-center text-center">
                  <span className="w-14 h-14 rounded-full bg-surface-container-low border border-outline/10 flex items-center justify-center text-on-surface-variant">
                    <span className="material-symbols-outlined text-[26px]" aria-hidden="true">{investments.length ? 'search_off' : 'monitoring'}</span>
                  </span>
                  <p className="mt-4 font-manrope font-bold text-lg text-on-surface">{investments.length ? 'No holdings match' : 'No investments yet'}</p>
                  <p className="mt-1 max-w-xs text-sm text-on-surface-variant">{investments.length ? 'Try another type or search term.' : 'Track a stock, mutual fund, crypto or FD to see it here.'}</p>
                  {!investments.length && (
                    <button type="button" onClick={() => setProfileModal({ isOpen: true, data: null })} className="mt-5 min-h-[44px] px-5 rounded-full border border-primary/40 text-sm font-semibold text-primary hover:bg-primary/10 transition-colors">Track an investment</button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col md:gap-4">
                  {processedInvestments.map(inv => {
                    const unrealizedPL = (inv.currentPrice - inv.avgCost) * inv.shares;
                    const currentValue = inv.shares * inv.currentPrice;
                    const investedAmount = inv.shares * inv.avgCost;

                    return (
                      <React.Fragment key={inv.id}>
                        {/* ===== DESKTOP CARD (unchanged) ===== */}
                        <div className="hidden md:flex group flex-col md:flex-row justify-between md:items-center bg-[#241a12] p-5 rounded-lg border border-outline/5 hover:border-outline/20 transition-all gap-4">
                          <div className="flex-1 cursor-pointer" onClick={() => setProfileModal({ isOpen: true, data: inv })}>
                            <h4 className="font-bold text-primary-container flex items-center gap-2">
                              {inv.name}
                              <span className="text-xs text-outline bg-surface-container-highest px-2 py-0.5 rounded-full">{inv.type === 'Mutual Fund' ? 'MF' : inv.symbol || inv.type}</span>
                            </h4>
                            <p className="text-xs text-[#F1DFD3]/60 mt-1">{inv.shares} units | Cost per Stock: {formatCurrency(inv.avgCost)}</p>
                            {inv.comments && <p className="text-xs text-[#F1DFD3]/40 mt-1 italic border-l-2 border-primary/20 pl-2">"{inv.comments}"</p>}
                            <p className="text-[10px] text-on-surface-variant mt-3 group-hover:text-primary transition-colors">Edit Profile ✎</p>
                          </div>
                          <div className="flex gap-8 items-center border-t border-outline/10 pt-4 md:border-t-0 md:pt-0">
                            <div className="hidden md:block text-right">
                              <span className="block text-[10px] uppercase text-on-surface-variant tracking-wider font-bold mb-1">Invested Amount</span>
                              <div className="text-sm font-bold text-on-surface">
                                {formatCurrency(investedAmount)}
                              </div>
                            </div>
                            <div className="text-right border-l border-outline/10 pl-6 border-r pr-6 relative pb-1">
                              <span className="block text-[10px] uppercase text-on-surface-variant tracking-wider font-bold mb-1">Unrealized</span>
                              <div className={`text-sm font-bold ${unrealizedPL >= 0 ? 'text-[#95CD41]' : 'text-error'}`}>
                                {unrealizedPL >= 0 ? '+' : ''}{formatCurrency(unrealizedPL)}
                              </div>
                              <span className="absolute -bottom-4 right-6 text-[10px] text-outline font-bold">Live: {formatCurrency(currentValue)}</span>
                            </div>
                            <div className="text-right">
                            </div>
                            <button data-onboarding="investments-trade" onClick={() => setTradeModal({ isOpen: true, data: inv })} className="bg-surface-container-highest hover:bg-primary hover:text-on-primary transition-all px-4 py-2 flex items-center justify-center rounded-lg text-xs font-bold uppercase tracking-wider text-primary shadow-sm active:scale-95">
                              Trade
                            </button>
                          </div>
                        </div>

                        {/* ===== MOBILE ROW: name, value and P/L % only; tap for details ===== */}
                        <button
                          type="button"
                          onClick={() => setDetailId(inv.id)}
                          className="md:hidden w-full flex items-center gap-4 py-3.5 text-left border-b border-outline/[0.07] last:border-0 active:bg-surface-container-low transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                        >
                          <span className="flex-1 min-w-0">
                            <span className="block text-[15px] font-semibold leading-snug text-on-surface line-clamp-2 break-words">{inv.name}</span>
                            <span className="block mt-0.5 text-xs text-on-surface-variant truncate">{inv.type === 'Mutual Fund' ? 'Mutual fund' : inv.symbol || inv.type}</span>
                          </span>
                          <span className="shrink-0 text-right tabular-nums">
                            <span className="block text-[15px] font-headline font-bold text-on-surface">{formatCurrency(currentValue)}</span>
                            <span className={`block mt-0.5 text-xs font-semibold ${unrealizedPL >= 0 ? 'text-[#95CD41]' : 'text-error'}`}>
                              {unrealizedPL >= 0 ? '+' : '−'}{Math.abs(investedAmount > 0 ? (unrealizedPL / investedAmount) * 100 : 0).toFixed(1)}%
                            </span>
                          </span>
                        </button>
                      </React.Fragment>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Mobile: portfolio breakdown sheet */}
      <Modal isOpen={summaryOpen} onClose={() => setSummaryOpen(false)} title={activeFilter === 'All' ? 'Portfolio' : `${activeFilter} portfolio`}>
        <p className="font-manrope font-extrabold text-[2rem] leading-none tracking-tight text-on-surface">{formatCurrency(visiblePortfolioValue)}</p>
        <p className="mt-1.5 text-xs text-on-surface-variant">{processedInvestments.length} {processedInvestments.length === 1 ? 'holding' : 'holdings'}</p>
        <dl className="mt-5">
          <DetailRow label="Invested">{formatCurrency(visibleInvested)}</DetailRow>
          <DetailRow label="Unrealized P/L" tone={visibleUnrealizedProfit >= 0 ? 'text-[#95CD41]' : 'text-error'}>
            {signed(visibleUnrealizedProfit)}
            {visibleInvested > 0 && <span className="ml-1 font-normal opacity-80">({visibleUnrealizedProfit >= 0 ? '+' : '−'}{Math.abs((visibleUnrealizedProfit / visibleInvested) * 100).toFixed(1)}%)</span>}
          </DetailRow>
          <DetailRow label="Realized P/L (cash)" tone={visibleRealizedProfit >= 0 ? 'text-[#95CD41]' : 'text-error'}>{signed(visibleRealizedProfit)}</DetailRow>
          <DetailRow label="Total P/L" tone={visibleUnrealizedProfit + visibleRealizedProfit >= 0 ? 'text-[#95CD41]' : 'text-error'}>{signed(visibleUnrealizedProfit + visibleRealizedProfit)}</DetailRow>
        </dl>
        <div className="mt-5"><RefreshStatus at={lastRefresh} refreshing={refreshing} onRefresh={refreshPrices} /></div>
      </Modal>

      {/* Mobile: holding details sheet */}
      <Modal
        isOpen={!!detailInv}
        onClose={() => setDetailId(null)}
        title={detailInv?.name || ''}
        footer={detailInv && (
          <div className="flex gap-2">
            <button type="button" onClick={() => { setDetailId(null); setProfileModal({ isOpen: true, data: detailInv }); }} className="flex-1 min-h-[48px] rounded-full border border-outline/20 text-sm font-semibold text-on-surface hover:bg-surface-container-highest transition-colors inline-flex items-center justify-center gap-1.5">
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">edit</span> Edit
            </button>
            <button type="button" onClick={() => { setDetailId(null); setTradeModal({ isOpen: true, data: detailInv }); }} className="flex-1 min-h-[48px] rounded-full bg-primary-container text-on-primary font-manrope font-bold text-[15px] hover:brightness-110 transition-[filter] inline-flex items-center justify-center gap-1.5">
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">swap_vert</span> Trade
            </button>
          </div>
        )}
      >
        {detailInv && <HoldingDetail inv={detailInv} />}
      </Modal>

      <Modal isOpen={profileModal.isOpen} onClose={() => setProfileModal({ isOpen: false, data: null })} title={profileModal.data ? "Edit Profile" : "Track New Investment"}>
        <AddInvestmentForm initialData={profileModal.data} onClose={() => setProfileModal({ isOpen: false, data: null })} />
      </Modal>

      <Modal isOpen={tradeModal.isOpen} onClose={() => setTradeModal({ isOpen: false, data: null })} title={`Execute Trade: ${tradeModal.data?.name}`}>
        {tradeModal.data && <InvestmentTradeForm investment={tradeModal.data} onClose={() => setTradeModal({ isOpen: false, data: null })} />}
      </Modal>

      <InvestmentAnalytics
        isOpen={analyticsOpen}
        onClose={() => setAnalyticsOpen(false)}
        investments={investments}
      />

      <FeatureTour section="investments" />
    </main>
  );
};

export default InvestmentsScreen;
