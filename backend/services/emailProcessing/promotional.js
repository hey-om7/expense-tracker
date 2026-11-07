/**
 * Promotional email detection (loan offers, travel/cashback campaigns, "here's ₹X for you").
 * Banks send these from the same domains as statements and alerts, and they
 * mention amounts, so they need their own filter.
 *
 * Safety: a subject that looks like a statement or a completed transaction is
 * never treated as promotional, so real records can't be filtered out here.
 */
const { BILL_SUBJECT_PATTERNS } = require('../gmailScanner');

// A completed money movement or a bill. Wins over any promotional signal.
const RECORD_SUBJECT = /\b(statement|debited|credited|spent|transaction|txn|payment\s+(received|due|reminder|successful)|due\s+date|amount\s+due|e-?mandate|auto[\s-]*debit|refund(ed)?|(paid|sent)\s+(to\b|(rs\.?|inr)\s*[0-9])|paid\s+₹|sent\s+₹)/i;

// Strong signals: one is enough.
const PROMO_SUBJECT_STRONG = [
  /\b(personal|instant|pre[\s-]*approved|top[\s-]*up|business|gold|home|car)\s+loan\b.{0,40}\b(ready|available|approved|waiting|offer|for\s+you|awaits)\b/i,
  /\bloan\s+(of\s+)?up\s*to\b/i,
  /\bon\s+top\s+of\s+your\s+(current\s+|existing\s+)?loan\b/i,
  /\bhere'?s\s+(rs\.?|₹|inr)\s*[0-9]/i,
  /\bfor\s+your\s+(celebrations?|festivities|festive|wedding|dreams?|vacation|holidays?|next\s+trip|shopping)\b/i,
  /\b(fly|travel|shop|dine|stay)\s+(for\s+)?free\b/i,
  /\bworth\s+(rs\.?|₹|inr)\s*[0-9]/i,
  /\bup\s*to\s+(rs\.?|₹|inr)?\s*[0-9][0-9,]*\s*(off|cashback|discount)\b/i,
  /\b(cashback|discount|vouchers?|reward\s*points?)\s+(offer|on|worth|of\s+up\s*to)\b/i,
  /\b(limited[\s-]*(time|period)|hurry|last\s+chance|don'?t\s+miss|ends\s+(today|tonight|soon))\b/i,
  /\b(apply|upgrade|avail|claim|unlock|grab)\s+(now|today|it|your)\b/i,
  /\b(special|exclusive|festive|mega|bumper)\s+(offers?|deals?|sale|rates?)\b/i,
  /\bsomething\s+extra\b/i,
];

// Weak signals: need two (subject + body).
const PROMO_WEAK = [
  /\bfree\b/i, /\boffers?\b/i, /\bdeals?\b/i, /\bcashback\b/i, /\bcelebrat/i, /\bfestive\b/i,
  /\bexclusive\b/i, /\bunsubscribe\b/i, /\bT\s*&\s*C(s)?\s+apply\b/i, /\bterms\s+and\s+conditions\s+apply\b/i,
  /\b(apply|book|shop|know\s+more|click\s+here|avail)\s+now\b/i, /\bnot\s+an\s+offer\s+of\s+credit\b|\bat\s+the\s+sole\s+discretion\b/i,
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, // emoji in a bank email
];

const isPromotional = (email) => {
  const subject = email.subject || '';
  if (RECORD_SUBJECT.test(subject) || BILL_SUBJECT_PATTERNS.some(p => p.test(subject))) return false;
  if (PROMO_SUBJECT_STRONG.some(p => p.test(subject))) return true;
  const head = `${subject}\n${(email.text || '').slice(0, 6000)}`;
  return PROMO_WEAK.filter(p => p.test(head)).length >= 2;
};

/** Subject-only check, for review items already stored (bodies are not kept). */
const isPromotionalSubject = (subject = '') =>
  !RECORD_SUBJECT.test(subject) && !BILL_SUBJECT_PATTERNS.some(p => p.test(subject)) &&
  (PROMO_SUBJECT_STRONG.some(p => p.test(subject)) || PROMO_WEAK.filter(p => p.test(subject)).length >= 2);

module.exports = { isPromotional, isPromotionalSubject };
