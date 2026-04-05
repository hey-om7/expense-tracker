import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';

const AddInvestmentForm = ({ onClose, initialData }) => {
  const { addInvestment, updateInvestment, deleteInvestment, addNotification } = useAppContext();
  const isEditing = !!initialData;

  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [shares, setShares] = useState('');
  const [avgCost, setAvgCost] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  const [type, setType] = useState('Stock');

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setSymbol(initialData.symbol || '');
      setShares(initialData.shares || '');
      setAvgCost(initialData.avgCost || '');
      setCurrentPrice(initialData.currentPrice || '');
      setType(initialData.type || 'Stock');
    }
  }, [initialData]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name || shares === '' || avgCost === '') return;
    
    const payload = {
      name,
      symbol,
      shares: parseFloat(shares),
      avgCost: parseFloat(avgCost),
      currentPrice: currentPrice ? parseFloat(currentPrice) : parseFloat(avgCost),
      type
    };

    if (isEditing) {
      updateInvestment(initialData.id, payload);
      addNotification({ title: 'Investment Updated', message: `Modified properties for ${name}.` });
    } else {
      addInvestment(payload);
      addNotification({ title: 'Investment Profile Created', message: `Successfully tracked ${name}. You can now execute trades on it.` });
    }
    
    onClose();
  };

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to completely erase this investment profile? This will not delete past cashflow transactions.")) {
      deleteInvestment(initialData.id);
      onClose();
    }
  }

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
          <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Shares/Units Owned *</label>
          <input type="number" step="0.0001" value={shares} onChange={e => setShares(e.target.value)} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 px-4 text-on-surface focus:outline-none focus:border-primary disabled:opacity-50" required disabled={isEditing && window.location.pathname.includes('investments')} />
          {isEditing && <p className="text-[9px] text-[#F1DFD3]/60 mt-1">To update shares properly, execute a Trade instead.</p>}
        </div>
        <div>
          <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Avg Cost *</label>
          <input type="number" step="0.01" value={avgCost} onChange={e => setAvgCost(e.target.value)} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 px-4 text-on-surface focus:outline-none focus:border-primary disabled:opacity-50" required disabled={isEditing && window.location.pathname.includes('investments')} />
        </div>
      </div>

      <div>
        <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Current Live Price</label>
        <input type="number" step="0.01" value={currentPrice} onChange={e => setCurrentPrice(e.target.value)} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 px-4 text-on-surface focus:outline-none focus:border-primary" placeholder="Update live price!" />
      </div>

      <div className="mt-4 flex gap-3">
        {isEditing && (
           <button type="button" onClick={handleDelete} className="bg-error-container text-on-error-container px-4 py-4 rounded-xl font-manrope font-bold hover:brightness-110 transition-all active:scale-95">
             Delete
           </button>
        )}
        <button type="submit" className="flex-1 bg-primary-container text-on-primary py-4 rounded-xl font-manrope font-bold shadow-xl shadow-primary-container/20 hover:brightness-110 transition-all active:scale-95">
          {isEditing ? 'Update Configuration' : 'Create Holding'}
        </button>
      </div>
    </form>
  );
};

export default AddInvestmentForm;
