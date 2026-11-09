/**
 * Turn a raw RFC822 email into the small, normalized object processors work on.
 * HTML is converted to text, whitespace collapsed, and the text capped. PDF attachments
 * are kept in memory for statement parsing; other attachments and the raw message are
 * not kept. The caller should drop the raw buffer after this.
 */
const { simpleParser } = require('mailparser');
const { emailBodyText, extractDomain, isBankDomain } = require('../gmailScanner');
const { rootDomainFor } = require('./institutions');

const MAX_TEXT = 20000;
const MAX_PDFS = 2;

// Gmail adds its own Authentication-Results header at the top of every message it
// receives. A sender can put any number of fake ones further down, so only the
// topmost header from Gmail's server is trusted.
const GMAIL_AUTHSERV = /^\s*mx\.google\.com\s*;/i;

// Same organization: both resolve to the same root bank domain
// ("statements.hdfcbank.net" and "hdfcbank.net"). A bare suffix like "net" or
// "bank.in" never matches a bank's root.
const sameOrg = (a, b) => !!a && !!b && rootDomainFor(a) === rootDomainFor(b);

/**
 * True only if Gmail verified that the From domain really sent the message:
 * DMARC passed for that domain, or a DKIM signature from that domain (or a
 * parent/subdomain of it) passed. A valid DKIM signature from some other domain
 * (e.g. the attacker's own) doesn't count.
 */
const isAuthenticatedFrom = (headerLines, fromDomain) => {
  if (!fromDomain) return false;
  const first = (headerLines || []).find(h => h.key === 'authentication-results');
  if (!first) return false;
  const value = first.line.replace(/^[^:]*:/, '').replace(/\r?\n[ \t]+/g, ' ');
  if (!GMAIL_AUTHSERV.test(value)) return false;
  const results = value.toLowerCase().split(';').map(s => s.trim());

  const dmarc = results.find(r => r.startsWith('dmarc='));
  if (dmarc && /^dmarc=pass\b/.test(dmarc)) {
    const from = dmarc.match(/header\.from=([a-z0-9.-]+)/);
    if (from && sameOrg(from[1], fromDomain)) return true;
  }
  return results.some(r => {
    if (!/^dkim=pass\b/.test(r)) return false;
    const signer = r.match(/header\.(?:i=[^@\s]*@|d=)([a-z0-9.-]+)/);
    return !!signer && sameOrg(signer[1], fromDomain);
  });
};

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
  const date = parsed.date && !isNaN(parsed.date) ? parsed.date : (receivedAt || new Date());

  return Object.freeze({
    messageId,
    subject: normalizeText(parsed.subject).slice(0, 500),
    fromAddr,
    fromName: String(from.name || '').slice(0, 200),
    domain,
    knownSender: isBankDomain(domain),
    // Forged "From: x@hdfcbank.com" emails must not be turned into data.
    authenticated: isAuthenticatedFrom(parsed.headerLines, domain),
    date,
    receivedAt: receivedAt || date,
    text: normalizeText(emailBodyText(parsed)).slice(0, MAX_TEXT),
    // Statement PDFs, kept in memory only for this processing run (never stored).
    pdfs: (parsed.attachments || [])
      .filter(a => a.contentType === 'application/pdf' || /\.pdf$/i.test(a.filename || ''))
      .slice(0, MAX_PDFS)
      .map(a => ({ filename: String(a.filename || 'statement.pdf').slice(0, 120), content: a.content })),
  });
};

module.exports = { normalizeEmail, normalizeText, isAuthenticatedFrom };
