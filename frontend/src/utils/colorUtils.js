/**
 * Takes a hex color and returns a highly contrasting, colorful HSL string.
 * @param {string} hexColor - The background color in hex format.
 * @param {'harmonious' | 'complementary'} style - The color relationship.
 */
export const getContrastingColor = (hexColor, style = 'harmonious') => {
  if (!hexColor) return '#FFFFFF';
  
  // 1. Clean the hex string
  const hex = hexColor.replace('#', '');

  // 2. Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // 3. Calculate YIQ perceived brightness (0 to 255)
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;

  // 4. Convert RGB to HSL to safely manipulate the color
  const rRatio = r / 255;
  const gRatio = g / 255;
  const bRatio = b / 255;

  const max = Math.max(rRatio, gRatio, bRatio);
  const min = Math.min(rRatio, gRatio, bRatio);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // It's a shade of gray
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rRatio: h = (gRatio - bRatio) / d + (gRatio < bRatio ? 6 : 0); break;
      case gRatio: h = (bRatio - rRatio) / d + 2; break;
      case bRatio: h = (rRatio - gRatio) / d + 4; break;
    }
    h /= 6;
  }

  // Convert Hue to standard 360 degrees
  let hueBase = h * 360;

  // 5. Determine the new Hue based on the requested style
  let newHue = hueBase;
  if (style === 'complementary') {
    // Shift by 180 degrees to get the exact opposite color on the color wheel
    newHue = (hueBase + 180) % 360; 
  }

  // 6. Force the Lightness for contrast (The Magic Step)
  // If background is light (yiq >= 128), force the icon to be very dark (20% lightness)
  // If background is dark (yiq < 128), force the icon to be very light (85% lightness)
  const newLightness = yiq >= 128 ? 20 : 85;

  // 7. Keep Saturation high to ensure it looks colorful and not washed out
  const newSaturation = 85;

  // 8. Return a CSS-ready HSL string
  return `hsl(${Math.round(newHue)}, ${newSaturation}%, ${newLightness}%)`;
};
