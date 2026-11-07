import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Lock, LogOut, CheckCircle } from 'lucide-react';

const INACTIVITY_TIMEOUT = 2 * 60 * 1000; // 5 minutes

// --- PIN storage ---
// The PIN is stored only as a salted SHA-256 hash in localStorage. It is never
// written to a cookie (cookies are sent to the server on every request).
const PIN_KEY = 'vestor_app_pin';
const MAX_PIN_ATTEMPTS = 5;

const toHex = (buf) => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');

const hashPin = async (pin, salt) => {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  return toHex(await crypto.subtle.digest('SHA-256', data));
};

const setSavedPin = async (pin) => {
  try {
    const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
    localStorage.setItem(PIN_KEY, `v1:${salt}:${await hashPin(pin, salt)}`);
    // Remove the legacy plaintext cookie if present
    document.cookie = 'vestor_app_pin=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  } catch (err) {
    console.error('Browser blocked saving the PIN:', err);
  }
};

const getSavedPin = () => {
  try {
    const stored = localStorage.getItem(PIN_KEY);
    if (stored) return stored;
    // Legacy: PIN previously kept in plaintext in a cookie
    const match = document.cookie.match(/(?:^|;\s*)vestor_app_pin=([^;]*)/);
    if (match && match[1]) return match[1];
  } catch (err) {
    console.error('Browser blocked reading the PIN:', err);
  }
  return null;
};

const verifyPin = async (pin) => {
  const stored = getSavedPin();
  if (!stored) return false;
  if (stored.startsWith('v1:')) {
    const [, salt, hash] = stored.split(':');
    return (await hashPin(pin, salt)) === hash;
  }
  // Legacy plaintext PIN: compare, then upgrade to hashed storage
  if (stored === pin) {
    await setSavedPin(pin);
    return true;
  }
  return false;
};

// --- Initial State Helper ---
// Checks if the user explicitly unlocked the app during this browser session
const getInitialLockState = () => {
  const hasPin = !!getSavedPin();
  if (!hasPin) return false; // If no PIN exists, don't lock on refresh (wait for timer to trigger setup)
  
  const sessionLockState = sessionStorage.getItem('vestor_is_locked');
  if (sessionLockState === 'false') return false; // User already unlocked it in this tab
  
  return true; // Default to locked if they have a PIN and haven't unlocked this session
};

