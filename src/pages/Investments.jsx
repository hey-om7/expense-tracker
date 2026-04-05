import React from 'react';
import { useAppContext } from '../context/AppContext';

const InvestmentsScreen = () => {
  const { totalPortfolioValue, investments } = useAppContext();

  return (
    <main className="pt-24 pb-32 px-6 max-w-7xl mx-auto min-h-screen">
      <section className="mb-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 bg-surface-container-low rounded-lg p-8 relative overflow-hidden flex flex-col justify-between min-h-[320px]">
            <div>
              <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-2 block">Total Portfolio Value</span>
              <h2 className="font-headline font-extrabold text-5xl md:text-6xl text-primary tracking-tighter mb-4">
                ${totalPortfolioValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </h2>
            </div>
            
            <div className="mt-8">
               <h3 className="text-lg font-bold mb-4">Holdings</h3>
               <div className="flex flex-col gap-4">
                  {investments.map(inv => (
                    <div key={inv.id} className="flex justify-between items-center bg-[#241a12] p-4 rounded-lg">
                      <div>
                         <h4 className="font-bold text-primary-container">{inv.name} <span className="text-xs text-outline ml-2">({inv.symbol})</span></h4>
                         <p className="text-xs text-[#F1DFD3]/60">{inv.shares} shares @ ${inv.avgCost} avg</p>
                       </div>
                      <div className="text-right">
                         <div className="font-bold text-on-surface">${(inv.shares * inv.currentPrice).toLocaleString('en-US', {minimumFractionDigits: 2})}</div>
                         <div className={`text-xs ${inv.currentPrice >= inv.avgCost ? 'text-[#95CD41]' : 'text-error'}`}>
                            {inv.currentPrice >= inv.avgCost ? '+' : ''}{(((inv.currentPrice - inv.avgCost) / inv.avgCost) * 100).toFixed(2)}%
                         </div>
                      </div>
                    </div>
                  ))}
               </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default InvestmentsScreen;
