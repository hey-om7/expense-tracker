import { operator, operatorName, contactLine, missing } from './operator';

/**
 * Vestor Terms of Service. Same block format as privacyPolicy.js.
 * Bump `version` when the terms change materially.
 */
export const TERMS_VERSION = '2026-11-08';

export const termsOfService = () => ({
  title: 'Terms of Service',
  version: TERMS_VERSION,
  effectiveDate: '8 November 2026',
  intro: `These terms govern your use of Vestor, a personal finance tracking app operated by ${operatorName()} ("we", "us"). By creating an account or using Vestor you agree to them. If you do not agree, do not use Vestor.`,
  summary: [
    'Vestor helps you record and organise your own finances. It is not financial, investment, tax or legal advice.',
    'Amounts read from emails, market prices and AI answers can be wrong. Check them before relying on them.',
    'You are responsible for your account, your PIN and the data you add.',
    'You can stop using Vestor at any time.',
  ],
  sections: [
    {
      id: 'service',
      title: 'What Vestor is',
      blocks: [
        { p: 'Vestor lets you record income, expenses, investments, subscriptions and credit card bills, view summaries and analytics, receive reminders, and optionally read bank emails from Gmail and ask an AI assistant about your data.' },
        { p: 'Vestor is a record-keeping and organisational tool. It does not hold money, move money, make payments, connect to your bank accounts, or carry out trades.' },
      ],
    },
    {
      id: 'advice',
      title: 'Not financial advice',
      blocks: [
        { note: 'Nothing in Vestor, including dashboards, analytics, investment figures, reminders and AI assistant answers, is financial, investment, tax, accounting or legal advice, or a recommendation to buy, sell or hold anything.' },
        { p: 'We are not a bank, broker, investment adviser or tax professional. Decide for yourself, and consult a qualified professional before making financial decisions.' },
      ],
    },
    {
      id: 'accuracy',
      title: 'Accuracy of information',
      blocks: [
        { ul: [
          'Details extracted from emails (amounts, due dates, merchants) are read automatically and may be missing or wrong. Review suggestions before saving them.',
          'Stock and mutual fund prices come from third-party sources, may be delayed, and may be inaccurate.',
          'AI answers are generated automatically and can be incorrect or incomplete.',
          'Bill and subscription reminders depend on the dates you or your emails provide. Do not rely on Vestor as your only reminder for payments.',
          'Your bank, card issuer or broker\'s records are the authoritative source.',
        ] },
      ],
    },
    {
      id: 'account',
      title: 'Your account',
      blocks: [
        { ul: [
          'You must be at least 18 years old and provide accurate account information.',
          'Keep your password and app PIN confidential. You are responsible for activity on your account.',
          'The app PIN locks the app on your device only. It is not a substitute for securing your device and your account password.',
          'Tell us promptly if you believe your account has been accessed without permission.',
        ] },
      ],
    },
    {
      id: 'third-party',
      title: 'Third-party services',
      blocks: [
        { p: 'Some features depend on services we do not control, including Google (sign-in and Gmail), Groq (AI), Yahoo Finance and MFAPI (prices). Your use of those services is also subject to their terms. If you add your own Groq API key, you are responsible for your Groq account and any usage charges.' },
        { p: 'These services may change or stop working, and the related Vestor features may then be limited or unavailable.' },
      ],
    },
    {
      id: 'gmail',
      title: 'Gmail access',
      blocks: [
        { p: 'Connecting Gmail is optional. By connecting it you authorise Vestor to read emails from supported bank and card-issuer senders, as described in the Privacy Policy. You can disconnect at any time in the app or from your Google Account.' },
      ],
    },
    {
      id: 'acceptable-use',
      title: 'Acceptable use',
      blocks: [
        { p: 'You agree not to:' },
        { ul: [
          'Use Vestor for anyone else\'s finances without their permission, or for any unlawful purpose.',
          'Try to access other users\' accounts or data, or probe, scan or test the service\'s security without our written permission.',
          'Interfere with the service, overload it, or get around its rate limits or access controls.',
          'Use automated means to access the service other than the app itself.',
          'Try to make the AI assistant reveal information about other users or about the service\'s internal systems.',
        ] },
      ],
    },
    {
      id: 'data',
      title: 'Your data',
      blocks: [
        { p: 'You own the information you add to Vestor. You give us permission to store and process it only to provide the service to you, as described in the Privacy Policy.' },
        { p: `You can delete individual records at any time in the app. To delete your account and all associated data, email ${contactLine()}.` },
      ],
    },
    {
      id: 'availability',
      title: 'Availability and changes',
      blocks: [
        { p: 'We work to keep Vestor available, but we do not guarantee it will be uninterrupted or error-free. We may change, add or remove features. Keep your own records of anything important; Vestor does not currently offer a data export.' },
      ],
    },
    {
      id: 'termination',
      title: 'Ending your use',
      blocks: [
        { p: 'You may stop using Vestor at any time. We may suspend or close accounts that break these terms or put the service or other users at risk. Where reasonable, we will tell you first.' },
      ],
    },
    {
      id: 'disclaimer',
      title: 'Disclaimer',
      blocks: [
        { p: 'To the extent permitted by law, Vestor is provided "as is" and "as available", without warranties of any kind, including that it is accurate, complete, fit for a particular purpose or free of errors.' },
      ],
    },
    {
      id: 'liability',
      title: 'Limitation of liability',
      blocks: [
        { p: 'To the extent permitted by law, we are not liable for indirect or consequential losses, or for losses arising from: financial decisions you make using Vestor; missed or late payments; inaccurate extracted data, prices or AI answers; or the acts of third-party services. Nothing in these terms limits liability that cannot be limited by law.' },
      ],
    },
    {
      id: 'law',
      title: 'Governing law',
      blocks: [
        { p: `These terms are governed by ${operator.governingLaw || missing('governing law')}, and disputes will be handled by ${operator.courtsLocation || missing('courts')}.` },
      ],
    },
    {
      id: 'changes',
      title: 'Changes to these terms',
      blocks: [
        { p: 'We may update these terms. We will change the effective date above and, for significant changes, tell you in the app or by email before they take effect. Continuing to use Vestor after that means you accept the updated terms.' },
      ],
    },
    {
      id: 'contact',
      title: 'Contact',
      blocks: [
        { p: `Questions about these terms: ${contactLine()}.` },
      ],
    },
  ],
});
