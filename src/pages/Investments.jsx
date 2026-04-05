import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { formatCurrency } from '../utils/currency';
import Modal from '../components/ui/Modal';
import AddInvestmentForm from '../components/forms/AddInvestmentForm';

const InvestmentsScreen = () => {
  const { totalPortfolioValue, investments } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const totalInvested = investments.reduce((acc, curr) => acc + (curr.shares * curr.avgCost), 0);
  const totalProfit = totalPortfolioValue - totalInvested;

  return (
    <main className="pt-24 pb-32 px-6 max-w-7xl mx-auto min-h-screen">
      <section className="mb-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 bg-surface-container-low rounded-lg p-8 relative overflow-hidden flex flex-col justify-between min-h-[320px]">
            <div className="flex justify-between items-start">
              <div>
                <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-2 block">Total Portfolio Value</span>
                <h2 className="font-headline font-extrabold text-5xl md:text-6xl text-primary tracking-tighter mb-4">
                  {formatCurrency(totalPortfolioValue)}
                </h2>
                <div className={`flex items-center gap-2 ${totalProfit >= 0 ? 'text-[#95CD41]' : 'text-error'}`}>
                   <span className="material-symbols-outlined text-sm">{totalProfit >= 0 ? 'trending_up' : 'trending_down'}</span>
                   <span className="text-sm font-medium font-body">{totalProfit >= 0 ? '+' : ''}{formatCurrency(totalProfit)} All time</span>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(true)} className="bg-primary-container text-on-primary py-2 px-4 rounded-lg font-manrope font-bold text-sm shadow-xl shadow-[#E5BA73]/10 hover:brightness-110 transition-all active:scale-95">
                + Add
              </button>
            </div>
            
            <div className="mt-8">
               <h3 className="text-lg font-bold mb-4">Holdings</h3>
               {investments.length === 0 ? (
                 <p className="text-outline text-sm">No investments tracked yet. Click "+ Add" to start tracking.</p>
               ) : (
                 <div className="flex flex-col gap-4">
                    {investments.map(inv => (
                      <div key={inv.id} className="flex justify-between items-center bg-[#241a12] p-4 rounded-lg border border-outline/5 hover:border-outline/20 transition-all">
                        <div>
                           <h4 className="font-bold text-primary-container">{inv.name} <span className="text-xs text-outline ml-2">({inv.symbol || inv.type})</span></h4>
                           <p className="text-xs text-[#F1DFD3]/60">{inv.shares} units @ {formatCurrency(inv.avgCost)}</p>
                         </div>
                        <div className="text-right">
                           <div className="font-bold text-on-surface">{formatCurrency(inv.shares * inv.currentPrice)}</div>
                           <div className={`text-xs ${inv.currentPrice >= inv.avgCost ? 'text-[#95CD41]' : 'text-error'}`}>
                              {inv.currentPrice >= inv.avgCost ? '+' : ''}{(((inv.currentPrice - inv.avgCost) / inv.avgCost) * 100).toFixed(2)}%
                           </div>
                        </div>
                      </div>
                    ))}
                 </div>
               )}
            </div>
          </div>
        </div>
      </section>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Track New Investment">
        <AddInvestmentForm onClose={() => setIsModalOpen(false)} />
      </Modal>
    </main>
  );
};

export default InvestmentsScreen;
