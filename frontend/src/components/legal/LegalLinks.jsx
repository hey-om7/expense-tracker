import React from 'react';
import { Link } from 'react-router-dom';
import './legal.css';

/** Privacy Policy and Terms links, used in footers, auth screens and Settings. */
const LegalLinks = ({ className = '' }) => (
  <nav aria-label="Legal" className={`flex items-center gap-4 text-xs ${className}`}>
    <Link to="/privacy" className="legal-link">Privacy Policy</Link>
    <span aria-hidden="true" className="text-on-surface-variant/40">·</span>
    <Link to="/terms" className="legal-link">Terms of Service</Link>
  </nav>
);

export default LegalLinks;
