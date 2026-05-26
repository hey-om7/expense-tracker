const cron = require('node-cron');
const Subscription = require('../models/Subscription');
const CreditCard = require('../models/CreditCard');
const Notification = require('../models/Notification');
const User = require('../models/User');
const UserPreferences = require('../models/UserPreferences');
const GmailScanState = require('../models/GmailScanState');
const { sendEmail } = require('./emailService');
const { scanGmailForBills } = require('./gmailScanner');

/**
 * Get tomorrow's date at midnight (UTC) for comparison
 */
const getTomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
};

const isSameDay = (d1, d2) => {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
};

const todayStr = () => new Date().toISOString().split('T')[0];

/**
 * Check if a reminder was already sent today for this record
 */
const alreadySentToday = (lastReminderDate) => {
  if (!lastReminderDate) return false;
  return isSameDay(new Date(lastReminderDate), new Date());
};

/**
 * Process subscription reminders and auto-deactivate expired subscriptions
 * Handles subscriptions that expired long ago (days, months, years back)
 */
const processSubscriptions = async () => {
  const tomorrow = getTomorrow();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeSubs = await Subscription.find({ isActive: true });

  for (const sub of activeSubs) {

    // ─── Auto-deactivate expired one_time subscriptions ───
    // Catches both yesterday and any date in the past (long overdue)
    if (sub.period === 'one_time' && sub.expiryDate) {
      const expiry = new Date(sub.expiryDate);
      expiry.setHours(0, 0, 0, 0);

      if (expiry < today) {
        sub.isActive = false;
        await sub.save();
        console.log(`❌ One-time subscription expired and deactivated: "${sub.name}" (expired: ${expiry.toLocaleDateString('en-IN')})`);
        continue;
      }
    } else if (sub.period !== 'one_time') {
      // ─── Auto-deactivate recurring subscriptions past their endDate ───
      // calculateNextRenewal returns null when endDate is in the past
      const nextRenewal = calculateNextRenewal(sub);
      if (!nextRenewal) {
        sub.isActive = false;
        await sub.save();
        const endInfo = sub.endDate ? `(ended: ${new Date(sub.endDate).toLocaleDateString('en-IN')})` : '(no future renewal)';
        console.log(`❌ Recurring subscription expired and deactivated: "${sub.name}" ${endInfo}`);
        continue;
      }
    }

    // ─── Skip reminder if already sent today ───
    if (alreadySentToday(sub.lastReminderSentDate)) continue;

    let shouldNotify = false;
    let notifMessage = '';

    if (sub.period === 'one_time' && sub.expiryDate) {
      // One-time: remind 1 day before expiry
      const expiry = new Date(sub.expiryDate);
      expiry.setHours(0, 0, 0, 0);
      if (isSameDay(expiry, tomorrow)) {
        shouldNotify = true;
        notifMessage = `Your "${sub.name}" subscription (₹${sub.amount}) expires tomorrow (${expiry.toLocaleDateString('en-IN')}).`;
      }
    } else {
      // Recurring: remind 1 day before next renewal
      const nextRenewal = calculateNextRenewal(sub);
      if (nextRenewal && isSameDay(nextRenewal, tomorrow)) {
        shouldNotify = true;
        notifMessage = `Your "${sub.name}" subscription (₹${sub.amount}/${sub.period}) renews tomorrow (${nextRenewal.toLocaleDateString('en-IN')}).`;
      }
    }

    if (shouldNotify) {
      const user = await User.findById(sub.userId).select('email name');
      const prefs = await UserPreferences.findOne({ userId: sub.userId }).lean();
      const sendEmailNotif = !prefs || prefs.emailAlertsEnabled !== false;

      // In-app notification
      await new Notification({
        userId: sub.userId,
        title: '🔔 Subscription Reminder',
        message: notifMessage,
        isRead: false,
        date: new Date(),
      }).save();

      // Email notification
      if (user?.email && sendEmailNotif) {
        try {
          await sendEmail(
            user.email,
            `Vestor Reminder: ${sub.name}`,
            buildReminderEmail(user.name || 'there', notifMessage)
          );
        } catch (emailErr) {
          console.error(`Failed to send email to ${user.email}:`, emailErr.message);
        }
      }

      // Mark as sent today
      sub.lastReminderSentDate = new Date();
      await sub.save();

      console.log(`🔔 Subscription reminder sent: ${sub.name} → ${user?.email || sub.userId}`);
    }
  }
};

