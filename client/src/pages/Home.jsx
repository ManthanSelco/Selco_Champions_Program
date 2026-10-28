import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { AnimatePresence, motion, useScroll, useTransform } from 'motion/react';
import gsap from 'gsap';
import {
  Users, MapPinned, Layers, Venus, Plus, Minus, RotateCcw, MousePointer2, Lock, ArrowRight, MapPin, Map as MapIcon, Route, X, Hand, Check,
} from 'lucide-react';
import Logo from '../components/ui/Logo';
import ShareMenu from '../components/ui/ShareMenu';
import CountUp from '../components/ui/CountUp';
import Avatar, { CoverArt } from '../components/ui/Avatar';
import ChampionList from '../components/ChampionList';
import Dropdown from '../components/ui/Dropdown';
import KarnatakaMap3D from '../components/map/KarnatakaMap3D';
import ProfileModal from '../components/profile/ProfileModal';
import { useChampions } from '../lib/ChampionsContext';
import { VALUE_CHAINS, vc, tint } from '../lib/valueChains';
import { DISTRICTS } from '../lib/geo';
import { assetUrl } from '../lib/api';
import { trackPageview, trackProfile } from '../lib/track';

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-black/[0.04] bg-canvas/75 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[1480px] items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav className="pill-tabs hidden md:inline-flex">
          <a href="#map" onClick={(e) => { e.preventDefault(); document.getElementById('map')?.scrollIntoView({ behavior: 'smooth' }); }} className="pill-tab">Map</a>
          <a href="#champions" onClick={(e) => { e.preventDefault(); document.getElementById('champions')?.scrollIntoView({ behavior: 'smooth' }); }} className="pill-tab">Champions</a>
          <a href="#value-chains" onClick={(e) => { e.preventDefault(); document.getElementById('value-chains')?.scrollIntoView({ behavior: 'smooth' }); }} className="pill-tab">Value chains</a>
        </nav>
        <div className="flex items-center gap-2">
          <ShareMenu label="Share" />
          <Link to="/admin" className="btn-dark hidden sm:inline-flex">
            <Lock size={15} /> Admin
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero({ champions }) {
  const title = useRef(null);
  useEffect(() => {
    const words = title.current?.querySelectorAll('[data-w]');
    if (!words?.length) return;
    const t = gsap.fromTo(words, { yPercent: 110, opacity: 0, rotate: 4 }, { yPercent: 0, opacity: 1, rotate: 0, duration: 1.1, ease: 'expo.out', stagger: 0.06, delay: 0.1 });
    return () => t.kill();
  }, []);

  const districts = new Set(champions.map((c) => c.district)).size;
  const chains = new Set(champions.map((c) => c.valueChain)).size;
  const women = champions.filter((c) => /^f/i.test(c.gender || '')).length;
  const stats = [
    { label: 'Champion end users', value: champions.length, Icon: Users, accent: '#E3242B' },
    { label: `Districts of ${DISTRICTS.length}`, value: districts, Icon: MapPinned, accent: '#2F6FDE' },
    { label: 'Value chains', value: chains, Icon: Layers, accent: '#E0A526' },
    { label: 'Women champions', value: women, Icon: Venus, accent: '#D9407A' },
  ];

  const line = (text, cls = '') =>
    text.split(' ').map((w, i) => (
      <span key={i} className="inline-block overflow-hidden pb-1 align-bottom">
        <span data-w className={`inline-block ${cls}`}>{w}&nbsp;</span>
      </span>
    ));

  return (
    <section className="mx-auto max-w-[1480px] px-4 pb-6 pt-8 sm:px-6 sm:pt-12">
      <div className="grid items-end gap-8 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="eyebrow mb-4 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-selco" /> SELCO Foundation · Karnataka
          </motion.p>
          <h1 ref={title} className="font-display text-[40px] font-extrabold leading-[0.98] tracking-[-0.03em] sm:text-[64px]">
            {line('Champions powering')}
            <br />
            {line('rural livelihoods', 'text-selco')}
          </h1>
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="mt-5 max-w-xl text-[15.5px] leading-relaxed text-ink-mute">
            Farmers and rural entrepreneurs who use clean energy to process, add value and lead their communities — mapped across Karnataka by where they work and the value chain they strengthen.
          </motion.p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {stats.map(({ label, value, Icon, accent }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.08, type: 'spring', stiffness: 180, damping: 22 }}
              whileHover={{ y: -4 }}
              className="card relative overflow-hidden p-5"
            >
              <span className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-xl" style={{ background: tint(accent, 0.88), color: accent }}>
                <Icon size={17} />
              </span>
              <p className="font-display text-[44px] font-bold leading-none tracking-tight">
                <CountUp value={value} delay={0.3 + i * 0.1} />
              </p>
              <p className="mt-2 text-[13px] font-medium text-ink-mute">{label}</p>
              <span className="absolute inset-x-0 bottom-0 h-1" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ChainBreakdown({ champions, active, onPick }) {
  const total = champions.length || 1;
  const rows = VALUE_CHAINS.map((v) => ({ ...v, count: champions.filter((c) => c.valueChain === v.name).length })).filter((v) => v.count);
  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold">Champions by value chain</p>
        <p className="text-xs text-ink-faint">tap to filter the map</p>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-black/[0.04]">
        {rows.map((r) => (
          <motion.div key={r.name} initial={{ width: 0 }} whileInView={{ width: `${(r.count / total) * 100}%` }} viewport={{ once: true }} transition={{ duration: 1, ease: 'easeOut' }} style={{ background: r.color }} className="h-full border-r-2 border-white last:border-0" />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {rows.map((r) => (
          <button
            key={r.name}
            onClick={() => onPick(active === r.name ? null : r.name)}
            className={`flex items-center gap-2.5 rounded-2xl border p-2.5 text-left transition ${active === r.name ? 'border-ink bg-ink text-white' : 'border-black/[0.06] hover:bg-black/[0.02]'}`}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl" style={{ background: active === r.name ? r.color : tint(r.color, 0.86), color: active === r.name ? '#fff' : r.color }}>
              <r.Icon size={15} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[12.5px] font-semibold">{r.name}</span>
              <span className={`block text-[11px] ${active === r.name ? 'text-white/60' : 'text-ink-mute'}`}>
                {r.count} · {Math.round((r.count / total) * 100)}%
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MapSection({ champions, onOpen, district, setDistrict, chain, setChain }) {
  const mapRef = useRef();
  const [mode, setMode] = useState('champion');
  const [hoveredId, setHoveredId] = useState(null);

  const visible = useMemo(() => (chain ? champions.filter((c) => c.valueChain === chain) : champions), [champions, chain]);
  const listed = useMemo(() => (district ? visible.filter((c) => c.district === district) : visible), [visible, district]);

  const byDistrict = useMemo(() => {
    const m = {};
    for (const c of visible) (m[c.district] ||= []).push(c);
    return Object.entries(m).sort((a, b) => b[1].length - a[1].length);
  }, [visible]);

  const chainCounts = useMemo(
    () => VALUE_CHAINS.map((v) => ({ ...v, count: champions.filter((c) => c.valueChain === v.name).length })).filter((v) => v.count),
    [champions]
  );

  const selectDistrict = (name) => setDistrict((d) => (d === name ? null : name));
  const selInfo = district ? visible.filter((c) => c.district === district) : [];
  const panelOpen = !!(district || chain);
  const [unlocked, setUnlocked] = useState(false);
  const listRef = useRef(null);

  // Phones: after choosing a district, bring the list (below the map) into view.
  useEffect(() => {
    if (!panelOpen || window.innerWidth >= 1024) return;
    const t = setTimeout(() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 650);
    return () => clearTimeout(t);
  }, [district, chain, panelOpen]);

  const districtOptions = useMemo(() => {
    const counts = {};
    for (const c of visible) counts[c.district] = (counts[c.district] || 0) + 1;
    return DISTRICTS.map((d) => ({ value: d.name, label: d.name, count: counts[d.name] || 0, muted: !counts[d.name] }));
  }, [visible]);

  const chainOptions = useMemo(
    () =>
      VALUE_CHAINS.map((v) => {
        const n = champions.filter((c) => c.valueChain === v.name).length;
        return { value: v.name, label: v.name, color: v.color, count: n, muted: !n };
      }),
    [champions]
  );

  const pickChain = (n) => {
    setChain(n);
    if (n) setMode('valueChain');
  };

  return (
    <section id="map" className="mx-auto max-w-[1480px] scroll-mt-20 px-4 sm:px-6">
      <div className="relative rounded-[32px] border border-white/60 shadow-card">
        <div className="map-bg absolute inset-0 overflow-hidden rounded-[32px]">
          <div className="map-grid absolute inset-0" />
        </div>

        <div className="relative flex flex-col pb-3 lg:block lg:h-[calc(100vh-110px)] lg:min-h-[640px] lg:pb-0">
          {/* 3D map */}
          <div className={`relative order-2 mx-3 mt-3 h-[64vh] max-h-[620px] min-h-[380px] overflow-hidden rounded-[26px] transition-shadow lg:absolute lg:inset-0 lg:m-0 lg:h-auto lg:max-h-none lg:rounded-[32px] ${unlocked ? 'ring-2 ring-ink ring-offset-2 ring-offset-transparent' : ''}`}>
            <KarnatakaMap3D
              interactive={unlocked}
              ref={mapRef}
              champions={visible}
              mode={mode}
              selectedDistrict={district}
              onSelectDistrict={selectDistrict}
              hoveredId={hoveredId}
              onHoverChampion={setHoveredId}
              onOpenChampion={onOpen}
              dimDistricts={!!chain}
            />

            {/* phone controls: the map stays scroll-friendly until "Move map" is tapped */}
            <div className="absolute bottom-3 left-3 right-3 z-10 flex items-end justify-between gap-2 lg:hidden">
              <button
                onClick={() => setUnlocked((u) => !u)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-semibold shadow-lift transition active:scale-95 ${unlocked ? 'bg-ink text-white' : 'glass text-ink'}`}
              >
                {unlocked ? <Check size={16} /> : <Hand size={16} />}
                {unlocked ? 'Done' : 'Move map'}
              </button>
              <div className="flex gap-1.5">
                {[
                  { Icon: Plus, fn: () => mapRef.current?.zoomIn(), label: 'Zoom in' },
                  { Icon: Minus, fn: () => mapRef.current?.zoomOut(), label: 'Zoom out' },
                  { Icon: RotateCcw, fn: () => { setDistrict(null); setChain(null); mapRef.current?.reset(); }, label: 'Reset view' },
                ].map(({ Icon, fn, label }) => (
                  <button key={label} onClick={fn} aria-label={label} className="glass grid h-10 w-10 place-items-center rounded-full text-ink active:scale-95">
                    <Icon size={17} />
                  </button>
                ))}
              </div>
            </div>
            <AnimatePresence>
              {unlocked && (
                <motion.p initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="pointer-events-none absolute inset-x-3 top-3 z-10 mx-auto w-fit whitespace-nowrap rounded-full bg-ink px-3.5 py-1.5 text-xs font-medium text-white shadow-lift lg:hidden">
                  Drag to rotate · pinch to zoom
                </motion.p>
              )}
              {!unlocked && !panelOpen && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ delay: 1.2 }} className="pointer-events-none absolute inset-x-3 top-3 z-10 mx-auto w-fit whitespace-nowrap rounded-full bg-white/85 px-3.5 py-1.5 text-xs font-medium text-ink-soft shadow-card backdrop-blur lg:hidden">
                  Tap a district to see its champions
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* control panel: mode + dropdowns */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="glass relative z-20 order-1 mx-3 mt-3 rounded-[22px] p-3 lg:absolute lg:right-4 lg:top-4 lg:m-0 lg:w-[300px] lg:p-4"
          >
            <div className="grid grid-cols-2 gap-1 rounded-full bg-black/[0.04] p-1">
              {[
                { k: 'champion', label: 'Champion location', short: 'Location', Icon: MapIcon },
                { k: 'valueChain', label: 'Value chain', short: 'Value chain', Icon: Route },
              ].map(({ k, label, short, Icon }) => (
                <button key={k} onClick={() => setMode(k)} className={`relative rounded-full px-2 py-2 text-[12.5px] font-semibold transition ${mode === k ? 'text-white' : 'text-ink-mute hover:text-ink'}`}>
                  {mode === k && <motion.span layoutId="mode" className="absolute inset-0 rounded-full bg-ink" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                  <span className="relative flex items-center justify-center gap-1.5 whitespace-nowrap">
                    <Icon size={14} /> <span className="hidden sm:inline">{label}</span>
                    <span className="sm:hidden">{short}</span>
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-3">
              <AnimatePresence mode="wait" initial={false}>
                {mode === 'champion' ? (
                  <motion.div key="d" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                    <label className="eyebrow mb-1.5 block" htmlFor="dd-district">District</label>
                    <Dropdown id="dd-district" value={district} onChange={setDistrict} options={districtOptions} placeholder="Select a district" allLabel="All districts" Icon={MapPin} />
                    {byDistrict.length > 0 && (
                      <div className="scroll-thin -mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 lg:pb-0">
                        {byDistrict.map(([name, list]) => (
                          <button key={name} onClick={() => selectDistrict(name)} className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition ${district === name ? 'bg-ink text-white' : 'bg-white text-ink-soft ring-1 ring-black/[0.06] hover:ring-black/20'}`}>
                            {name} <span className={district === name ? 'text-white/60' : 'text-selco'}>{list.length}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div key="v" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                    <label className="eyebrow mb-1.5 block" htmlFor="dd-chain">Value chain</label>
                    <Dropdown id="dd-chain" value={chain} onChange={pickChain} options={chainOptions} placeholder="Select a value chain" allLabel="All value chains" searchable={false} />
                    <div className="mt-2 grid grid-cols-2 gap-0.5 lg:mt-3 lg:block lg:space-y-0.5">
                      {chainOptions.filter((v) => v.count).map((v) => (
                        <button key={v.value} onClick={() => pickChain(chain === v.value ? null : v.value)} className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-[12.5px] transition ${chain === v.value ? 'bg-ink text-white' : 'hover:bg-black/[0.04]'} ${chain && chain !== v.value ? 'opacity-45' : ''}`}>
                          <span className="h-2.5 w-2.5 rounded-full ring-2 ring-white" style={{ background: v.color }} />
                          <span className="flex-1 font-medium">{v.label}</span>
                          <span className="tabular-nums text-xs opacity-70">{v.count}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* left list panel: only after a district / value chain is chosen */}
          <AnimatePresence>
            {panelOpen && (
              <motion.aside
                key="list"
                initial={{ opacity: 0, x: -40, scale: 0.98 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -40, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 220, damping: 28 }}
                ref={listRef}
                className="glass relative z-10 order-3 m-3 flex scroll-mt-20 flex-col overflow-hidden rounded-[26px] lg:absolute lg:bottom-4 lg:left-4 lg:top-4 lg:m-0 lg:w-[360px]"
              >
                <button
                  onClick={() => {
                    setDistrict(null);
                    setChain(null);
                  }}
                  className="absolute right-4 top-4 z-10 grid h-8 w-8 place-items-center rounded-full bg-black/[0.05] text-ink-mute transition hover:bg-black/10 hover:text-ink"
                  aria-label="Close list"
                >
                  <X size={16} />
                </button>
                <ChampionList
                  champions={listed}
                  district={district}
                  onClearDistrict={() => setDistrict(null)}
                  chain={chain}
                  onClearChain={() => setChain(null)}
                  hoveredId={hoveredId}
                  onHover={setHoveredId}
                  onOpen={onOpen}
                />
              </motion.aside>
            )}
          </AnimatePresence>

          {/* prompt shown before anything is chosen */}
          <AnimatePresence>
            {!panelOpen && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: 0.9 }}
                className="glass absolute bottom-4 left-4 z-10 hidden max-w-[300px] rounded-[22px] p-5 lg:block"
              >
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-selco-soft text-selco">
                  <MousePointer2 size={18} />
                </span>
                <p className="mt-3 font-display text-lg font-bold leading-tight">Click a district to see its champions</p>
                <p className="mt-1 text-[13px] text-ink-mute">Or choose one from the dropdown. Districts with champions are raised on the map.</p>
              </motion.div>
            )}
          </AnimatePresence>


          {/* controls */}
          <div className="absolute bottom-4 right-4 z-10 hidden flex-col gap-2 lg:flex">
            {[
              { Icon: Plus, fn: () => mapRef.current?.zoomIn(), label: 'Zoom in' },
              { Icon: Minus, fn: () => mapRef.current?.zoomOut(), label: 'Zoom out' },
              { Icon: RotateCcw, fn: () => { setDistrict(null); setChain(null); mapRef.current?.reset(); }, label: 'Reset view' },
            ].map(({ Icon, fn, label }) => (
              <button key={label} onClick={fn} title={label} aria-label={label} className="glass grid h-10 w-10 place-items-center rounded-2xl text-ink transition hover:scale-105">
                <Icon size={17} />
              </button>
            ))}
          </div>
          <div className={`pointer-events-none absolute bottom-5 left-1/2 z-10 hidden -translate-x-1/2 items-center gap-2 rounded-full bg-white/70 px-3.5 py-1.5 text-[11.5px] font-medium text-ink-mute backdrop-blur ${panelOpen ? '' : 'xl:flex'}`}>
            <MousePointer2 size={13} /> Drag to rotate · Ctrl + scroll to zoom · click a district
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.4fr]" id="value-chains">
        <div className="card flex flex-col justify-between p-6">
          <div>
            <p className="eyebrow">How to explore</p>
            <p className="mt-2 font-display text-2xl font-bold leading-tight tracking-tight">Pick an area, then meet the people behind it.</p>
          </div>
          <ul className="mt-5 space-y-2.5 text-sm text-ink-mute">
            <li className="flex gap-2.5"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ink text-[10px] font-bold text-white">1</span><span>Tap or click a district on the 3D map (or pick one from the dropdown) to see its champions.</span></li>
            <li className="flex gap-2.5"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ink text-[10px] font-bold text-white">2</span><span>Switch to <b className="font-semibold text-ink">Value chain</b> to colour the map by millets, paddy, oilseeds and more.</span></li>
            <li className="flex gap-2.5"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ink text-[10px] font-bold text-white">3</span><span>Open any champion for their full story, location and photos — and share it.</span></li>
          </ul>
        </div>
        <ChainBreakdown champions={champions} active={chain} onPick={(n) => { setChain(n); if (n) setMode('valueChain'); document.getElementById('map')?.scrollIntoView({ behavior: 'smooth' }); }} />
      </div>
    </section>
  );
}

function ChampionGrid({ champions, onOpen, district, chain, onClear }) {
  const filtered = !!(district || chain);
  return (
    <section id="champions" className="mx-auto max-w-[1480px] scroll-mt-20 px-4 py-16 sm:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Meet the champions</p>
          <h2 className="mt-2 font-display text-4xl font-extrabold tracking-tight">Stories from the field</h2>
          {filtered && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-ink-mute">Showing</span>
              {district && (
                <span className="inline-flex items-center gap-1 rounded-full bg-selco-soft px-2.5 py-1 text-xs font-semibold text-selco">
                  <MapPin size={12} /> {district}
                </span>
              )}
              {chain && (
                <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: tint(vc(chain).color, 0.85), color: vc(chain).color }}>
                  {chain}
                </span>
              )}
              <span className="text-ink-mute">· {champions.length} champion{champions.length === 1 ? '' : 's'}</span>
              <button onClick={onClear} className="inline-flex items-center gap-1 rounded-full bg-black/[0.05] px-2.5 py-1 text-xs font-semibold text-ink-soft hover:bg-black/10">
                <X size={12} /> Show all
              </button>
            </div>
          )}
        </div>
        <p className="max-w-md text-sm text-ink-mute">Every profile covers who they are, why they lead, what changed, and how SELCO Foundation is involved.</p>
      </div>
      {!champions.length && (
        <div className="card px-6 py-14 text-center">
          <p className="font-semibold">No champions for this selection yet</p>
          <button onClick={onClear} className="btn-dark mt-4">Show all champions</button>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {champions.map((c, i) => {
          const chain = vc(c.valueChain);
          return (
            <motion.button
              key={c.id}
              onClick={() => onOpen(c)}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ delay: (i % 4) * 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -6 }}
              className="group card overflow-hidden text-left"
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                {c.photo ? (
                  <img src={assetUrl(c.photo)} alt={c.name} loading="lazy" className="h-full w-full object-cover object-[center_25%] transition duration-700 group-hover:scale-105" />
                ) : (
                  <CoverArt champion={c} className="h-full w-full transition duration-700 group-hover:scale-105" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold backdrop-blur" style={{ color: chain.color }}>
                  <chain.Icon size={12} /> {c.valueChain}
                </span>
                <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 text-xs font-medium text-white">
                  <MapPin size={12} /> {c.district}
                </span>
              </div>
              <div className="p-5">
                <p className="font-display text-lg font-bold leading-tight">{c.name}</p>
                <p className="mt-1 line-clamp-2 text-[13px] text-ink-mute">{c.tagline || c.occupation}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-ink">
                  View profile <ArrowRight size={14} className="transition group-hover:translate-x-1" />
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-black/[0.06] bg-white">
      <div className="mx-auto flex max-w-[1480px] flex-col items-start justify-between gap-6 px-4 py-10 sm:flex-row sm:items-center sm:px-6">
        <div className="flex items-center gap-4">
          <img src="selco-logo.png" alt="SELCO Foundation" className="h-14 w-14 object-contain" />
          <div>
            <p className="font-display text-lg font-bold">SELCO Foundation</p>
            <p className="text-sm text-ink-mute">Champion End Users of Karnataka</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ShareMenu label="Share this website" up />
          <Link to="/admin" className="btn-ghost">
            <Lock size={15} /> Admin
          </Link>
        </div>
      </div>
    </footer>
  );
}

export default function Home() {
  const { champions, loading, error } = useChampions();
  const { id } = useParams();
  const navigate = useNavigate();
  const open = champions.find((c) => c.id === id);
  // Map filters live here so the "Stories from the field" grid follows them too.
  const [district, setDistrict] = useState(null);
  const [chain, setChain] = useState(null);
  const gridChampions = useMemo(
    () => champions.filter((c) => (!district || c.district === district) && (!chain || c.valueChain === chain)),
    [champions, district, chain]
  );
  const { scrollY } = useScroll();
  const glowY = useTransform(scrollY, [0, 600], [0, -120]);

  useEffect(() => {
    trackPageview();
  }, []);
  useEffect(() => {
    if (open) {
      trackProfile(open.id);
      document.title = `${open.name} · SELCO Champion`;
    } else document.title = 'SELCO Champion Map';
  }, [open]);

  // Remember where the visitor was on the home page so "Back" returns them there.
  const savedScroll = useRef(0);
  const onOpen = (c) => {
    savedScroll.current = window.scrollY;
    navigate(`/champion/${c.id}`);
  };
  const onClose = () => navigate('/');
  useEffect(() => {
    if (!open && savedScroll.current) {
      const y = savedScroll.current;
      const t = setTimeout(() => window.scrollTo({ top: y, behavior: 'instant' }), 60);
      return () => clearTimeout(t);
    }
  }, [open]);

  return (
    <>
    {open && <ProfileModal key={open.id} champion={open} onClose={onClose} page />}
    {/* home stays mounted (hidden) while a profile page is open, so the map keeps its state */}
    <div className={`relative min-h-screen overflow-x-hidden ${open ? 'hidden' : ''}`}>
      <motion.div style={{ y: glowY }} className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(227,36,43,0.10),transparent)]" />
      <Header />
      {error && <div className="mx-auto mt-4 max-w-xl rounded-2xl bg-selco-soft px-4 py-3 text-center text-sm text-selco">Couldn’t load champions: {error}</div>}
      <Hero champions={champions} />
      {loading ? (
        <div className="mx-auto grid h-[60vh] max-w-[1480px] place-items-center px-6">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-ink/10 border-t-selco" />
        </div>
      ) : (
        <MapSection champions={champions} onOpen={onOpen} district={district} setDistrict={setDistrict} chain={chain} setChain={setChain} />
      )}
      <ChampionGrid champions={gridChampions} onOpen={onOpen} district={district} chain={chain} onClear={() => { setDistrict(null); setChain(null); }} />
      <Footer />
    </div>
    </>
  );
}
