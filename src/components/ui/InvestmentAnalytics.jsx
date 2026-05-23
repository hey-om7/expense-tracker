import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { useAppContext } from '../../context/AppContext';
import { formatCurrency } from '../../utils/currency';
import * as api from '../../services/api';

const RANGES = ['7D', '1M', '1Y'];
const RANGE_MAP = { '7D': '7d', '1M': '1mo', '1Y': '1y' };

const TYPE_COLORS = {
  Stock: '#E5BA73',
  'Mutual Fund': '#95CD41',
  Crypto: '#7C6BFF',
  FD: '#FF8A65',
  Other: '#9a8f80',
};

const tooltipStyle = {
  contentStyle: {
    backgroundColor: '#1a140e',
    border: '1px solid rgba(241, 223, 211, 0.1)',
    borderRadius: '12px',
    color: '#f1dfd3',
    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)',
    fontSize: '12px',
  },
  itemStyle: { color: '#f1dfd3' },
  labelStyle: { color: '#f1dfd3', fontWeight: 'bold', marginBottom: '4px' },
};

// ─── Price Chart for a single Stock/MF ───
const PriceChart = ({ investment }) => {
  const [range, setRange] = useState('1M');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchHistory = useCallback(async () => {
    if (!investment?.symbol) return;
    setLoading(true);
    setError(null);
    try {
      if (investment.type === 'Mutual Fund') {
        // Use mfapi.in for MF historical NAV
        const days = range === '7D' ? 7 : range === '1M' ? 30 : 365;
        const res = await fetch(`https://api.mfapi.in/mf/${investment.symbol}`);
        const json = await res.json();
        if (json?.data) {
          const sliced = json.data.slice(0, days).reverse();
          setData(sliced.map(d => ({
            date: d.date,
            close: parseFloat(d.nav),
          })));
        }
      } else if (investment.type === 'Stock') {
        const result = await api.fetchStockHistory(investment.symbol, RANGE_MAP[range]);
        setData(result);
      } else {
        setData([]);
      }
    } catch (e) {
      setError('Could not load price history.');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [investment, range]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const { minVal, maxVal, isPositive, pctChange } = useMemo(() => {
    if (data.length < 2) return { minVal: 0, maxVal: 0, isPositive: true, pctChange: 0 };
    const first = data[0].close;
    const last = data[data.length - 1].close;
    const vals = data.map(d => d.close);
    return {
      minVal: Math.min(...vals),
      maxVal: Math.max(...vals),
      isPositive: last >= first,
      pctChange: first > 0 ? ((last - first) / first) * 100 : 0,
    };
  }, [data]);

  const strokeColor = isPositive ? '#95CD41' : '#ef4444';
  const gradientId = `priceGrad_${investment?.id}`;

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (range === '1Y') return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="bg-surface-container-low rounded-xl p-5 border border-outline/5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h4 className="font-bold text-on-surface text-sm">{investment.name}</h4>
          <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mt-0.5">
            {investment.symbol} · {investment.type}
          </p>
        </div>
        <div className="text-right">
          <p className="font-headline font-extrabold text-lg text-primary">
            {formatCurrency(investment.currentPrice)}
          </p>
          {data.length >= 2 && (
            <p className={`text-xs font-bold ${isPositive ? 'text-[#95CD41]' : 'text-error'}`}>
              {isPositive ? '+' : ''}{pctChange.toFixed(2)}% ({range})
            </p>
          )}
        </div>
      </div>

      {/* Range tabs */}
      <div className="flex gap-1 mb-4">
        {RANGES.map(r => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${
              range === r
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container-highest text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-[180px] flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="h-[180px] flex items-center justify-center text-outline text-xs">{error}</div>
      ) : data.length === 0 ? (
        <div className="h-[180px] flex items-center justify-center text-outline text-xs">
          No historical data available for this asset type.
        </div>
      ) : (
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={strokeColor} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#4e4539" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="#9a8f80"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10 }}
                tickFormatter={formatDate}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke="#9a8f80"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10 }}
                width={55}
                domain={[minVal * 0.995, maxVal * 1.005]}
                tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toFixed(0)}`}
              />
              <Tooltip
                formatter={(v) => [formatCurrency(v), 'Price']}
                labelFormatter={formatDate}
                {...tooltipStyle}
              />
              <ReferenceLine
                y={data[0]?.close}
                stroke={strokeColor}
                strokeDasharray="4 4"
                strokeOpacity={0.4}
              />
              <Area
                type="monotone"
                dataKey="close"
                stroke={strokeColor}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                dot={false}
                activeDot={{ r: 4, fill: strokeColor }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Buy price reference */}
      {investment.avgCost > 0 && (
        <div className="mt-3 flex items-center gap-2 text-xs text-on-surface-variant">
          <span className="w-4 border-t-2 border-dashed border-primary/40" />
          <span>Avg buy: <span className="font-bold text-on-surface">{formatCurrency(investment.avgCost)}</span></span>
          <span className="ml-auto font-bold" style={{ color: investment.currentPrice >= investment.avgCost ? '#95CD41' : '#ef4444' }}>
            {investment.currentPrice >= investment.avgCost ? '▲' : '▼'}{' '}
            {investment.avgCost > 0
              ? Math.abs(((investment.currentPrice - investment.avgCost) / investment.avgCost) * 100).toFixed(2)
              : '0.00'}% vs cost
          </span>
        </div>
      )}
    </div>
  );
};

// ─── Portfolio Overview Charts ───
const PortfolioCharts = ({ investments }) => {
  const { totalPortfolioValue, totalInvested, totalUnrealizedProfit, totalRealizedProfit } = useAppContext();

  // Allocation by type
  const allocationData = useMemo(() => {
    const typeMap = {};
    investments.forEach(inv => {
      const val = inv.shares * inv.currentPrice;
      if (val > 0) typeMap[inv.type] = (typeMap[inv.type] || 0) + val;
    });
    return Object.entries(typeMap)
      .map(([type, value]) => ({ name: type === 'Mutual Fund' ? 'MF' : type, fullName: type, value, color: TYPE_COLORS[type] || '#9a8f80' }))
      .sort((a, b) => b.value - a.value);
  }, [investments]);

  // P/L per holding bar chart
  const plData = useMemo(() => {
    return investments
      .filter(inv => inv.shares > 0)
      .map(inv => ({
        name: inv.symbol || inv.name.slice(0, 8),
        fullName: inv.name,
        unrealized: parseFloat(((inv.currentPrice - inv.avgCost) * inv.shares).toFixed(2)),
        realized: parseFloat((inv.realizedProfit || 0).toFixed(2)),
        color: TYPE_COLORS[inv.type] || '#9a8f80',
      }))
      .sort((a, b) => b.unrealized - a.unrealized);
  }, [investments]);

  // Trade activity over time (monthly buy/sell volumes)
  const tradeActivityData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const map = {};
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${months[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
      map[key] = { name: key, Bought: 0, Sold: 0 };
    }
    investments.forEach(inv => {
      (inv.trades || []).forEach(trade => {
        const d = new Date(trade.date);
        const key = `${months[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
        if (map[key]) {
          const val = (trade.shares || 0) * (trade.price || 0);
          if (trade.type === 'buy_investment' || trade.type === 'BUY') map[key].Bought += val;
          else map[key].Sold += val;
        }
      });
    });
    return Object.values(map);
  }, [investments]);

  return (
    <div className="flex flex-col gap-5">
      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Portfolio Value', value: totalPortfolioValue, color: 'text-primary' },
          { label: 'Total Invested', value: totalInvested, color: 'text-[#E5BA73]' },
          { label: 'Unrealized P/L', value: totalUnrealizedProfit, color: totalUnrealizedProfit >= 0 ? 'text-[#95CD41]' : 'text-error' },
          { label: 'Realized P/L', value: totalRealizedProfit, color: totalRealizedProfit >= 0 ? 'text-[#95CD41]' : 'text-error' },
        ].map((s, i) => (
          <div key={i} className="bg-surface-container-lowest rounded-xl p-4 border border-outline/5">
            <span className="text-[9px] uppercase text-on-surface-variant font-bold tracking-widest block mb-1">{s.label}</span>
            <span className={`text-base font-headline font-extrabold ${s.color}`}>
              {s.value >= 0 ? '' : ''}{formatCurrency(s.value)}
            </span>
          </div>
        ))}
      </div>

      {/* Allocation Pie + P/L Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Allocation */}
        <div className="bg-surface-container-low rounded-xl p-5 border border-outline/5">
          <h4 className="font-bold text-sm text-on-surface mb-4">Allocation by Type</h4>
          {allocationData.length === 0 ? (
            <div className="h-[180px] flex items-center justify-center text-outline text-xs">No active holdings</div>
          ) : (
            <>
              <div className="h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={allocationData} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={4} dataKey="value">
                      {allocationData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip formatter={(v) => formatCurrency(v)} {...tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 space-y-2">
                {allocationData.map((e, i) => (
                  <div key={i} className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                      <span className="text-on-surface-variant truncate">{e.fullName}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-[10px] text-on-surface-variant">
                        {totalPortfolioValue > 0 ? ((e.value / totalPortfolioValue) * 100).toFixed(1) : 0}%
                      </span>
                      <span className="font-bold">{formatCurrency(e.value)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* P/L per holding */}
        <div className="bg-surface-container-low rounded-xl p-5 border border-outline/5">
          <h4 className="font-bold text-sm text-on-surface mb-4">Unrealized P/L by Holding</h4>
          {plData.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-outline text-xs">No active holdings</div>
          ) : (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={plData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#4e4539" horizontal={false} />
                  <XAxis
                    type="number"
                    stroke="#9a8f80"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => `${v >= 0 ? '+' : ''}${v >= 1000 || v <= -1000 ? (v / 1000).toFixed(1) + 'k' : v.toFixed(0)}`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="#9a8f80"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10 }}
                    width={45}
                  />
                  <Tooltip
                    formatter={(v, name, props) => [formatCurrency(v), props.payload.fullName]}
                    {...tooltipStyle}
                  />
                  <ReferenceLine x={0} stroke="#4e4539" />
                  <Bar dataKey="unrealized" radius={[0, 4, 4, 0]}>
                    {plData.map((entry, i) => (
                      <Cell key={i} fill={entry.unrealized >= 0 ? '#95CD41' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Trade Activity */}
      <div className="bg-surface-container-low rounded-xl p-5 border border-outline/5">
        <h4 className="font-bold text-sm text-on-surface mb-4">Trade Activity (12 Months)</h4>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={tradeActivityData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#4e4539" vertical={false} />
              <XAxis dataKey="name" stroke="#9a8f80" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
              <YAxis
                stroke="#9a8f80"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10 }}
                width={40}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
              />
              <Tooltip formatter={(v) => formatCurrency(v)} {...tooltipStyle} cursor={{ fill: 'rgba(229,186,115,0.05)' }} />
              <Bar dataKey="Bought" fill="#95CD41" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Sold" fill="#E5BA73" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex gap-4 mt-2 text-[10px] font-bold text-on-surface-variant">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#95CD41]" />Bought</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#E5BA73]" />Sold</span>
        </div>
      </div>
    </div>
  );
};

// ─── Main Analytics Panel ───
const InvestmentAnalytics = ({ isOpen, onClose, investments }) => {
  const [activeTab, setActiveTab] = useState('overview');

  // Only show price charts for Stock and MF types
  const chartableInvestments = useMemo(
    () => investments.filter(inv => inv.type === 'Stock' || inv.type === 'Mutual Fund'),
    [investments]
  );

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-surface-container shadow-2xl flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="Investment Analytics"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-outline/10 shrink-0">
          <div>
            <h2 className="font-headline font-bold text-lg text-on-surface">Investment Analytics</h2>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mt-0.5">
              Portfolio performance & charts
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition-colors"
            aria-label="Close analytics"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-outline/10 px-6 shrink-0">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-1 mr-6 text-xs font-bold uppercase tracking-widest border-b-2 transition-all ${
              activeTab === 'overview'
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Overview
          </button>
          {chartableInvestments.length > 0 && (
            <button
              onClick={() => setActiveTab('charts')}
              className={`py-3 px-1 text-xs font-bold uppercase tracking-widest border-b-2 transition-all ${
                activeTab === 'charts'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Price Charts
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-6">
          {activeTab === 'overview' && (
            <PortfolioCharts investments={investments} />
          )}

          {activeTab === 'charts' && (
            <div className="flex flex-col gap-5">
              {chartableInvestments.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-outline text-sm">
                  No Stocks or Mutual Funds to chart.
                </div>
              ) : (
                chartableInvestments.map(inv => (
                  <PriceChart key={inv.id} investment={inv} />
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default InvestmentAnalytics;
