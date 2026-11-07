import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Number of open modals, so nested modals (e.g. a confirm dialog inside a form)
// only release the body scroll lock when the last one closes.
let openCount = 0;
const SWIPE_CLOSE_PX = 100;

/**
 * Responsive popup.
 * - Mobile (< md): bottom sheet with a drag handle, sticky header and swipe-down to close.
 * - Desktop (>= md): centered dialog.
 * The body scrolls inside the panel; the header stays visible. Tapping the backdrop closes it.
 */
const Modal = ({ isOpen, onClose, title, children }) => {
  const [dragY, setDragY] = useState(0);
  const dragStart = useRef(null);
  const downOnBackdrop = useRef(false);

  useEffect(() => {
    if (!isOpen) return undefined;
    openCount += 1;
    document.body.style.overflow = 'hidden';
    return () => {
      openCount -= 1;
      if (openCount <= 0) { openCount = 0; document.body.style.overflow = ''; }
    };
  }, [isOpen]);

  useEffect(() => { if (!isOpen) setDragY(0); }, [isOpen]);

  if (!isOpen) return null;

  const onTouchStart = (e) => { dragStart.current = e.touches[0].clientY; };
  const onTouchMove = (e) => {
    if (dragStart.current == null) return;
    setDragY(Math.max(0, e.touches[0].clientY - dragStart.current));
  };
  const onTouchEnd = () => {
    if (dragStart.current == null) return;
    dragStart.current = null;
    if (dragY > SWIPE_CLOSE_PX) onClose?.();
    else setDragY(0);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm md:p-6 animate-[modalFade_150ms_ease-out]"
      onMouseDown={(e) => { downOnBackdrop.current = e.target === e.currentTarget; }}
      onClick={(e) => { if (downOnBackdrop.current && e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className="relative w-full flex flex-col bg-surface-container-high shadow-2xl overflow-hidden
          rounded-t-[28px] max-h-[92dvh] animate-[sheetUp_220ms_cubic-bezier(0.32,0.72,0,1)]
          md:max-w-lg md:rounded-2xl md:max-h-[85vh] md:animate-[dialogIn_160ms_ease-out]"
        style={dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : { transition: 'transform 200ms ease-out' }}
      >
        {/* Header: drag handle on mobile, title + close button */}
        <div
          className="shrink-0 px-5 md:px-6 pt-2 md:pt-5 pb-3 md:pb-4 border-b border-outline/10 touch-none md:touch-auto"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="md:hidden mx-auto mb-2 h-1.5 w-10 rounded-full bg-on-surface-variant/30" aria-hidden="true" />
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-headline font-bold text-lg md:text-xl text-on-surface truncate">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-2 shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-on-surface-variant hover:text-primary hover:bg-surface-container-highest transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain no-scrollbar px-5 md:px-6 pt-4 md:pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:pb-6">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;
