import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import Modal from '../components/ui/Modal';
import CategoryForm from '../components/forms/CategoryForm';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { getContrastingColor } from '../utils/colorUtils';

const CategoriesScreen = () => {
  const { categories, deleteCategory } = useAppContext();
  const [modalState, setModalState] = useState({ isOpen: false, data: null });
  const [confirmState, setConfirmState] = useState({ isOpen: false, id: null });

  const expenses = categories.filter(c => c.type === 'expense');
  const incomes = categories.filter(c => c.type === 'income');

  return (
    <main className="pt-24 pb-32 px-6 max-w-7xl mx-auto min-h-screen max-md:px-4 max-md:pb-28">
      <div className="mb-10 flex justify-between items-center max-md:mb-6">
        <div>
          <span className="text-xs font-bold text-primary uppercase tracking-[0.2em] mb-2 block max-md:mb-1">Settings</span>
          <h1 className="font-headline font-extrabold text-4xl md:text-5xl text-on-surface tracking-tight max-md:text-2xl">Categories</h1>
        </div>
        <button onClick={() => setModalState({ isOpen: true, data: null })} className="bg-primary-container text-on-primary p-4 rounded-xl flex items-center gap-2 font-manrope font-bold text-sm shadow-xl shadow-[#E5BA73]/10 hover:brightness-110 transition-all active:scale-95 max-md:p-3 max-md:text-xs max-md:rounded-lg">
          <span className="material-symbols-outlined max-md:text-lg">add</span> New
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-md:gap-6">
        <div>
          <h2 className="text-xl font-bold mb-4 border-b border-outline/10 pb-2 max-md:text-base max-md:mb-3">Expenses</h2>
          <div className="flex flex-col gap-3 max-md:gap-2">
             {expenses.map(c => (
               <div key={c.id} className="flex items-center justify-between p-4 bg-surface-container-low rounded-lg border border-outline/5 hover:border-outline/20 transition-all max-md:p-3">
                  <div className="flex items-center gap-4 min-w-0 max-md:gap-3">
                     <span className="w-10 h-10 rounded-xl flex justify-center items-center shrink-0 max-md:w-9 max-md:h-9 max-md:rounded-lg" style={{backgroundColor: c.color, color: getContrastingColor(c.color)}}>
                       <span className="material-symbols-outlined text-sm">{c.icon}</span>
                     </span>
                     <span className="font-bold max-md:text-sm truncate">{c.name}</span>
                  </div>
                  <div className="flex gap-1 shrink-0">
                     <button onClick={() => setModalState({ isOpen: true, data: c })} className="p-2 text-on-surface-variant hover:text-primary transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"><span className="material-symbols-outlined text-lg">edit</span></button>
                     <button onClick={() => setConfirmState({ isOpen: true, id: c.id })} className="p-2 text-on-surface-variant hover:text-error transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"><span className="material-symbols-outlined text-lg">delete</span></button>
                  </div>
               </div>
             ))}
          </div>
        </div>

         <div>
            <h2 className="text-xl font-bold mb-4 border-b border-outline/10 pb-2 max-md:text-base max-md:mb-3">Income</h2>
            <div className="flex flex-col gap-3 max-md:gap-2">
              {incomes.map(c => (
                <div key={c.id} className="flex items-center justify-between p-4 bg-surface-container-low rounded-lg border border-outline/5 hover:border-outline/20 transition-all max-md:p-3">
                   <div className="flex items-center gap-4 min-w-0 max-md:gap-3">
                      <span className="w-10 h-10 rounded-xl flex justify-center items-center shrink-0 max-md:w-9 max-md:h-9 max-md:rounded-lg" style={{backgroundColor: c.color, color: getContrastingColor(c.color)}}>
                        <span className="material-symbols-outlined text-sm">{c.icon}</span>
                      </span>
                      <span className="font-bold max-md:text-sm truncate">{c.name}</span>
                   </div>
                  <div className="flex gap-1 shrink-0">
                     <button onClick={() => setModalState({ isOpen: true, data: c })} className="p-2 text-on-surface-variant hover:text-primary transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"><span className="material-symbols-outlined text-lg">edit</span></button>
                     <button onClick={() => setConfirmState({ isOpen: true, id: c.id })} className="p-2 text-on-surface-variant hover:text-error transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"><span className="material-symbols-outlined text-lg">delete</span></button>
                  </div>
               </div>
             ))}
           </div>
        </div>
      </div>

      <Modal isOpen={modalState.isOpen} onClose={() => setModalState({isOpen: false, data: null})} title={modalState.data ? "Edit Category" : "New Category"}>
        <CategoryForm initialData={modalState.data} onClose={() => setModalState({isOpen: false, data: null})} />
      </Modal>

      <ConfirmDialog 
        isOpen={confirmState.isOpen}
        title="Delete Category"
        message="Are you sure you want to delete this category? Past transactions assigned to this will become uncategorized!"
        onConfirm={() => {
           deleteCategory(confirmState.id);
           setConfirmState({ isOpen: false, id: null });
        }}
        onCancel={() => setConfirmState({ isOpen: false, id: null })}
      />
    </main>
  );
};

export default CategoriesScreen;
