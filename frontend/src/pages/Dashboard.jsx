import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import Modal from '../components/ui/Modal';
import AddTransactionForm from '../components/forms/AddTransactionForm';
import FeatureTour from '../components/ui/FeatureTour';
import BalanceHero from '../components/dashboard/BalanceHero';
import SpendingBreakdown from '../components/dashboard/SpendingBreakdown';
import RecentActivity from '../components/dashboard/RecentActivity';
import PortfolioSnapshot from '../components/dashboard/PortfolioSnapshot';
import UpcomingBills from '../components/dashboard/UpcomingBills';

// Cycles a recurring start date forward to the next upcoming occurrence.
const getNextCycleDate = (startDate, periodString) => {
  if (!startDate) return null;
  const d = new Date(startDate);
  if (isNaN(d.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const period = (periodString || '').toLowerCase();
  if (period === 'one_time' || period === 'onetime') return d;

  let maxIterations = 1000; // Safeguard against infinite loops
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

const UNCATEGORIZED = { name: 'Uncategorized', color: '#3D332B', icon: 'receipt' };

const DashboardScreen = () => {
  const {
    totalBalance, monthlySpent, totalPortfolioValue, totalRealizedProfit, totalUnrealizedProfit,
    transactions, categories, subscriptions, creditCards,
  } = useAppContext();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const navigate = useNavigate();

  const { categorySpending, monthIncome } = useMemo(() => {
    const now = new Date();
    const thisMonth = transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const expenses = thisMonth.filter(t => t.type === 'expense');
    const spending = categories
      .map(cat => ({ ...cat, spent: expenses.filter(t => t.categoryId === cat.id).reduce((s, t) => s + t.amount, 0) }))
      .filter(cat => cat.spent > 0)
      .sort((a, b) => b.spent - a.spent);
    const income = thisMonth.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    return { categorySpending: spending, monthIncome: income };
  }, [transactions, categories]);

  const recentTransactions = useMemo(
    () => [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5),
    [transactions]
  );

  const upcomingBills = useMemo(() => {
    const bills = [];
    subscriptions.filter(s => s.isActive).forEach(sub => {
      const targetDate = sub.period === 'one_time'
        ? (sub.expiryDate ? new Date(sub.expiryDate) : null)
        : getNextCycleDate(sub.startDate, sub.period);
      if (!targetDate || isNaN(targetDate.getTime())) return;
      bills.push({ id: `sub-${sub.id}`, title: sub.name, amount: sub.amount, date: targetDate, icon: 'event_repeat', color: '#95CD41' });
    });
    creditCards.forEach(cc => {
      if (!cc.billDueDate) return;
      bills.push({ id: `cc-${cc.id}`, title: cc.name, amount: 'Pending', date: new Date(cc.billDueDate), icon: 'credit_card', color: '#E5BA73' });
    });
    return bills.sort((a, b) => a.date - b.date).slice(0, 4);
  }, [subscriptions, creditCards]);

  const getCategory = (id) => categories.find(c => c.id === id) || UNCATEGORIZED;
  const openAdd = () => setIsAddOpen(true);

  return (
    <main className="pt-20 md:pt-24 px-4 sm:px-6 lg:px-10 pb-28 md:pb-12 max-w-7xl mx-auto w-full">
      <BalanceHero
        balance={totalBalance}
        monthIncome={monthIncome}
        monthSpent={monthlySpent}
        onQuickAdd={() => navigate('/voice')}
        onAdd={openAdd}
      />

      {/* Mobile: one column ordered by urgency (bills, spending, activity, portfolio).
          Desktop: the column wrappers become a 8/4 two-column layout. */}
      <div className="flex flex-col gap-9 md:grid md:grid-cols-12 md:gap-6 md:items-start">
        <div className="contents md:flex md:flex-col md:gap-6 md:col-span-7 lg:col-span-8">
          <SpendingBreakdown className="order-2" categories={categorySpending} total={monthlySpent} />
          <RecentActivity className="order-3" transactions={recentTransactions} getCategory={getCategory} onAdd={openAdd} />
        </div>
        <div className="contents md:flex md:flex-col md:gap-6 md:col-span-5 lg:col-span-4">
          <UpcomingBills className="order-1" bills={upcomingBills} />
          <PortfolioSnapshot className="order-4" value={totalPortfolioValue} unrealized={totalUnrealizedProfit} realized={totalRealizedProfit} />
        </div>
      </div>

      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="New transaction">
        <AddTransactionForm onClose={() => setIsAddOpen(false)} />
      </Modal>

      <FeatureTour section="dashboard" />
    </main>
  );
};

export default DashboardScreen;
