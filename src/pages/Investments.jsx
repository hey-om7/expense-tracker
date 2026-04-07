import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { formatCurrency } from '../utils/currency';
import Modal from '../components/ui/Modal';
import AddInvestmentForm from '../components/forms/AddInvestmentForm';
import InvestmentTradeForm from '../components/forms/InvestmentTradeForm';

const InvestmentsScreen = () => {
  const { investments, updateInvestment } = useAppContext();

  const [profileModal, setProfileModal] = useState({ isOpen: false, data: null });
  const [tradeModal, setTradeModal] = useState({ isOpen: false, data: null });
  const [activeFilter, setActiveFilter] = useState('All');

  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'value', direction: 'desc' });

  const hasFetchedNavs = useRef(false);

  useEffect(() => {
    if (investments.length === 0 || hasFetchedNavs.current) return;

    const fetchLatestPrices = async () => {
      hasFetchedNavs.current = true;
      const autoUpdateInvestments = investments.filter(inv => (inv.type === 'Mutual Fund' || inv.type === 'Stock') && inv.symbol);

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
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/stocks/quote/${encodeURIComponent(inv.symbol)}`);
            if (response.ok) {
              const data = await response.json();
              if (data && data.price) {
                latestPrice = parseFloat(data.price);
              }
            }
          }

          if (latestPrice && latestPrice !== inv.currentPrice) {
            await updateInvestment(inv.id, { currentPrice: latestPrice });
          }
        } catch (e) {
          console.error(`Failed to fetch live price for ${inv.name}`, e);
        }
      }
    };

    fetchLatestPrices();
  }, [investments, updateInvestment]);

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
  const visibleUnrealizedProfit = processedInvestments.reduce((acc, curr) => acc + ((curr.currentPrice - curr.avgCost) * curr.shares), 0);

  const toggleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  return (
    <main className="pt-24 pb-32 px-6 max-w-7xl mx-auto min-h-screen">
      <section className="mb-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-12 bg-surface-container-low rounded-lg p-8 relative overflow-hidden flex flex-col justify-between min-h-[320px]">

            {/* ===== DESKTOP HERO (unchanged) ===== */}
            <div className="hidden md:flex justify-between items-start">
              <div>
                <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-2 block">
                  {activeFilter === 'All' ? 'Total Portfolio Value (Live)' : `${activeFilter} Portfolio Value (Live)`}
                </span>
                <h2 className="font-headline font-extrabold text-5xl md:text-6xl text-primary tracking-tighter mb-4 transition-all">
                  {formatCurrency(visiblePortfolioValue)}
                </h2>
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
              <button onClick={() => setProfileModal({ isOpen: true, data: null })} className="bg-primary-container text-on-primary py-2 px-4 rounded-lg font-manrope font-bold text-sm shadow-xl shadow-[#E5BA73]/10 hover:brightness-110 transition-all active:scale-95">
                + New Profile
              </button>
            </div>

            {/* ===== MOBILE HERO ===== */}
            <div className="md:hidden -m-8 mb-0 p-5 pb-4">
              <div className="flex justify-between items-center mb-3">
                <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                  {activeFilter === 'All' ? 'Portfolio (Live)' : `${activeFilter} (Live)`}
                </span>
                <button onClick={() => setProfileModal({ isOpen: true, data: null })} className="bg-primary-container text-on-primary py-1.5 px-3 rounded-lg font-manrope font-bold text-xs shadow-lg shadow-[#E5BA73]/10 active:scale-95">
                  + New
                </button>
              </div>
              <h2 className="font-headline font-extrabold text-3xl text-primary tracking-tighter mb-3">
                {formatCurrency(visiblePortfolioValue)}
              </h2>
              <div className="flex gap-4">
                <div className="flex flex-col">
                  <span className="text-[9px] text-on-surface-variant uppercase font-bold tracking-widest mb-0.5">Unrealized</span>
                  <span className={`text-sm font-bold font-body ${visibleUnrealizedProfit >= 0 ? 'text-[#95CD41]' : 'text-error'}`}>
                    {visibleUnrealizedProfit >= 0 ? '+' : ''}{formatCurrency(visibleUnrealizedProfit)}
                  </span>
                </div>
                <div className="flex flex-col border-l border-outline/20 pl-4">
                  <span className="text-[9px] text-on-surface-variant uppercase font-bold tracking-widest mb-0.5">Realized</span>
                  <span className={`text-sm font-bold font-body ${visibleRealizedProfit >= 0 ? 'text-[#95CD41]' : 'text-error'}`}>
                    {visibleRealizedProfit >= 0 ? '+' : ''}{formatCurrency(visibleRealizedProfit)}
                  </span>
                </div>
              </div>
            </div>

            {/* ===== HOLDINGS SECTION ===== */}
            <div className="mt-10 md:mt-10 max-md:-mx-8 max-md:mt-4 max-md:px-4">

              {/* ===== MOBILE: Search + Filters ===== */}
              <div className="md:hidden flex flex-col gap-3 mb-4">
                <div className="flex gap-2 items-center">
                  <h3 className="text-base font-bold flex-1">Holdings</h3>
                  <select
                    value={sortConfig.key}
                    onChange={(e) => setSortConfig({ key: e.target.value, direction: 'desc' })}
                    className="bg-surface-container-highest border border-outline/10 text-xs rounded-lg py-1.5 px-2 focus:outline-none text-on-surface-variant"
                  >
                    <option value="value">By Value</option>
                    <option value="name">By Name</option>
                    <option value="invested">By Invested</option>
                    <option value="pl">By P/L</option>
                  </select>
                </div>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-surface-container-highest border border-outline/10 text-sm rounded-lg focus:outline-none focus:border-primary text-on-surface w-full"
                  />
                </div>
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
                  {['All', 'Stock', 'MF', 'Crypto', 'FD'].map(f => {
                    const filterVal = f === 'MF' ? 'Mutual Fund' : f;
                    return (
                      <button
                        key={f}
                        onClick={() => setActiveFilter(filterVal)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${activeFilter === filterVal ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container-highest text-on-surface-variant'}`}
                      >
                        {f}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ===== DESKTOP: Search + Filters (unchanged) ===== */}
              <div className="hidden md:flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
                <h3 className="text-lg font-bold">Current Holdings</h3>
                <div className="flex flex-col md:flex-row gap-3">
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
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${activeFilter === f ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
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
                <p className="text-outline text-sm italic">No active profiles matching parameters in the local framework.</p>
              ) : (
                <div className="flex flex-col gap-4 max-md:gap-3">
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
                            <button onClick={() => setTradeModal({ isOpen: true, data: inv })} className="bg-surface-container-highest hover:bg-primary hover:text-on-primary transition-all px-4 py-2 flex items-center justify-center rounded-lg text-xs font-bold uppercase tracking-wider text-primary shadow-sm active:scale-95">
                              Trade
                            </button>
                          </div>
                        </div>

                        {/* ===== MOBILE CARD ===== */}
                        <div className="md:hidden bg-[#241a12] rounded-xl border border-outline/5 overflow-hidden active:border-outline/20 transition-all">
                          {/* Top: Name + Tag */}
                          <div className="p-4 pb-3 cursor-pointer" onClick={() => setProfileModal({ isOpen: true, data: inv })}>
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="font-bold text-primary-container text-sm truncate mr-2">{inv.name}</h4>
                              <span className="text-[10px] text-outline bg-surface-container-highest px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">{inv.type === 'Mutual Fund' ? 'MF' : inv.symbol || inv.type}</span>
                            </div>
                            <p className="text-[11px] text-[#F1DFD3]/50">{inv.shares} units @ {formatCurrency(inv.avgCost)}</p>
                          </div>

                          {/* Middle: Stats grid */}
                          <div className="grid grid-cols-3 gap-px bg-outline/5 mx-4">
                            <div className="bg-[#241a12] py-2 pr-2">
                              <span className="block text-[9px] text-on-surface-variant uppercase tracking-wider font-bold mb-0.5">Invested</span>
                              <span className="text-xs font-bold text-on-surface">{formatCurrency(investedAmount)}</span>
                            </div>
                            <div className="bg-[#241a12] py-2 px-2 text-center">
                              <span className="block text-[9px] text-on-surface-variant uppercase tracking-wider font-bold mb-0.5">P/L</span>
                              <span className={`text-xs font-bold ${unrealizedPL >= 0 ? 'text-[#95CD41]' : 'text-error'}`}>
                                {unrealizedPL >= 0 ? '+' : ''}{formatCurrency(unrealizedPL)}
                              </span>
                            </div>
                            <div className="bg-[#241a12] py-2 pl-2 text-right">
                              <span className="block text-[9px] text-on-surface-variant uppercase tracking-wider font-bold mb-0.5">Value</span>
                              <span className="text-xs font-bold text-primary">{formatCurrency(currentValue)}</span>
                            </div>
                          </div>

                          {/* Bottom: Actions */}
                          <div className="flex gap-2 p-4 pt-3">
                            <button onClick={() => setProfileModal({ isOpen: true, data: inv })} className="flex-1 bg-surface-container-highest/60 text-on-surface-variant py-2 rounded-lg text-xs font-bold active:scale-95 transition-all flex items-center justify-center gap-1">
                              <span className="material-symbols-outlined text-sm">edit</span> Edit
                            </button>
                            <button onClick={() => setTradeModal({ isOpen: true, data: inv })} className="flex-1 bg-primary/15 text-primary py-2 rounded-lg text-xs font-bold active:scale-95 transition-all flex items-center justify-center gap-1">
                              <span className="material-symbols-outlined text-sm">swap_vert</span> Trade
                            </button>
                          </div>
                        </div>
                      </React.Fragment>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <Modal isOpen={profileModal.isOpen} onClose={() => setProfileModal({ isOpen: false, data: null })} title={profileModal.data ? "Edit Profile" : "Track New Investment"}>
        <AddInvestmentForm initialData={profileModal.data} onClose={() => setProfileModal({ isOpen: false, data: null })} />
      </Modal>

      <Modal isOpen={tradeModal.isOpen} onClose={() => setTradeModal({ isOpen: false, data: null })} title={`Execute Trade: ${tradeModal.data?.name}`}>
        {tradeModal.data && <InvestmentTradeForm investment={tradeModal.data} onClose={() => setTradeModal({ isOpen: false, data: null })} />}
      </Modal>
    </main>
  );
};

export default InvestmentsScreen;
