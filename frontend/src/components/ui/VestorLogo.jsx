import React from 'react';

// Vestor mark (same artwork as public/favicon.svg). Decorative next to the
// "Vestor" wordmark, so it is hidden from screen readers.
const VestorLogo = ({ className = 'w-8 h-8' }) => (
  <svg viewBox="10 10 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className={`shrink-0 ${className}`} aria-hidden="true" focusable="false">
    <circle cx="50" cy="50" r="40" fill="#2A221B" />
    <circle cx="50" cy="50" r="30" stroke="#4A3C31" strokeWidth="4" strokeDasharray="8 4" fill="none" />
    <circle cx="50" cy="50" r="16" fill="#E5BA73" />
    <path d="M 50 50 L 50 20" stroke="#C99C45" strokeWidth="6" strokeLinecap="round" />
    <circle cx="50" cy="50" r="6" fill="#1A120B" />
  </svg>
);

export default VestorLogo;
