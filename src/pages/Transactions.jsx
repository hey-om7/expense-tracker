import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { formatCurrency } from '../utils/currency';

const TransactionsScreen = () => {
  const { transactions, monthlySpent, getCategory, categories } = useAppContext();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortBy, setSortBy] = useState('latest');

  const filteredTransactions = useMemo(() => {
    let result = transactions;

    // Search
    if (searchTerm) {
      const lowerQuery = searchTerm.toLowerCase();
      result = result.filter(t => 
        t.title.toLowerCase().includes(lowerQuery) || 
        (t.notes || '').toLowerCase().includes(lowerQuery)
      );
    }

    // Filter Type
    if (filterType !== 'all') {
      result = result.filter(t => t.type === filterType);
    }

    // Filter Category
    if (filterCategory !== 'all') {
      result = result.filter(t => t.categoryId === filterCategory);
    }

    // Sort
    result = [...result].sort((a, b) => {
      if (sortBy === 'latest') return new Date(b.date) - new Date(a.date);
      if (sortBy === 'oldest') return new Date(a.date) - new Date(b.date);
      if (sortBy === 'highest') return b.amount - a.amount;
      if (sortBy === 'lowest') return a.amount - b.amount;
      return 0;
    });

    return result;
  }, [transactions, searchTerm, filterType, filterCategory, sortBy]);

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
              <span className="text-2xl font-headline font-bold text-primary">{formatCurrency(monthlySpent)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <section className="mb-8 p-4 bg-surface-container-lowest rounded-xl flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <span className="material-symbols-outlined absolute left-3 top-3 text-on-surface-variant">search</span>
          <input 
            type="text" 
            placeholder="Search keywords, notes..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-surface-container-low border border-outline/20 rounded-lg py-3 pl-10 pr-4 text-sm text-on-surface focus:outline-none focus:border-primary"
          />
        </div>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="bg-surface-container-low border border-outline/20 rounded-lg py-3 px-4 text-sm focus:outline-none">
          <option value="all">All Types</option>
          <option value="expense">Expenses</option>
          <option value="income">Income</option>
        </select>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="bg-surface-container-low border border-outline/20 rounded-lg py-3 px-4 text-sm focus:outline-none">
           <option value="all">All Categories</option>
           {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="bg-surface-container-low border border-outline/20 rounded-lg py-3 px-4 text-sm focus:outline-none">
          <option value="latest">Latest First</option>
          <option value="oldest">Oldest First</option>
          <option value="highest">Highest Amount</option>
          <option value="lowest">Lowest Amount</option>
        </select>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-headline font-bold text-lg text-on-surface-variant">
                {filteredTransactions.length} Transactions Found
              </h3>
            </div>
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-10 bg-surface-container-low rounded-xl border border-dashed border-outline/20">
                <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-2">receipt_long</span>
                <p className="text-outline">No transactions found matching your criteria.</p>
              </div>
            ) : (
               filteredTransactions.map(t => {
                 const cat = getCategory(t.categoryId);
                 return (
                  <div key={t.id} className="group bg-surface-container-low hover:bg-surface-container-high transition-all rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="min-w-12 h-12 flex-shrink-0 rounded-2xl flex items-center justify-center text-primary" style={{ backgroundColor: cat?.color || '#3D332B' }}>
                        <span className="material-symbols-outlined">{cat?.icon || 'receipt'}</span>
                      </div>
                      <div>
                        <h4 className="font-headline font-bold text-on-surface">{t.title}</h4>
                        <p className="text-xs text-outline font-medium">{cat?.name || 'Uncategorized'} • {new Date(t.date).toLocaleDateString()}</p>
                        {t.notes && <p className="text-xs text-on-surface-variant mt-1 italic">"{t.notes}"</p>}
                      </div>
                    </div>
                    <div className="text-left md:text-right mt-2 md:mt-0">
                      <span className={`block font-headline font-extrabold text-lg ${t.type === 'expense' ? 'text-on-surface' : 'text-[#95CD41]'}`}>
                        {t.type === 'expense' ? '-' : '+'}{formatCurrency(t.amount)}
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
