import React from 'react';
import { useAppContext } from '../context/AppContext';

const TransactionsScreen = () => {
  const { transactions, monthlySpent, getCategory } = useAppContext();

  return (
    <main className="pt-24 pb-32 px-6 max-w-7xl mx-auto min-h-screen">
      <div className="mb-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <span className="text-xs font-bold text-primary uppercase tracking-[0.2em] mb-2 block">Ledger Overview</span>
            <h1 className="font-headline font-extrabold text-4xl md:text-5xl text-on-surface tracking-tight">History</h1>
          </div>
          <div className="bg-surface-container-low rounded-xl p-4 flex items-center gap-6 shadow-sm border border-outline-variant/10">
            <div className="flex flex-col">
              <span className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest">Total Monthly Spent</span>
              <span className="text-2xl font-headline font-bold text-primary">${monthlySpent.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      </div>
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-headline font-bold text-lg text-on-surface-variant">Recent Transactions</h3>
            </div>
            {transactions.length === 0 ? (
              <p className="text-outline">No recent transactions.</p>
            ) : (
               transactions.map(t => {
                 const cat = getCategory(t.categoryId);
                 return (
                  <div key={t.id} className="group bg-surface-container-low hover:bg-surface-container-high transition-all rounded-lg p-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-primary" style={{ backgroundColor: cat?.color || '#3D332B' }}>
                        <span className="material-symbols-outlined">{cat?.icon || 'receipt'}</span>
                      </div>
                      <div>
                        <h4 className="font-headline font-bold text-on-surface">{t.title}</h4>
                        <p className="text-xs text-outline font-medium">{cat?.name || 'Uncategorized'} • {new Date(t.date).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`block font-headline font-extrabold text-lg ${t.type === 'expense' ? 'text-on-surface' : 'text-[#95CD41]'}`}>
                        {t.type === 'expense' ? '-' : '+'}${t.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                 )
               })
            )}
          </div>
        </div>
      </section>
    </main>
  );
};

export default TransactionsScreen;
