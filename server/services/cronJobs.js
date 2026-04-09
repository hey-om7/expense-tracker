const cron = require('node-cron');
const Subscription = require('../models/Subscription');
const CreditCard = require('../models/CreditCard');
const Notification = require('../models/Notification');
const User = require('../models/User');
const UserPreferences = require('../models/UserPreferences');
const { sendEmail } = require('./emailService');

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
 * Process subscription reminders
 */
const processSubscriptions = async () => {
  const tomorrow = getTomorrow();
  const activeSubs = await Subscription.find({ isActive: true });

  for (const sub of activeSubs) {
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
      const sendEmailNotif = !prefs || prefs.emailAlertsEnabled !== false; // Default true

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
            `Wallo Reminder: ${sub.name}`,
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

  // Check against endDate
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
      const sendEmailNotif = !prefs || prefs.emailAlertsEnabled !== false; // Default true
      
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
            `Wallo Reminder: ${card.name} Bill Due`,
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
        <h1 style="color: #E5BA73; font-size: 24px; margin: 0;">Wallo</h1>
        <p style="color: #F1DFD3; opacity: 0.6; font-size: 12px; margin: 4px 0 0; text-transform: uppercase; letter-spacing: 2px;">Financial Reminder</p>
      </div>
      <div style="background: #241a12; border-radius: 12px; padding: 20px; border: 1px solid rgba(229,186,115,0.1);">
        <p style="margin: 0 0 12px; font-size: 16px;">Hi ${name},</p>
        <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #F1DFD3; opacity: 0.9;">${message}</p>
      </div>
      <p style="text-align: center; font-size: 11px; color: #F1DFD3; opacity: 0.4; margin-top: 24px;">Sent by Wallo · Your Personal Finance Tracker</p>
    </div>
  `;
};

/**
 * Initialize the cron job - runs every hour
 */
const initCronJobs = () => {
  cron.schedule('0 * * * *', async () => {
    console.log(`⏰ [${new Date().toISOString()}] Running scheduled reminder check...`);
    try {
      await processSubscriptions();
      await processCreditCards();
      console.log(`✅ Scheduled reminder check completed.`);
    } catch (err) {
      console.error('❌ Cron job error:', err.message);
    }
  });

  console.log('🕐 Cron jobs initialized (hourly reminder checks)');
};

module.exports = { initCronJobs };
