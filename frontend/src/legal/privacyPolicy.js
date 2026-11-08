import { operatorName, contactLine } from './operator';

/**
 * Vestor Privacy Policy.
 *
 * Content blocks: { p }, { ul: [] }, { note }, { table: { head: [], rows: [[]] } }.
 * Every statement here should match what the code does. When a data practice
 * changes, update this file and bump `version` (users who signed up under an older
 * version keep their recorded consent version on their account).
 */
export const PRIVACY_VERSION = '2026-11-08';

export const privacyPolicy = () => ({
  title: 'Privacy Policy',
  version: PRIVACY_VERSION,
  effectiveDate: '8 November 2026',
  intro: `This policy explains what information ${operatorName()} collects when you use Vestor, how it is used, who it is shared with, and the choices you have. Vestor is a personal finance tracker: the information it holds is the financial information you add to it or ask it to read.`,
  summary: [
    'We collect what you enter (transactions, investments, subscriptions, cards) and, only if you connect Gmail, details extracted from bank emails.',
    'We store only the last 4 digits of cards. We never ask for bank passwords, full card numbers or CVVs.',
    'Email bodies are not saved. Voice is turned into text by your browser; we never receive audio.',
    'AI features send the minimum data needed to Groq, and only when you use them.',
    'We do not sell your data, show ads or use analytics or tracking scripts.',
  ],
  sections: [
    {
      id: 'collect',
      title: 'Information we collect',
      blocks: [
        { h: 'Account information' },
        { ul: [
          'Your name and email address.',
          'Your password, stored only as a bcrypt hash. We cannot read it.',
          'If you sign in with Google: your Google account ID, name and verified email address. We do not store your Google profile photo or Google sign-in tokens.',
          'Account security records: whether your email is verified, failed sign-in counts and temporary lockouts, and one-time tokens for email verification and password reset (stored as hashes).',
        ] },
        { h: 'Financial information you add' },
        { ul: [
          'Transactions: type (income, expense, investment buy or sell), amount, title, notes, category and date.',
          'Categories you create, including their name, colour and icon.',
          'Investments: name, ticker or scheme code, type, comments, and each buy or sell with quantity, price and date.',
          'Subscriptions and recurring payments: name, amount, billing period, start, end and expiry dates.',
          'Credit cards: a name you choose, the last 4 digits, credit limit, bill due date, bill amount and notes.',
        ] },
        { note: 'Vestor does not connect to your bank accounts. We never collect bank login details, full card numbers, CVVs, card expiry dates or UPI PINs.' },
        { h: 'Information from Gmail (only if you connect it)' },
        { p: 'See "Gmail integration" below for exactly what is read and kept.' },
        { h: 'Settings' },
        { ul: [
          'AI preferences: whether AI is on, the AI model you picked and, if you add one, your Groq API key (stored encrypted).',
          'Whether email reminders and AI email processing are on, and which in-app tutorials you have seen.',
          'In-app notifications we create for you, such as bill reminders.',
        ] },
        { h: 'Technical information' },
        { ul: [
          'Your IP address is used to limit repeated requests (for example, too many sign-in attempts). These records expire automatically.',
          'Our servers keep operational logs, such as error messages, to keep the service running.',
          'We do not use analytics, advertising or tracking scripts.',
        ] },
      ],
    },
    {
      id: 'gmail',
      title: 'Gmail integration',
      blocks: [
        { p: 'Connecting Gmail is optional. When you connect it, you grant Vestor read-only access to Gmail through Google. Vestor cannot send, delete or change your email.' },
        { ul: [
          'Which emails: Vestor searches only for messages from a fixed list of bank and card-issuer sender domains (for example HDFC, ICICI, Axis, SBI Card, Kotak and PhonePe). Other emails are not requested.',
          'When: the first scan covers the last 90 days. After that, Vestor checks for new messages about every 30 minutes and when you open the app.',
          'What is kept: for each matching email, the sender domain, subject, date, Gmail message ID and the details found in it, such as amount, due date, statement date, card last 4 digits, merchant and payment method.',
          'What is not kept: the email body. Messages are read in memory to extract those details and then discarded. Vestor may read a message again later to improve the details it extracted.',
          'The access token Google gives us is stored encrypted (AES-256-GCM) and is used only to read these emails.',
        ] },
        { p: 'Disconnecting Gmail in Vestor asks Google to revoke our access and deletes the stored token. Statements, payment suggestions and card bill amounts already extracted stay in your account. Dismissing them in the app hides them but does not delete them; to have them deleted, contact us (see "Your choices and requests"). You can also remove Vestor\'s access at any time from your Google Account permissions page.' },
        { p: 'Vestor\'s use of information received from Google APIs is limited to providing the features described here.' },
      ],
    },
    {
      id: 'ai',
      title: 'AI features',
      blocks: [
        { p: 'Vestor\'s AI features are provided by Groq, Inc. Data sent to Groq is handled under Groq\'s own terms and privacy policy.' },
        { table: {
          head: ['Feature', 'What is sent to Groq', 'When'],
          rows: [
            ['AI assistant (chat)', 'Your question, your first name and categories, and only the records the question needs: matching transactions (amount, title, notes, category, date), investments, subscriptions and cards (name, last 4 digits, limit, due date).', 'Only when you send a message, using your own Groq API key.'],
            ['Voice quick-add', 'The text of what you said and your category names.', 'Only when you use voice add, using your own Groq API key.'],
            ['AI email processing', 'The sender, subject and text of bank emails Vestor reads, with some sensitive numbers masked first.', 'Only if you turn on "AI email processing" in Settings. It is off by default. This may use a Vestor-provided API key or yours.'],
          ],
        } },
        { p: 'AI answers can be wrong. Check anything important against your own records.' },
      ],
    },
    {
      id: 'voice',
      title: 'Voice input',
      blocks: [
        { p: 'Voice quick-add uses your browser\'s built-in speech recognition. Vestor receives only the resulting text, never audio. Some browsers (for example Google Chrome) send audio to their own speech service to do this; that is governed by your browser provider\'s privacy policy.' },
      ],
    },
    {
      id: 'use',
      title: 'How we use information',
      blocks: [
        { ul: [
          'To provide Vestor: show your dashboard, history, analytics, investments, bills and suggestions.',
          'To run features you set up: record recurring subscription payments, read bank emails you connected, and answer AI questions.',
          'To send you emails: account verification, password reset, bill and subscription reminders, and notices when new statements are found. You can turn reminder emails off in Settings.',
          'To fetch market prices for the investments you track.',
          'To keep accounts secure and prevent abuse.',
        ] },
        { p: 'We do not sell your information, use it for advertising, or use it to build profiles for anyone else.' },
      ],
    },
    {
      id: 'sharing',
      title: 'Service providers we rely on',
      blocks: [
        { p: 'We share information only with the providers below, only as needed to run the feature named.' },
        { table: {
          head: ['Provider', 'Purpose', 'What they receive'],
          rows: [
            ['Google', 'Sign in with Google, Gmail access, web fonts', 'Sign-in and Gmail requests you authorise. Loading the app fetches fonts and the sign-in script from Google, which receives your IP address.'],
            ['Groq', 'AI features', 'See "AI features".'],
            ['Yahoo Finance', 'Stock prices and history', 'Ticker symbols and search terms, sent from our server, not linked to you.'],
            ['MFAPI (mfapi.in)', 'Mutual fund search and prices', 'Fund search terms and scheme codes, sent from your browser (so it receives your IP address).'],
            ['Have I Been Pwned', 'Checking new passwords against known breaches', 'The first 5 characters of a hash of the password. Never the password itself.'],
            ['Our email provider', 'Sending account and reminder emails', 'Your email address and the email content.'],
            ['Hosting and database providers', 'Running the service and storing data', 'All data stored in Vestor, held on our behalf.'],
          ],
        } },
        { p: 'We may also disclose information if required by law, or to protect the rights and safety of users or the service.' },
      ],
    },
    {
      id: 'security',
      title: 'How information is protected',
      blocks: [
        { ul: [
          'Connections to Vestor in production use HTTPS. Your session is an HTTP-only cookie that page scripts cannot read, valid for up to 7 days.',
          'Passwords are hashed with bcrypt. Verification and reset links expire (24 hours and 1 hour) and are stored as hashes.',
          'Signing out, or resetting your password, ends your existing sessions.',
          'Gmail access tokens and Groq API keys are encrypted with AES-256-GCM.',
          'Requests are rate-limited, and accounts are temporarily locked after repeated failed sign-ins.',
          'Every account can only access its own data.',
        ] },
        { p: 'Other financial records (transactions, investments, cards, extracted email details) are not separately encrypted by Vestor. They are protected by access controls and by the security of our hosting and database providers.' },
        { p: 'The app PIN is a convenience lock on your device. It is stored only in your browser and does not protect your data on our servers.' },
        { p: 'No system is completely secure. If we learn of a breach that affects your information, we will tell you as required by law.' },
      ],
    },
    {
      id: 'retention',
      title: 'How long we keep information',
      blocks: [
        { ul: [
          'Your account and financial records are kept until you delete them or your account is deleted.',
          'Records you delete inside Vestor (transactions, categories, investments, subscriptions, cards, notifications) are removed from our database.',
          'Rate-limit records expire automatically. Verification and reset tokens stop working when they expire.',
          'Details extracted from Gmail are kept, including after you disconnect Gmail or dismiss them, until your account is deleted or you ask us to delete them.',
        ] },
      ],
    },
    {
      id: 'choices',
      title: 'Your choices and requests',
      blocks: [
        { ul: [
          'View, edit and delete your records at any time in the app.',
          'Disconnect Gmail, turn AI features or AI email processing off, and turn reminder emails off, in Settings.',
          'Remove your Groq API key in Settings.',
        ] },
        { p: `Vestor does not yet offer self-service account deletion or data export. To ask for a copy of your information, a correction, or deletion of your account and all associated data, email ${contactLine()}. We may need to confirm the request comes from the account owner.` },
        { p: 'Depending on where you live, you may have further rights under data protection law. You can contact us to exercise them.' },
      ],
    },
    {
      id: 'storage',
      title: 'Cookies and browser storage',
      blocks: [
        { p: 'Vestor uses one cookie and a few browser storage entries, all needed for the app to work. None are used for tracking.' },
        { table: {
          head: ['Name', 'Type', 'Purpose'],
          rows: [
            ['vestor_session', 'Cookie (HTTP-only)', 'Keeps you signed in, up to 7 days.'],
            ['vestor_app_pin', 'Local storage', 'A salted hash of your app PIN, so it can be checked on this device.'],
            ['vestor_session_hint', 'Local storage', 'Remembers that this browser was signed in, so the PIN screen shows straight away. Holds no personal data.'],
            ['vestor_is_locked, vestor_pin_attempts', 'Session storage', 'Whether the app is locked in this tab, and wrong PIN attempts.'],
            ['Voice language, investment cache', 'Local and session storage', 'Your voice input language and recently loaded price data.'],
          ],
        } },
        { p: 'Google may set its own cookies when the Sign in with Google script loads.' },
      ],
    },
    {
      id: 'children',
      title: 'Children',
      blocks: [
        { p: 'Vestor is not intended for anyone under 18, and we do not knowingly collect information from children.' },
      ],
    },
    {
      id: 'transfers',
      title: 'Where information is processed',
      blocks: [
        { p: 'Vestor is designed for users in India, but our service providers may process information in other countries. By using Vestor you understand your information may be transferred to and processed in those countries.' },
      ],
    },
    {
      id: 'changes',
      title: 'Changes to this policy',
      blocks: [
        { p: 'We will update this page when our practices change and change the effective date above. For significant changes we will tell you in the app or by email before they take effect.' },
      ],
    },
    {
      id: 'contact',
      title: 'Contact',
      blocks: [
        { p: `Questions or requests about privacy: ${contactLine()}.` },
      ],
    },
  ],
});
