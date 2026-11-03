import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { formatCurrency } from '../utils/currency';
import { getContrastingColor } from '../utils/colorUtils';
import Modal from '../components/ui/Modal';
import AddTransactionForm from '../components/forms/AddTransactionForm';
import InvestmentTradeForm from '../components/forms/InvestmentTradeForm';
import FeatureTour from '../components/ui/FeatureTour';

const TransactionsScreen = () => {
  const { transactions, monthlySpent, getCategory, categories, investments } = useAppContext();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortBy, setSortBy] = useState('latest');
  
  const [filterDate, setFilterDate] = useState('');
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterYear, setFilterYear] = useState('all');

  const [editModal, setEditModal] = useState({ isOpen: false, data: null });
  const [tradeModal, setTradeModal] = useState({ isOpen: false, data: null });

  // Mobile filter panel toggle
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const activeFilterCount = [
    filterType !== 'all',
    filterCategory !== 'all',
    sortBy !== 'latest',
    filterDate !== '',
    filterMonth !== 'all',
    filterYear !== 'all',
  ].filter(Boolean).length;

  const filteredTransactions = useMemo(() => {
    let result = transactions;

    if (searchTerm) {
      const lowerQuery = searchTerm.toLowerCase();
      result = result.filter(t => 
        t.title.toLowerCase().includes(lowerQuery) || 
        (t.notes || '').toLowerCase().includes(lowerQuery)
      );
    }

    if (filterType !== 'all') {
      if (filterType === 'trade') {
         result = result.filter(t => t.type === 'buy_investment' || t.type === 'sell_investment');
      } else {
         result = result.filter(t => t.type === filterType);
      }
    }

    if (filterCategory !== 'all') {
      result = result.filter(t => t.categoryId === filterCategory);
    }
    
    if (filterDate) {
       result = result.filter(t => new Date(t.date).toISOString().split('T')[0] === filterDate);
    }
    if (filterMonth !== 'all') {
       result = result.filter(t => new Date(t.date).getMonth().toString() === filterMonth);
    }
    if (filterYear !== 'all') {
       result = result.filter(t => new Date(t.date).getFullYear().toString() === filterYear);
    }

    result = [...result].sort((a, b) => {
      if (sortBy === 'latest') return new Date(b.date) - new Date(a.date);
      if (sortBy === 'oldest') return new Date(a.date) - new Date(b.date);
      if (sortBy === 'highest') return b.amount - a.amount;
      if (sortBy === 'lowest') return a.amount - b.amount;
      return 0;
    });

    return result;
  }, [transactions, searchTerm, filterType, filterCategory, sortBy, filterDate, filterMonth, filterYear]);

  const uniqueYears = useMemo(() => {
    const years = new Set(transactions.map(t => new Date(t.date).getFullYear()));
    return Array.from(years).sort((a,b) => b - a);
  }, [transactions]);

  const clearAllFilters = () => {
    setFilterType('all');
    setFilterCategory('all');
    setSortBy('latest');
    setFilterDate('');
    setFilterMonth('all');
    setFilterYear('all');
  };

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

      {/* ===== MOBILE: Search + Filter Toggle ===== */}
      <div className="md:hidden mb-4 flex flex-col gap-3">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-3 text-on-surface-variant">search</span>
          <input 
            type="text" 
            placeholder="Search notes..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-surface-container-low border border-outline/20 rounded-lg py-3 pl-10 pr-4 text-sm text-on-surface focus:outline-none focus:border-primary"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all border ${showMobileFilters ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-surface-container-low border-outline/20 text-on-surface-variant'}`}
          >
            <span className="material-symbols-outlined text-lg">tune</span>
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-primary text-on-primary text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">{activeFilterCount}</span>
            )}
          </button>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="flex-1 bg-surface-container-low border border-outline/20 rounded-lg py-2.5 px-3 text-sm focus:outline-none text-on-surface-variant">
            <option value="latest">Latest First</option>
            <option value="oldest">Oldest First</option>
            <option value="highest">Highest ₹</option>
            <option value="lowest">Lowest ₹</option>
          </select>
        </div>

        {showMobileFilters && (
          <div className="bg-surface-container-lowest rounded-xl border border-outline/10 p-4 flex flex-col gap-3 animate-[slideDown_0.2s_ease-out]">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Filter By</span>
              {activeFilterCount > 0 && (
                <button onClick={clearAllFilters} className="text-[10px] text-error font-bold uppercase tracking-wider">Clear All</button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase text-on-surface-variant mb-1 font-bold">Type</span>
                <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="bg-surface-container-low border border-outline/20 rounded-lg py-2.5 px-3 text-sm focus:outline-none">
                  <option value="all">All Types</option>
                  <option value="expense">Expenses</option>
                  <option value="income">Income</option>
                  <option value="trade">Trades</option>
                </select>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase text-on-surface-variant mb-1 font-bold">Category</span>
                <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="bg-surface-container-low border border-outline/20 rounded-lg py-2.5 px-3 text-sm focus:outline-none">
                  <option value="all">All</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 min-w-0 overflow-hidden">
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] uppercase text-on-surface-variant mb-1 font-bold">Date</span>
                <input type="date" value={filterDate} onChange={e => {setFilterDate(e.target.value); setFilterMonth('all'); setFilterYear('all')}} className="bg-surface-container-low border border-outline/20 rounded-lg py-2 px-2 text-sm focus:outline-none w-full min-w-0 box-border" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase text-on-surface-variant mb-1 font-bold">Month</span>
                <select value={filterMonth} onChange={e => {setFilterMonth(e.target.value); setFilterDate('')}} className="bg-surface-container-low border border-outline/20 rounded-lg py-2 px-2 text-sm focus:outline-none">
                  <option value="all">Any</option>
                  {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m,i) => <option key={i} value={i.toString()}>{m}</option>)}
                </select>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase text-on-surface-variant mb-1 font-bold">Year</span>
                <select value={filterYear} onChange={e => {setFilterYear(e.target.value); setFilterDate('')}} className="bg-surface-container-low border border-outline/20 rounded-lg py-2 px-2 text-sm focus:outline-none">
                  <option value="all">Any</option>
                  {uniqueYears.map(y => <option key={y} value={y.toString()}>{y}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===== DESKTOP: Unified filter bar ===== */}
      <section className="hidden md:block mb-8" data-onboarding="history-filters">
        <div className="bg-surface-container-lowest rounded-2xl border border-outline/5 overflow-hidden">
          {/* Top row: Search + Primary filters */}
          <div className="p-5 flex items-center gap-4">
            <div className="relative flex-1 max-w-xs">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span>
              <input 
                type="text" 
                placeholder="Search transactions..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-surface-container-low border border-outline/20 rounded-lg py-2.5 pl-10 pr-4 text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
              />
            </div>
            <div className="flex items-center gap-2 flex-1">
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="bg-surface-container-low border border-outline/20 rounded-lg py-2.5 px-3 text-sm focus:outline-none text-on-surface hover:border-outline/40 transition-colors cursor-pointer">
                <option value="all">All Types</option>
                <option value="expense">Expenses</option>
                <option value="income">Income</option>
                <option value="trade">Trades (Buy/Sell)</option>
              </select>
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="bg-surface-container-low border border-outline/20 rounded-lg py-2.5 px-3 text-sm focus:outline-none text-on-surface hover:border-outline/40 transition-colors cursor-pointer">
                <option value="all">All Categories</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="bg-surface-container-low border border-outline/20 rounded-lg py-2.5 px-3 text-sm focus:outline-none text-on-surface hover:border-outline/40 transition-colors cursor-pointer">
                <option value="latest">Latest First</option>
                <option value="oldest">Oldest First</option>
                <option value="highest">Highest Amount</option>
                <option value="lowest">Lowest Amount</option>
              </select>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-outline/5 mx-5" />

          {/* Bottom row: Date filters */}
          <div className="px-5 py-3 flex items-center gap-4">
            <span className="text-[10px] uppercase text-on-surface-variant font-bold tracking-widest shrink-0">Date Filter</span>
            <div className="flex items-center gap-3 flex-1">
              <input type="date" value={filterDate} onChange={e => {setFilterDate(e.target.value); setFilterMonth('all'); setFilterYear('all')}} className="bg-surface-container-low border border-outline/20 rounded-lg py-1.5 px-3 text-sm focus:outline-none text-on-surface hover:border-outline/40 transition-colors cursor-pointer" />
              <span className="text-[10px] text-on-surface-variant/50">or</span>
              <select value={filterMonth} onChange={e => {setFilterMonth(e.target.value); setFilterDate('')}} className="bg-surface-container-low border border-outline/20 rounded-lg py-1.5 px-3 text-sm focus:outline-none text-on-surface hover:border-outline/40 transition-colors cursor-pointer">
                <option value="all">Any Month</option>
                {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m,i) => <option key={i} value={i.toString()}>{m}</option>)}
              </select>
              <select value={filterYear} onChange={e => {setFilterYear(e.target.value); setFilterDate('')}} className="bg-surface-container-low border border-outline/20 rounded-lg py-1.5 px-3 text-sm focus:outline-none text-on-surface hover:border-outline/40 transition-colors cursor-pointer">
                <option value="all">Any Year</option>
                {uniqueYears.map(y => <option key={y} value={y.toString()}>{y}</option>)}
              </select>
            </div>
            {(filterDate || filterMonth !== 'all' || filterYear !== 'all') && (
              <button 
                onClick={() => {setFilterDate(''); setFilterMonth('all'); setFilterYear('all')}}
                className="text-xs text-error font-bold hover:underline shrink-0"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
        <div className="lg:col-span-8 flex flex-col gap-6" data-onboarding="history-list">
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
                 let cat = getCategory(t.categoryId);
                 if (t.type === 'buy_investment' || t.type === 'sell_investment') {
                    cat = { color: '#95CD41', icon: 'monitoring', name: 'Trade Executed' }
                 }

                 return (
                  <div key={t.id} onClick={() => {
                     if (t.type === 'buy_investment' || t.type === 'sell_investment') {
                        const inv = investments.find(i => i.id === t.investmentId);
                        if (inv) setTradeModal({ isOpen: true, data: t, investment: inv });
                     } else {
                        setEditModal({ isOpen: true, data: t });
                     }
                  }} className="group cursor-pointer bg-surface-container-low hover:bg-surface-container-high hover:scale-[1.01] transition-all rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-transparent hover:border-primary/20">
                    <div className="flex items-center gap-4">
                      <div className="min-w-[3rem] h-12 flex-shrink-0 rounded-2xl flex items-center justify-center" style={{ backgroundColor: cat?.color || '#3D332B', color: getContrastingColor(cat?.color || '#3D332B') }}>
                        <span className="material-symbols-outlined">{cat?.icon || 'receipt'}</span>
                      </div>
                      <div>
                        <h4 className="font-headline font-bold text-on-surface">{t.title}</h4>
                        <p className="text-xs text-outline font-medium">{cat?.name || 'Uncategorized'} • {new Date(t.date).toLocaleDateString('en-IN')}</p>
                        {t.notes && <p className="text-xs text-on-surface-variant mt-1 italic">"{t.notes}"</p>}
                      </div>
                    </div>
                      <div className="text-left md:text-right mt-2 md:mt-0 flex flex-col items-end">
                        <span className={`block whitespace-nowrap font-headline font-extrabold text-lg ${(t.type === 'expense' || t.type === 'buy_investment') ? 'text-on-surface' : 'text-[#95CD41]'}`}>
                          {(t.type === 'expense' || t.type === 'buy_investment') ? '-' : '+'}{formatCurrency(t.amount)}
                        </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-outline group-hover:text-primary transition-colors flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100">
                         Edit <span className="material-symbols-outlined text-[10px]">edit</span>
                      </span>
                    </div>
                  </div>
                 )
               })
            )}
          </div>
        </div>
      </section>

      <Modal isOpen={editModal.isOpen} onClose={() => setEditModal({ isOpen: false, data: null})} title="Edit Transaction">
        <AddTransactionForm initialData={editModal.data} onClose={() => setEditModal({isOpen: false, data: null})} />
      </Modal>

      <Modal isOpen={tradeModal.isOpen} onClose={() => setTradeModal({isOpen: false, data: null})} title="Edit Trade">
         {tradeModal.data && <InvestmentTradeForm initialTradeData={tradeModal.data} investment={tradeModal.investment} onClose={() => setTradeModal({isOpen: false, data: null})} />}
      </Modal>

      <FeatureTour section="history" />

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </main>
  );
};

export default TransactionsScreen;
