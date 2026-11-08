import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from '../components/ui/Modal';
import AddTransactionForm from '../components/forms/AddTransactionForm';
import * as api from '../services/api';
import { useAppContext } from '../context/AppContext';

/**
 * /voice — shortcut page for adding an expense by speaking.
 * Speech is turned into text by the browser (Web Speech API); only that text is
 * sent to our backend, which asks the user's AI model for the transaction fields.
 * The result opens the normal Add Transaction sheet, prefilled, for the user to confirm.
 */
const SpeechRecognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

const EXAMPLES = ['"Spent 250 on lunch at Swiggy"', '"Paid 1200 for petrol by card yesterday"', '"Got 50,000 salary today"'];

const LANGUAGES = [
  { code: 'en-IN', label: 'English (India)' },
  { code: 'hi-IN', label: 'Hindi / Hinglish' },
  { code: 'en-US', label: 'English (US)' },
];
const LANG_KEY = 'vestor_voice_lang';
const MAX_ALTERNATIVES = 4;
// Stop after this much silence once something has been heard.
const SILENCE_MS = 2000;
// Android Chrome's continuous mode repeats earlier words in later results, so
// there we keep the one-phrase mode, which stops at the first pause.
const CONTINUOUS = typeof navigator !== 'undefined' && !/Android/i.test(navigator.userAgent);

// Builds up to MAX_ALTERNATIVES full-sentence readings from per-phrase guesses:
// reading k uses guess k for one phrase and the top guess for the rest.
const buildReadings = (segments) => {
  const best = segments.map(s => s[0]).join(' ').replace(/\s+/g, ' ').trim();
  const readings = [best];
  segments.forEach((alts, i) => {
    alts.slice(1).forEach(alt => {
      const r = segments.map((s, j) => (j === i ? alt : s[0])).join(' ').replace(/\s+/g, ' ').trim();
      if (r && !readings.includes(r)) readings.push(r);
    });
  });
  return { best, alternatives: readings.slice(1, MAX_ALTERNATIVES + 1) };
};

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
  const segmentsRef = useRef([]); // one array of guesses per finished phrase
  const endedRef = useRef(false);
  const silenceRef = useRef(null);
  const [lang, setLang] = useState(() => {
    const saved = typeof localStorage !== 'undefined' && localStorage.getItem(LANG_KEY);
    return LANGUAGES.some(l => l.code === saved) ? saved : 'en-IN';
  });
  const changeLang = (code) => { setLang(code); localStorage.setItem(LANG_KEY, code); };

  const { ensureTransactions } = useAppContext();

  const understand = useCallback(async (text, alternatives = []) => {
    const clean = text.trim();
    if (!clean) { setPhase('idle'); return; }
    // Past transactions let the form reuse a category; fetch them while the AI parses.
    ensureTransactions?.();
    setTranscript(clean);
    setPhase('thinking');
    setError('');
    try {
      const fields = await api.parseSpokenTransaction(clean, alternatives);
      setPrefill({ ...fields, _at: Date.now() }); // new object each time so the form re-applies it
      setPhase('idle');
    } catch (err) {
      setError(err.message || "Couldn't understand that. Please try again.");
      setPhase('error');
    }
  }, [ensureTransactions]);

  const stop = () => { clearTimeout(silenceRef.current); recRef.current?.stop(); };

  const start = () => {
    if (!SpeechRecognition) { setShowTyping(true); return; }
    setError('');
    setTranscript('');
    setSavedLabel('');
    segmentsRef.current = [];

    const rec = new SpeechRecognition();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = CONTINUOUS;
    rec.maxAlternatives = MAX_ALTERNATIVES;

    // In continuous mode the browser never stops on its own; end after a pause.
    const armSilenceTimer = () => {
      if (!CONTINUOUS) return;
      clearTimeout(silenceRef.current);
      silenceRef.current = setTimeout(() => recRef.current?.stop(), SILENCE_MS);
    };

    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const r = e.results[i];
        if (r.isFinal) {
          const guesses = Array.from(r, a => a.transcript.trim()).filter(Boolean);
          if (guesses.length) segmentsRef.current[i] = guesses;
        } else {
          interim += r[0].transcript;
        }
      }
      const finalText = segmentsRef.current.filter(Boolean).map(s => s[0]).join(' ');
      setTranscript(`${finalText} ${interim}`.replace(/\s+/g, ' ').trim());
      armSilenceTimer();
    };
    rec.onerror = (e) => {
      clearTimeout(silenceRef.current);
      recRef.current = null;
      endedRef.current = true;
      if (e.error === 'aborted') { setPhase('idle'); return; }
      setError(e.error === 'not-allowed' || e.error === 'service-not-allowed'
        ? 'Microphone access is blocked. Allow it in your browser settings, or type instead.'
        : e.error === 'no-speech' ? "I didn't hear anything. Tap and try again."
        : e.error === 'language-not-supported' ? 'This browser can\'t recognize the selected language. Pick another one.'
        : 'Voice input failed. Try again or type instead.');
      setPhase('error');
    };
    rec.onend = () => {
      clearTimeout(silenceRef.current);
      recRef.current = null;
      if (endedRef.current) return; // onerror already handled it
      const segments = segmentsRef.current.filter(Boolean);
      if (!segments.length) { setPhase('idle'); return; }
      const { best, alternatives } = buildReadings(segments);
      understand(best, alternatives);
    };

    recRef.current = rec;
    endedRef.current = false;
    setPhase('listening');
    try { rec.start(); } catch { setPhase('idle'); }
  };

  useEffect(() => () => { clearTimeout(silenceRef.current); recRef.current?.abort(); }, []);

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
        <p className="text-xs uppercase tracking-widest font-bold text-on-surface-variant flex items-center gap-1.5 mb-3">
          <span className="material-symbols-outlined text-sm text-primary">auto_awesome</span>
          Voice add
        </p>
        {SpeechRecognition && (
          <label className="mb-7 flex items-center gap-2 text-xs text-on-surface-variant">
            <span className="material-symbols-outlined text-sm">translate</span>
            <span className="sr-only">Speech language</span>
            <select
              value={lang}
              onChange={(e) => changeLang(e.target.value)}
              disabled={listening || thinking}
              className="bg-surface-container-lowest border border-outline/20 rounded-lg py-1.5 px-2 text-on-surface text-xs focus:outline-none focus:border-primary disabled:opacity-50"
            >
              {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </label>
        )}

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
