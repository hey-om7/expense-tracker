import React, { useEffect, useRef, useState } from 'react';
import Modal from './Modal';

/**
 * Asks for the password of a statement PDF attached to a bank email.
 * prompt: { email, filename, savedPasswordFailed, error }
 */
const PdfPasswordModal = ({ prompt, busy, onClose, onSubmit }) => {
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const inputRef = useRef(null);
  const promptId = prompt?.email?._id;

  useEffect(() => {
    if (!promptId) return undefined;
    setPassword('');
    setShow(false);
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [promptId]);

  if (!prompt) return null;
  const bank = prompt.email.institutionName || 'your bank';

  const submit = (e) => {
    e.preventDefault();
    if (password) onSubmit({ password, rememberPassword: remember });
  };

  return (
    <Modal isOpen onClose={onClose} title="Open the attached statement">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex gap-3">
          <span className="material-symbols-outlined text-[22px] text-primary shrink-0" aria-hidden="true">lock</span>
          <p className="text-sm text-on-surface-variant">
            <span className="font-semibold text-on-surface">{prompt.filename || 'The statement PDF'}</span> is password protected.
            {prompt.savedPasswordFailed ? ` Your saved ${bank} password didn't open it, so it may have changed.` : ''}
            {' '}Banks usually use part of your name, date of birth or card number. The password is in the email or on {bank}&apos;s website.
          </p>
        </div>

        <label className="flex flex-col gap-1.5 text-[11px] font-bold text-on-surface-variant uppercase tracking-[0.14em]">
          PDF password
          <span className="relative">
            <input
              ref={inputRef}
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              maxLength={100}
              aria-invalid={!!prompt.error}
              aria-describedby={prompt.error ? 'pdf-password-error' : undefined}
              className={`w-full bg-surface-container-lowest border rounded-xl py-3 pl-4 pr-12 text-on-surface text-sm font-normal normal-case tracking-normal focus:outline-none ${prompt.error ? 'border-error' : 'border-outline/20 focus:border-primary'}`}
            />
            <button type="button" onClick={() => setShow(v => !v)} aria-label={show ? 'Hide password' : 'Show password'}
              className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface">
              <span className="material-symbols-outlined text-[20px]">{show ? 'visibility_off' : 'visibility'}</span>
            </button>
          </span>
        </label>
        {prompt.error && <p id="pdf-password-error" role="alert" className="-mt-2 text-xs font-semibold text-error">{prompt.error}</p>}

        <label className="flex items-start gap-3 rounded-xl border border-outline/15 p-3 cursor-pointer">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#E5BA73]" />
          <span className="text-xs text-on-surface-variant">
            <span className="block text-sm font-semibold text-on-surface">Save this password for {bank}</span>
            Stored encrypted, so future statements from {bank} can be read automatically. You can remove it any time.
          </span>
        </label>

        <div className="flex gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="flex-1 min-h-[48px] rounded-full border border-outline/20 text-sm font-semibold text-on-surface hover:bg-surface-container-highest transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" disabled={busy || !password} className="flex-1 min-h-[48px] rounded-full bg-primary-container text-on-primary text-sm font-bold hover:brightness-110 active:brightness-95 transition-[filter] inline-flex items-center justify-center gap-2 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            {busy && <span className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" aria-hidden="true" />}
            {busy ? 'Opening…' : 'Open and analyze'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default PdfPasswordModal;
