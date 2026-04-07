import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { formatCurrency } from '../utils/currency';
import Modal from '../components/ui/Modal';
import AddTransactionForm from '../components/forms/AddTransactionForm';

const DashboardScreen = () => {
  const { totalBalance, monthlySpent, totalPortfolioValue, totalRealizedProfit, totalUnrealizedProfit } = useAppContext();
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

  return (
    <main className="pt-24 px-6 pb-12 max-w-7xl mx-auto w-full max-md:pb-28 max-md:px-4 max-md:min-h-screen">
      <section className="mb-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 max-md:gap-4">
          <div className="min-w-0">
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#F1DFD3]/40 font-semibold mb-2 block">Available Liquidity</span>
            {/* Desktop: original size */}
            <h2 className="hidden md:block text-5xl md:text-7xl font-manrope font-extrabold text-on-surface tracking-tighter">
              {formatCurrency(totalBalance)}
            </h2>
            {/* Mobile: auto-shrink for large numbers */}
            <h2 className={`md:hidden font-manrope font-extrabold text-on-surface tracking-tighter ${
              formatCurrency(totalBalance).length > 14 ? 'text-2xl' : formatCurrency(totalBalance).length > 10 ? 'text-3xl' : 'text-4xl'
            }`}>
              {formatCurrency(totalBalance)}
            </h2>
          </div>
          <div className="flex gap-3 max-md:gap-2">
            <button onClick={() => setIsQuickAddOpen(true)} className="bg-[#E5BA73]/10 text-[#E5BA73] p-4 rounded-xl flex items-center gap-2 font-manrope font-bold text-sm hover:bg-[#E5BA73]/20 transition-all active:scale-95 max-md:p-3 max-md:text-xs max-md:rounded-lg">
              <span className="material-symbols-outlined max-md:text-lg">add_circle</span> Quick Add
            </button>
            <button className="bg-primary-container text-on-primary p-4 rounded-xl flex items-center gap-2 font-manrope font-bold text-sm shadow-xl shadow-[#E5BA73]/10 hover:brightness-110 transition-all active:scale-95 max-md:p-3 max-md:text-xs max-md:rounded-lg">
              <span className="material-symbols-outlined max-md:text-lg">file_upload</span> Transfer
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 max-md:gap-4">
        <div className="md:col-span-8 flex flex-col gap-6 max-md:gap-4">
          <div className="bg-surface-container-low rounded-lg p-8 max-md:p-5">
            <h3 className="font-manrope font-bold text-xl mb-4 max-md:text-lg max-md:mb-3">Welcome to Wallo</h3>
            <p className="text-[#F1DFD3]/60 max-md:text-sm">Navigate using the sidebar or bottom navigation to explore transactions, investments, and analytics.</p>
            <p className="text-[#F1DFD3]/60 mt-4 max-md:mt-3 max-md:text-sm">Current Monthly Spent: <span className="font-bold text-error">{formatCurrency(monthlySpent)}</span></p>
          </div>
        </div>

        <div className="md:col-span-4 flex flex-col gap-6 max-md:gap-4">
          <div className="bg-[#241a12] border border-outline/10 rounded-lg p-6 max-md:p-4">
             <h3 className="font-manrope font-bold text-sm uppercase tracking-widest text-on-surface-variant mb-4">Portfolio Summary</h3>
             <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium text-outline">Total Value</span>
                <span className="font-bold text-lg">{formatCurrency(totalPortfolioValue)}</span>
             </div>
             <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium text-outline">Unrealized P/L</span>
                <span className={`font-bold ${totalUnrealizedProfit >= 0 ? 'text-[#95CD41]' : 'text-error'}`}>
                   {totalUnrealizedProfit >= 0 ? '+' : ''}{formatCurrency(totalUnrealizedProfit)}
                </span>
             </div>
             <div className="flex justify-between items-center pt-3 border-t border-outline/10">
                <span className="text-sm font-medium text-outline">Realized (Cash) P/L</span>
                <span className={`font-bold ${totalRealizedProfit >= 0 ? 'text-[#95CD41]' : 'text-error'}`}>
                   {totalRealizedProfit >= 0 ? '+' : ''}{formatCurrency(totalRealizedProfit)}
                </span>
             </div>
          </div>
        </div>
      </div>

      <Modal isOpen={isQuickAddOpen} onClose={() => setIsQuickAddOpen(false)} title="New Transaction">
        <AddTransactionForm onClose={() => setIsQuickAddOpen(false)} />
      </Modal>
    </main>
  );
};

export default DashboardScreen;
