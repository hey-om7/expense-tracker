import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { formatCurrency } from '../utils/currency';
import Modal from '../components/ui/Modal';
import AddInvestmentForm from '../components/forms/AddInvestmentForm';
import InvestmentTradeForm from '../components/forms/InvestmentTradeForm';

const InvestmentsScreen = () => {
  const { totalPortfolioValue, totalInvested, totalUnrealizedProfit, totalRealizedProfit, investments, updateInvestment } = useAppContext();
  
  const [profileModal, setProfileModal] = useState({ isOpen: false, data: null });
  const [tradeModal, setTradeModal] = useState({ isOpen: false, data: null });
  const [activeFilter, setActiveFilter] = useState('All');
  
  const hasFetchedNavs = useRef(false);

  // Auto-refresh Mutual Fund NAVs on initial mount
  useEffect(() => {
    if (investments.length === 0 || hasFetchedNavs.current) return;

    const fetchLatestNavs = async () => {
       hasFetchedNavs.current = true;
       const mfs = investments.filter(inv => inv.type === 'Mutual Fund' && inv.symbol);
       
       for (const mf of mfs) {
          try {
             const response = await fetch(`https://api.mfapi.in/mf/${mf.symbol}/latest`);
             const data = await response.json();
             if (data && data.data && data.data.length > 0) {
                 const latestNav = parseFloat(data.data[0].nav);
                 // Only update if there is a discrepancy to avoid infinite loops and unnecessary DB writes
                 if (latestNav && latestNav !== mf.currentPrice) {
                    await updateInvestment(mf.id, { currentPrice: latestNav });
                 }
             }
          } catch(e) {
             console.error(`Failed to fetch NAV for ${mf.name}`, e);
          }
       }
    };
    
    fetchLatestNavs();
  }, [investments, updateInvestment]);

  const filteredInvestments = investments.filter(inv => activeFilter === 'All' || inv.type === activeFilter);

  return (
    <main className="pt-24 pb-32 px-6 max-w-7xl mx-auto min-h-screen">
      <section className="mb-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-12 bg-surface-container-low rounded-lg p-8 relative overflow-hidden flex flex-col justify-between min-h-[320px]">
            <div className="flex justify-between items-start">
              <div>
                <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-2 block">Total Portfolio Value (Live)</span>
                <h2 className="font-headline font-extrabold text-5xl md:text-6xl text-primary tracking-tighter mb-4">
                  {formatCurrency(totalPortfolioValue)}
                </h2>
                <div className="flex items-center gap-6 mt-4">
                  <div className={`flex flex-col`}>
                     <span className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest mb-1">Unrealized P/L</span>
                     <span className={`text-md font-bold font-body ${totalUnrealizedProfit >= 0 ? 'text-[#95CD41]' : 'text-error'}`}>
                       {totalUnrealizedProfit >= 0 ? '+' : ''}{formatCurrency(totalUnrealizedProfit)}
                     </span>
                  </div>
                  <div className={`flex flex-col border-l border-outline/20 pl-6`}>
                     <span className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest mb-1">Realized P/L (Cash)</span>
                     <span className={`text-md font-bold font-body ${totalRealizedProfit >= 0 ? 'text-[#95CD41]' : 'text-error'}`}>
                       {totalRealizedProfit >= 0 ? '+' : ''}{formatCurrency(totalRealizedProfit)}
                     </span>
                  </div>
                </div>
              </div>
              <button onClick={() => setProfileModal({ isOpen: true, data: null })} className="bg-primary-container text-on-primary py-2 px-4 rounded-lg font-manrope font-bold text-sm shadow-xl shadow-[#E5BA73]/10 hover:brightness-110 transition-all active:scale-95">
                + New Profile
              </button>
            </div>
            
            <div className="mt-10">
               <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold">Current Holdings</h3>
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

               {filteredInvestments.length === 0 ? (
                 <p className="text-outline text-sm">No active profiles matching the selected filter.</p>
               ) : (
                 <div className="flex flex-col gap-4">
                    {filteredInvestments.map(inv => {
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
                              <div className="text-right">
                                 <span className="block text-[10px] uppercase text-on-surface-variant tracking-wider font-bold mb-1">Unrealized</span>
                                 <div className={`text-sm font-bold ${unrealizedPL >= 0 ? 'text-[#95CD41]' : 'text-error'}`}>
                                    {unrealizedPL >= 0 ? '+' : ''}{formatCurrency(unrealizedPL)}
                                 </div>
                              </div>
                              <div className="text-right border-l border-outline/10 pl-6 border-r pr-6">
                                 <span className="block text-[10px] uppercase text-on-surface-variant tracking-wider font-bold mb-1">Live NAV Value</span>
                                 <div className="font-bold text-on-surface">{formatCurrency(inv.shares * inv.currentPrice)}</div>
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
