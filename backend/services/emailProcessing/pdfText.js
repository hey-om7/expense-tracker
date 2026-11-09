/**
 * Text from PDF statements attached to bank emails, using PDF.js.
 * Indian banks usually lock statement PDFs with a password (often based on the
 * customer's name, date of birth or card digits). Passwords are tried in order;
 * the caller decides where they come from (saved per bank, or typed by the user).
 * Nothing is written to disk and the PDF is not kept after reading.
 */
const MAX_PAGES = 4;       // summary (amount due, due date, balances) is on the first pages
const MAX_TEXT = 15000;
const MAX_PDF_BYTES = 8 * 1024 * 1024;

let pdfjsPromise;
const loadPdfjs = () => {
  pdfjsPromise = pdfjsPromise || import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjsPromise;
};

// PDF.js PasswordResponses: 1 = password needed, 2 = wrong password
const PASSWORD_NEEDED = 1;

const pageText = async (page) => {
  const content = await page.getTextContent();
  let out = '';
  let lastY = null;
  for (const item of content.items) {
    const y = item.transform?.[5];
    if (lastY !== null && y !== undefined && Math.abs(y - lastY) > 2) out += '\n';
    else if (out && !out.endsWith(' ')) out += ' ';
    out += item.str;
    if (y !== undefined) lastY = y;
  }
  return out;
};

const openPdf = async (data, password) => {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({
    data: new Uint8Array(data), password, isEvalSupported: false, disableFontFace: true, useSystemFonts: false, verbosity: 0,
  });
  try {
    return { doc: await task.promise, task };
  } catch (err) {
    await task.destroy().catch(() => {});
    throw err;
  }
};

/**
 * @param {Buffer} data
 * @param {string[]} passwords tried in order after trying no password
 * @returns {Promise<{ status: 'ok', text: string, password: string|null }
 *   | { status: 'needs_password' } | { status: 'error', message: string }>}
 */
const extractPdfText = async (data, passwords = []) => {
  if (!data?.length || data.length > MAX_PDF_BYTES) return { status: 'error', message: 'PDF is empty or too large' };
  const candidates = [null, ...passwords.filter(p => typeof p === 'string' && p.length)];
  for (const password of candidates) {
    let doc;
    let task;
    try {
      ({ doc, task } = await openPdf(data, password ?? undefined));
    } catch (err) {
      if (err?.name === 'PasswordException') continue;
      return { status: 'error', message: err?.message || 'Unreadable PDF' };
    }
    try {
      const parts = [];
      for (let i = 1; i <= Math.min(doc.numPages, MAX_PAGES); i += 1) {
        parts.push(await pageText(await doc.getPage(i)));
      }
      const text = parts.join('\n\n').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim().slice(0, MAX_TEXT);
      return { status: 'ok', text, password };
    } finally {
      await task.destroy().catch(() => {});
    }
  }
  return { status: 'needs_password' };
};

/**
 * Read the first statement PDF in a normalized email.
 * @returns same shape as extractPdfText, or { status: 'none' } when the email has no PDF
 */
const readStatementPdf = async (email, passwords = []) => {
  const pdf = email.pdfs?.[0];
  if (!pdf) return { status: 'none' };
  const r = await extractPdfText(pdf.content, passwords);
  return { ...r, filename: pdf.filename };
};

/** A copy of the email whose text also contains the PDF text (body first, shortened). */
const withPdfText = (email, pdfText) => Object.freeze({
  ...email,
  text: `${email.text.slice(0, 2500)}\n\n[Attached statement PDF]\n${pdfText}`,
  pdfs: undefined,
});

module.exports = { extractPdfText, readStatementPdf, withPdfText, PASSWORD_NEEDED };