const LockScreen = () => {
  const { logout } = useAuth();
  
  // FIX: Read from sessionStorage on initial load
  const [isLocked, setIsLocked] = useState(getInitialLockState);
  const [isSetupMode, setIsSetupMode] = useState(false);
  
  const [digits, setDigits] = useState(['', '', '', '']);
  const [confirmDigits, setConfirmDigits] = useState(['', '', '', '']);
  const [setupFirstPin, setSetupFirstPin] = useState(''); 
  
  const [step, setStep] = useState(1); 
  const [error, setError] = useState('');
  
  const timerRef = useRef(null);
  const inputRefs = useRef([]);

  const lockApp = useCallback(() => {
    const hasPin = !!getSavedPin();
    setIsLocked(true);
    sessionStorage.setItem('vestor_is_locked', 'true'); // Save locked state to session
    setIsSetupMode(!hasPin);
    setStep(1);
  }, []);

  const unlockApp = useCallback(() => {
    setIsLocked(false);
    sessionStorage.setItem('vestor_is_locked', 'false'); // Save unlocked state to session
  }, []);

  const resetTimer = useCallback(() => {
    if (isLocked) return;
    
    // Only apply on desktop sizing
    if (window.innerWidth <= 768) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    
    timerRef.current = setTimeout(lockApp, INACTIVITY_TIMEOUT);
  }, [isLocked, lockApp]);

  useEffect(() => {
    resetTimer();

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    const handleActivity = () => resetTimer();

    events.forEach(event => window.addEventListener(event, handleActivity));

    const handleResize = () => {
      if (window.innerWidth <= 768 && isLocked) {
        unlockApp();
        if (timerRef.current) clearTimeout(timerRef.current);
      } else if (window.innerWidth > 768 && !isLocked) {
        resetTimer();
      }
    };
    
    window.addEventListener('resize', handleResize);

    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity));
      window.removeEventListener('resize', handleResize);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resetTimer, isLocked, unlockApp]);

  useEffect(() => {
    if (isLocked) {
      setDigits(['', '', '', '']);
      setConfirmDigits(['', '', '', '']);
      setSetupFirstPin('');
      setError('');
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [isLocked]); 

  const handleValidation = async (enteredPin) => {
    if (isSetupMode) {
      if (step === 1) {
        setSetupFirstPin(enteredPin);
        setStep(2);
        setConfirmDigits(['', '', '', '']);
        setTimeout(() => inputRefs.current[0]?.focus(), 50);
      } else {
        if (setupFirstPin === enteredPin) {
          await setSavedPin(enteredPin);
          sessionStorage.removeItem('vestor_pin_attempts');
          unlockApp();
          resetTimer();
        } else {
          setError('PINs do not match. Try again.');
          setStep(1);
          setSetupFirstPin('');
          setDigits(['', '', '', '']);
          setConfirmDigits(['', '', '', '']);
          setTimeout(() => inputRefs.current[0]?.focus(), 50);
        }
      }
    } else {
      if (await verifyPin(enteredPin)) {
        sessionStorage.removeItem('vestor_pin_attempts');
        unlockApp();
        resetTimer();
      } else {
        const attempts = Number(sessionStorage.getItem('vestor_pin_attempts') || 0) + 1;
        sessionStorage.setItem('vestor_pin_attempts', String(attempts));
        if (attempts >= MAX_PIN_ATTEMPTS) {
          // Too many wrong guesses: end the session so the PIN can't be brute-forced.
          sessionStorage.removeItem('vestor_pin_attempts');
          sessionStorage.removeItem('vestor_is_locked');
          logout();
          return;
        }
        setError(`Incorrect PIN (${MAX_PIN_ATTEMPTS - attempts} attempts left)`);
        setDigits(['', '', '', '']);
        setTimeout(() => inputRefs.current[0]?.focus(), 50);
      }
    }
  };

  const handleDigitChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const digit = value.length > 1 ? value.slice(-1) : value;
    
    const currentArray = (isSetupMode && step === 2) ? [...confirmDigits] : [...digits];
    currentArray[index] = digit;
    
    if (isSetupMode && step === 2) {
      setConfirmDigits(currentArray);
    } else {
      setDigits(currentArray);
    }

    setError('');

    if (digit !== '') {
      if (index < 3) {
        inputRefs.current[index + 1]?.focus();
      } else {
        handleValidation(currentArray.join(''));
      }
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      const currentArray = (isSetupMode && step === 2) ? confirmDigits : digits;
      if (currentArray[index] === '' && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const handleLogout = () => {
    unlockApp();
    logout();
  };

  const activeArray = (isSetupMode && step === 2) ? confirmDigits : digits;
  const filledCount = activeArray.filter(Boolean).length;
  const title = isSetupMode ? (step === 1 ? 'Set up a PIN' : 'Confirm your PIN') : 'Welcome back';
  const subtitle = isSetupMode
    ? (step === 1 ? 'Create a 4-digit PIN to secure the app.' : 'Enter the same PIN again.')
    : 'Enter your 4-digit PIN to unlock.';

  // On-screen keypad (mobile)
  const pressDigit = (d) => {
    const index = activeArray.findIndex(v => v === '');
    if (index !== -1) handleDigitChange(index, d);
  };
  const pressBackspace = () => {
    const last = activeArray.map(Boolean).lastIndexOf(true);
    if (last === -1) return;
    const next = [...activeArray];
    next[last] = '';
    if (isSetupMode && step === 2) setConfirmDigits(next); else setDigits(next);
    setError('');
  };
  const keyClass = 'h-[72px] rounded-full text-[1.75rem] font-manrope font-semibold text-on-surface bg-surface-container-low active:bg-surface-container-highest transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary';

  return (
    <div 
      // FIX: Increased blur from backdrop-blur-sm to backdrop-blur-xl and lowered background opacity
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background/80 backdrop-blur-xl max-md:bg-[#1A120B] max-md:backdrop-blur-none text-on-surface transition-transform duration-400 ease-in-out ${
        isLocked ? 'translate-y-0' : '-translate-y-full'
      }`}
      style={{ pointerEvents: isLocked ? 'auto' : 'none' }}
    >
      <div className="max-md:hidden w-full max-w-sm px-6 py-8 bg-surface-container-low border border-outline-variant/40 rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.5)] flex flex-col items-center">
        
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6 text-primary shadow-[0_0_20px_rgba(255,215,150,0.15)]">
          {isSetupMode && step === 2 ? <CheckCircle size={32} /> : <Lock size={32} />}
        </div>
        
        <h2 className="text-2xl font-headline font-bold mb-2 tracking-tight text-on-surface">
          {isSetupMode 
            ? (step === 1 ? 'Set Up PIN' : 'Confirm PIN') 
            : 'Session Locked'}
        </h2>
        
        <p className="text-on-surface-variant font-body text-center mb-8 text-sm">
          {isSetupMode 
            ? (step === 1 ? 'Create a 4-digit PIN to secure your app.' : 'Retype your PIN to confirm.') 
            : 'Enter your 4-digit PIN to continue.'}
        </p>

        <div className="flex gap-4 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <input
              key={i}
              ref={el => inputRefs.current[i] = el}
              type="password"
              inputMode="numeric"
              maxLength={2}
              value={activeArray[i]}
              onChange={(e) => handleDigitChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className="w-14 h-16 text-center text-2xl font-bold rounded-xl bg-surface-container-lowest border border-outline/20 text-on-surface focus:border-primary focus:ring-2 focus:ring-primary/50 focus:outline-none transition-all shadow-inner"
            />
          ))}
        </div>

        <div className="h-6 mb-6">
          {error && <p className="text-error text-sm font-body font-medium animate-pulse">{error}</p>}
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors text-sm font-headline font-medium px-4 py-2 rounded-lg hover:bg-surface-container"
        >
          <LogOut size={16} />
          <span>Logout instead</span>
        </button>
      </div>

      {/* ===== MOBILE: full-screen PIN pad (no system keyboard) ===== */}
      <div className="md:hidden w-full h-[100dvh] flex flex-col px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="flex justify-end">
          <button type="button" onClick={handleLogout} className="inline-flex items-center gap-1.5 min-h-[44px] px-3 -mr-3 rounded-full text-sm text-on-surface-variant hover:text-on-surface">
            <LogOut size={16} aria-hidden="true" /> Log out
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <span className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            {isSetupMode && step === 2 ? <CheckCircle size={26} aria-hidden="true" /> : <Lock size={26} aria-hidden="true" />}
          </span>
          <h2 className="mt-5 font-manrope font-extrabold text-[1.75rem] leading-tight tracking-tight text-on-surface">{title}</h2>
          <p className="mt-1.5 text-sm text-on-surface-variant">{subtitle}</p>

          <div className="mt-8 flex gap-5" role="img" aria-label={`${filledCount} of 4 digits entered`}>
            {[0, 1, 2, 3].map(i => (
              <span
                key={i}
                className={`w-3.5 h-3.5 rounded-full border-2 transition-colors duration-150 ${
                  error ? 'border-error bg-error' : i < filledCount ? 'border-primary bg-primary' : 'border-on-surface-variant/40'
                }`}
              />
            ))}
          </div>
          <p className="mt-5 h-5 text-sm font-medium text-error" role="alert">{error}</p>
        </div>

        <div className="grid grid-cols-3 gap-x-6 gap-y-3 max-w-[300px] w-full mx-auto">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
            <button key={d} type="button" onClick={() => pressDigit(d)} className={keyClass}>{d}</button>
          ))}
          <span aria-hidden="true" />
          <button type="button" onClick={() => pressDigit('0')} className={keyClass}>0</button>
          <button type="button" onClick={pressBackspace} disabled={filledCount === 0} aria-label="Delete last digit" className="h-[72px] rounded-full flex items-center justify-center text-on-surface-variant active:bg-surface-container-low disabled:opacity-30 transition-colors">
            <span className="material-symbols-outlined text-[26px]">backspace</span>
          </button>
        </div>
      </div>
    </div>
  );
};


export default LockScreen;