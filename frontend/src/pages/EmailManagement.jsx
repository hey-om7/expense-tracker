import React from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import GmailStatementsPanel from '../components/ui/GmailStatementsPanel';

// Settings → Email management: Gmail connection, scanning, review queue,
// tracked emails ("Don't track") and the history of untracked email types.
const EmailManagementScreen = () => {
  const { creditCards, refetchCreditCards } = useAppContext();

  return (
    <main className="pt-24 pb-32 px-4 sm:px-6 max-w-4xl w-full mx-auto min-h-screen">
      <Link to="/settings" className="group inline-flex items-center gap-1 text-xs font-semibold text-on-surface-variant hover:text-on-surface transition-colors">
        <span className="material-symbols-outlined text-sm transition-transform group-hover:-translate-x-0.5 motion-reduce:transition-none" aria-hidden="true">arrow_back</span>
        Settings
      </Link>

      <header className="mt-5 mb-8 max-w-2xl">
        <h1 className="font-headline font-extrabold text-on-surface tracking-tight leading-[1.02] text-[clamp(2rem,4.2vw,3rem)]">
          Email management
        </h1>
        <p className="mt-4 text-sm text-on-surface-variant leading-relaxed max-w-xl">
          Connect Gmail, scan for bank emails, review the ones Vestor couldn&apos;t read, and stop tracking promotions
          or unrelated emails. Anything you stop tracking is listed under Untracked emails, where you can undo it.
        </p>
      </header>

      <GmailStatementsPanel creditCards={creditCards} onCardsChanged={refetchCreditCards} />

      <Link to="/settings/ai-training" className="group mt-6 flex items-center gap-3 px-4 py-3 rounded-xl border border-outline/15 hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors">
        <span className="material-symbols-outlined text-lg text-primary" aria-hidden="true">school</span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-on-surface">AI training</span>
          <span className="block text-xs text-on-surface-variant">Correct how expense emails are read.</span>
        </span>
        <span className="material-symbols-outlined text-base text-on-surface-variant ml-auto transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true">arrow_forward</span>
      </Link>
    </main>
  );
};

export default EmailManagementScreen;
