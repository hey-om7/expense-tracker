import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import ConfirmDialog from '../ui/ConfirmDialog';

const AddSubscriptionForm = ({ onClose, initialData }) => {
  const { addSubscription, updateSubscription, deleteSubscription, addNotification, categories } = useAppContext();
  const [showConfirm, setShowConfirm] = useState(false);
  const isEditing = !!initialData;

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [renewalDate, setRenewalDate] = useState(new Date().toISOString().split('T')[0]);
  const [categoryId, setCategoryId] = useState('');
  const [period, setPeriod] = useState('monthly');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setAmount(initialData.amount || '');
      setRenewalDate(initialData.renewalDate ? new Date(initialData.renewalDate).toISOString().split('T')[0] : '');
      setCategoryId(initialData.categoryId || '');
      setPeriod(initialData.period || 'monthly');
      setIsActive(initialData.isActive ?? true);
    }
  }, [initialData]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name || !amount || !categoryId || !renewalDate) return;
    
    const payload = {
      name,
      amount: parseFloat(amount),
      renewalDate: new Date(renewalDate).toISOString(),
      categoryId,
      period,
      isActive,
      lastExecutedDate: initialData?.lastExecutedDate || null
    };

    if (isEditing) {
      updateSubscription(initialData.id, payload);
      addNotification({ title: 'Subscription Updated', message: `Updated recurring config for ${name}.` });
    } else {
      addSubscription(payload);
      addNotification({ title: 'Subscription Created', message: `Automated cyclic tracking enabled for ${name}.` });
    }
    
    onClose();
  };

  const confirmDelete = () => {
    deleteSubscription(initialData.id);
    onClose();
  };

  const expenseCategories = categories.filter(c => c.type === 'expense');

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto px-2 pb-8 no-scrollbar">
      
      <div className="flex items-center justify-between bg-surface-container-low p-4 rounded-xl border border-outline/10">
         <div>
            <h4 className="font-bold text-sm text-on-surface">Automation Status</h4>
            <p className="text-[10px] text-on-surface-variant">Is this actively charging you?</p>
         </div>
         <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="sr-only peer" />
            <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#95CD41]"></div>
         </label>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Name *</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 px-4 text-on-surface focus:outline-none focus:border-primary" placeholder="e.g. Netflix, Rent" required />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Target Category *</label>
          <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 pl-4 pr-10 text-on-surface focus:outline-none focus:border-primary appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23E5BA73%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')]%20bg-[length:1.25rem]%20bg-[right_1rem_center]%20bg-no-repeat" required>
            <option value="" disabled>Select mapping...</option>
            {expenseCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Automated Amount *</label>
          <div className="relative">
            <span className="absolute left-3 top-3 text-on-surface-variant">₹</span>
            <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 pl-8 pr-4 text-on-surface focus:outline-none focus:border-primary" placeholder="0.00" required />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Cycle Frequency</label>
          <select value={period} onChange={e => setPeriod(e.target.value)} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 pl-4 pr-10 text-on-surface focus:outline-none focus:border-primary appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23E5BA73%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')]%20bg-[length:1.25rem]%20bg-[right_1rem_center]%20bg-no-repeat" required>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Next Renewal Date *</label>
          <input type="date" value={renewalDate} onChange={e => setRenewalDate(e.target.value)} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 px-4 text-on-surface focus:outline-none focus:border-primary" required />
        </div>
      </div>

      <div className="mt-4 flex gap-3">
        {isEditing && (
           <button type="button" onClick={() => setShowConfirm(true)} className="bg-error-container text-on-error-container px-4 py-4 rounded-xl font-manrope font-bold hover:brightness-110 transition-all active:scale-95">
             Delete
           </button>
        )}
        <button type="submit" className="flex-1 bg-primary-container text-on-primary py-4 rounded-xl font-manrope font-bold shadow-xl shadow-primary-container/20 hover:brightness-110 transition-all active:scale-95">
          {isEditing ? 'Save Changes' : 'Initialize Subscription'}
        </button>
      </div>

      <ConfirmDialog 
        isOpen={showConfirm} 
        title="Stop Billing Cycle" 
        message="Are you sure you want to delete this subscription? Note: Disabling the 'Automation Status' toggle merely pauses execution, whereas this formally sweeps it off the register. Existing generated expense records will remain untouched in your History ledger." 
        onConfirm={confirmDelete} 
        onCancel={() => setShowConfirm(false)} 
      />
    </form>
  );
};

export default AddSubscriptionForm;
