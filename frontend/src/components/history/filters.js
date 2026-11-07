// Filter model and pure helpers for the History page.

export const TYPE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'expense', label: 'Expenses', icon: 'south_east' },
  { value: 'income', label: 'Income', icon: 'north_east' },
  { value: 'trade', label: 'Trades', icon: 'monitoring' },
];

export const PERIOD_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'last_90', label: 'Last 90 days' },
  { value: 'this_year', label: 'This year' },
  { value: 'custom', label: 'Custom' },
];

export const SORT_OPTIONS = [
  { value: 'latest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'highest', label: 'Highest amount' },
  { value: 'lowest', label: 'Lowest amount' },
];

export const DEFAULT_FILTERS = {
  search: '',
  type: 'all',
  period: 'all',
  from: '', // yyyy-mm-dd, used when period === 'custom'
  to: '',
  categoryIds: [],
  sort: 'latest',
};

export const isTrade = (t) => t.type === 'buy_investment' || t.type === 'sell_investment';
export const isOutflow = (t) => t.type === 'expense' || t.type === 'buy_investment';

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const parseInputDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

// Returns [start, endExclusive] or null for "all time".
export const periodRange = ({ period, from, to }) => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (period) {
    case 'this_month': return [new Date(y, m, 1), new Date(y, m + 1, 1)];
    case 'last_month': return [new Date(y, m - 1, 1), new Date(y, m, 1)];
    case 'last_90': { const s = startOfDay(now); s.setDate(s.getDate() - 89); const e = startOfDay(now); e.setDate(e.getDate() + 1); return [s, e]; }
    case 'this_year': return [new Date(y, 0, 1), new Date(y + 1, 0, 1)];
    case 'custom': {
      if (!from && !to) return null;
      const s = from ? parseInputDate(from) : new Date(0);
      const e = to ? parseInputDate(to) : new Date(8640000000000000);
      if (to) e.setDate(e.getDate() + 1);
      return [s, e];
    }
    default: return null;
  }
};

export const applyFilters = (transactions, f) => {
  const q = f.search.trim().toLowerCase();
  const range = periodRange(f);
  const cats = f.categoryIds.length ? new Set(f.categoryIds) : null;

  const result = transactions.filter(t => {
    if (q && !t.title.toLowerCase().includes(q) && !(t.notes || '').toLowerCase().includes(q)) return false;
    if (f.type === 'trade' ? !isTrade(t) : f.type !== 'all' && t.type !== f.type) return false;
    if (cats && !cats.has(t.categoryId)) return false;
    if (range) { const d = new Date(t.date); if (d < range[0] || d >= range[1]) return false; }
    return true;
  });

  const byDate = (a, b) => new Date(a.date) - new Date(b.date);
  const sorters = {
    latest: (a, b) => byDate(b, a),
    oldest: byDate,
    highest: (a, b) => b.amount - a.amount,
    lowest: (a, b) => a.amount - b.amount,
  };
  return result.sort(sorters[f.sort] || sorters.latest);
};

export const summarize = (list) => list.reduce((acc, t) => {
  if (isOutflow(t)) acc.out += t.amount; else acc.in += t.amount;
  return acc;
}, { in: 0, out: 0 });

const fmtShort = (s) => parseInputDate(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });

// Chips describing every filter that differs from the default (search excluded; it has its own field).
export const activeChips = (f, categories) => {
  const chips = [];
  if (f.period !== 'all') {
    const label = f.period === 'custom'
      ? (f.from || f.to ? `${f.from ? fmtShort(f.from) : 'Start'} – ${f.to ? fmtShort(f.to) : 'Today'}` : null)
      : PERIOD_OPTIONS.find(p => p.value === f.period)?.label;
    if (label) chips.push({ key: 'period', label, clear: { period: 'all', from: '', to: '' } });
  }
  f.categoryIds.forEach(id => {
    const c = categories.find(x => x.id === id);
    chips.push({ key: `cat-${id}`, label: c?.name || 'Category', color: c?.color, clear: { categoryIds: f.categoryIds.filter(x => x !== id) } });
  });
  if (f.sort !== 'latest') chips.push({ key: 'sort', label: SORT_OPTIONS.find(s => s.value === f.sort)?.label, clear: { sort: 'latest' } });
  return chips;
};

// Groups an already date-sorted list into days.
export const groupByDay = (list) => {
  const groups = [];
  let current = null;
  list.forEach(t => {
    const key = startOfDay(t.date).getTime();
    if (!current || current.key !== key) { current = { key, date: new Date(key), items: [], in: 0, out: 0 }; groups.push(current); }
    current.items.push(t);
    if (isOutflow(t)) current.out += t.amount; else current.in += t.amount;
  });
  return groups;
};

export const dayLabel = (date) => {
  const diff = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
};
