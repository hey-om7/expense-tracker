import React from 'react';
import Modal from './Modal';

const ConfirmDialog = ({ isOpen, title, message, onConfirm, onCancel, confirmLabel = 'Delete Record' }) => {
  const confirmClasses = confirmLabel === 'Delete Record'
    ? "flex-1 bg-error-container text-on-error-container py-3 rounded-xl font-manrope font-bold shadow-xl shadow-error-container/10 hover:brightness-110 transition-all active:scale-95"
    : "flex-1 bg-primary-container text-on-primary py-3 rounded-xl font-manrope font-bold shadow-xl shadow-primary-container/20 hover:brightness-110 transition-all active:scale-95";

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title}>
      <div className="flex flex-col gap-6 pt-2 pb-4 px-2">
        <p className="text-on-surface-variant font-medium leading-relaxed">{message}</p>
        <div className="flex gap-3 mt-2">
          <button onClick={onCancel} className="flex-1 bg-surface-container-high text-on-surface hover:brightness-110 py-3 rounded-xl font-manrope font-bold transition-all active:scale-95">
            Cancel
          </button>
          <button onClick={onConfirm} className={confirmClasses}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmDialog;
