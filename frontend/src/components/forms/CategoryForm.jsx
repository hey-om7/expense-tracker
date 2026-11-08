import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import CategoryIcon from '../ui/CategoryIcon';

// Curated Material Symbols that read well filled at small sizes.
const ICON_CHOICES = {
  expense: ['restaurant', 'local_cafe', 'shopping_cart', 'shopping_bag', 'local_gas_station', 'directions_car', 'flight', 'train',
    'home', 'bolt', 'water_drop', 'wifi', 'smartphone', 'medical_services', 'fitness_center', 'school',
    'movie', 'sports_esports', 'pets', 'checkroom', 'spa', 'redeem', 'receipt_long', 'category'],
  income: ['payments', 'work', 'account_balance', 'savings', 'trending_up', 'storefront', 'volunteer_activism', 'redeem',
    'currency_rupee', 'real_estate_agent', 'laptop_mac', 'category'],
};
const SWATCHES = ['#E5BA73', '#E07A5F', '#F2A65A', '#8AB17D', '#4FB3A9', '#5B9BD5', '#9B8AF4', '#D47FA6'];

const CategoryForm = ({ onClose, initialData }) => {
  const { addCategory, updateCategory } = useAppContext();
  const isEditing = !!initialData;

  const [name, setName] = useState(initialData?.name || '');
  const [type, setType] = useState(initialData?.type || 'expense');
  const [color, setColor] = useState(initialData?.color || '#E5BA73');
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
        <button type="button" onClick={() => setType('expense')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${type === 'expense' ? 'bg-error-container text-on-error-container' : 'text-on-surface-variant'}`}>
          Expense
        </button>
        <button type="button" onClick={() => setType('income')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${type === 'income' ? 'bg-tertiary-container text-on-tertiary-container' : 'text-on-surface-variant'}`}>
          Income
        </button>
      </div>

      <div>
        <label className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-1 block">Name *</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-3 px-4 text-on-surface focus:outline-none focus:border-primary" required placeholder="e.g. Utilities" />
      </div>

      <div>
        <span className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-2 block">Color</span>
        <div className="flex flex-wrap items-center gap-2">
          {SWATCHES.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Color ${c}`} aria-pressed={color.toLowerCase() === c.toLowerCase()}
              className={`w-8 h-8 rounded-full transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${color.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-offset-2 ring-offset-surface-container ring-on-surface' : ''}`}
              style={{ backgroundColor: c }} />
          ))}
          <label className="relative w-8 h-8 rounded-full overflow-hidden border border-outline/30 cursor-pointer flex items-center justify-center text-on-surface-variant hover:text-on-surface" title="Custom color">
            <span className="material-symbols-outlined text-base" aria-hidden="true">colorize</span>
            <input type="color" value={color} onChange={e => setColor(e.target.value)} aria-label="Custom color" className="absolute inset-0 opacity-0 cursor-pointer" />
          </label>
        </div>
      </div>

      <div>
        <span className="text-xs text-on-surface-variant uppercase tracking-widest font-bold mb-2 block">Icon</span>
        <div role="radiogroup" aria-label="Icon" className="grid grid-cols-6 sm:grid-cols-8 gap-2">
          {ICON_CHOICES[type].map((name) => {
            const active = icon === name;
            return (
              <button key={name} type="button" role="radio" aria-checked={active} aria-label={name.replace(/_/g, ' ')} onClick={() => setIcon(name)}
                className={`group flex items-center justify-center p-1 rounded-xl transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${active ? '' : 'opacity-55 hover:opacity-100'}`}>
                <CategoryIcon icon={name} color={color} size="sm" className={active ? 'ring-1 ring-on-surface/60' : ''} />
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <CategoryIcon icon={icon} color={color} size="lg" />
          <div className="flex-1 min-w-0">
            <label htmlFor="category-icon-name" className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold block mb-1">
              Or any icon name from <a href="https://fonts.google.com/icons" target="_blank" rel="noreferrer" className="text-primary underline">Material Symbols</a>
            </label>
            <input id="category-icon-name" type="text" value={icon} onChange={e => setIcon(e.target.value.trim().toLowerCase().replace(/\s+/g, '_'))} maxLength={50}
              className="w-full bg-surface-container-lowest border border-outline/20 rounded-lg py-2 px-3 text-on-surface focus:outline-none focus:border-primary" />
          </div>
        </div>
      </div>

      <button type="submit" className="mt-4 bg-primary-container text-on-primary py-3.5 rounded-xl font-manrope font-bold shadow-xl shadow-primary-container/20 hover:brightness-110 transition-all active:scale-95 text-sm">
        {isEditing ? 'Save Changes' : 'Create Category'}
      </button>
    </form>
  );
};

export default CategoryForm;
