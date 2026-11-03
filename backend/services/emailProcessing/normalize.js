/**
 * Turn a raw RFC822 email into the small, normalized object processors work on.
 * HTML is converted to text, whitespace collapsed, and the text capped. Attachments
 * and the raw message are not kept; the caller should drop the raw buffer after this.
 */
const { simpleParser } = require('mailparser');
const { emailBodyText, extractDomain, isBankDomain } = require('../gmailScanner');

const MAX_TEXT = 20000;

const normalizeText = (s) => String(s || '')
  .replace(/[\u200b-\u200d\ufeff]/g, '')
  .replace(/[ \t]+/g, ' ')
  .replace(/ *\n */g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

/**
 * @param {Buffer} raw
 * @param {{ messageId?: string, receivedAt?: Date }} meta
 */
const normalizeEmail = async (raw, { messageId = null, receivedAt = null } = {}) => {
  const parsed = await simpleParser(raw, { skipImageLinks: true, skipTextToHtml: true, skipTextLinks: true });
  const from = parsed.from?.value?.[0] || {};
  const fromAddr = String(from.address || '').toLowerCase();
  const domain = extractDomain(fromAddr);
  // Gmail stamps every message with Authentication-Results. DKIM or DMARC must
  // pass, otherwise a forged "From: x@hdfcbank.com" could plant fake data.
  const authResults = [].concat(parsed.headers.get('authentication-results') || []).join(' ').toLowerCase();
  const date = parsed.date && !isNaN(parsed.date) ? parsed.date : (receivedAt || new Date());

  return Object.freeze({
    messageId,
    subject: normalizeText(parsed.subject).slice(0, 500),
    fromAddr,
    fromName: String(from.name || '').slice(0, 200),
    domain,
    knownSender: isBankDomain(domain),
    authenticated: /\b(dmarc|dkim)=pass\b/.test(authResults),
    date,
    receivedAt: receivedAt || date,
    text: normalizeText(emailBodyText(parsed)).slice(0, MAX_TEXT),
  });
};

module.exports = { normalizeEmail, normalizeText };
