import React, { useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { formatCurrency } from '../utils/currency';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const AnalyticsScreen = () => {
  const { transactions, categories, monthlySpent } = useAppContext();

  const { pieData, barData } = useMemo(() => {
    const expenseData = transactions.filter(t => t.type === 'expense');
    const categoryTotals = {};
    expenseData.forEach(t => {
      categoryTotals[t.categoryId] = (categoryTotals[t.categoryId] || 0) + t.amount;
    });

    const parsedPieData = Object.keys(categoryTotals).map(catId => {
      const cat = categories.find(c => c.id === catId);
      return {
        name: cat ? cat.name : 'Unknown',
        value: categoryTotals[catId],
        color: cat ? cat.color : '#3D332B'
      };
    }).sort((a,b) => b.value - a.value);

    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const monthlyAggregate = {};
    const currentMonth = new Date().getMonth();
    for(let i=5; i>=0; i--) {
       let mIndex = currentMonth - i;
       if (mIndex < 0) mIndex += 12;
       monthlyAggregate[months[mIndex]] = { name: months[mIndex], Income: 0, Expense: 0 };
    }

    transactions.forEach(t => {
      const date = new Date(t.date);
      const mName = months[date.getMonth()];
      if (monthlyAggregate[mName]) {
        if (t.type === 'income') monthlyAggregate[mName].Income += t.amount;
        if (t.type === 'expense') monthlyAggregate[mName].Expense += t.amount;
      }
    });

    return { pieData: parsedPieData, barData: Object.values(monthlyAggregate) };
  }, [transactions, categories]);

  return (
    <main className="pt-24 pb-32 px-6 max-w-7xl mx-auto min-h-screen max-md:px-4 max-md:pb-28">
      {/* ===== DESKTOP HEADER (unchanged) ===== */}
      <section className="mb-12 hidden md:block">
        <p className="font-label text-[10px] uppercase tracking-widest text-[#F1DFD3]/60 mb-2">Financial Performance</p>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <h2 className="font-headline font-bold text-4xl md:text-5xl text-on-surface tracking-tight">Trends & Insights</h2>
        </div>
      </section>

      {/* ===== MOBILE HEADER ===== */}
      <section className="mb-6 md:hidden">
        <p className="font-label text-[10px] uppercase tracking-widest text-[#F1DFD3]/60 mb-1">Financial Performance</p>
        <h2 className="font-headline font-bold text-2xl text-on-surface tracking-tight">Trends & Insights</h2>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 max-md:gap-4">

        {/* ===== SPENDING VELOCITY CARD ===== */}
        {/* Desktop (unchanged) */}
        <div className="hidden md:block bg-surface-container-low rounded-lg p-8 shadow-sm">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h3 className="font-headline font-semibold text-lg text-on-surface">Monthly Spending Velocity</h3>
            </div>
            <div className="text-right">
              <span className="text-3xl font-headline font-extrabold text-primary">
                {formatCurrency(monthlySpent)}
              </span>
            </div>
          </div>
          
          {pieData.length === 0 ? (
             <div className="h-[250px] flex items-center justify-center text-outline">No expense data yet</div>
          ) : (
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatCurrency(value)}
                    contentStyle={{ backgroundColor: '#1a140e', border: '1px solid rgba(241, 223, 211, 0.1)', borderRadius: '12px', color: '#f1dfd3', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)' }}
                    itemStyle={{ color: '#f1dfd3' }}
                    labelStyle={{ color: '#f1dfd3', fontWeight: 'bold', marginBottom: '4px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="mt-6 space-y-3">
             {pieData.slice(0, 4).map((entry, i) => (
                <div key={i} className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                     <span className="w-3 h-3 rounded-full" style={{backgroundColor: entry.color}}></span>
                     <span className="text-on-surface-variant">{entry.name}</span>
                  </div>
                  <span className="font-bold">{formatCurrency(entry.value)}</span>
                </div>
             ))}
          </div>
        </div>

        {/* Mobile spending card */}
        <div className="md:hidden bg-surface-container-low rounded-lg p-4 shadow-sm">
          <div className="flex flex-col gap-1 mb-4">
            <h3 className="font-headline font-semibold text-sm text-on-surface">Monthly Spending</h3>
            <span className="text-2xl font-headline font-extrabold text-primary">
              {formatCurrency(monthlySpent)}
            </span>
          </div>
          
          {pieData.length === 0 ? (
             <div className="h-[180px] flex items-center justify-center text-outline text-sm">No expense data yet</div>
          ) : (
            <div className="h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={4} dataKey="value">
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatCurrency(value)}
                    contentStyle={{ backgroundColor: '#1a140e', border: '1px solid rgba(241, 223, 211, 0.1)', borderRadius: '10px', color: '#f1dfd3', fontSize: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)' }}
                    itemStyle={{ color: '#f1dfd3' }}
                    labelStyle={{ color: '#f1dfd3', fontWeight: 'bold', marginBottom: '4px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="mt-4 space-y-2.5">
             {pieData.slice(0, 4).map((entry, i) => (
                <div key={i} className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                     <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{backgroundColor: entry.color}}></span>
                     <span className="text-on-surface-variant truncate">{entry.name}</span>
                  </div>
                  <span className="font-bold shrink-0 ml-2">{formatCurrency(entry.value)}</span>
                </div>
             ))}
          </div>
        </div>

        {/* ===== INCOME VS EXPENSE CARD ===== */}
        {/* Desktop (unchanged) */}
        <div className="hidden md:flex bg-surface-container-low rounded-lg p-8 shadow-sm flex-col">
          <h3 className="font-headline font-semibold text-lg text-on-surface mb-8">Income vs Expense</h3>
          <div className="flex-grow min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#4e4539" vertical={false} />
                <XAxis dataKey="name" stroke="#9a8f80" axisLine={false} tickLine={false} />
                <YAxis stroke="#9a8f80" axisLine={false} tickLine={false} tickFormatter={(value) => `₹${value / 1000}k`} />
                <Tooltip
                  formatter={(value) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: '#1a140e', border: '1px solid rgba(241, 223, 211, 0.1)', borderRadius: '12px', color: '#f1dfd3', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)' }}
                  itemStyle={{ color: '#f1dfd3' }}
                  labelStyle={{ color: '#f1dfd3', fontWeight: 'bold', marginBottom: '4px' }}
                  cursor={{ fill: 'rgba(229, 186, 115, 0.05)' }}
                />
                <Bar dataKey="Income" fill="#95CD41" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Expense" fill="#E5BA73" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Mobile bar chart card */}
        <div className="md:hidden bg-surface-container-low rounded-lg p-4 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-headline font-semibold text-sm text-on-surface">Income vs Expense</h3>
            <div className="flex gap-3 text-[10px] font-bold">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#95CD41]"></span> Income</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#E5BA73]"></span> Expense</span>
            </div>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#4e4539" vertical={false} />
                <XAxis dataKey="name" stroke="#9a8f80" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                <YAxis stroke="#9a8f80" axisLine={false} tickLine={false} tickFormatter={(value) => `${value / 1000}k`} tick={{ fontSize: 10 }} width={30} />
                <Tooltip
                  formatter={(value) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: '#1a140e', border: '1px solid rgba(241, 223, 211, 0.1)', borderRadius: '10px', color: '#f1dfd3', fontSize: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)' }}
                  itemStyle={{ color: '#f1dfd3' }}
                  labelStyle={{ color: '#f1dfd3', fontWeight: 'bold', marginBottom: '4px' }}
                  cursor={{ fill: 'rgba(229, 186, 115, 0.05)' }}
                />
                <Bar dataKey="Income" fill="#95CD41" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Expense" fill="#E5BA73" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </main>
  );
};

export default AnalyticsScreen;
