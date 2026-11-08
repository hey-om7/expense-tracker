/**
 * Details about who runs Vestor, used by the Privacy Policy and Terms of Service.
 *
 * These are not in the codebase anywhere, so they must be filled in by the
 * operator before the documents are published. While `draft` is true, both
 * pages show a visible "draft, pending review" notice, and any missing value
 * renders as a bracketed marker instead of an invented detail.
 */
export const operator = {
  draft: true,
  productName: 'Vestor',
  legalName: 'Ambarkar Om',
  contactEmail: 'wallyn999@gmail.com',
  postalAddress: null,    // optional; required by some jurisdictions
  governingLaw: null,     // e.g. "the laws of India"; confirm with a lawyer
  courtsLocation: null,   // e.g. "the courts of Bengaluru, Karnataka"
};

export const missing = (label) => `[${label} — to be added]`;

export const operatorName = () => operator.legalName || operator.productName;
export const contactLine = () => operator.contactEmail || missing('contact email');
