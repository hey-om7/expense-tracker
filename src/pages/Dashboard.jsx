import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { formatCurrency } from '../utils/currency';
import { getContrastingColor } from '../utils/colorUtils'; // Make sure this file exists from previous screens!
import Modal from '../components/ui/Modal';
import AddTransactionForm from '../components/forms/AddTransactionForm';
import FeatureTour from '../components/ui/FeatureTour';

// Helper function to cycle recurring dates forward to the next upcoming cycle
const getNextCycleDate = (startDate, periodString) => {
  if (!startDate) return null;
  const d = new Date(startDate);
  if (isNaN(d.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const period = (periodString || '').toLowerCase();
  if (period === 'one_time' || period === 'onetime') return d;

  let maxIterations = 1000; // Safeguard against infinite loops
  // Increment the date until it is today or in the future
  while (d < today && maxIterations > 0) {
    if (period === 'monthly') d.setMonth(d.getMonth() + 1);
    else if (period === 'yearly' || period === 'annually') d.setFullYear(d.getFullYear() + 1);
    else if (period === 'weekly') d.setDate(d.getDate() + 7);
    else if (period === 'daily') d.setDate(d.getDate() + 1);
    else if (period === 'quarterly') d.setMonth(d.getMonth() + 3);
    else break; 
    maxIterations--;
  }
  return d;
};

const DashboardScreen = () => {
  const { 
    totalBalance, monthlySpent, totalPortfolioValue, totalRealizedProfit, totalUnrealizedProfit,
    transactions, categories, subscriptions, creditCards 
  } = useAppContext();
  
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

  // --- WIDGET LOGIC 1: Category Spending (Current Month) ---
  const categorySpending = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const monthlyExpenses = transactions.filter(t => 
      t.type === 'expense' && 
      new Date(t.date).getMonth() === currentMonth && 
      new Date(t.date).getFullYear() === currentYear
    );

    const spending = categories.map(cat => {
      const spent = monthlyExpenses.filter(t => t.categoryId === cat.id).reduce((sum, t) => sum + t.amount, 0);
      return { ...cat, spent };
    }).filter(cat => cat.spent > 0).sort((a, b) => b.spent - a.spent);

    // Calculate max to scale the progress bars proportionally
    const maxSpend = spending.length > 0 ? Math.max(...spending.map(c => c.spent)) : 1;
    return { data: spending, maxSpend };
  }, [transactions, categories]);

  // --- WIDGET LOGIC 2: Recent Transactions ---
  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5); // Grab only the latest 5
  }, [transactions]);

  // --- WIDGET LOGIC 3: Upcoming Bills ---
  const upcomingBills = useMemo(() => {
    let bills = [];

    // Add Active Subscriptions
    subscriptions.filter(s => s.isActive).forEach(sub => {
      let targetDate;
      if (sub.period === 'one_time') {
        targetDate = sub.expiryDate ? new Date(sub.expiryDate) : null;
      } else {
        targetDate = getNextCycleDate(sub.startDate, sub.period);
      }

      if (!targetDate || isNaN(targetDate.getTime())) return;
      bills.push({ id: `sub-${sub.id}`, title: sub.name, amount: sub.amount, date: targetDate, type: 'Subscription', icon: 'event_repeat', color: '#95CD41' });
    });

    // Add Credit Cards
    creditCards.forEach(cc => {
      if (!cc.billDueDate) return;
      const d = new Date(cc.billDueDate);
      bills.push({ id: `cc-${cc.id}`, title: cc.name, amount: 'Pending', date: d, type: 'Credit Card', icon: 'credit_card', color: '#E5BA73' });
    });

    // Sort by closest date first and take top 4
    return bills.sort((a, b) => a.date - b.date).slice(0, 4);
  }, [subscriptions, creditCards]);

  // Helper to find category info safely
  const getCategoryInfo = (id) => categories.find(c => c.id === id) || { name: 'Uncategorized', color: '#3D332B', icon: 'receipt' };

  return (
    <main className="pt-24 px-6 pb-12 max-w-7xl mx-auto w-full max-md:pb-28 max-md:px-4 max-md:min-h-screen">
      
      {/* Header Section */}
      <section className="mb-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 max-md:gap-4">
          <div className="min-w-0" data-onboarding="dashboard-balance">
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#F1DFD3]/40 font-semibold mb-2 block">Available Liquidity</span>
            <h2 className="hidden md:block text-5xl md:text-7xl font-manrope font-extrabold text-on-surface tracking-tighter">
              {formatCurrency(totalBalance)}
            </h2>
            <h2 className={`md:hidden font-manrope font-extrabold text-on-surface tracking-tighter ${
              formatCurrency(totalBalance).length > 14 ? 'text-2xl' : formatCurrency(totalBalance).length > 10 ? 'text-3xl' : 'text-4xl'
            }`}>
              {formatCurrency(totalBalance)}
            </h2>
          </div>
          <div className="flex gap-3 max-md:gap-2" data-onboarding="dashboard-actions">
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
        
        {/* LEFT COLUMN: Spending & Transactions */}
        <div className="md:col-span-8 flex flex-col gap-6 max-md:gap-4">
          
          {/* Spending Widget */}
          <div className="bg-surface-container-low border border-outline/10 rounded-2xl p-6 md:p-8">
            <div className="flex justify-between items-end mb-6">
              <div>
                <h3 className="font-manrope font-bold text-lg text-on-surface">Monthly Spending</h3>
                <p className="text-xs text-on-surface-variant mt-1">Where your money went this month</p>
              </div>
              <div className="text-right">
                <span className="block font-headline font-extrabold text-2xl text-error">{formatCurrency(monthlySpent)}</span>
              </div>
            </div>

            {categorySpending.data.length === 0 ? (
               <p className="text-outline text-sm italic text-center py-6">No expenses recorded this month.</p>
            ) : (
               <div className="flex flex-col gap-4 mt-4">
                 {categorySpending.data.map(cat => (
                   <div key={cat.id} className="flex flex-col gap-1.5">
                     <div className="flex justify-between text-xs font-bold">
                       <span className="flex items-center gap-1.5 text-on-surface">
                         <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }}></span>
                         {cat.name}
                       </span>
                       <span className="text-on-surface-variant">{formatCurrency(cat.spent)}</span>
                     </div>
                     {/* Custom Tailwind Progress Bar */}
                     <div className="w-full bg-surface-container-highest rounded-full h-2 overflow-hidden">
                       <div 
                         className="h-full rounded-full transition-all duration-1000 ease-out" 
                         style={{ width: `${(cat.spent / categorySpending.maxSpend) * 100}%`, backgroundColor: cat.color }}
                       ></div>
                     </div>
                   </div>
                 ))}
               </div>
            )}
          </div>

          {/* Recent Activity Widget */}
          <div className="bg-surface-container-low border border-outline/10 rounded-2xl p-6 md:p-8">
             <div className="flex justify-between items-center mb-6">
                <h3 className="font-manrope font-bold text-lg text-on-surface">Recent Activity</h3>
                <span className="text-xs font-bold text-primary cursor-pointer hover:underline">View All</span>
             </div>
             
             {recentTransactions.length === 0 ? (
                <p className="text-outline text-sm italic text-center py-6">No transactions yet.</p>
             ) : (
                <div className="flex flex-col gap-3">
                  {recentTransactions.map(t => {
                    const cat = getCategoryInfo(t.categoryId);
                    const isExpense = t.type === 'expense' || t.type === 'buy_investment';
                    
                    return (
                      <div key={t.id} className="flex items-center justify-between p-3 bg-surface-container-highest/30 rounded-xl hover:bg-surface-container-highest transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: cat.color, color: getContrastingColor(cat.color) }}>
                            <span className="material-symbols-outlined text-[20px]">{cat.icon}</span>
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-sm text-on-surface truncate pr-2">{t.title}</h4>
                            <p className="text-[10px] text-on-surface-variant">{new Date(t.date).toLocaleDateString('en-IN')}</p>
                          </div>
                        </div>
                        <div className={`font-headline font-bold text-sm shrink-0 ${isExpense ? 'text-on-surface' : 'text-[#95CD41]'}`}>
                          {isExpense ? '-' : '+'}{formatCurrency(t.amount)}
                        </div>
                      </div>
                    )
                  })}
                </div>
             )}
          </div>
        </div>

        {/* RIGHT COLUMN: Portfolio & Bills */}
        <div className="md:col-span-4 flex flex-col gap-6 max-md:gap-4">
          
          {/* Portfolio Summary (Refined UI) */}
          <div className="bg-surface-container-lowest border border-outline/10 rounded-2xl p-6 md:p-8 relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl rounded-full"></div>
             <h3 className="font-manrope font-bold text-sm uppercase tracking-widest text-on-surface-variant mb-6 relative z-10">Portfolio Overview</h3>
             
             <div className="flex flex-col gap-4 relative z-10">
               <div>
                  <span className="block text-xs font-medium text-outline mb-1">Total Value</span>
                  <span className="block font-headline font-extrabold text-3xl text-primary">{formatCurrency(totalPortfolioValue)}</span>
               </div>
               
               <div className="flex justify-between items-center bg-surface-container-low p-3 rounded-xl border border-outline/5 mt-2">
                  <span className="text-xs font-medium text-on-surface-variant">Unrealized P/L</span>
                  <span className={`text-sm font-bold ${totalUnrealizedProfit >= 0 ? 'text-[#95CD41]' : 'text-error'}`}>
                     {totalUnrealizedProfit >= 0 ? '+' : ''}{formatCurrency(totalUnrealizedProfit)}
                  </span>
               </div>
               
               <div className="flex justify-between items-center bg-surface-container-low p-3 rounded-xl border border-outline/5">
                  <span className="text-xs font-medium text-on-surface-variant">Realized (Cash)</span>
                  <span className={`text-sm font-bold ${totalRealizedProfit >= 0 ? 'text-[#95CD41]' : 'text-error'}`}>
                     {totalRealizedProfit >= 0 ? '+' : ''}{formatCurrency(totalRealizedProfit)}
                  </span>
               </div>
             </div>
          </div>

          {/* Upcoming Bills Widget */}
          <div className="bg-surface-container-low border border-outline/10 rounded-2xl p-6 md:p-8">
             <div className="flex items-center gap-2 mb-6">
                <span className="material-symbols-outlined text-error-container text-xl">calendar_clock</span>
                <h3 className="font-manrope font-bold text-base text-on-surface">Upcoming Bills</h3>
             </div>

             {upcomingBills.length === 0 ? (
               <p className="text-outline text-sm italic">No upcoming bills detected.</p>
             ) : (
               <div className="flex flex-col gap-4">
                 {upcomingBills.map((bill, idx) => {
                   // Calculate days left
                   const today = new Date();
                   today.setHours(0,0,0,0);
                   const daysLeft = Math.ceil((bill.date - today) / (1000 * 60 * 60 * 24));
                   
                   // Dynamic Text & Styling based on days
                   let statusText = '';
                   let textClass = 'text-on-surface-variant';
                   
                   if (daysLeft < 0) {
                     statusText = `Overdue by ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''}`;
                     textClass = 'text-error'; // Solid red for overdue
                   } else if (daysLeft === 0) {
                     statusText = 'Due Today';
                     textClass = 'text-error animate-pulse'; // Flashing red for today
                   } else if (daysLeft === 1) {
                     statusText = 'Due Tomorrow';
                     textClass = 'text-error animate-pulse'; // Flashing red for tomorrow
                   } else {
                     statusText = `Due in ${daysLeft} days`;
                     textClass = daysLeft <= 3 ? 'text-error animate-pulse' : 'text-on-surface-variant'; // Normal text unless due in <= 3 days
                   }

                   return (
                     <div key={`${bill.id}-${idx}`} className="flex justify-between items-center pb-4 border-b border-outline/10 last:border-0 last:pb-0">
                       <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded bg-surface-container-highest flex items-center justify-center shrink-0" style={{ color: bill.color }}>
                            <span className="material-symbols-outlined text-[16px]">{bill.icon}</span>
                         </div>
                         <div>
                           <p className="text-sm font-bold text-on-surface">{bill.title}</p>
                           <p className={`text-[10px] font-bold mt-0.5 ${textClass}`}>
                             {statusText}
                           </p>
                         </div>
                       </div>
                       <span className="text-xs font-bold text-on-surface">
                         {typeof bill.amount === 'number' ? formatCurrency(bill.amount) : bill.amount}
                       </span>
                     </div>
                   );
                 })}
               </div>
             )}
          </div>

        </div>
      </div>

      <Modal isOpen={isQuickAddOpen} onClose={() => setIsQuickAddOpen(false)} title="New Transaction">
        <AddTransactionForm onClose={() => setIsQuickAddOpen(false)} />
      </Modal>

      <FeatureTour section="dashboard" />
    </main>
  );
};

export default DashboardScreen;