import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { formatCurrency } from '../utils/currency';
import Modal from '../components/ui/Modal';
import AddTransactionForm from '../components/forms/AddTransactionForm';

const DashboardScreen = () => {
  const { totalBalance, monthlySpent } = useAppContext();
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

  return (
    <main className="pt-24 px-6 pb-12 max-w-7xl mx-auto w-full">
      <section className="mb-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#F1DFD3]/40 font-semibold mb-2 block">Available Liquidity</span>
            <h2 className="text-5xl md:text-7xl font-manrope font-extrabold text-on-surface tracking-tighter">
              {formatCurrency(totalBalance)}
            </h2>
            <div className="flex items-center gap-2 mt-4 text-[#95CD41]">
              <span className="material-symbols-outlined text-sm">trending_up</span>
              <span className="text-sm font-medium font-body">+4.2% from last month</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setIsQuickAddOpen(true)} className="bg-[#E5BA73]/10 text-[#E5BA73] p-4 rounded-xl flex items-center gap-2 font-manrope font-bold text-sm hover:bg-[#E5BA73]/20 transition-all active:scale-95">
              <span className="material-symbols-outlined">add_circle</span> Quick Add
            </button>
            <button className="bg-primary-container text-on-primary p-4 rounded-xl flex items-center gap-2 font-manrope font-bold text-sm shadow-xl shadow-[#E5BA73]/10 hover:brightness-110 transition-all active:scale-95">
              <span className="material-symbols-outlined">file_upload</span> Transfer
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-12 flex flex-col gap-6">
          <div className="bg-surface-container-low rounded-lg p-8">
            <h3 className="font-manrope font-bold text-xl mb-4">Welcome to Wallo</h3>
            <p className="text-[#F1DFD3]/60">Navigate using the sidebar or bottom navigation to explore transactions, investments, and analytics.</p>
            <p className="text-[#F1DFD3]/60 mt-4">Current Monthly Spent: <span className="font-bold text-error">{formatCurrency(monthlySpent)}</span></p>
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
