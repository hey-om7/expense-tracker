import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Lock, LogOut, CheckCircle } from 'lucide-react';

const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// --- Bulletproof Storage Helper Functions ---
let sessionMemoryPin = null; 

const setSavedPin = (pin) => {
  sessionMemoryPin = pin; 
  try {
    localStorage.setItem('wallo_app_pin', pin);
    document.cookie = `wallo_app_pin=${pin}; max-age=31536000; path=/`;
  } catch (err) {
    console.error('❌ Browser blocked saving to LocalStorage:', err);
  }
};

const getSavedPin = () => {
  if (sessionMemoryPin) return sessionMemoryPin;

  try {
    const localPin = localStorage.getItem('wallo_app_pin');
    if (localPin) {
      sessionMemoryPin = localPin; 
      return localPin;
    }

    const match = document.cookie.match(/(?:^|;\s*)wallo_app_pin=([^;]*)/);
    if (match && match[1]) {
      localStorage.setItem('wallo_app_pin', match[1]);
      sessionMemoryPin = match[1];
      return match[1];
    }
  } catch (err) {
    console.error('❌ Browser blocked reading from LocalStorage:', err);
  }
  
  return null;
};

// --- Initial State Helper ---
// Checks if the user explicitly unlocked the app during this browser session
const getInitialLockState = () => {
  const hasPin = !!getSavedPin();
  if (!hasPin) return false; // If no PIN exists, don't lock on refresh (wait for timer to trigger setup)
  
  const sessionLockState = sessionStorage.getItem('wallo_is_locked');
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
    sessionStorage.setItem('wallo_is_locked', 'true'); // Save locked state to session
    setIsSetupMode(!hasPin);
    setStep(1);
  }, []);

  const unlockApp = useCallback(() => {
    setIsLocked(false);
    sessionStorage.setItem('wallo_is_locked', 'false'); // Save unlocked state to session
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

  const handleValidation = (enteredPin) => {
    if (isSetupMode) {
      if (step === 1) {
        setSetupFirstPin(enteredPin);
        setStep(2);
        setConfirmDigits(['', '', '', '']);
        setTimeout(() => inputRefs.current[0]?.focus(), 50);
      } else {
        if (setupFirstPin === enteredPin) {
          setSavedPin(enteredPin);
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
      const storedPin = getSavedPin();
      if (enteredPin === storedPin) {
        unlockApp();
        resetTimer();
      } else {
        setError('Incorrect PIN');
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

  return (
    <div 
      // FIX: Increased blur from backdrop-blur-sm to backdrop-blur-xl and lowered background opacity
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background/80 backdrop-blur-xl text-on-surface transition-transform duration-400 ease-in-out ${
        isLocked ? 'translate-y-0' : '-translate-y-full'
      }`}
      style={{ pointerEvents: isLocked ? 'auto' : 'none' }}
    >
      <div className="w-full max-w-sm px-6 py-8 bg-surface-container-low border border-outline-variant/40 rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.5)] flex flex-col items-center">
        
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
    </div>
  );
};

export default LockScreen;