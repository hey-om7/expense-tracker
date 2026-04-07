import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import ConfirmDialog from '../ui/ConfirmDialog';

const AddSubscriptionForm = ({ onClose, initialData }) => {
  const { addSubscription, updateSubscription, deleteSubscription, addTransaction, addNotification, categories } = useAppContext();
  const [showConfirm, setShowConfirm] = useState(false);
  const [showBackdatedConfirm, setShowBackdatedConfirm] = useState(false);
  const [missedDates, setMissedDates] = useState([]);
  const [pendingPayload, setPendingPayload] = useState(null);
  const isEditing = !!initialData;

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [period, setPeriod] = useState('monthly');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setAmount(initialData.amount || '');
      setStartDate(initialData.startDate ? new Date(initialData.startDate).toISOString().split('T')[0] : '');
      setEndDate(initialData.endDate ? new Date(initialData.endDate).toISOString().split('T')[0] : '');
      setCategoryId(initialData.categoryId || '');
      setPeriod(initialData.period || 'monthly');
      setIsActive(initialData.isActive ?? true);
    }
  }, [initialData]);

  const generateMissedCycles = (startStr, freqStr, endStr) => {
    const missed = [];
    const start = new Date(startStr);
    start.setHours(0, 0, 0, 0);

    const limit = new Date();
    limit.setHours(0, 0, 0, 0);

    const endObj = endStr ? new Date(endStr) : null;
    if (endObj) endObj.setHours(0, 0, 0, 0);

    const finalLimit = endObj && endObj < limit ? endObj : limit;

    let current = new Date(start);
    while (current <= finalLimit) {
      missed.push(new Date(current));
      if (freqStr === 'weekly') {
        current.setDate(current.getDate() + 7);
      } else if (freqStr === 'yearly') {
        current.setFullYear(current.getFullYear() + 1);
      } else {
        current.setMonth(current.getMonth() + 1);
      }
    }
    return missed;
  };

  const finalizeSave = async (payload) => {
    if (isEditing) {
      await updateSubscription(initialData.id, payload);
      addNotification({ title: 'Subscription Updated', message: `Updated recurring config for ${payload.name}.` });
    } else {
      await addSubscription(payload);
      addNotification({ title: 'Subscription Created', message: `Automated cyclic tracking enabled for ${payload.name}.` });
    }
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name || !amount || !categoryId || !startDate) return;

    if (endDate && new Date(endDate) <= new Date(startDate)) {
      addNotification({ title: 'Invalid Dates', message: 'End date must be after the start date.' });
      return;
    }
    
    const payload = {
      name,
      amount: parseFloat(amount),
      startDate: new Date(startDate).toISOString(),
      endDate: endDate ? new Date(endDate).toISOString() : null,
      categoryId,
      period,
      isActive,
      lastExecutedDate: initialData?.lastExecutedDate || null
    };

    if (!isEditing) {
      const missed = generateMissedCycles(startDate, period, endDate);
      if (missed.length > 0) {
        setMissedDates(missed);
        setPendingPayload(payload);
        setShowBackdatedConfirm(true);
        return;
      }
    }

    finalizeSave(payload);
  };

  const handleBackdatedConfirm = async () => {
    setShowBackdatedConfirm(false);
    
    try {
      const finalPayload = { 
        ...pendingPayload, 
        lastExecutedDate: missedDates[missedDates.length - 1].toISOString().split('T')[0] 
      };

      // Step 1: Create the subscription first to ensure it exists
      const savedSub = await addSubscription(finalPayload);
      
      if (!savedSub || !savedSub.id) {
        addNotification({ title: 'Creation Failed', message: 'Could not initialize subscription ledger.' });
        return;
      }

      // Step 2 & 3: Generate and persist missed transactions using valid subscriptionId
      for (const d of missedDates) {
        const txDate = new Date(d);
        txDate.setHours(12, 0, 0, 0);
        await addTransaction({
          type: 'expense',
          categoryId: categoryId,
          amount: parseFloat(amount),
          title: `Subscription Payment - ${name}`,
          date: txDate.toISOString(),
          notes: `Subscription Payment - ${name} (Auto-added)`,
          subscriptionId: savedSub.id,
        });
      }

      addNotification({ 
        title: 'Subscription & History Sync', 
        message: `Created ${name} and backfilled ${missedDates.length} historical entries.` 
      });
      
      onClose();
    } catch (err) {
      console.error('Backdated sync failed:', err);
      addNotification({ title: 'Sync Error', message: 'Subscription setup encountered an issue.' });
      onClose();
    }
  };

  const confirmDelete = () => {
    deleteSubscription(initialData.id);
    onClose();
  };

  const expenseCategories = categories.filter(c => c.type === 'expense');

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-h-[70vh] md:max-h-[70vh] max-md:max-h-none overflow-y-auto px-2 max-md:px-0 pb-8 no-scrollbar">
      
      <div className="flex items-center justify-between bg-surface-container-low p-4 max-md:p-3 rounded-xl max-md:rounded-lg border border-outline/10">
         <div>
            <h4 className="font-bold text-sm text-on-surface max-md:text-xs">Automation Status</h4>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Category *</label>
          <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 pl-4 pr-10 text-on-surface focus:outline-none focus:border-primary appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23E5BA73%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')]%20bg-[length:1.25rem]%20bg-[right_1rem_center]%20bg-no-repeat" required>
            <option value="" disabled>Select mapping...</option>
            {expenseCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Amount *</label>
          <div className="relative">
            <span className="absolute left-3 top-3 text-on-surface-variant">₹</span>
            <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 pl-8 pr-4 text-on-surface focus:outline-none focus:border-primary" placeholder="0.00" required />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Frequency</label>
          <select value={period} onChange={e => setPeriod(e.target.value)} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 pl-4 pr-10 text-on-surface focus:outline-none focus:border-primary appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23E5BA73%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')]%20bg-[length:1.25rem]%20bg-[right_1rem_center]%20bg-no-repeat" required>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Start Date *</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} disabled={isEditing} className={`w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 px-4 text-on-surface focus:outline-none focus:border-primary ${isEditing ? 'opacity-60 cursor-not-allowed' : ''}`} required />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">End Date (Optional)</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} disabled={isEditing} className={`w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 px-4 text-on-surface focus:outline-none focus:border-primary ${isEditing ? 'opacity-60 cursor-not-allowed' : ''}`} />
        </div>
      </div>

      <div className="mt-4 flex gap-3">
        {isEditing && (
           <button type="button" onClick={() => setShowConfirm(true)} className="bg-error-container text-on-error-container px-4 py-3.5 rounded-xl font-manrope font-bold hover:brightness-110 transition-all active:scale-95 text-sm">
             Delete
           </button>
        )}
        <button type="submit" className="flex-1 bg-primary-container text-on-primary py-3.5 rounded-xl font-manrope font-bold shadow-xl shadow-primary-container/20 hover:brightness-110 transition-all active:scale-95 text-sm">
          {isEditing ? 'Save Changes' : 'Add Subscription'}
        </button>
      </div>

      <ConfirmDialog 
        isOpen={showConfirm} 
        title="Stop Billing Cycle" 
        message="Are you sure you want to delete this subscription? Note: Disabling the 'Automation Status' toggle merely pauses execution, whereas this formally sweeps it off the register. Existing generated expense records will remain untouched in your History ledger." 
        onConfirm={confirmDelete} 
        onCancel={() => setShowConfirm(false)} 
      />

      <ConfirmDialog 
        isOpen={showBackdatedConfirm} 
        title="Backdated Subscription Detected" 
        message={`This subscription start date is in the past. ${missedDates.length} payment(s) (₹${amount} × ${missedDates.length} = ₹${(amount * missedDates.length).toFixed(2)}) will be added to your transaction history. These entries will be created immediately and cannot be auto-reversed.`} 
        onConfirm={handleBackdatedConfirm} 
        onCancel={() => setShowBackdatedConfirm(false)} 
        confirmLabel="Add Subscription"
      />
    </form>
  );
};

export default AddSubscriptionForm;
