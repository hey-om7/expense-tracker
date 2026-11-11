// Pure calculations for the Analytics page. All dates are local (the user's day).
// Only 'income' and 'expense' transactions count; investment buys/sells are moves, not spending.

const DAY_MS = 86400000;
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const monthStart = (y, m) => new Date(y, m, 1);
const daysIn = (y, m) => new Date(y, m + 1, 0).getDate();
const weekdayIndex = (d) => (d.getDay() + 6) % 7; // Monday = 0

const inMonth = (t, y, m) => {
  const d = new Date(t.date);
  return d.getFullYear() === y && d.getMonth() === m;
};

export const monthLabel = (y, m, opts = { month: 'long', year: 'numeric' }) =>
  monthStart(y, m).toLocaleDateString('en-IN', opts);

export const shiftMonth = ({ y, m }, by) => {
  const d = new Date(y, m + by, 1);
  return { y: d.getFullYear(), m: d.getMonth() };
};

const sum = (list) => list.reduce((s, t) => s + (Number(t.amount) || 0), 0);
const pctChange = (now, before) => (before > 0 ? ((now - before) / before) * 100 : null);

// Normalized monthly cost of a recurring payment.
const MONTHLY_FACTOR = { weekly: 52 / 12, monthly: 1, yearly: 1 / 12 };
export const monthlyCost = (s) => (Number(s.amount) || 0) * (MONTHLY_FACTOR[s.period] ?? 0);

/**
 * Everything the page shows for one month.
 * @param {{ transactions, categories, subscriptions, y, m, today?: Date }} input
 */
