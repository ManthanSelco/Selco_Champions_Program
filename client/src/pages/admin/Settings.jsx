import { useState } from 'react';
import { motion } from 'motion/react';
import { KeyRound, Eye, EyeOff, ShieldCheck, UserRound } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../components/ui/Toast';

function strength(p) {
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return Math.min(s, 4);
}
const LABELS = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
const COLORS = ['#E3242B', '#E3242B', '#EDA100', '#2A78D6', '#1BAF7A'];

export default function Settings({ me, setMe }) {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [conf, setConf] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const toast = useToast();
  const s = strength(next);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (next.length < 8) return setErr('New password must be at least 8 characters.');
    if (next !== conf) return setErr('The two new passwords don’t match.');
    if (next === cur) return setErr('New password must be different from the current one.');
    setBusy(true);
    try {
      const r = await api.changePassword(cur, next);
      setMe({ ...me, passwordChangedAt: r.passwordChangedAt });
      setCur('');
      setNext('');
      setConf('');
      toast('Password changed');
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  const type = show ? 'text' : 'password';
  return (
    <div className="max-w-2xl">
      <p className="eyebrow">Security</p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Change password</h1>

      <div className="card mt-6 flex items-center gap-4 p-5">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-black/[0.04]">
          <UserRound size={20} />
        </span>
        <div className="flex-1">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-mute">Admin ID (fixed)</p>
          <p className="font-semibold">{me.adminId}</p>
        </div>
        <p className="text-right text-xs text-ink-mute">
          Password last changed
          <br />
          <b className="text-ink">{me.passwordChangedAt ? new Date(me.passwordChangedAt).toLocaleString('en-IN') : 'Never (default password)'}</b>
        </p>
      </div>

      <motion.form onSubmit={submit} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card mt-4 space-y-4 p-6">
        <label className="block">
          <span className="label">Current password</span>
          <input className="input" type={type} value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" required />
        </label>
        <label className="block">
          <span className="label">New password</span>
          <input className="input" type={type} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required />
          {next && (
            <div className="mt-2 flex items-center gap-3">
              <div className="flex flex-1 gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className="h-1.5 flex-1 rounded-full transition" style={{ background: i < s ? COLORS[s] : 'rgba(0,0,0,.08)' }} />
                ))}
              </div>
              <span className="w-16 text-right text-xs font-semibold text-ink-soft">{LABELS[s]}</span>
            </div>
          )}
        </label>
        <label className="block">
          <span className="label">Confirm new password</span>
          <input className="input" type={type} value={conf} onChange={(e) => setConf(e.target.value)} autoComplete="new-password" required />
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-mute">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> {show ? <EyeOff size={14} /> : <Eye size={14} />} Show passwords
        </label>
        {err && <p className="rounded-2xl bg-selco-soft px-4 py-2.5 text-sm font-medium text-selco">{err}</p>}
        <div className="flex items-center justify-between gap-3 pt-2">
          <p className="flex items-center gap-1.5 text-xs text-ink-mute">
            <ShieldCheck size={14} /> Other logged-in sessions will be signed out.
          </p>
          <button className="btn-dark" disabled={busy}>
            <KeyRound size={16} /> {busy ? 'Saving…' : 'Update password'}
          </button>
        </div>
      </motion.form>
    </div>
  );
}
