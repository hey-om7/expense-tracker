const { escapeHtml } = require('./security');
const { sendEmail } = require('../services/emailService');

const appUrl = (path) => `${(process.env.FRONTEND_URL || '').replace(/\/$/, '')}${path}`;

// Shared layout for account emails (verification, password reset).
const buildActionEmail = ({ name, label, intro, buttonText, link, footer }) => `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #1A120B; color: #F1DFD3; border-radius: 16px;">
    <div style="text-align: center; margin-bottom: 24px;">
      <h1 style="color: #E5BA73; font-size: 24px; margin: 0;">Vestor</h1>
      <p style="color: #F1DFD3; opacity: 0.6; font-size: 12px; margin: 4px 0 0; text-transform: uppercase; letter-spacing: 2px;">${escapeHtml(label)}</p>
    </div>
    <div style="background: #241a12; border-radius: 12px; padding: 20px; border: 1px solid rgba(229,186,115,0.1);">
      <p style="margin: 0 0 12px; font-size: 16px;">Hi ${escapeHtml(name || 'there')},</p>
      <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; opacity: 0.9;">${escapeHtml(intro)}</p>
      ${link ? `<p style="text-align: center; margin: 0;">
        <a href="${escapeHtml(link)}" style="display: inline-block; background: #E5BA73; color: #1A120B; text-decoration: none; font-weight: bold; padding: 12px 24px; border-radius: 10px; font-size: 14px;">${escapeHtml(buttonText)}</a>
      </p>` : ''}
      <p style="margin: 16px 0 0; font-size: 12px; line-height: 1.6; opacity: 0.6;">${escapeHtml(footer)}</p>
    </div>
    <p style="text-align: center; font-size: 11px; color: #F1DFD3; opacity: 0.4; margin-top: 24px;">Sent by Vestor · Your Personal Finance Tracker</p>
  </div>
`;

/**
 * Sends an account email. Returns true if sent.
 * Outside production, when SMTP isn't configured, the link is printed to the
 * server console instead so local sign-up still works.
 */
const sendActionEmail = async (to, subject, opts) => {
  const sent = await sendEmail(to, subject, buildActionEmail(opts));
  if (!sent && process.env.NODE_ENV !== 'production' && opts.link) {
    console.log(`🔗 [dev] Email not sent. ${subject}: ${opts.link}`);
    return true;
  }
  return sent;
};

module.exports = { appUrl, buildActionEmail, sendActionEmail };
