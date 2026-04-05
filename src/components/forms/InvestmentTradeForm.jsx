import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';

const InvestmentTradeForm = ({ onClose, investment }) => {
  const { executeTrade } = useAppContext();
  
  const [type, setType] = useState('BUY');
  const [shares, setShares] = useState('');
  const [price, setPrice] = useState(investment.currentPrice || '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!shares || !price) return;
    
    executeTrade(investment.id, {
      type,
      shares: parseFloat(shares),
      price: parseFloat(price),
      date: new Date(date).toISOString()
    });
    
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex bg-surface-container-highest p-1 rounded-lg">
        <button type="button" onClick={() => setType('BUY')} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${type === 'BUY' ? 'bg-[#95CD41] text-[#1A120B]' : 'text-on-surface-variant'}`}>
          Buy
        </button>
        <button type="button" onClick={() => setType('SELL')} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${type === 'SELL' ? 'bg-error-container text-on-error-container' : 'text-on-surface-variant'}`}>
          Sell
        </button>
      </div>

      {type === 'SELL' && (
         <div className="text-xs text-on-surface-variant text-center pb-2">
            Available to sell: <span className="font-bold text-on-surface">{investment.shares} units</span>
         </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Quantity *</label>
          <input type="number" step="0.0001" max={type === 'SELL' ? investment.shares : undefined} value={shares} onChange={e => setShares(e.target.value)} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 px-4 text-on-surface focus:outline-none focus:border-primary" required placeholder="0.00" />
        </div>
        <div>
          <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Execution Price *</label>
          <div className="relative">
            <span className="absolute left-3 top-3 text-on-surface-variant">₹</span>
            <input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 pl-8 pr-4 text-on-surface focus:outline-none focus:border-primary" required placeholder="0.00" />
          </div>
        </div>
      </div>

      <div>
        <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Date *</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 px-4 text-on-surface focus:outline-none focus:border-primary" required />
      </div>

      <button type="submit" className="mt-4 bg-primary-container text-on-primary py-4 rounded-xl font-manrope font-bold shadow-xl shadow-primary-container/20 hover:brightness-110 transition-all active:scale-95">
        Execute {type} Order
      </button>
    </form>
  );
};

export default InvestmentTradeForm;
