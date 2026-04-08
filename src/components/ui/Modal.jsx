import React from 'react';

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center md:flex md:items-center md:justify-center bg-black/60 backdrop-blur-sm px-4 max-md:items-end max-md:px-0">
      <div className="bg-surface-container-high w-full max-w-md rounded-2xl p-6 shadow-2xl relative max-md:rounded-b-none max-md:rounded-t-2xl max-md:max-h-[92vh] max-md:overflow-y-auto max-md:no-scrollbar max-md:p-5 max-md:pb-8 overflow-x-hidden">
        <button onClick={onClose} className="absolute right-4 top-4 text-on-surface-variant hover:text-primary transition-colors max-md:right-3 max-md:top-3 min-w-[44px] min-h-[44px] flex items-center justify-center">
          <span className="material-symbols-outlined">close</span>
        </button>
        <h2 className="font-headline font-bold text-xl text-on-surface mb-6 max-md:text-lg max-md:mb-4 max-md:pr-8">{title}</h2>
        {children}
      </div>
    </div>
  );
};

export default Modal;
