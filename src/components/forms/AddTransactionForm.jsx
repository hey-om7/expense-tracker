import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';

const AddTransactionForm = ({ onClose }) => {
  const { addTransaction, categories } = useAppContext();
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!amount || !title || !categoryId) return;
    
    addTransaction({
      amount: parseFloat(amount),
      title,
      categoryId,
      type
    });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex bg-surface-container-highest p-1 rounded-lg">
        <button type="button" onClick={() => setType('expense')} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${type === 'expense' ? 'bg-error-container text-on-error-container' : 'text-on-surface-variant'}`}>
          Expense
        </button>
        <button type="button" onClick={() => setType('income')} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${type === 'income' ? 'bg-tertiary-container text-on-tertiary-container' : 'text-on-surface-variant'}`}>
          Income
        </button>
      </div>
      
      <div>
        <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Amount</label>
        <div className="relative">
          <span className="absolute left-3 top-3 text-on-surface-variant">₹</span>
          <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 pl-8 pr-4 text-on-surface focus:outline-none focus:border-primary" placeholder="0.00" required />
        </div>
      </div>

      <div>
        <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Title</label>
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 px-4 text-on-surface focus:outline-none focus:border-primary" placeholder="e.g. Morning Coffee" required />
      </div>

      {type === 'expense' && (
        <div>
          <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Category</label>
          <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 px-4 text-on-surface focus:outline-none focus:border-primary">
            {categories.filter(c => c.type === 'expense').map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {type === 'income' && (
        <div>
          <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Category</label>
          <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 px-4 text-on-surface focus:outline-none focus:border-primary">
            {categories.filter(c => c.type === 'income').map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      <button type="submit" className="mt-4 bg-primary-container text-on-primary py-4 rounded-xl font-manrope font-bold shadow-xl shadow-primary-container/20 hover:brightness-110 transition-all active:scale-95">
        Add {type === 'expense' ? 'Expense' : 'Income'}
      </button>
    </form>
  );
};

export default AddTransactionForm;
