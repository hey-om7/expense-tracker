import React from 'react';

// Accessible on/off switch used on the settings pages.
const Toggle = ({ id, checked, disabled, onChange, describedBy }) => (
  <div className="relative shrink-0">
    <input
      type="checkbox"
      role="switch"
      id={id}
      aria-describedby={describedBy}
      aria-checked={checked}
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      className="sr-only peer"
    />
    <div className="w-11 h-6 bg-surface-container-highest rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-on-surface after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-disabled:opacity-60 transition-all"></div>
  </div>
);

export default Toggle;
