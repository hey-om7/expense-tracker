import React, { useEffect, useState } from 'react';
import { useAppContext } from '../../context/AppContext';

const ToastContainer = () => {
  const { notifications } = useAppContext();
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    if (notifications.length > 0) {
      const latest = notifications[0];
      const isFresh = new Date() - new Date(latest.date) < 2000;
      if (isFresh) {
        setToasts(prev => {
          if (prev.find(t => t.id === latest.id)) return prev;
          return [...prev, latest];
        });
      }
    }
  }, [notifications]);

  useEffect(() => {
    if (toasts.length > 0) {
      const timer = setTimeout(() => {
        setToasts(prev => prev.slice(1));
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toasts]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-3 pointer-events-none items-center w-full max-w-sm px-4">
      {toasts.map(toast => (
        <div key={toast.id} className="bg-primary-container text-on-primary-container backdrop-blur-md shadow-2xl rounded-2xl p-4 flex flex-col gap-1 w-full animate-[slideUp_0.3s_ease-out] shadow-primary-container/20 pointer-events-auto border border-outline/10">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sm font-bold text-green-900">check_circle</span>
            <h4 className="font-bold text-sm">{toast.title}</h4>
          </div>
          {toast.message && <p className="text-xs opacity-90 pl-6 text-green-900">{toast.message}</p>}
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