/**
 * Calculate the next renewal date for a recurring subscription
 */
const calculateNextRenewal = (sub) => {
  if (!sub.startDate) return null;

  const start = new Date(sub.startDate);
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let next = new Date(start);

  // If we have a lastExecutedDate, calculate from there
  if (sub.lastExecutedDate) {
    next = new Date(sub.lastExecutedDate);
    next.setHours(0, 0, 0, 0);
    advanceDate(next, sub.period);
  }

  // Walk forward to find the next renewal after today
  while (next <= today) {
    advanceDate(next, sub.period);
  }

  // Check against endDate — return null if past end (signals expiry to caller)
  if (sub.endDate) {
    const end = new Date(sub.endDate);
    end.setHours(0, 0, 0, 0);
    if (next > end) return null;
  }

  return next;
};

const advanceDate = (date, period) => {
  if (period === 'weekly') date.setDate(date.getDate() + 7);
  else if (period === 'yearly') date.setFullYear(date.getFullYear() + 1);
  else date.setMonth(date.getMonth() + 1); // monthly default
};

/**
 * Process credit card due date reminders
 */
const processCreditCards = async () => {
  const tomorrow = getTomorrow();
  const cards = await CreditCard.find({});

  for (const card of cards) {
    if (alreadySentToday(card.lastReminderSentDate)) continue;

    const dueDate = new Date(card.billDueDate);
    dueDate.setHours(0, 0, 0, 0);

    if (isSameDay(dueDate, tomorrow)) {
      const user = await User.findById(card.userId).select('email name');
      const prefs = await UserPreferences.findOne({ userId: card.userId }).lean();
      const sendEmailNotif = !prefs || prefs.emailAlertsEnabled !== false;

      const msg = `Your "${card.name}" (****${card.last4Digits}) credit card bill is due tomorrow (${dueDate.toLocaleDateString('en-IN')}).`;

      // In-app notification
      await new Notification({
        userId: card.userId,
        title: '💳 Credit Card Reminder',
        message: msg,
        isRead: false,
        date: new Date(),
      }).save();

      // Email notification
      if (user?.email && sendEmailNotif) {
        try {
          await sendEmail(
            user.email,
            `Vestor Reminder: ${card.name} Bill Due`,
            buildReminderEmail(user.name || 'there', msg)
          );
        } catch (emailErr) {
          console.error(`Failed to send email to ${user.email}:`, emailErr.message);
        }
      }

      // Mark as sent today
      card.lastReminderSentDate = new Date();
      await card.save();

      console.log(`💳 CC reminder sent: ${card.name} → ${user?.email || card.userId}`);
    }
  }
};

/**
 * Build a simple HTML email template
 */
