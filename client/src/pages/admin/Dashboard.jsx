import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Eye, Users, CalendarDays, UserRound, Share2, Monitor, Smartphone, Tablet, Globe, RefreshCw, Activity, MapPin } from 'lucide-react';
import { api } from '../../lib/api';
import CountUp from '../../components/ui/CountUp';
import Avatar from '../../components/ui/Avatar';
import { vc } from '../../lib/valueChains';

const RANGES = [7, 30, 90];

function Tile({ label, value, sub, Icon, i }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="card relative overflow-hidden p-5">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-ink-mute">{label}</p>
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-black/[0.04] text-ink-soft">
          <Icon size={15} />
        </span>
      </div>
      <p className="mt-3 font-display text-[34px] font-bold leading-none tracking-tight">
        <CountUp value={value} duration={1.1} />
      </p>
      {sub && <p className="mt-2 text-xs text-ink-faint">{sub}</p>}
      {i === 0 && <span className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-selco to-transparent" />}
    </motion.div>
  );
}

function BarList({ rows, total, Icon }) {
  if (!rows?.length) return <p className="py-6 text-center text-sm text-ink-faint">No data yet</p>;
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.name}>
          <div className="mb-1 flex items-center justify-between text-[13px]">
            <span className="flex items-center gap-2 font-medium">
              {Icon && <Icon name={r.name} />} {r.name}
            </span>
            <span className="tabular-nums text-ink-mute">
              {r.value} <span className="text-ink-faint">· {Math.round((r.value / (total || 1)) * 100)}%</span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-black/[0.04]">
            <motion.div initial={{ width: 0 }} animate={{ width: `${(r.value / (total || 1)) * 100}%` }} transition={{ duration: 0.9, ease: 'easeOut' }} className="h-full rounded-full bg-[#2a78d6]" />
          </div>
        </div>
      ))}
    </div>
  );
}

const DeviceIcon = ({ name }) => {
  const I = name === 'Mobile' ? Smartphone : name === 'Tablet' ? Tablet : name === 'Desktop' ? Monitor : Globe;
  return <I size={14} className="text-ink-mute" />;
};

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-2xl bg-ink px-3.5 py-2.5 text-xs text-white shadow-lift">
      <p className="mb-1 font-semibold">{new Date(label).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
      <p>
        <span className="text-white/60">Visits</span> <b className="tabular-nums">{p.visits}</b>
      </p>
      <p>
        <span className="text-white/60">Unique visitors</span> <b className="tabular-nums">{p.visitors}</b>
      </p>
      <p>
        <span className="text-white/60">Profile views</span> <b className="tabular-nums">{p.profileViews}</b>
      </p>
    </div>
  );
}

