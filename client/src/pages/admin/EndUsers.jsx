import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Search, Pencil, Trash2, Eye, UserPlus, MapPin, AlertTriangle } from 'lucide-react';
import Avatar from '../../components/ui/Avatar';
import { api } from '../../lib/api';
import { vc, tint, VALUE_CHAINS } from '../../lib/valueChains';
import { DISTRICT_NAMES } from '../../lib/geo';
import { useToast } from '../../components/ui/Toast';

export default function EndUsers({ list, refresh }) {
  const [q, setQ] = useState('');
  const [district, setDistrict] = useState('');
  const [chain, setChain] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return list
      .filter((c) => (!district || c.district === district) && (!chain || c.valueChain === chain))
      .filter((c) => !s || [c.name, c.village, c.district, c.valueChain, c.phonePrimary].join(' ').toLowerCase().includes(s))
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }, [list, q, district, chain]);

  const remove = async () => {
    setBusy(true);
    try {
      await api.deleteChampion(confirm.id);
      await refresh();
      toast(`${confirm.name} removed`);
      setConfirm(null);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Manage</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Champion end users</h1>
          <p className="mt-1 text-sm text-ink-mute">{list.length} total · {list.filter((c) => c.published === false).length} hidden from website</p>
        </div>
        <Link to="/admin/users/new" className="btn-red">
          <UserPlus size={16} /> Add end user
        </Link>
      </div>

      <div className="card mb-4 flex flex-wrap items-center gap-2 p-3">
        <label className="relative min-w-[220px] flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input className="input !rounded-full !border-transparent !bg-black/[0.035] !pl-10" placeholder="Search name, village, phone…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <select className="input !w-auto !rounded-full" value={district} onChange={(e) => setDistrict(e.target.value)}>
          <option value="">All districts</option>
          {DISTRICT_NAMES.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <select className="input !w-auto !rounded-full" value={chain} onChange={(e) => setChain(e.target.value)}>
          <option value="">All value chains</option>
          {VALUE_CHAINS.map((v) => (
            <option key={v.name}>{v.name}</option>
          ))}
        </select>
      </div>

      {/* phones: cards */}
      <div className="space-y-2 md:hidden">
        {rows.map((c) => {
          const v = vc(c.valueChain);
          return (
            <div key={c.id} className="card flex items-center gap-3 p-3">
              <button onClick={() => navigate(`/admin/users/${c.id}`)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <Avatar champion={c} size={48} rounded="rounded-xl" />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{c.name}</span>
                  <span className="mt-0.5 flex items-center gap-1 text-xs text-ink-mute">
                    <MapPin size={11} className="text-selco" /> {c.district}
                    {c.published === false && <span className="ml-1 rounded-full bg-amber-50 px-1.5 text-[10px] font-semibold text-amber-700">Hidden</span>}
                  </span>
                  <span className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={{ background: tint(v.color, 0.86), color: v.color }}>
                    <v.Icon size={10} /> {c.valueChain || '—'}
                  </span>
                </span>
              </button>
              <div className="flex shrink-0 flex-col gap-1">
                <Link to={`/admin/users/${c.id}`} aria-label="Edit" className="grid h-9 w-9 place-items-center rounded-xl bg-black/[0.04] text-ink">
                  <Pencil size={16} />
                </Link>
                <button onClick={() => setConfirm(c)} aria-label="Delete" className="grid h-9 w-9 place-items-center rounded-xl bg-selco-soft text-selco">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}
        {!rows.length && <p className="py-10 text-center text-sm text-ink-mute">No end users match these filters.</p>}
      </div>

      <div className="card hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-black/[0.06] bg-black/[0.02] text-[11px] uppercase tracking-[0.08em] text-ink-mute">
                <th className="px-5 py-3 font-semibold">End user</th>
                <th className="px-3 py-3 font-semibold">District</th>
                <th className="px-3 py-3 font-semibold">Value chain</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">Updated</th>
                <th className="px-5 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {rows.map((c) => {
                  const v = vc(c.valueChain);
                  return (
                    <motion.tr key={c.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="border-b border-black/[0.04] last:border-0 hover:bg-black/[0.015]">
                      <td className="px-5 py-3">
                        <button onClick={() => navigate(`/admin/users/${c.id}`)} className="flex items-center gap-3 text-left">
                          <Avatar champion={c} size={40} rounded="rounded-xl" />
                          <span>
                            <span className="block font-semibold">{c.name}</span>
                            <span className="block text-xs text-ink-mute">{c.tagline || c.occupation || '—'}</span>
                          </span>
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1 text-ink-soft">
                          <MapPin size={13} className="text-selco" /> {c.district}
                        </span>
                        {c.village && <span className="block text-xs text-ink-faint">{c.village}</span>}
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: tint(v.color, 0.86), color: v.color }}>
                          <v.Icon size={11} /> {c.valueChain || '—'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {c.published === false ? (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Hidden</span>
                        ) : (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Live</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs text-ink-mute">{c.updatedAt ? new Date(c.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          {c.published !== false && (
                            <Link to={`/champion/${c.id}`} title="View on website" className="grid h-8 w-8 place-items-center rounded-lg text-ink-mute hover:bg-black/[0.05] hover:text-ink">
                              <Eye size={16} />
                            </Link>
                          )}
                          <Link to={`/admin/users/${c.id}`} title="Edit" className="grid h-8 w-8 place-items-center rounded-lg text-ink-mute hover:bg-black/[0.05] hover:text-ink">
                            <Pencil size={16} />
                          </Link>
                          <button onClick={() => setConfirm(c)} title="Delete" className="grid h-8 w-8 place-items-center rounded-lg text-ink-mute hover:bg-selco-soft hover:text-selco">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
          {!rows.length && <p className="py-14 text-center text-sm text-ink-mute">No end users match these filters.</p>}
        </div>
      </div>

      <AnimatePresence>
        {confirm && (
          <motion.div className="fixed inset-0 z-50 grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={() => !busy && setConfirm(null)} />
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-lift">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-selco-soft text-selco">
                <AlertTriangle size={20} />
              </span>
              <p className="mt-4 font-display text-xl font-bold">Delete {confirm.name}?</p>
              <p className="mt-1 text-sm text-ink-mute">The profile will be removed from the website and the map. This can’t be undone — to hide it temporarily, edit the profile and switch off “Show on website”.</p>
              <div className="mt-6 flex justify-end gap-2">
                <button className="btn-ghost" onClick={() => setConfirm(null)} disabled={busy}>
                  Cancel
                </button>
                <button className="btn-red" onClick={remove} disabled={busy}>
                  {busy ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
