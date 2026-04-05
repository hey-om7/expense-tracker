import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';

const AddInvestmentForm = ({ onClose }) => {
  const { addInvestment, addNotification } = useAppContext();
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [shares, setShares] = useState('');
  const [avgCost, setAvgCost] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  const [type, setType] = useState('Stock');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name || !shares || !avgCost) return;
    
    addInvestment({
      name,
      symbol,
      shares: parseFloat(shares),
      avgCost: parseFloat(avgCost),
      currentPrice: currentPrice ? parseFloat(currentPrice) : parseFloat(avgCost),
      type
    });
    
    addNotification({ title: 'Investment Added', message: `Successfully tracked ${name}.` });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto px-2 pb-4 no-scrollbar">
      <div>
        <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Type</label>
        <select value={type} onChange={e => setType(e.target.value)} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 px-4 text-on-surface focus:outline-none focus:border-primary">
          <option value="Stock">Stocks</option>
          <option value="Mutual Fund">Mutual Funds</option>
          <option value="Crypto">Crypto</option>
          <option value="FD">Fixed Deposit</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Name *</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 px-4 text-on-surface focus:outline-none focus:border-primary" required />
        </div>
        <div>
          <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Ticker/Symbol</label>
          <input type="text" value={symbol} onChange={e => setSymbol(e.target.value)} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 px-4 text-on-surface focus:outline-none focus:border-primary" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Shares/Units *</label>
          <input type="number" step="0.0001" value={shares} onChange={e => setShares(e.target.value)} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 px-4 text-on-surface focus:outline-none focus:border-primary" required />
        </div>
        <div>
          <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Avg Cost *</label>
          <input type="number" step="0.01" value={avgCost} onChange={e => setAvgCost(e.target.value)} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 px-4 text-on-surface focus:outline-none focus:border-primary" required />
        </div>
      </div>

      <div>
        <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Current Price (Optional)</label>
        <input type="number" step="0.01" value={currentPrice} onChange={e => setCurrentPrice(e.target.value)} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 px-4 text-on-surface focus:outline-none focus:border-primary" placeholder="Defaults to Avg Cost" />
      </div>

      <button type="submit" className="mt-4 bg-primary-container text-on-primary py-4 rounded-xl font-manrope font-bold shadow-xl shadow-primary-container/20 hover:brightness-110 transition-all active:scale-95">
        Save Investment
      </button>
    </form>
  );
};

export default AddInvestmentForm;
