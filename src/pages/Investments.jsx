import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { formatCurrency } from '../utils/currency';
import Modal from '../components/ui/Modal';
import AddInvestmentForm from '../components/forms/AddInvestmentForm';
import InvestmentTradeForm from '../components/forms/InvestmentTradeForm';

const InvestmentsScreen = () => {
  // Disconnected global aggregations in favor of localized dynamic totals
  const { investments, updateInvestment } = useAppContext();
  
  const [profileModal, setProfileModal] = useState({ isOpen: false, data: null });
  const [tradeModal, setTradeModal] = useState({ isOpen: false, data: null });
  const [activeFilter, setActiveFilter] = useState('All');
  
  // Analytics Enhancements Search & Sort States
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'value', direction: 'desc' });
  
  const hasFetchedNavs = useRef(false);

  // Auto-refresh Mutual Fund NAVs and Stock Quotes on initial mount
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
          } catch(e) {
             console.error(`Failed to fetch live price for ${inv.name}`, e);
          }
       }
    };
    
    fetchLatestPrices();
  }, [investments, updateInvestment]);

  // Derived Filter & Sort Execution Matrix
  const processedInvestments = useMemo(() => {
    // 1. Filter Matrix
    let results = investments.filter(inv => activeFilter === 'All' || inv.type === activeFilter);
    
    // 2. Search Matrix
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      results = results.filter(inv => 
        (inv.name && inv.name.toLowerCase().includes(q)) || 
        (inv.symbol && inv.symbol.toLowerCase().includes(q)) || 
        (inv.comments && inv.comments.toLowerCase().includes(q))
      );
    }
    
    // 3. Sorting Matrix
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

  // Dynamic Aggegration Mathematical Resolution
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
            <div className="flex justify-between items-start">
              <div>
                <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-2 block">
                  {activeFilter === 'All' ? 'Total Portfolio Value (Live)' : `${activeFilter} Portfolio Value (Live)`}
                </span>
                <h2 className="font-headline font-extrabold text-5xl md:text-6xl text-primary tracking-tighter mb-4 transition-all">
                  {formatCurrency(visiblePortfolioValue)}
                </h2>
                <div className="flex items-center gap-6 mt-4">
                  <div className={`flex flex-col`}>
                     <span className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest mb-1">Unrealized P/L</span>
                     <span className={`text-md font-bold font-body ${visibleUnrealizedProfit >= 0 ? 'text-[#95CD41]' : 'text-error'}`}>
                       {visibleUnrealizedProfit >= 0 ? '+' : ''}{formatCurrency(visibleUnrealizedProfit)}
                     </span>
                  </div>
                  <div className={`flex flex-col border-l border-outline/20 pl-6`}>
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
            
            <div className="mt-10">
               <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
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
                    <div className="relative flex bg-surface-container-highest p-1 rounded-xl h-10 w-full md:w-auto overflow-hidden">
                      {/* Sliding Multi-Selector Background */}
                      <div 
                        className="absolute top-1 bottom-1 transition-all duration-300 ease-out z-0 bg-primary"
                        style={{
                          width: 'calc((100% - 8px) / 5)',
                          left: `calc(4px + (${['All', 'Stock', 'Mutual Fund', 'Crypto', 'FD'].indexOf(activeFilter)} * (100% - 8px) / 5))`,
                          borderRadius: activeFilter === 'All' ? '8px 4px 4px 8px' : activeFilter === 'FD' ? '4px 8px 8px 4px' : '4px'
                        }}
                      />
                      
                      {['All', 'Stock', 'Mutual Fund', 'Crypto', 'FD'].map(f => (
                        <button 
                          key={f}
                          onClick={() => setActiveFilter(f)} 
                          className={`relative z-10 px-4 py-1.5 text-xs font-bold transition-colors duration-300 min-w-fit flex-1 md:flex-initial
                            ${activeFilter === f ? 'text-on-primary' : 'text-on-surface-variant hover:text-on-surface'}
                          `}
                        >
                          {f}
                        </button>
                      ))}
                   </div>
                  </div>
               </div>

               <div className="flex gap-4 mb-4 items-center bg-surface-container-lowest px-4 py-2 rounded-lg border border-outline/5 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
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
                 <div className="flex flex-col gap-4">
                    {processedInvestments.map(inv => {
                      const unrealizedPL = (inv.currentPrice - inv.avgCost) * inv.shares;
                      
                      return (
                        <div key={inv.id} className="group flex flex-col md:flex-row justify-between md:items-center bg-[#241a12] p-5 rounded-lg border border-outline/5 hover:border-outline/20 transition-all gap-4">
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
                                 <div className={`text-sm font-bold text-on-surface`}>
                                    {formatCurrency(inv.shares * inv.avgCost)}
                                 </div>
                              </div>
                              <div className="text-right border-l border-outline/10 pl-6 border-r pr-6 relative pb-1">
                                 <span className="block text-[10px] uppercase text-on-surface-variant tracking-wider font-bold mb-1">Unrealized</span>
                                 <div className={`text-sm font-bold ${unrealizedPL >= 0 ? 'text-[#95CD41]' : 'text-error'}`}>
                                    {unrealizedPL >= 0 ? '+' : ''}{formatCurrency(unrealizedPL)}
                                 </div>
                                 <span className="absolute -bottom-4 right-6 text-[10px] text-outline font-bold">Live: {formatCurrency(inv.shares * inv.currentPrice)}</span>
                              </div>
                              <div className="text-right">
                              </div>
                              <button onClick={() => setTradeModal({ isOpen: true, data: inv })} className="bg-surface-container-highest hover:bg-primary hover:text-on-primary transition-all px-4 py-2 flex items-center justify-center rounded-lg text-xs font-bold uppercase tracking-wider text-primary shadow-sm active:scale-95">
                                 Trade
                              </button>
                           </div>
                        </div>
                      )
                    })}
                 </div>
               )}
            </div>
          </div>
        </div>
      </section>

      <Modal isOpen={profileModal.isOpen} onClose={() => setProfileModal({isOpen: false, data: null})} title={profileModal.data ? "Edit Profile" : "Track New Investment"}>
        <AddInvestmentForm initialData={profileModal.data} onClose={() => setProfileModal({isOpen: false, data: null})} />
      </Modal>

      <Modal isOpen={tradeModal.isOpen} onClose={() => setTradeModal({isOpen: false, data: null})} title={`Execute Trade: ${tradeModal.data?.name}`}>
        {tradeModal.data && <InvestmentTradeForm investment={tradeModal.data} onClose={() => setTradeModal({isOpen: false, data: null})} />}
      </Modal>
    </main>
  );
};

export default InvestmentsScreen;
