import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import ConfirmDialog from '../ui/ConfirmDialog';

const AddTransactionForm = ({ onClose, initialData }) => {
  const { addTransaction, updateTransaction, deleteTransaction, categories } = useAppContext();
  const [showConfirm, setShowConfirm] = useState(false);
  const isEditing = !!initialData;
  
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (initialData) {
      setType(initialData.type === 'buy_investment' ? 'expense' : initialData.type === 'sell_investment' ? 'income' : initialData.type);
      setAmount(initialData.amount || '');
      setCategoryId(initialData.categoryId || '');
      setTitle(initialData.title || '');
      setNotes(initialData.notes || '');
      setDate(new Date(initialData.date).toISOString().split('T')[0] || '');
    }
  }, [initialData]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!amount || !categoryId || !title) return;
    
    // Safety check for trade modifications. Disallow editing amount/type/category of trade logs through this form directly, just title/notes/date.
    if (isEditing && (initialData.type === 'buy_investment' || initialData.type === 'sell_investment')) {
        updateTransaction(initialData.id, {
            title, notes, date: new Date(date).toISOString()
        });
        onClose();
        return;
    }

    const payload = {
      type,
      amount: parseFloat(amount),
      categoryId,
      title,
      notes,
      date: new Date(date).toISOString()
    };

    if (isEditing) {
      updateTransaction(initialData.id, payload);
    } else {
      addTransaction(payload);
    }
    onClose();
  };
  
  const handleDelete = () => {
    setShowConfirm(true);
  };

  const confirmDelete = () => {
    deleteTransaction(initialData.id);
    onClose();
  };

  const currentCategories = categories.filter(c => c.type === type);
  const isTradeLog = isEditing && (initialData.type === 'buy_investment' || initialData.type === 'sell_investment');

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {isTradeLog && (
         <div className="bg-primary/20 text-on-surface p-3 text-xs rounded-lg mb-2 border border-primary/50">
           <strong>Notice:</strong> This is an investment trade log. You can only update its title, notes, and date here. To reverse financial impact, delete it and adjust holdings manually.
         </div>
      )}

      {!isTradeLog && (
        <div className="flex bg-surface-container-highest p-1 rounded-lg">
          <button type="button" onClick={() => setType('expense')} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${type === 'expense' ? 'bg-error-container text-on-error-container' : 'text-on-surface-variant'}`}>
            Expense
          </button>
          <button type="button" onClick={() => setType('income')} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${type === 'income' ? 'bg-tertiary-container text-on-tertiary-container' : 'text-on-surface-variant'}`}>
            Income
          </button>
        </div>
      )}

      <div>
        <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Amount *</label>
        <div className="relative">
          <span className="absolute left-3 top-3 text-on-surface-variant">₹</span>
          <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} disabled={isTradeLog} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 pl-8 pr-4 text-on-surface focus:outline-none focus:border-primary disabled:opacity-50" placeholder="0.00" required />
        </div>
      </div>

      <div>
        <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Category *</label>
        <select value={categoryId} onChange={e => setCategoryId(e.target.value)} disabled={isTradeLog} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 px-4 text-on-surface focus:outline-none focus:border-primary disabled:opacity-50" required>
          <option value="" disabled>Select a category</option>
          {isTradeLog && <option value="trade">Investment Trade</option>}
          {currentCategories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Date *</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 px-4 text-on-surface focus:outline-none focus:border-primary" required />
      </div>

      <div>
        <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Title *</label>
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 px-4 text-on-surface focus:outline-none focus:border-primary" placeholder="What was this for?" required />
      </div>

      <div>
        <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Notes (Optional)</label>
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 px-4 text-on-surface focus:outline-none focus:border-primary" placeholder="Any details..." />
      </div>

      <div className="mt-4 flex gap-3">
        {isEditing && (
           <button type="button" onClick={handleDelete} className="bg-error-container text-on-error-container px-4 py-4 rounded-xl font-manrope font-bold hover:brightness-110 transition-all active:scale-95">
             Delete
           </button>
        )}
        <button type="submit" className="flex-1 bg-primary-container text-on-primary py-4 rounded-xl font-manrope font-bold shadow-xl shadow-primary-container/20 hover:brightness-110 transition-all active:scale-95">
          {isEditing ? 'Save Changes' : 'Add Transaction'}
        </button>
      </div>

      <ConfirmDialog 
        isOpen={showConfirm} 
        title="Confirm Deletion" 
        message="Are you sure you want to delete this record? This action cannot be officially undone." 
        onConfirm={confirmDelete} 
        onCancel={() => setShowConfirm(false)} 
      />
    </form>
  );
};

export default AddTransactionForm;