const buildReminderEmail = (name, message) => {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #1A120B; color: #F1DFD3; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #E5BA73; font-size: 24px; margin: 0;">Vestor</h1>
        <p style="color: #F1DFD3; opacity: 0.6; font-size: 12px; margin: 4px 0 0; text-transform: uppercase; letter-spacing: 2px;">Financial Reminder</p>
      </div>
      <div style="background: #241a12; border-radius: 12px; padding: 20px; border: 1px solid rgba(229,186,115,0.1);">
        <p style="margin: 0 0 12px; font-size: 16px;">Hi ${name},</p>
        <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #F1DFD3; opacity: 0.9;">${message}</p>
      </div>
      <p style="text-align: center; font-size: 11px; color: #F1DFD3; opacity: 0.4; margin-top: 24px;">Sent by Vestor · Your Personal Finance Tracker</p>
    </div>
  `;
};

/**
 * Core check function — extracted so it can be called on startup AND by cron
 */
const runReminderCheck = async () => {
  console.log(`⏰ [${new Date().toISOString()}] Running reminder check...`);
  try {
    await processSubscriptions();
    await processCreditCards();
    console.log(`✅ Reminder check completed.`);
  } catch (err) {
    console.error('❌ Reminder check error:', err.message);
  }
};

/**
 * Daily Gmail bill scanner.
 * Runs for every user who has at least one tracked credit card.
 * Uses GmailScanState to track the last processed email date per user,
 * so each run only processes genuinely new emails — never duplicates.
 *
 * NOTE: All users share the same Gmail inbox (GMAIL_INBOX_USER / GMAIL_INBOX_PASS from .env).
 * The scan runs once globally, then matches found bills to each user's cards.
 */
const processGmailBillScans = async () => {
  console.log(`📧 [${new Date().toISOString()}] Running daily Gmail bill scan...`);

  try {
    // Find all users who have at least one credit card tracked
    const usersWithCards = await CreditCard.distinct('userId');
    if (usersWithCards.length === 0) {
      console.log('📧 No users with credit cards — skipping Gmail scan.');
      return;
    }

    // Load scan state for all users at once
    const scanStates = await GmailScanState.find({
      userId: { $in: usersWithCards },
    }).lean();
    const stateMap = new Map(scanStates.map(s => [s.userId.toString(), s]));

    // Determine the global "since" cutoff — oldest lastEmailDate across all users
    // (so one IMAP fetch covers everyone)
    let globalSince = null;
    for (const userId of usersWithCards) {
      const state = stateMap.get(userId.toString());
      const userSince = state?.lastEmailDate || null;
      if (!globalSince || !userSince || userSince < globalSince) {
        globalSince = userSince;
      }
    }

    // Scan Gmail once with the global cutoff
    const bills = await scanGmailForBills(globalSince);

    if (bills.length === 0) {
      console.log('📧 Gmail scan complete — no new bill emails found.');
      // Still update lastScannedAt for all users
      await GmailScanState.bulkWrite(
        usersWithCards.map(userId => ({
          updateOne: {
            filter: { userId },
            update: { $set: { lastScannedAt: new Date() } },
            upsert: true,
          },
        }))
      );
      return;
    }

    console.log(`📧 Found ${bills.length} new bill email(s). Matching to users...`);

    // Process each user independently
    for (const userId of usersWithCards) {
      const state = stateMap.get(userId.toString());
      const userSince = state?.lastEmailDate || null;

      // Filter bills to only those newer than this user's last scan
      const newBills = userSince
        ? bills.filter(b => new Date(b.date) > new Date(userSince))
        : bills;

      if (newBills.length === 0) continue;

      const cards = await CreditCard.find({ userId });
      const matched = [];

      for (const bill of newBills) {
        let card = null;

        // Match by last 4 digits first
        if (bill.last4) {
          card = cards.find(c => c.last4Digits === bill.last4);
        }
        // Fallback: match by card name keywords in subject/sender
        if (!card) {
          card = cards.find(c =>
            c.name.toLowerCase().split(/\s+/).some(word =>
              word.length > 3 && (
                bill.subject.toLowerCase().includes(word) ||
                bill.from.toLowerCase().includes(word)
              )
            )
          );
        }

        if (card) {
          const updateData = { billGeneratedDate: bill.date };
          if (bill.amount) updateData.billAmount = bill.amount;
          if (bill.dueDate) updateData.billDueDate = bill.dueDate;
          await CreditCard.findByIdAndUpdate(card._id, updateData);

          matched.push({
            cardName: card.name,
            last4: card.last4Digits,
            amount: bill.amount,
            dueDate: bill.dueDate,
            emailSubject: bill.subject,
            emailFrom: bill.from,
            emailDate: bill.date,
          });
        }
      }

      if (matched.length === 0) continue;

      // In-app notification
      const cardNames = matched.map(m => m.cardName).join(', ');
      await Notification.create({
        userId,
        title: '💳 New Credit Card Bill Detected',
        message: `Auto-scanned Gmail and updated bills for: ${cardNames}`,
        isRead: false,
        date: new Date(),
      });

      // Email summary to user
      const user = await User.findById(userId).select('email name').lean();
      const prefs = await UserPreferences.findOne({ userId }).lean();
      const sendEmailNotif = !prefs || prefs.emailAlertsEnabled !== false;

      if (user?.email && sendEmailNotif) {
        const totalDue = matched.reduce((s, m) => s + (m.amount || 0), 0);
        await sendEmail(
          user.email,
          `💳 New Credit Card Bill${matched.length > 1 ? 's' : ''} Detected — ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`,
          buildBillSummaryEmail(user.name || 'there', matched, totalDue)
        );
      }

      // Advance this user's lastEmailDate to the most recent bill we processed
      const latestBillDate = newBills.reduce(
        (max, b) => (new Date(b.date) > max ? new Date(b.date) : max),
        new Date(0)
      );

      await GmailScanState.findOneAndUpdate(
        { userId },
        {
          $set: {
            lastEmailDate: latestBillDate,
            lastScannedAt: new Date(),
            lastScanCount: matched.length,
          },
        },
        { upsert: true }
      );

      console.log(`📧 Updated ${matched.length} card(s) for user ${userId}: ${cardNames}`);
    }

    console.log('📧 Daily Gmail bill scan complete.');
  } catch (err) {
    console.error('❌ Gmail bill scan error:', err.message);
  }
};

/**
 * HTML email template for the daily bill scan summary
 */
const buildBillSummaryEmail = (userName, matched, totalDue) => {
  const fmt = (n) =>
    n != null
      ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n)
      : 'N/A';
  const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A';
  const isDueSoon = (d) => {
    if (!d) return false;
    const diff = new Date(d) - new Date();
    return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
  };

  const rows = matched.map(m => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #2a1f15;">
        <strong style="color:#E5BA73;">${m.cardName}</strong>
        <span style="color:#9a8f80;font-size:11px;margin-left:8px;">····${m.last4}</span>
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #2a1f15;text-align:right;">
        <strong style="color:#f1dfd3;">${fmt(m.amount)}</strong>
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #2a1f15;text-align:right;">
        <span style="color:${isDueSoon(m.dueDate) ? '#ef4444' : '#95CD41'};font-weight:bold;">
          ${fmtDate(m.dueDate)}${isDueSoon(m.dueDate) ? ' ⚠️' : ''}
        </span>
      </td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0d0905;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:26px;font-weight:900;color:#E5BA73;">Wallo</div>
      <div style="color:#9a8f80;font-size:11px;text-transform:uppercase;letter-spacing:3px;margin-top:4px;">New Bill Alert</div>
    </div>
    <div style="background:#1a140e;border:1px solid #2a1f15;border-radius:16px;padding:20px;margin-bottom:20px;">
      <p style="color:#f1dfd3;margin:0 0 8px;font-size:15px;">Hey ${userName} 👋</p>
      <p style="color:#9a8f80;margin:0;font-size:13px;line-height:1.6;">
        Wallo auto-scanned your Gmail and found <strong style="color:#E5BA73;">${matched.length} new credit card bill${matched.length !== 1 ? 's' : ''}</strong>.
        Your dashboard has been updated automatically.
      </p>
    </div>
    ${totalDue > 0 ? `
    <div style="background:linear-gradient(135deg,#2a1a0a,#1a0f05);border-radius:14px;padding:20px;margin-bottom:20px;text-align:center;">
      <div style="color:#9a8f80;font-size:10px;text-transform:uppercase;letter-spacing:3px;margin-bottom:6px;">Total Due Across All Cards</div>
      <div style="color:#E5BA73;font-size:32px;font-weight:900;">${fmt(totalDue)}</div>
    </div>` : ''}
    <div style="background:#1a140e;border:1px solid #2a1f15;border-radius:14px;overflow:hidden;margin-bottom:20px;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#120d08;">
            <th style="padding:10px 16px;text-align:left;color:#9a8f80;font-size:10px;text-transform:uppercase;letter-spacing:2px;">Card</th>
            <th style="padding:10px 16px;text-align:right;color:#9a8f80;font-size:10px;text-transform:uppercase;letter-spacing:2px;">Amount Due</th>
            <th style="padding:10px 16px;text-align:right;color:#9a8f80;font-size:10px;text-transform:uppercase;letter-spacing:2px;">Due Date</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p style="text-align:center;color:#4e4539;font-size:11px;margin:0;">
      Auto-detected by Wallo · ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
    </p>
  </div>
</body>
</html>`;
};

/**
 * Initialize the cron job
 * - Runs immediately on server start to catch any missed/long-expired records
 * - Then runs every hour on schedule
 */
const initCronJobs = () => {
  // ─── Run reminder check immediately on startup ───
  console.log('🕐 Cron jobs initialized — running startup check...');
  runReminderCheck();

  // ─── Hourly reminder checks (subscriptions + CC due dates) ───
  cron.schedule('0 * * * *', runReminderCheck);
  console.log('🕐 Hourly reminder checks scheduled.');

  // ─── Daily Gmail bill scan at 8:00 AM ───
  // Runs once per day; only processes emails newer than the last scan per user.
  cron.schedule('0 8 * * *', processGmailBillScans);
  console.log('📧 Daily Gmail bill scan scheduled at 08:00.');
};

module.exports = { initCronJobs };