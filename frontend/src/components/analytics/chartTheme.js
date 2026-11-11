// Shared Recharts styling for the Analytics page.
export const chartTooltip = {
  contentStyle: {
    backgroundColor: '#1a140e', border: '1px solid rgba(241, 223, 211, 0.12)', borderRadius: '8px',
    color: '#f1dfd3', fontSize: '12px', padding: '8px 10px',
  },
  itemStyle: { color: '#f1dfd3', padding: 0 },
  labelStyle: { color: '#d2c5b4', marginBottom: '4px', fontWeight: 600 },
  cursor: { stroke: 'rgba(241, 223, 211, 0.15)', fill: 'rgba(241, 223, 211, 0.04)' },
};

export const axisTick = { fill: '#9a8f80', fontSize: 11 };

export const compactRupees = (v) => {
  if (!v) return '0';
  if (Math.abs(v) >= 1e5) return `₹${(v / 1e5).toFixed(v % 1e5 ? 1 : 0)}L`;
  if (Math.abs(v) >= 1e3) return `₹${Math.round(v / 1e3)}k`;
  return `₹${Math.round(v)}`;
};