const ago = (ts) => {
  const s = (Date.now() - new Date(ts).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
};

export default function Dashboard({ champions }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async (d = days) => {
    setBusy(true);
    try {
      setData(await api.analytics(d));
      setErr('');
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    load(days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const t = data?.totals;
  const byDistrict = Object.entries(
    champions.reduce((m, c) => ((m[c.district] = (m[c.district] || 0) + 1), m), {})
  ).sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Website analytics</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Who’s visiting the site</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="pill-tabs bg-white shadow-card">
            {RANGES.map((r) => (
              <button key={r} onClick={() => setDays(r)} className={`pill-tab ${days === r ? '!bg-ink !text-white' : ''}`}>
                <span className="sm:hidden">{r} days</span>
                <span className="hidden sm:inline">Last {r} days</span>
              </button>
            ))}
          </div>
          <button onClick={() => load()} className="btn-ghost !p-2.5" aria-label="Refresh">
            <RefreshCw size={16} className={busy ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {err && <p className="mb-4 rounded-2xl bg-selco-soft px-4 py-3 text-sm text-selco">{err}</p>}

      {t && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Tile i={0} label="Total visits" value={t.visits} sub={`${t.allTimeVisits.toLocaleString('en-IN')} all time`} Icon={Eye} />
            <Tile i={1} label="Unique visitors" value={t.visitors} sub={`${t.allTimeVisitors.toLocaleString('en-IN')} all time`} Icon={Users} />
            <Tile i={2} label="Visits today" value={t.todayVisits} sub={`${t.todayVisitors} unique today`} Icon={CalendarDays} />
            <Tile i={3} label="Profile views" value={t.profileViews} sub={`last ${days} days`} Icon={UserRound} />
            <div className="col-span-2 lg:col-span-1">
              <Tile i={4} label="Shares" value={t.shares} sub={`last ${days} days`} Icon={Share2} />
            </div>
          </div>

          <div className="card mt-4 p-5">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">Visits per day</p>
              <p className="text-xs text-ink-faint">hover a day for details</p>
            </div>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.series} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2a78d6" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#2a78d6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="rgba(0,0,0,.06)" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#9AA1AD' }} minTickGap={28} tickFormatter={(d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#9AA1AD' }} />
                  <Tooltip content={<ChartTip />} cursor={{ stroke: '#16181D', strokeWidth: 1, strokeDasharray: '3 3' }} />
                  <Area type="monotone" dataKey="visits" stroke="#2a78d6" strokeWidth={2} fill="url(#gv)" activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="card p-5 lg:col-span-1">
              <p className="mb-4 text-sm font-semibold">Most viewed champions</p>
              {data.topChampions.length ? (
                <div className="space-y-2">
                  {data.topChampions.map((r, k) => {
                    const c = champions.find((x) => x.id === r.id) || { name: r.name };
                    return (
                      <div key={r.id} className="flex items-center gap-3">
                        <span className="w-4 text-xs font-semibold text-ink-faint">{k + 1}</span>
                        <Avatar champion={c} size={32} rounded="rounded-xl" />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
                        <span className="text-sm font-semibold tabular-nums">{r.value}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-ink-faint">No profile views yet</p>
              )}
            </div>
            <div className="card p-5">
              <p className="mb-4 text-sm font-semibold">Devices</p>
              <BarList rows={data.devices} total={t.visits} Icon={DeviceIcon} />
              <p className="mb-4 mt-6 text-sm font-semibold">Where visitors come from</p>
              <BarList rows={data.referrers} total={t.visits} />
            </div>
            <div className="card p-5">
              <p className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <Activity size={15} /> Recent activity
              </p>
              <div className="space-y-3">
                {data.recent.length ? (
                  data.recent.map((e, k) => (
                    <div key={k} className="flex items-start gap-3 text-[13px]">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${e.type === 'share' ? 'bg-selco' : e.type === 'profile_view' ? 'bg-[#2a78d6]' : 'bg-ink-faint'}`} />
                      <span className="min-w-0 flex-1">
                        {e.type === 'pageview' && 'Someone visited the website'}
                        {e.type === 'profile_view' && (
                          <>
                            Viewed <b className="font-semibold">{e.championName || e.championId}</b>
                          </>
                        )}
                        {e.type === 'share' && (
                          <>
                            Shared {e.championName ? <b className="font-semibold">{e.championName}</b> : 'the website'} via {e.channel}
                          </>
                        )}
                        <span className="block text-[11px] text-ink-faint">
                          {ago(e.ts)} · {e.device || '—'}
                        </span>
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="py-6 text-center text-sm text-ink-faint">No visits yet</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <div className="mt-8 mb-4">
        <p className="eyebrow">Content</p>
        <h2 className="mt-1 font-display text-2xl font-bold tracking-tight">Champions on the map</h2>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <p className="mb-4 text-sm font-semibold">By district</p>
          <div className="grid grid-cols-2 gap-2">
            {byDistrict.map(([d, n]) => (
              <div key={d} className="flex items-center justify-between rounded-xl bg-black/[0.03] px-3 py-2 text-sm">
                <span className="flex items-center gap-1.5">
                  <MapPin size={13} className="text-selco" /> {d}
                </span>
                <b className="tabular-nums">{n}</b>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <p className="mb-4 text-sm font-semibold">By value chain</p>
          <div className="space-y-2">
            {Object.entries(champions.reduce((m, c) => ((m[c.valueChain] = (m[c.valueChain] || 0) + 1), m), {}))
              .sort((a, b) => b[1] - a[1])
              .map(([n, k]) => {
                const v = vc(n);
                return (
                  <div key={n} className="flex items-center gap-3 text-sm">
                    <v.Icon size={15} style={{ color: v.color }} />
                    <span className="flex-1 font-medium">{n}</span>
                    <b className="tabular-nums">{k}</b>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
