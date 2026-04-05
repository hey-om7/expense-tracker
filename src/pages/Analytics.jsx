import React from 'react';
import { useAppContext } from '../context/AppContext';

const AnalyticsScreen = () => {
  const { monthlySpent } = useAppContext();

  return (
    <main className="pt-24 pb-32 px-6 max-w-7xl mx-auto min-h-screen">
      <section className="mb-12">
        <p className="font-label text-[10px] uppercase tracking-widest text-[#F1DFD3]/60 mb-2">Financial Performance</p>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <h2 className="font-headline font-bold text-4xl md:text-5xl text-on-surface tracking-tight">Trends & Insights</h2>
        </div>
      </section>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-8 space-y-6">
          <div className="bg-surface-container-low rounded-lg p-8 shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-start mb-12">
              <div>
                <h3 className="font-headline font-semibold text-lg text-on-surface">Spending Velocity</h3>
              </div>
              <div className="text-right">
                <span className="text-3xl font-headline font-extrabold text-primary">
                  ${monthlySpent.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default AnalyticsScreen;
