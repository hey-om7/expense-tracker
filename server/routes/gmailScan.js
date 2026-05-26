/**
 * POST /api/gmail/scan-bills
 * Scans Gmail inbox for CC bill emails, matches them to tracked credit cards,
 * updates billDueDate + billAmount, and sends a summary email to the user.
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const CreditCard = require('../models/CreditCard');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { scanGmailForBills } = require('../services/gmailScanner');
const { sendEmail } = require('../services/emailService');

router.use(auth);

// In-flight lock per user to prevent double-scans
const scanLocks = new Set();

router.post('/scan-bills', async (req, res) => {
  if (scanLocks.has(req.userId)) {
    return res.status(429).json({ message: 'Scan already in progress. Please wait.' });
  }
  scanLocks.add(req.userId);

  try {
    // 1. Scan Gmail
    const bills = await scanGmailForBills(45);

    if (bills.length === 0) {
      return res.json({
        matched: 0,
        unmatched: 0,
        bills: [],
        message: 'No credit card bill emails found in the last 45 days.',
      });
    }

    // 2. Load user's tracked credit cards
    const cards = await CreditCard.find({ userId: req.userId });

    const matched = [];
    const unmatched = [];

    for (const bill of bills) {
      let card = null;

      // Try to match by last 4 digits first
      if (bill.last4) {
        card = cards.find(c => c.last4Digits === bill.last4);
      }

      // Fallback: match by card name keywords in email subject/from
      if (!card) {
        card = cards.find(c => {
          const cardNameLower = c.name.toLowerCase();
          const subjectLower = bill.subject.toLowerCase();
          const fromLower = bill.from.toLowerCase();
          // Check if any word from the card name appears in subject or sender
          return cardNameLower.split(/\s+/).some(word =>
            word.length > 3 && (subjectLower.includes(word) || fromLower.includes(word))
          );
        });
      }

      if (card) {
        // Update the card with bill details
        const updateData = {};
        if (bill.amount) updateData.billAmount = bill.amount;
        if (bill.dueDate) updateData.billDueDate = bill.dueDate;
        updateData.billGeneratedDate = bill.date;

        await CreditCard.findByIdAndUpdate(card._id, updateData);

        matched.push({
          cardId: card._id,
          cardName: card.name,
          last4: card.last4Digits,
          amount: bill.amount,
          dueDate: bill.dueDate,
          emailSubject: bill.subject,
          emailFrom: bill.from,
          emailDate: bill.date,
        });
      } else {
        unmatched.push({
          amount: bill.amount,
          dueDate: bill.dueDate,
          last4: bill.last4,
          emailSubject: bill.subject,
          emailFrom: bill.from,
          emailDate: bill.date,
        });
      }
    }

    // 3. Send summary notification in-app
    if (matched.length > 0) {
      const cardNames = matched.map(m => m.cardName).join(', ');
      await Notification.create({
        userId: req.userId,
        title: 'Credit Card Bills Updated',
        message: `Found and updated bills for: ${cardNames}`,
        isRead: false,
        date: new Date(),
      });
    }

    // 4. Send summary email to the user
    const user = await User.findById(req.userId).select('email name').lean();
    const userEmail = user?.email || process.env.EMAIL_USER;
    const userName = user?.name || 'there';

    if (userEmail) {
      const emailHtml = buildSummaryEmail(userName, matched, unmatched);
      await sendEmail(
        userEmail,
        `💳 Credit Card Bills Summary — ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`,
        emailHtml
      );
    }

    res.json({
      matched: matched.length,
      unmatched: unmatched.length,
      bills: matched,
      unmatchedBills: unmatched,
    });
  } catch (err) {
    console.error('Gmail scan error:', err.message);
    res.status(500).json({ message: `Scan failed: ${err.message}` });
  } finally {
    scanLocks.delete(req.userId);
  }
});

// ─── Email template ───────────────────────────────────────────────────────
const buildSummaryEmail = (userName, matched, unmatched) => {
  const formatCurrency = (n) =>
    n != null
      ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n)
      : 'N/A';

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A';

  const totalDue = matched.reduce((sum, m) => sum + (m.amount || 0), 0);

  const matchedRows = matched.map(m => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #2a1f15;">
        <strong style="color:#E5BA73;">${m.cardName}</strong>
        <span style="color:#9a8f80;font-size:11px;margin-left:8px;">····${m.last4}</span>
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #2a1f15;text-align:right;">
        <strong style="color:#f1dfd3;font-size:16px;">${formatCurrency(m.amount)}</strong>
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #2a1f15;text-align:right;">
        <span style="color:${isDueSoon(m.dueDate) ? '#ef4444' : '#95CD41'};font-weight:bold;">
          ${formatDate(m.dueDate)}
          ${isDueSoon(m.dueDate) ? ' ⚠️' : ''}
        </span>
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #2a1f15;color:#9a8f80;font-size:11px;">
        ${m.emailSubject}
      </td>
    </tr>
  `).join('');

  const unmatchedSection = unmatched.length > 0 ? `
    <div style="margin-top:32px;padding:16px;background:#1a0f0a;border:1px solid #3d2a1a;border-radius:12px;">
      <h3 style="color:#F59E0B;margin:0 0 12px;font-size:14px;">⚠️ ${unmatched.length} Bill(s) Could Not Be Matched</h3>
      <p style="color:#9a8f80;font-size:12px;margin:0 0 12px;">
        These emails look like credit card bills but couldn't be matched to any of your tracked cards.
        You may want to add these cards to Wallo.
      </p>
      ${unmatched.map(u => `
        <div style="padding:10px 0;border-bottom:1px solid #2a1f15;">
          <div style="color:#f1dfd3;font-size:13px;">${u.emailSubject}</div>
          <div style="color:#9a8f80;font-size:11px;margin-top:4px;">
            From: ${u.emailFrom} · Amount: ${formatCurrency(u.amount)} · Due: ${formatDate(u.dueDate)}
            ${u.last4 ? ` · Card ending ····${u.last4}` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  ` : '';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0d0905;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:32px 16px;">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <div style="font-size:28px;font-weight:900;color:#E5BA73;letter-spacing:-1px;">Wallo</div>
      <div style="color:#9a8f80;font-size:12px;text-transform:uppercase;letter-spacing:3px;margin-top:4px;">Credit Card Bills Summary</div>
    </div>

    <!-- Greeting -->
    <div style="background:#1a140e;border:1px solid #2a1f15;border-radius:16px;padding:24px;margin-bottom:24px;">
      <p style="color:#f1dfd3;margin:0 0 8px;font-size:16px;">Hey ${userName} 👋</p>
      <p style="color:#9a8f80;margin:0;font-size:14px;line-height:1.6;">
        We scanned your Gmail inbox and found <strong style="color:#E5BA73;">${matched.length} credit card bill${matched.length !== 1 ? 's' : ''}</strong>.
        Your Wallo dashboard has been updated with the latest due dates and amounts.
      </p>
    </div>

    ${matched.length > 0 ? `
    <!-- Total Due Banner -->
    <div style="background:linear-gradient(135deg,#2a1a0a,#1a0f05);border:1px solid #E5BA73/20;border-radius:16px;padding:24px;margin-bottom:24px;text-align:center;">
      <div style="color:#9a8f80;font-size:11px;text-transform:uppercase;letter-spacing:3px;margin-bottom:8px;">Total Amount Due Across All Cards</div>
      <div style="color:#E5BA73;font-size:36px;font-weight:900;letter-spacing:-1px;">${formatCurrency(totalDue)}</div>
    </div>

    <!-- Bills Table -->
    <div style="background:#1a140e;border:1px solid #2a1f15;border-radius:16px;overflow:hidden;margin-bottom:24px;">
      <div style="padding:16px 16px 0;border-bottom:1px solid #2a1f15;">
        <h2 style="color:#f1dfd3;margin:0 0 16px;font-size:16px;">📋 Bill Details</h2>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#120d08;">
            <th style="padding:10px 16px;text-align:left;color:#9a8f80;font-size:10px;text-transform:uppercase;letter-spacing:2px;font-weight:600;">Card</th>
            <th style="padding:10px 16px;text-align:right;color:#9a8f80;font-size:10px;text-transform:uppercase;letter-spacing:2px;font-weight:600;">Amount Due</th>
            <th style="padding:10px 16px;text-align:right;color:#9a8f80;font-size:10px;text-transform:uppercase;letter-spacing:2px;font-weight:600;">Due Date</th>
            <th style="padding:10px 16px;text-align:left;color:#9a8f80;font-size:10px;text-transform:uppercase;letter-spacing:2px;font-weight:600;">Source</th>
          </tr>
        </thead>
        <tbody>${matchedRows}</tbody>
      </table>
    </div>
    ` : ''}

    ${unmatchedSection}

    <!-- Action CTA -->
    <div style="text-align:center;margin-top:32px;padding:24px;background:#1a140e;border:1px solid #2a1f15;border-radius:16px;">
      <p style="color:#9a8f80;font-size:13px;margin:0 0 16px;">
        Open Wallo to review your bills, mark payments, and stay on top of your finances.
      </p>
      <div style="display:inline-block;background:#E5BA73;color:#1a0f05;padding:12px 32px;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none;">
        Open Wallo Dashboard
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;margin-top:24px;">
      <p style="color:#4e4539;font-size:11px;margin:0;">
        This email was generated automatically by Wallo · ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
      </p>
    </div>

  </div>
</body>
</html>
  `;
};

const isDueSoon = (dueDate) => {
  if (!dueDate) return false;
  const diff = new Date(dueDate) - new Date();
  return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
};

module.exports = router;
