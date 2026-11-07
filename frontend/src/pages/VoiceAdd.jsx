import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from '../components/ui/Modal';
import AddTransactionForm from '../components/forms/AddTransactionForm';
import * as api from '../services/api';

/**
 * /voice — shortcut page for adding an expense by speaking.
 * Speech is turned into text by the browser (Web Speech API); only that text is
 * sent to our backend, which asks the user's AI model for the transaction fields.
 * The result opens the normal Add Transaction sheet, prefilled, for the user to confirm.
 */
const SpeechRecognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

const EXAMPLES = ['"Spent 250 on lunch at Swiggy"', '"Paid 1200 for petrol by card yesterday"', '"Got 50,000 salary today"'];

const VoiceAdd = () => {
  // idle | listening | thinking | error | saved
  const [phase, setPhase] = useState('idle');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const [prefill, setPrefill] = useState(null);
  const [savedLabel, setSavedLabel] = useState('');
  const [typed, setTyped] = useState('');
  const [showTyping, setShowTyping] = useState(!SpeechRecognition);
  const recRef = useRef(null);
  const finalRef = useRef('');
  const endedRef = useRef(false);

  const understand = useCallback(async (text) => {
    const clean = text.trim();
    if (!clean) { setPhase('idle'); return; }
    setTranscript(clean);
    setPhase('thinking');
    setError('');
    try {
      const fields = await api.parseSpokenTransaction(clean);
      setPrefill({ ...fields, _at: Date.now() }); // new object each time so the form re-applies it
      setPhase('idle');
    } catch (err) {
      setError(err.message || "Couldn't understand that. Please try again.");
      setPhase('error');
    }
  }, []);

  const stop = () => recRef.current?.stop();

  const start = () => {
    if (!SpeechRecognition) { setShowTyping(true); return; }
    setError('');
    setTranscript('');
    setSavedLabel('');
    finalRef.current = '';

    const rec = new SpeechRecognition();
    rec.lang = 'en-IN';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += r[0].transcript;
        else interim += r[0].transcript;
      }
      setTranscript((finalRef.current + interim).trim());
    };
    rec.onerror = (e) => {
      recRef.current = null;
      endedRef.current = true;
      if (e.error === 'aborted') { setPhase('idle'); return; }
      setError(e.error === 'not-allowed' || e.error === 'service-not-allowed'
        ? 'Microphone access is blocked. Allow it in your browser settings, or type instead.'
        : e.error === 'no-speech' ? "I didn't hear anything. Tap and try again." : 'Voice input failed. Try again or type instead.');
      setPhase('error');
    };
    rec.onend = () => {
      recRef.current = null;
      if (endedRef.current) return; // onerror already handled it
      const text = finalRef.current.trim();
      if (text) understand(text);
      else setPhase('idle');
    };

    recRef.current = rec;
    endedRef.current = false;
    setPhase('listening');
    try { rec.start(); } catch { setPhase('idle'); }
  };

  useEffect(() => () => recRef.current?.abort(), []);

  const onMic = () => {
    if (phase === 'listening') stop();
    else if (phase !== 'thinking') start();
  };

  const onSaved = (saved) => {
    setPrefill(null);
    if (!saved) {
      setError("Couldn't save the transaction. Please try again.");
      setPhase('error');
      return;
    }
    setSavedLabel(`₹${Number(saved.amount).toLocaleString('en-IN')} · ${saved.title}`);
    setTranscript('');
    setPhase('saved');
  };

  const listening = phase === 'listening';
  const thinking = phase === 'thinking' || phase === 'saving';

  const status = listening ? 'Listening… tap to finish'
    : phase === 'saving' ? 'Saving…'
    : thinking ? 'Understanding…'
    : phase === 'saved' ? 'Added. Tap to add another'
    : 'Tap and say your expense';

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#1a120b] text-on-surface">
      {/* Top bar */}
      <header className="flex items-center justify-between px-5 h-16 pt-[env(safe-area-inset-top)]">
        <Link to="/" className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors min-h-[44px]">
          <span className="material-symbols-outlined">arrow_back</span>
          <span className="text-sm font-semibold">Dashboard</span>
        </Link>
        <span className="text-lg font-headline font-extrabold tracking-tighter">Vestor</span>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <p className="text-xs uppercase tracking-widest font-bold text-on-surface-variant flex items-center gap-1.5 mb-10">
          <span className="material-symbols-outlined text-sm text-primary">auto_awesome</span>
          Voice add
        </p>

        {/* Mic button */}
        <div className="relative flex items-center justify-center w-64 h-64">
          {listening && (
            <>
              <span className="absolute inset-4 rounded-full bg-primary-container/20 animate-ping" />
              <span className="absolute inset-0 rounded-full border border-primary-container/30 animate-pulse" />
            </>
          )}
          <button
            type="button"
            onClick={onMic}
            disabled={thinking}
            aria-label={listening ? 'Stop recording' : 'Start recording'}
            aria-pressed={listening}
            className={`relative w-44 h-44 rounded-full flex items-center justify-center transition-all duration-300 active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/50
              ${listening
                ? 'bg-primary text-on-primary shadow-[0_0_80px_-10px_rgba(229,186,115,0.8)] scale-105'
                : 'bg-primary-container text-on-primary shadow-2xl shadow-primary-container/30 hover:brightness-110'}
              ${thinking ? 'opacity-80 cursor-wait' : ''}`}
          >
            {thinking ? (
              <span className="w-14 h-14 rounded-full border-4 border-on-primary/30 border-t-on-primary animate-spin" />
            ) : (
              <span className="material-symbols-outlined" style={{ fontSize: 72, fontVariationSettings: "'FILL' 1" }}>
                {listening ? 'stop' : phase === 'saved' ? 'check' : 'mic'}
              </span>
            )}
          </button>
        </div>

        <p className="mt-8 font-manrope font-bold text-lg text-center">{status}</p>

        {/* Live transcript / result */}
        <div className="mt-4 min-h-[56px] max-w-md w-full text-center">
          {transcript && (
            <p className="text-on-surface-variant text-base leading-relaxed">“{transcript}”</p>
          )}
          {!transcript && phase === 'saved' && (
            <p className="text-on-surface-variant text-sm">{savedLabel}</p>
          )}
          {!transcript && phase === 'idle' && (
            <p className="text-on-surface-variant/70 text-sm">Try {EXAMPLES[0]}</p>
          )}
        </div>

        {error && (
          <div role="alert" className="mt-2 max-w-md w-full bg-error-container/40 text-on-error-container text-sm rounded-xl px-4 py-3 text-center">
            {error}
          </div>
        )}

        {/* Typing fallback (also used when the browser has no speech recognition) */}
        <div className="mt-8 w-full max-w-md">
          {showTyping ? (
            <form
              onSubmit={(e) => { e.preventDefault(); understand(typed); setTyped(''); }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                maxLength={500}
                placeholder="e.g. Spent 250 on lunch"
                className="flex-1 bg-surface-container-lowest border border-outline/20 rounded-xl py-3 px-4 text-on-surface focus:outline-none focus:border-primary"
              />
              <button
                type="submit"
                disabled={!typed.trim() || thinking}
                className="bg-primary-container text-on-primary px-4 rounded-xl font-manrope font-bold disabled:opacity-40 active:scale-95 transition-all"
                aria-label="Understand"
              >
                <span className="material-symbols-outlined">arrow_upward</span>
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowTyping(true)}
              className="mx-auto flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface transition-colors min-h-[44px]"
            >
              <span className="material-symbols-outlined text-base">keyboard</span>
              Type instead
            </button>
          )}
          {!SpeechRecognition && (
            <p className="mt-2 text-xs text-on-surface-variant/70 text-center">Voice input isn't supported in this browser. Chrome, Edge and Safari support it.</p>
          )}
        </div>
      </main>

      <Modal isOpen={!!prefill} onClose={() => setPrefill(null)} title="New Transaction">
        {prefill && (
          <AddTransactionForm prefill={prefill} onSaved={onSaved} onClose={() => { setPrefill(null); setPhase('saving'); setTranscript(''); }} />
        )}
      </Modal>
    </div>
  );
};

export default VoiceAdd;
