import React, { useEffect, useRef, useState } from 'react';

// Quiet text trigger with a dropdown panel. Closes on outside click and Escape.
const FilterMenuButton = ({ label, value, active, align = 'left', children }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1 h-9 px-3 rounded-full text-[13px] transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary
          ${active ? 'text-primary bg-primary/10' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'}`}
      >
        <span className="opacity-70">{label}</span>
        {value && <span className="font-semibold max-w-[10rem] truncate">{value}</span>}
        <span className={`material-symbols-outlined text-[18px] transition-transform duration-150 ${open ? 'rotate-180' : ''}`} aria-hidden="true">expand_more</span>
      </button>
      {open && (
        <div className={`absolute top-full mt-2 z-30 p-1 rounded-xl bg-surface-container-high border border-outline/10 shadow-2xl shadow-black/40 animate-[slideDown_0.15s_ease-out] ${align === 'right' ? 'right-0' : 'left-0'}`}>
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  );
};

export default FilterMenuButton;
