import React, { useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { formatCurrency } from '../utils/currency';
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const tooltipStyle = {
  contentStyle: { backgroundColor: '#1a140e', border: '1px solid rgba(241, 223, 211, 0.1)', borderRadius: '12px', color: '#f1dfd3', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)' },
  itemStyle: { color: '#f1dfd3' },
  labelStyle: { color: '#f1dfd3', fontWeight: 'bold', marginBottom: '4px' },
};

const tooltipStyleMobile = {
  contentStyle: { ...tooltipStyle.contentStyle, borderRadius: '10px', fontSize: '12px' },
  itemStyle: tooltipStyle.itemStyle,
  labelStyle: tooltipStyle.labelStyle,
};

const AnalyticsScreen = () => {
  const { transactions, categories, investments, subscriptions, monthlySpent, totalPortfolioValue, totalInvested, totalBalance } = useAppContext();

  const { pieData, barData, savingsData, portfolioAllocation, topExpenses, summaryStats } = useMemo(() => {
    // 1. Expense by category (existing)
    const expenseData = transactions.filter(t => t.type === 'expense');
    const categoryTotals = {};
    expenseData.forEach(t => {
      categoryTotals[t.categoryId] = (categoryTotals[t.categoryId] || 0) + t.amount;
    });
    const parsedPieData = Object.keys(categoryTotals).map(catId => {
      const cat = categories.find(c => c.id === catId);
      return { name: cat ? cat.name : 'Unknown', value: categoryTotals[catId], color: cat ? cat.color : '#3D332B' };
    }).sort((a,b) => b.value - a.value);

    // 2. Monthly income vs expense (existing)
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const monthlyAggregate = {};
    const currentMonth = new Date().getMonth();
    for(let i=5; i>=0; i--) {
       let mIndex = currentMonth - i;
       if (mIndex < 0) mIndex += 12;
       monthlyAggregate[months[mIndex]] = { name: months[mIndex], Income: 0, Expense: 0, Savings: 0 };
    }
    transactions.forEach(t => {
      const date = new Date(t.date);
      const mName = months[date.getMonth()];
      if (monthlyAggregate[mName]) {
        if (t.type === 'income') monthlyAggregate[mName].Income += t.amount;
        if (t.type === 'expense') monthlyAggregate[mName].Expense += t.amount;
      }
    });
    const barValues = Object.values(monthlyAggregate);

    // 3. Net savings trend (income - expense per month)
    const savingsValues = barValues.map(m => ({ name: m.name, Savings: m.Income - m.Expense }));

    // 4. Portfolio allocation by investment type
    const typeMap = {};
    const typeColors = { 'Stock': '#E5BA73', 'Mutual Fund': '#95CD41', 'Crypto': '#7C6BFF', 'FD': '#FF8A65', 'Other': '#9a8f80' };
    investments.forEach(inv => {
      const val = inv.shares * inv.currentPrice;
      if (val > 0) {
        typeMap[inv.type] = (typeMap[inv.type] || 0) + val;
      }
    });
    const portfolioData = Object.entries(typeMap).map(([type, value]) => ({
      name: type === 'Mutual Fund' ? 'MF' : type,
      fullName: type,
      value,
      color: typeColors[type] || '#9a8f80'
    })).sort((a,b) => b.value - a.value);

    // 5. Top 5 individual expenses this month
    const thisMonth = new Date().getMonth();
    const thisYear = new Date().getFullYear();
    const topExp = transactions
      .filter(t => t.type === 'expense' && new Date(t.date).getMonth() === thisMonth && new Date(t.date).getFullYear() === thisYear)
      .sort((a,b) => b.amount - a.amount)
      .slice(0, 5);

    // 6. Summary stats
    const totalIncome = transactions.filter(t => t.type === 'income').reduce((a,c) => a + c.amount, 0);
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((a,c) => a + c.amount, 0);
    const recurringMonthly = subscriptions.filter(s => s.isActive).reduce((a,c) => a + c.amount, 0);

    return {
      pieData: parsedPieData,
      barData: barValues,
      savingsData: savingsValues,
      portfolioAllocation: portfolioData,
      topExpenses: topExp,
      summaryStats: { totalIncome, totalExpense, recurringMonthly, netWorth: totalBalance + totalPortfolioValue }
    };
  }, [transactions, categories, investments, subscriptions, totalBalance, totalPortfolioValue]);

  return (
    <main className="pt-24 pb-32 px-6 max-w-7xl mx-auto min-h-screen max-md:px-4 max-md:pb-28">
      {/* Desktop header */}
      <section className="mb-12 hidden md:block">
        <p className="font-label text-[10px] uppercase tracking-widest text-[#F1DFD3]/60 mb-2">Financial Performance</p>
        <h2 className="font-headline font-bold text-4xl md:text-5xl text-on-surface tracking-tight">Trends & Insights</h2>
      </section>
      {/* Mobile header */}
      <section className="mb-6 md:hidden">
        <p className="font-label text-[10px] uppercase tracking-widest text-[#F1DFD3]/60 mb-1">Financial Performance</p>
        <h2 className="font-headline font-bold text-2xl text-on-surface tracking-tight">Trends & Insights</h2>
      </section>

      {/* ===== SUMMARY STATS ROW ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 max-md:mb-4">
        {[
          { label: 'Net Worth', value: summaryStats.netWorth, color: 'text-primary' },
          { label: 'Total Income', value: summaryStats.totalIncome, color: 'text-[#95CD41]' },
          { label: 'Total Expenses', value: summaryStats.totalExpense, color: 'text-error' },
          { label: 'Recurring/mo', value: summaryStats.recurringMonthly, color: 'text-[#E5BA73]' },
        ].map((stat, i) => (
          <div key={i} className="bg-surface-container-low rounded-lg p-4 md:p-5 border border-outline/5">
            <span className="text-[9px] md:text-[10px] uppercase text-on-surface-variant font-bold tracking-widest block mb-1">{stat.label}</span>
            <span className={`text-lg md:text-xl font-headline font-extrabold ${stat.color}`}>{formatCurrency(stat.value)}</span>
          </div>
        ))}
      </div>

      {/* ===== ROW 1: Spending Pie + Income vs Expense Bar ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 max-md:gap-4">

        {/* Spending pie - Desktop */}
        <div className="hidden md:block bg-surface-container-low rounded-lg p-8 shadow-sm">
          <div className="flex justify-between items-start mb-8">
            <h3 className="font-headline font-semibold text-lg text-on-surface">Monthly Spending Velocity</h3>
            <span className="text-3xl font-headline font-extrabold text-primary">{formatCurrency(monthlySpent)}</span>
          </div>
          {pieData.length === 0 ? (
             <div className="h-[250px] flex items-center justify-center text-outline">No expense data yet</div>
          ) : (
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie><Tooltip formatter={(v) => formatCurrency(v)} {...tooltipStyle} /></PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="mt-6 space-y-3">
            {pieData.slice(0, 4).map((e, i) => (
              <div key={i} className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{backgroundColor: e.color}} /><span className="text-on-surface-variant">{e.name}</span></div>
                <span className="font-bold">{formatCurrency(e.value)}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Spending pie - Mobile */}
        <div className="md:hidden bg-surface-container-low rounded-lg p-4 shadow-sm">
          <div className="flex flex-col gap-1 mb-4">
            <h3 className="font-headline font-semibold text-sm text-on-surface">Monthly Spending</h3>
            <span className="text-2xl font-headline font-extrabold text-primary">{formatCurrency(monthlySpent)}</span>
          </div>
          {pieData.length === 0 ? (
             <div className="h-[180px] flex items-center justify-center text-outline text-sm">No expense data yet</div>
          ) : (
            <div className="h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={4} dataKey="value">
                  {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie><Tooltip formatter={(v) => formatCurrency(v)} {...tooltipStyleMobile} /></PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="mt-4 space-y-2.5">
            {pieData.slice(0, 4).map((e, i) => (
              <div key={i} className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-2 min-w-0"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{backgroundColor: e.color}} /><span className="text-on-surface-variant truncate">{e.name}</span></div>
                <span className="font-bold shrink-0 ml-2">{formatCurrency(e.value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Income vs Expense bar - Desktop */}
        <div className="hidden md:flex bg-surface-container-low rounded-lg p-8 shadow-sm flex-col">
          <h3 className="font-headline font-semibold text-lg text-on-surface mb-8">Income vs Expense</h3>
          <div className="flex-grow min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#4e4539" vertical={false} />
                <XAxis dataKey="name" stroke="#9a8f80" axisLine={false} tickLine={false} />
                <YAxis stroke="#9a8f80" axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v / 1000}k`} />
                <Tooltip formatter={(v) => formatCurrency(v)} {...tooltipStyle} cursor={{ fill: 'rgba(229, 186, 115, 0.05)' }} />
                <Bar dataKey="Income" fill="#95CD41" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Expense" fill="#E5BA73" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        {/* Income vs Expense bar - Mobile */}
        <div className="md:hidden bg-surface-container-low rounded-lg p-4 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-headline font-semibold text-sm text-on-surface">Income vs Expense</h3>
            <div className="flex gap-3 text-[10px] font-bold">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#95CD41]" /> Income</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#E5BA73]" /> Expense</span>
            </div>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#4e4539" vertical={false} />
                <XAxis dataKey="name" stroke="#9a8f80" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                <YAxis stroke="#9a8f80" axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} tick={{ fontSize: 10 }} width={30} />
                <Tooltip formatter={(v) => formatCurrency(v)} {...tooltipStyleMobile} cursor={{ fill: 'rgba(229, 186, 115, 0.05)' }} />
                <Bar dataKey="Income" fill="#95CD41" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Expense" fill="#E5BA73" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ===== ROW 2: Net Savings Trend + Portfolio Allocation ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 max-md:gap-4">

        {/* Net Savings Trend - Desktop */}
        <div className="hidden md:flex bg-surface-container-low rounded-lg p-8 shadow-sm flex-col">
          <h3 className="font-headline font-semibold text-lg text-on-surface mb-8">Net Savings Trend</h3>
          <div className="flex-grow min-h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={savingsData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="savingsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#95CD41" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#95CD41" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#4e4539" vertical={false} />
                <XAxis dataKey="name" stroke="#9a8f80" axisLine={false} tickLine={false} />
                <YAxis stroke="#9a8f80" axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v / 1000}k`} />
                <Tooltip formatter={(v) => formatCurrency(v)} {...tooltipStyle} />
                <Area type="monotone" dataKey="Savings" stroke="#95CD41" strokeWidth={2} fill="url(#savingsGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        {/* Net Savings Trend - Mobile */}
        <div className="md:hidden bg-surface-container-low rounded-lg p-4 shadow-sm flex flex-col">
          <h3 className="font-headline font-semibold text-sm text-on-surface mb-4">Net Savings Trend</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={savingsData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="savingsGradM" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#95CD41" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#95CD41" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#4e4539" vertical={false} />
                <XAxis dataKey="name" stroke="#9a8f80" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                <YAxis stroke="#9a8f80" axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} tick={{ fontSize: 10 }} width={30} />
                <Tooltip formatter={(v) => formatCurrency(v)} {...tooltipStyleMobile} />
                <Area type="monotone" dataKey="Savings" stroke="#95CD41" strokeWidth={2} fill="url(#savingsGradM)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Portfolio Allocation - Desktop */}
        <div className="hidden md:block bg-surface-container-low rounded-lg p-8 shadow-sm">
          <div className="flex justify-between items-start mb-8">
            <h3 className="font-headline font-semibold text-lg text-on-surface">Portfolio Allocation</h3>
            <span className="text-2xl font-headline font-extrabold text-primary">{formatCurrency(totalPortfolioValue)}</span>
          </div>
          {portfolioAllocation.length === 0 ? (
            <div className="h-[250px] flex items-center justify-center text-outline">No investments yet</div>
          ) : (
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={portfolioAllocation} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {portfolioAllocation.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie><Tooltip formatter={(v) => formatCurrency(v)} {...tooltipStyle} /></PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="mt-6 space-y-3">
            {portfolioAllocation.map((e, i) => (
              <div key={i} className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{backgroundColor: e.color}} /><span className="text-on-surface-variant">{e.fullName}</span></div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-on-surface-variant">{totalPortfolioValue > 0 ? ((e.value / totalPortfolioValue) * 100).toFixed(1) : 0}%</span>
                  <span className="font-bold">{formatCurrency(e.value)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Portfolio Allocation - Mobile */}
        <div className="md:hidden bg-surface-container-low rounded-lg p-4 shadow-sm">
          <div className="flex flex-col gap-1 mb-4">
            <h3 className="font-headline font-semibold text-sm text-on-surface">Portfolio Allocation</h3>
            <span className="text-xl font-headline font-extrabold text-primary">{formatCurrency(totalPortfolioValue)}</span>
          </div>
          {portfolioAllocation.length === 0 ? (
            <div className="h-[160px] flex items-center justify-center text-outline text-sm">No investments yet</div>
          ) : (
            <div className="h-[160px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={portfolioAllocation} cx="50%" cy="50%" innerRadius={40} outerRadius={58} paddingAngle={4} dataKey="value">
                  {portfolioAllocation.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie><Tooltip formatter={(v) => formatCurrency(v)} {...tooltipStyleMobile} /></PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="mt-3 space-y-2">
            {portfolioAllocation.map((e, i) => (
              <div key={i} className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-2 min-w-0"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{backgroundColor: e.color}} /><span className="text-on-surface-variant truncate">{e.fullName}</span></div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-[10px] text-on-surface-variant">{totalPortfolioValue > 0 ? ((e.value / totalPortfolioValue) * 100).toFixed(0) : 0}%</span>
                  <span className="font-bold">{formatCurrency(e.value)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== ROW 3: Top Expenses This Month ===== */}
      <div className="bg-surface-container-low rounded-lg p-8 max-md:p-4 shadow-sm mb-6">
        <h3 className="font-headline font-semibold text-lg max-md:text-sm text-on-surface mb-6 max-md:mb-4">Top Expenses This Month</h3>
        {topExpenses.length === 0 ? (
          <p className="text-outline text-sm max-md:text-xs py-6 text-center">No expenses recorded this month.</p>
        ) : (
          <div className="flex flex-col gap-3 max-md:gap-2">
            {topExpenses.map((t, i) => {
              const cat = categories.find(c => c.id === t.categoryId);
              const maxAmount = topExpenses[0]?.amount || 1;
              const pct = (t.amount / maxAmount) * 100;
              return (
                <div key={t.id} className="flex items-center gap-4 max-md:gap-3">
                  <span className="text-on-surface-variant font-bold text-sm max-md:text-xs w-5 shrink-0">#{i+1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm max-md:text-xs font-bold text-on-surface truncate">{t.title}</span>
                      <span className="text-sm max-md:text-xs font-extrabold text-on-surface shrink-0 ml-2">{formatCurrency(t.amount)}</span>
                    </div>
                    <div className="w-full h-1.5 max-md:h-1 bg-surface-container-highest rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-[#E5BA73] transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] max-md:text-[9px] text-on-surface-variant mt-0.5 block">{cat?.name || 'Uncategorized'} · {new Date(t.date).toLocaleDateString('en-IN')}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
};

export default AnalyticsScreen;
