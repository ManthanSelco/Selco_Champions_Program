import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Eye, EyeOff, Lock, UserRound, ArrowLeft, ShieldCheck } from 'lucide-react';
import { api, DEMO } from '../../lib/api';
import MiniMap from './MiniMap';
import { useChampions } from '../../lib/ChampionsContext';

export default function Login({ onDone }) {
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const { champions } = useChampions();
  const [noServer, setNoServer] = useState(false);
  useEffect(() => {
    api.serverAvailable().then((ok) => setNoServer(!ok));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const r = await api.login(id.trim(), pw);
      onDone({ adminId: r.adminId, passwordChangedAt: r.passwordChangedAt });
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="sun-rays absolute -right-1/3 -top-1/3 h-[160%] w-[160%] opacity-40" />
        <div className="relative flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white">
            <img src="selco-logo.png" alt="" className="h-10 w-10 object-contain" />
          </span>
          <div>
            <p className="font-display text-lg font-bold">SELCO Foundation</p>
            <p className="text-sm text-white/60">Champion End Users · Admin</p>
          </div>
        </div>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1 }} className="relative mx-auto w-[78%] max-w-[420px]">
          <MiniMap champions={champions} dark />
        </motion.div>
        <div className="relative">
          <p className="font-display text-4xl font-bold leading-tight tracking-tight">
            Keep every champion’s story <span className="text-selco">up to date.</span>
          </p>
          <p className="mt-3 max-w-md text-white/60">Add end users, update their profiles and photos, and see how many people visit the website.</p>
        </div>
      </div>

      <div className="flex items-center justify-center px-5 py-10">
        <motion.form onSubmit={submit} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-[400px]">
          <Link to="/" className="mb-10 inline-flex items-center gap-1.5 text-sm font-medium text-ink-mute hover:text-ink">
            <ArrowLeft size={15} /> Back to website
          </Link>
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-selco-soft text-selco">
            <ShieldCheck size={22} />
          </span>
          <h1 className="mt-5 font-display text-3xl font-bold tracking-tight">Admin login</h1>
          <p className="mt-1.5 text-sm text-ink-mute">Sign in with the admin ID and password.</p>

          {noServer && (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-semibold">Admin is not available on this link</p>
              <p className="mt-1 text-[13px] leading-relaxed">
                This copy of the website is hosted without the Node server, so login, editing, photo upload and analytics are switched off. Open the admin on the server version
                (<code className="rounded bg-white/70 px-1">npm start</code> / <code className="rounded bg-white/70 px-1">npm run share</code>, or the AWS deployment).
              </p>
            </div>
          )}

          <label className="label mt-8" htmlFor="aid">Admin ID</label>
          <div className="relative">
            <UserRound size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input id="aid" className="input !pl-11" autoComplete="username" value={id} onChange={(e) => setId(e.target.value)} placeholder="admin" required />
          </div>

          <label className="label mt-4" htmlFor="apw">Password</label>
          <div className="relative">
            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input id="apw" className="input !pl-11 !pr-11" type={show ? 'text' : 'password'} autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" required />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-ink-faint hover:text-ink" aria-label={show ? 'Hide password' : 'Show password'}>
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {err && (
            <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-2xl bg-selco-soft px-4 py-2.5 text-sm font-medium text-selco">
              {err}
            </motion.p>
          )}

          <button className="btn-dark mt-6 w-full !py-3" disabled={busy || noServer}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          {DEMO && (
            <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
              Preview mode — sign in with <b>admin</b> / <b>Selco@2026</b>. Changes are saved only in this browser.
            </p>
          )}
        </motion.form>
      </div>
    </div>
  );
}
