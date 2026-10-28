import { useCallback, useEffect, useState } from 'react';
import { Routes, Route, NavLink, Navigate, useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { LayoutDashboard, Users, UserPlus, KeyRound, LogOut, ExternalLink, Menu, X } from 'lucide-react';
import { api, getToken } from '../../lib/api';
import { useChampions } from '../../lib/ChampionsContext';
import Login from './Login';
import Dashboard from './Dashboard';
import EndUsers from './EndUsers';
import Editor from './Editor';
import Settings from './Settings';

const NAV = [
  { to: '/admin', end: true, label: 'Analytics', Icon: LayoutDashboard },
  { to: '/admin/users', end: true, label: 'End users', Icon: Users },
  { to: '/admin/users/new', label: 'Add end user', Icon: UserPlus },
  { to: '/admin/settings', label: 'Change password', Icon: KeyRound },
];

export default function AdminApp() {
  const [me, setMe] = useState(null);
  const [checking, setChecking] = useState(!!getToken());
  const [list, setList] = useState([]);
  const [menu, setMenu] = useState(false);
  const navigate = useNavigate();
  const { reload: reloadPublic } = useChampions();

  useEffect(() => {
    document.title = 'Admin · SELCO Champion Map';
    if (!getToken()) return;
    api
      .me()
      .then(setMe)
      .catch(() => setMe(null))
      .finally(() => setChecking(false));
  }, []);

  const refresh = useCallback(async () => {
    const l = await api.listChampions({ admin: true });
    setList(l);
    reloadPublic();
    return l;
  }, [reloadPublic]);

  useEffect(() => {
    if (me) refresh().catch(() => {});
  }, [me, refresh]);

  const logout = () => {
    api.logout();
    setMe(null);
    navigate('/admin');
  };

  if (checking)
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-ink/10 border-t-selco" />
      </div>
    );
  if (!me) return <Login onDone={setMe} />;

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-5">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white ring-1 ring-black/5">
          <img src="selco-logo.png" alt="" className="h-9 w-9 object-contain" />
        </span>
        <div className="leading-tight">
          <p className="font-display text-[15px] font-bold">SELCO Admin</p>
          <p className="text-[11.5px] text-ink-mute">Champion End Users</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {NAV.map(({ to, end, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setMenu(false)}
            className={({ isActive }) =>
              `relative flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-medium transition ${isActive ? 'text-white' : 'text-ink-mute hover:bg-black/[0.04] hover:text-ink'}`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <motion.span layoutId="adminnav" className="absolute inset-0 rounded-2xl bg-ink" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
                <Icon size={17} className="relative" />
                <span className="relative">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-1 border-t border-black/[0.06] p-3">
        <Link to="/" className="flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-medium text-ink-mute hover:bg-black/[0.04] hover:text-ink">
          <ExternalLink size={17} /> View website
        </Link>
        <button onClick={logout} className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-medium text-selco hover:bg-selco-soft">
          <LogOut size={17} /> Log out
        </button>
        <div className="mt-2 rounded-2xl bg-black/[0.03] px-3.5 py-3">
          <p className="text-[11px] uppercase tracking-[0.1em] text-ink-faint">Signed in as</p>
          <p className="text-sm font-semibold">{me.adminId}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F3F5F8]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] border-r border-black/[0.06] bg-white lg:block">{sidebar}</aside>
      {menu && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setMenu(false)} />
          <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} className="absolute inset-y-0 left-0 w-[270px] bg-white">
            {sidebar}
          </motion.aside>
        </div>
      )}
      <div className="lg:pl-[260px]">
        <div className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-black/[0.06] bg-white/80 px-4 backdrop-blur lg:hidden">
          <button onClick={() => setMenu((m) => !m)} className="grid h-9 w-9 place-items-center rounded-xl bg-black/[0.04]" aria-label="Menu">
            {menu ? <X size={18} /> : <Menu size={18} />}
          </button>
          <p className="font-display font-bold">SELCO Admin</p>
          <span className="w-9" />
        </div>
        <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-8 sm:py-8">
          <Routes>
            <Route index element={<Dashboard champions={list} />} />
            <Route path="users" element={<EndUsers list={list} refresh={refresh} />} />
            <Route path="users/new" element={<Editor list={list} refresh={refresh} />} />
            <Route path="users/:id" element={<Editor list={list} refresh={refresh} />} />
            <Route path="settings" element={<Settings me={me} setMe={setMe} />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