export const buildAnalytics = ({ transactions, categories, subscriptions, y, m, today = new Date() }) => {
  const prev = shiftMonth({ y, m }, -1);
  const expenses = transactions.filter(t => t.type === 'expense');
  const incomes = transactions.filter(t => t.type === 'income');
  const monthExp = expenses.filter(t => inMonth(t, y, m));
  const prevExp = expenses.filter(t => inMonth(t, prev.y, prev.m));

  const isCurrent = today.getFullYear() === y && today.getMonth() === m;
  const isFuture = monthStart(y, m) > today;
  const totalDays = daysIn(y, m);
  const elapsed = isFuture ? 0 : isCurrent ? today.getDate() : totalDays;

  // ── Pace: spent so far vs the same days of last month ──
  const spent = sum(monthExp);
  const prevDays = daysIn(prev.y, prev.m);
  const prevToSameDay = sum(prevExp.filter(t => new Date(t.date).getDate() <= Math.min(elapsed, prevDays)));
  const prevTotal = sum(prevExp);
  const income = sum(incomes.filter(t => inMonth(t, y, m)));
  const dailyAvg = elapsed > 0 ? spent / elapsed : 0;
  const projected = isCurrent && elapsed >= 3 ? dailyAvg * totalDays : null;

  // Cumulative spend by day, this month vs last month (for the pace chart).
  const byDay = (list, n) => {
    const days = Array(n).fill(0);
    list.forEach(t => { days[new Date(t.date).getDate() - 1] += Number(t.amount) || 0; });
    return days;
  };
  const dayTotals = byDay(monthExp, totalDays);
  const prevDayTotals = byDay(prevExp, prevDays);
  let a = 0; let b = 0;
  const pace = Array.from({ length: totalDays }, (_, i) => {
    b += prevDayTotals[i] || 0;
    if (i < elapsed) a += dayTotals[i];
    return { day: i + 1, current: i < elapsed ? a : null, previous: i < prevDays ? b : null };
  });

  // ── Calendar ──
  const firstWeekday = weekdayIndex(monthStart(y, m));
  const calendar = dayTotals.map((amount, i) => ({
    day: i + 1,
    amount,
    future: i + 1 > elapsed,
    today: isCurrent && i + 1 === today.getDate(),
  }));
  const noSpendDays = calendar.filter(d => !d.future && d.amount === 0).length;
  const maxDay = Math.max(0, ...dayTotals);

  // ── Categories vs last month ──
  const catById = new Map(categories.map(c => [c.id, c]));
  const catTotals = (list) => list.reduce((map, t) => map.set(t.categoryId || '', (map.get(t.categoryId || '') || 0) + (Number(t.amount) || 0)), new Map());
  const nowCats = catTotals(monthExp);
  const prevCats = catTotals(prevExp);
  const catIds = new Set([...nowCats.keys(), ...prevCats.keys()]);
  const categoryShifts = [...catIds].map((id) => {
    const cat = catById.get(id);
    const now = nowCats.get(id) || 0;
    const before = prevCats.get(id) || 0;
    return { id: id || 'none', name: cat?.name || 'Uncategorized', color: cat?.color || '#5c5047', now, before, diff: now - before, change: pctChange(now, before) };
  }).filter(c => c.now > 0 || c.before > 0).sort((x, z) => z.now - x.now || z.before - x.before);

  // ── Payees: where money goes again and again ──
  const payeeMap = new Map();
  monthExp.forEach((t) => {
    const name = String(t.title || '').trim();
    if (!name) return;
    const key = name.toLowerCase();
    const p = payeeMap.get(key) || { name, count: 0, total: 0, categoryId: t.categoryId };
    p.count += 1;
    p.total += Number(t.amount) || 0;
    payeeMap.set(key, p);
  });
  const payees = [...payeeMap.values()].sort((x, z) => z.total - x.total).slice(0, 6)
    .map(p => ({ ...p, color: catById.get(p.categoryId)?.color || '#5c5047' }));
  const biggest = [...monthExp].sort((x, z) => z.amount - x.amount)[0] || null;

  // ── Weekday pattern: average per weekday over the last 8 full weeks before the month end ──
  const end = isCurrent ? today : new Date(y, m, totalDays, 23, 59, 59);
  const from = new Date(end.getTime() - 56 * DAY_MS);
  const weekdaySums = Array(7).fill(0);
  expenses.forEach((t) => {
    const d = new Date(t.date);
    if (d > from && d <= end) weekdaySums[weekdayIndex(d)] += Number(t.amount) || 0;
  });
  const weekdays = WEEKDAYS.map((name, i) => ({ name, avg: weekdaySums[i] / 8 }));
  const weekdayHasData = weekdaySums.some(v => v > 0);

  // ── Fixed commitments ──
  const active = subscriptions.filter(s => s.isActive && s.period !== 'one_time');
  const commitments = active.map(s => ({ id: s.id, name: s.name, period: s.period, amount: Number(s.amount) || 0, monthly: monthlyCost(s) }))
    .filter(s => s.monthly > 0).sort((x, z) => z.monthly - x.monthly);
  const committed = commitments.reduce((s, c) => s + c.monthly, 0);

  // ── 6-month cash flow, ending with the selected month ──
  const flow = Array.from({ length: 6 }, (_, i) => {
    const { y: fy, m: fm } = shiftMonth({ y, m }, i - 5);
    const inc = sum(incomes.filter(t => inMonth(t, fy, fm)));
    const exp = sum(expenses.filter(t => inMonth(t, fy, fm)));
    return {
      key: `${fy}-${fm}`,
      name: monthLabel(fy, fm, { month: 'short' }),
      Income: inc,
      Expense: exp,
      rate: inc > 0 ? Math.round(((inc - exp) / inc) * 100) : null,
    };
  });
  const flowMonths = flow.filter(f => f.Income > 0 || f.Expense > 0);
  const avgIncome = flowMonths.length ? flowMonths.reduce((s, f) => s + f.Income, 0) / flowMonths.length : 0;

  return {
    period: { y, m, isCurrent, isFuture, totalDays, elapsed, daysLeft: isCurrent ? totalDays - elapsed : 0, firstWeekday },
    pace: {
      spent, income, dailyAvg, projected, prevTotal, prevToSameDay,
      change: pctChange(spent, prevToSameDay),
      saved: income - spent,
      savingsRate: income > 0 ? Math.round(((income - spent) / income) * 100) : null,
      series: pace,
      count: monthExp.length,
    },
    calendar: { days: calendar, noSpendDays, maxDay },
    categoryShifts,
    payees,
    biggest,
    weekdays,
    weekdayHasData,
    commitments,
    committed,
    committedShare: avgIncome > 0 ? Math.round((committed / avgIncome) * 100) : null,
    flow,
  };
};
