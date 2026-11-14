import React from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import GmailStatementsPanel from '../components/ui/GmailStatementsPanel';
import { BackLink, PageHeader } from '../components/settings/SettingsUi';

// Settings → Email Management: Gmail connection, scanning, review queue,
// tracked emails ("Don't track"), rules and the history of untracked email types.
const EmailManagementScreen = () => {
  const { creditCards, refetchCreditCards } = useAppContext();

  return (
    <main className="pt-24 pb-32 px-4 sm:px-6 max-w-4xl w-full mx-auto min-h-screen">
      <BackLink />
      <PageHeader
        title="Email Management"
        aside={(
          <Link to="/settings/ai-training"
            className="group self-start sm:self-auto shrink-0 inline-flex items-center gap-1.5 min-h-[40px] px-4 rounded-xl text-xs font-bold text-primary border border-primary/25 bg-primary/10 hover:bg-primary/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            Teach AI (Training)
            <span className="material-symbols-outlined text-sm transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true">arrow_forward</span>
          </Link>
        )}
      >
        Connect Gmail, review the bank emails Vestor couldn&apos;t read, and stop tracking promotions or unrelated
        emails. Anything you stop tracking is listed under Rules &amp; Ignored, where you can undo it.
      </PageHeader>

      <GmailStatementsPanel creditCards={creditCards} onCardsChanged={refetchCreditCards} />
    </main>
  );
};

export default EmailManagementScreen;
