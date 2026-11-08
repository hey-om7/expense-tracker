import React from 'react';

const parseHex = (hex) => {
  const h = String(hex || '').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
};

/**
 * Returns the category color as HSL, lifted so it stays readable on the dark
 * surfaces (a saved color like #3D332B would otherwise vanish).
 */
export const categoryTone = (hex) => {
  const rgb = parseHex(hex);
  if (!rgb) return 'hsl(38, 68%, 68%)'; // brand gold
  const [r, g, b] = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  const light = Math.min(Math.max(l * 100, 64), 80);
  const sat = s < 0.08 ? s * 100 : Math.max(s * 100, 55);
  return `hsl(${Math.round(h)}, ${Math.round(sat)}%, ${Math.round(light)}%)`;
};

const SIZES = {
  sm: 'w-9 h-9 rounded-[10px] text-[18px]',
  md: 'w-11 h-11 rounded-xl text-[22px] max-md:w-10 max-md:h-10 max-md:text-[20px]',
  lg: 'w-14 h-14 rounded-2xl text-[28px]',
};

/**
 * Tonal category badge: tinted tile, hairline ring and a filled glyph, all
 * derived from the category's own color.
 */
const CategoryIcon = ({ icon, color, size = 'md', className = '' }) => {
  const tone = categoryTone(color);
  return (
    <span
      aria-hidden="true"
      className={`category-icon ${SIZES[size] || SIZES.md} ${className}`}
      style={{ '--tone': tone }}
    >
      <span className="material-symbols-outlined category-icon__glyph">{icon || 'category'}</span>
    </span>
  );
};

export default CategoryIcon;
