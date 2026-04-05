import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';

const CategoryForm = ({ onClose, initialData }) => {
  const { addCategory, updateCategory } = useAppContext();
  const isEditing = !!initialData;
  
  const [name, setName] = useState(initialData?.name || '');
  const [type, setType] = useState(initialData?.type || 'expense');
  const [color, setColor] = useState(initialData?.color || '#3D332B');
  const [icon, setIcon] = useState(initialData?.icon || 'category');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name) return;

    if (isEditing) {
      updateCategory(initialData.id, { name, type, color, icon });
    } else {
      addCategory({ name, type, color, icon });
    }
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
        <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Name *</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 px-4 text-on-surface focus:outline-none focus:border-primary" required placeholder="e.g. Utilities" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
           <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Color Hex</label>
           <div className="flex gap-2 items-center">
             <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer bg-transparent border-0" />
             <input type="text" value={color} onChange={e => setColor(e.target.value)} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-2 px-3 text-on-surface focus:outline-none" />
           </div>
        </div>
        <div>
           <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Icon Name <a href="https://fonts.google.com/icons" target="_blank" rel="noreferrer" className="text-primary underline text-[10px]">Google Fonts</a></label>
           <div className="relative">
              <span className="material-symbols-outlined absolute left-2 top-2">{icon}</span>
              <input type="text" value={icon} onChange={e => setIcon(e.target.value)} className="w-full pl-10 pr-3 py-2 bg-surface-container-lowest border border-outline/20 rounded-lg text-on-surface focus:outline-none" />
           </div>
        </div>
      </div>

      <button type="submit" className="mt-4 bg-primary-container text-on-primary py-4 rounded-xl font-manrope font-bold shadow-xl shadow-primary-container/20 hover:brightness-110 transition-all active:scale-95">
        {isEditing ? 'Save Changes' : 'Create Category'}
      </button>
    </form>
  );
};

export default CategoryForm;
