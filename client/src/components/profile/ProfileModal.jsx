import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  X, ArrowLeft, MapPin, Phone, UserRound, Star, Award, BookOpen, Fingerprint, Handshake, Images, Navigation, PanelLeftClose, PanelLeftOpen,
  ExternalLink, Building2, Contact, CalendarClock, Sparkles,
} from 'lucide-react';
import Avatar, { CoverArt } from '../ui/Avatar';
import ShareMenu from '../ui/ShareMenu';
import Gallery from './Gallery';
import { assetUrl } from '../../lib/api';
import { vc, tint } from '../../lib/valueChains';
import { mapsUrl } from '../../lib/geo';

const SECTION_META = {
  profile: { label: 'Champion Profile', Icon: UserRound },
  why: { label: 'Why a Champion?', Icon: Star },
  achievement: { label: 'Achievement & Influence', Icon: Award },
  story: { label: 'Success Story', Icon: BookOpen },
  unique: { label: 'Uniqueness of this Site', Icon: Fingerprint },
  selco: { label: 'SELCO Engagement', Icon: Handshake },
  gallery: { label: 'Gallery', Icon: Images },
  contact: { label: 'Contact & Address', Icon: Contact },
  location: { label: 'Location', Icon: MapPin },
};
const has = (v) => typeof v === 'string' && v.trim().length > 0;

/** Sections that actually have content for this champion, in display order. */
function sectionsFor(c, gallery) {
  const list = [
    ['profile', has(c.profile) || has(c.occupation) || has(c.organisation) || has(c.implementation)],
    ['why', has(c.whyChampion)],
    ['achievement', has(c.achievement)],
    ['story', has(c.successStory)],
    ['unique', has(c.uniqueness)],
    ['selco', has(c.selcoEngagement)],
    ['gallery', gallery.length > 0],
    ['contact', has(c.phonePrimary) || has(c.phoneSecondary) || has(c.address)],
    ['location', (c.lat != null && c.lng != null) || has(c.mapLink) || has(c.address) || has(c.village)],
  ];
  return list.filter(([, ok]) => ok).map(([id]) => ({ id, ...SECTION_META[id] }));
}

/** Grid columns that exactly fit 1–4 highlight boxes (no empty cells). */
const HL_COLS = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-2 sm:grid-cols-4' };


/** Render multi-line text; "Label: text" lines get a bold label. */
function Rich({ text, empty = 'Details will be added soon.' }) {
  if (!text?.trim()) return <p className="text-sm italic text-ink-faint">{empty}</p>;
  return (
    <div className="prose-champ text-[15px] leading-[1.75] text-ink-soft">
      {text
        .split(/\n+/)
        .filter(Boolean)
        .map((line, i) => {
          const m = line.match(/^([^:.]{3,42}):\s+(.+)$/);
          return (
            <p key={i}>
              {m ? (
                <>
                  <strong className="font-semibold text-ink">{m[1]}:</strong> {m[2]}
                </>
              ) : (
                line
              )}
            </p>
          );
        })}
    </div>
  );
}

function Section({ id, index, title, Icon, children, root, accent }) {
  return (
    <motion.section
      id={`sec-${id}`}
      data-sec={id}
      initial={{ opacity: 0, y: 28 }}
      {...(index === 1 ? { animate: { opacity: 1, y: 0 } } : { whileInView: { opacity: 1, y: 0 }, viewport: { root, once: true, amount: 0.05 } })}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="scroll-mt-6 border-t border-black/[0.06] py-9 first:border-t-0 first:pt-2"
    >
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl" style={{ background: tint(accent, 0.86), color: accent }}>
          <Icon size={19} />
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">{String(index).padStart(2, '0')}</p>
          <h3 className="font-display text-[22px] font-bold leading-tight tracking-tight">{title}</h3>
        </div>
      </div>
      {children}
    </motion.section>
  );
}

function Fact({ label, value }) {
  if (!value) return null;
  return (
    <div className="rounded-2xl bg-black/[0.03] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-faint">{label}</p>
      <p className="mt-1 text-sm font-medium text-ink">{value}</p>
    </div>
  );
}

export default function ProfileModal({ champion: c, onClose, preview = false, page = false }) {
  const scroller = useRef(null);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('selco_profile_rail') === 'collapsed';
    } catch {
      return false;
    }
  });
  const toggleRail = () =>
    setCollapsed((v) => {
      try {
        localStorage.setItem('selco_profile_rail', v ? 'open' : 'collapsed');
      } catch {
        /* ignore */
      }
      return !v;
    });
  const chain = vc(c.valueChain);
  const photo = assetUrl(c.photo);
  const gallery = c.gallery?.length ? c.gallery : c.photo ? [c.photo] : [];
  const sections = useMemo(() => sectionsFor(c, gallery), [c]); // eslint-disable-line react-hooks/exhaustive-deps
  const [active, setActive] = useState(sections[0]?.id);
  const highlights = (c.highlights || []).filter((h) => has(h.value) || has(h.label)).slice(0, 4);
  const num = (id) => sections.findIndex((x) => x.id === id) + 1;

  useEffect(() => {
    if (page) {
      window.scrollTo(0, 0);
      return undefined;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', k);
    };
  }, [onClose, page]);

  // Scroll-spy for the section nav
  useEffect(() => {
    const box = scroller.current;
    if (!box) return;
    const root = page ? null : box;
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.dataset.sec);
      },
      { root, rootMargin: '-15% 0px -70% 0px' }
    );
    box.querySelectorAll('[data-sec]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [c.id, page, sections.length]);

  const jump = (id) => {
    const el = scroller.current?.querySelector(`#sec-${id}`);
    if (!el) return;
    if (page) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 130, behavior: 'smooth' });
    else scroller.current.scrollTo({ top: el.offsetTop - 16, behavior: 'smooth' });
  };

  const hasCoords = c.lat != null && c.lng != null;
  const embed = hasCoords
    ? `https://maps.google.com/maps?q=${c.lat},${c.lng}&z=13&output=embed`
    : `https://maps.google.com/maps?q=${encodeURIComponent(c.address || `${c.village}, ${c.district}, Karnataka`)}&z=11&output=embed`;

  const scrollRoot = page ? undefined : scroller;
  const body = (
    <>
        {/* ---------- left rail (collapsible) ---------- */}
        <motion.aside
          animate={{ width: collapsed ? 84 : 300 }}
          transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          className={`relative hidden shrink-0 flex-col border-r border-black/[0.06] bg-white lg:flex ${page ? 'sticky top-[68px] h-[calc(100vh-68px)] self-start' : ''}`}
        >

          <div className={collapsed ? 'flex justify-center px-2 py-6' : 'p-6'}>
            <Avatar champion={c} size={collapsed ? 48 : 84} rounded={collapsed ? 'rounded-2xl' : 'rounded-3xl'} />
            {!collapsed && (
              <>
                <h2 className="mt-4 font-display text-2xl font-bold leading-tight tracking-tight">{c.name}</h2>
                {c.tagline && <p className="mt-1 text-sm text-ink-mute">{c.tagline}</p>}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: tint(chain.color, 0.86), color: chain.color }}>
                    <chain.Icon size={12} /> {c.valueChain}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.04] px-2.5 py-1 text-[11px] font-semibold text-ink-soft">
                    <MapPin size={12} /> {c.district}
                  </span>
                </div>
              </>
            )}
          </div>
          <nav className={`scroll-thin min-h-0 flex-1 overflow-y-auto pb-3 ${collapsed ? 'px-2' : 'px-3'}`}>
            {sections.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => jump(id)}
                title={collapsed ? label : undefined}
                aria-label={label}
                className={`relative mb-0.5 flex w-full items-center rounded-xl py-2.5 text-left text-[13.5px] font-medium transition ${
                  collapsed ? 'justify-center px-0' : 'gap-3 px-3'
                } ${active === id ? 'text-ink' : 'text-ink-mute hover:bg-black/[0.03] hover:text-ink'}`}
              >
                {active === id && <motion.span layoutId="navpill" className="absolute inset-0 rounded-xl bg-black/[0.05]" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
                <Icon size={collapsed ? 18 : 16} className="relative shrink-0" style={active === id ? { color: chain.color } : undefined} />
                {!collapsed && <span className="relative whitespace-nowrap">{label}</span>}
              </button>
            ))}
          </nav>
          <div className={`border-t border-black/[0.06] ${collapsed ? 'px-2 py-2' : 'px-3 py-2'}`}>
            <button
              onClick={toggleRail}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className={`flex w-full items-center rounded-xl py-2.5 text-[13px] font-medium text-ink-mute transition hover:bg-black/[0.04] hover:text-ink ${collapsed ? 'justify-center' : 'gap-3 px-3'}`}
            >
              {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={16} />}
              {!collapsed && <span>Collapse sidebar</span>}
            </button>
          </div>
          {!preview && (
            <div className={`border-t border-black/[0.06] ${collapsed ? 'flex justify-center p-3' : 'p-4'}`}>
              <ShareMenu
                championId={c.id}
                title={`${c.name} — SELCO Champion`}
                text={`Meet ${c.name}, a SELCO Foundation champion from ${c.district}: ${c.tagline || c.valueChain}`}
                align="left"
                up
                variant="dark"
                label={collapsed ? '' : 'Share profile'}
                className={collapsed ? '' : '[&>button]:w-full'}
              />
            </div>
          )}
        </motion.aside>

        {/* ---------- content ---------- */}
        <div ref={scroller} className={`relative min-w-0 flex-1 ${page ? '' : 'scroll-thin overflow-y-auto'}`}>
          {/* hero: end-user image */}
          <div className="relative h-[46vh] min-h-[320px] overflow-hidden">
            {photo ? (
              <>
                {/* blurred copy fills the space, the real photo is shown whole (never cropped) */}
                <img src={photo} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-2xl" />
                <div className="absolute inset-0 bg-ink/35" />
                <motion.img
                  src={photo}
                  alt={c.name}
                  initial={{ opacity: 0, scale: 1.04 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0 h-full w-full object-contain object-top lg:inset-y-6 lg:left-auto lg:right-6 lg:h-[calc(100%-3rem)] lg:w-[58%] lg:rounded-3xl lg:object-right"
                />
              </>
            ) : (
              <CoverArt champion={c} className="absolute inset-0" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent lg:bg-gradient-to-r lg:from-black/75 lg:via-black/35 lg:to-transparent" />
            <div className="absolute right-4 top-4 flex gap-2">
              {!preview && !page && (
                <div className="lg:hidden">
                  <ShareMenu championId={c.id} title={`${c.name} — SELCO Champion`} label="" />
                </div>
              )}
              {!page && (
                <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-white/90 text-ink shadow-card backdrop-blur transition hover:rotate-90 hover:bg-white" aria-label="Close profile">
                  <X size={20} />
                </button>
              )}
            </div>
            {preview && <span className="absolute left-4 top-4 rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-ink">Preview</span>}
            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10 lg:max-w-[52%]">
              <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                <Sparkles size={13} /> SELCO Champion End User
              </motion.p>
              <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }} className="font-display text-4xl font-extrabold leading-[1.02] tracking-tight text-white [text-wrap:balance] sm:text-5xl xl:text-6xl">
                {c.name}
              </motion.h1>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/85">
                {c.tagline && <span>{c.tagline}</span>}
                <span className="inline-flex items-center gap-1">
                  <MapPin size={14} /> {c.village ? `${c.village}, ` : ''}
                  {c.district}
                </span>
              </motion.div>
            </div>
          </div>

          {/* highlights */}
          {highlights.length > 0 && (
            <div className={`relative z-10 -mt-px grid gap-px bg-black/[0.06] ${HL_COLS[highlights.length]}`}>
              {highlights.map((h, k) => (
                <motion.div key={k} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 + k * 0.07 }} className="bg-white px-4 py-4 sm:px-6 sm:py-5">
                  <p className="font-display text-[20px] font-bold leading-none tracking-tight sm:text-[26px]" style={{ color: k === 0 ? chain.color : undefined }}>
                    {h.value}
                  </p>
                  <p className="mt-1.5 text-xs font-medium text-ink-mute">{h.label}</p>
                </motion.div>
              ))}
            </div>
          )}

          {/* mobile section chips */}
          <div className={`scroll-thin sticky ${page ? 'top-[68px]' : 'top-0'} z-20 flex gap-1.5 overflow-x-auto border-b border-black/[0.06] bg-[#F7F8FA]/90 px-4 py-2.5 backdrop-blur lg:hidden`}>
            {sections.map(({ id, label }) => (
              <button key={id} onClick={() => jump(id)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${active === id ? 'bg-ink text-white' : 'bg-white text-ink-mute'}`}>
                {label}
              </button>
            ))}
          </div>

          <div className="mx-auto max-w-[860px] px-5 py-8 sm:px-10">
            {num('profile') > 0 && (
              <Section id="profile" index={num('profile')} title="Champion Profile" Icon={UserRound} root={scrollRoot} accent={chain.color}>
                {has(c.profile) && <Rich text={c.profile} />}
                {(has(c.occupation) || has(c.organisation)) && (
                  <div className={`grid gap-2 sm:grid-cols-2 ${has(c.profile) ? 'mt-5' : ''}`}>
                    <Fact label="Occupation" value={c.occupation} />
                    <Fact label="Organisation / Affiliation" value={c.organisation} />
                  </div>
                )}
                {has(c.implementation) && (
                  <div className="mt-2 flex gap-3 rounded-2xl border border-black/[0.06] bg-white px-4 py-3">
                    <CalendarClock size={18} className="mt-0.5 shrink-0" style={{ color: chain.color }} />
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-faint">Implementation</p>
                      <p className="mt-0.5 text-sm text-ink">{c.implementation}</p>
                    </div>
                  </div>
                )}
              </Section>
            )}

            {num('why') > 0 && (
              <Section id="why" index={num('why')} title="Why is a Champion?" Icon={Star} root={scrollRoot} accent={chain.color}>
                <Rich text={c.whyChampion} />
              </Section>
            )}

            {num('achievement') > 0 && (
              <Section id="achievement" index={num('achievement')} title="Achievement & Influence" Icon={Award} root={scrollRoot} accent={chain.color}>
                <Rich text={c.achievement} />
              </Section>
            )}

            {num('story') > 0 && (
              <Section id="story" index={num('story')} title="Success Story" Icon={BookOpen} root={scrollRoot} accent={chain.color}>
                <div className="relative overflow-hidden rounded-3xl bg-white p-6 shadow-card sm:p-8">
                  <span className="absolute -top-6 left-4 font-display text-[140px] leading-none" style={{ color: tint(chain.color, 0.8) }}>
                    “
                  </span>
                  <div className="relative">
                    <Rich text={c.successStory} />
                  </div>
                </div>
              </Section>
            )}

            {num('unique') > 0 && (
              <Section id="unique" index={num('unique')} title="Uniqueness of this Site" Icon={Fingerprint} root={scrollRoot} accent={chain.color}>
                <Rich text={c.uniqueness} />
              </Section>
            )}

            {num('selco') > 0 && (
              <Section id="selco" index={num('selco')} title="SELCO Engagement" Icon={Handshake} root={scrollRoot} accent={chain.color}>
                <div className="rounded-3xl border border-selco/15 bg-gradient-to-br from-selco-soft/70 to-white p-6">
                  <div className="mb-4 flex items-center gap-3">
                    <img src="selco-logo.png" alt="" className="h-10 w-10 object-contain" />
                    <p className="text-sm font-semibold text-selco">SELCO Foundation</p>
                  </div>
                  <Rich text={c.selcoEngagement} />
                </div>
              </Section>
            )}

            {num('gallery') > 0 && (
              <Section id="gallery" index={num('gallery')} title="Gallery" Icon={Images} root={scrollRoot} accent={chain.color}>
                <Gallery images={gallery} name={c.name} />
              </Section>
            )}

            {num('contact') > 0 && (
              <Section id="contact" index={num('contact')} title="Contact Details & Address" Icon={Contact} root={scrollRoot} accent={chain.color}>
                <div className={`grid gap-3 ${(has(c.phonePrimary) || has(c.phoneSecondary)) && has(c.address) ? 'sm:grid-cols-2' : ''}`}>
                  {(has(c.phonePrimary) || has(c.phoneSecondary)) && (
                    <div className="card p-5">
                      <p className="eyebrow mb-3">Phone</p>
                      <div className="space-y-2">
                        {[c.phonePrimary, c.phoneSecondary].filter(has).map((p, k) => (
                          <a key={k} href={`tel:${p.replace(/[^\d+]/g, '')}`} className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-black/[0.03]">
                            <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                              <Phone size={16} />
                            </span>
                            <span>
                              <span className="block text-sm font-semibold">{p}</span>
                              <span className="block text-[11px] text-ink-mute">{k === 0 ? 'Primary' : 'Secondary'}</span>
                            </span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  {has(c.address) && (
                    <div className="card p-5">
                      <p className="eyebrow mb-3">Address</p>
                      <div className="flex gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-selco-soft text-selco">
                          <Building2 size={16} />
                        </span>
                        <p className="text-sm leading-relaxed text-ink">{c.address}</p>
                      </div>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {num('location') > 0 && (
              <Section id="location" index={num('location')} title="Location" Icon={MapPin} root={scrollRoot} accent={chain.color}>
                <div className="overflow-hidden rounded-3xl border border-black/[0.06] bg-white">
                  <div className="relative aspect-[16/8] bg-black/[0.03]">
                    <iframe title={`Map of ${c.name}'s site`} src={embed} className="absolute inset-0 h-full w-full" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="text-sm">
                      <p className="font-semibold">
                        {c.village ? `${c.village}, ` : ''}
                        {c.district} district
                      </p>
                      {hasCoords && (
                        <p className="text-xs tabular-nums text-ink-mute">
                          {Number(c.lat).toFixed(5)}° N, {Number(c.lng).toFixed(5)}° E
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {hasCoords && (
                        <a className="btn-ghost !py-2 text-xs" href={`https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`} target="_blank" rel="noreferrer">
                          <Navigation size={14} /> Directions
                        </a>
                      )}
                      <a className="btn-dark !py-2 text-xs" href={mapsUrl(c)} target="_blank" rel="noreferrer">
                        <ExternalLink size={14} /> Open in Google Maps
                      </a>
                    </div>
                  </div>
                </div>
              </Section>
            )}

            <div className="mt-6 flex flex-col items-center gap-3 rounded-3xl bg-ink px-6 py-10 text-center text-white">
              <img src="selco-logo.png" alt="" className="h-12 w-12 rounded-2xl bg-white object-contain p-1" />
              <p className="font-display text-xl font-bold">Know someone who should see this?</p>
              {!preview && <ShareMenu championId={c.id} title={`${c.name} — SELCO Champion`} variant="red" label="Share this profile" up align="left" />}
            </div>
          </div>
        </div>
    </>
  );

  if (page)
    return (
      <div className="min-h-screen bg-[#F7F8FA]">
        <header className="sticky top-0 z-30 border-b border-black/[0.06] bg-white/85 backdrop-blur-xl">
          <div className="flex h-[68px] items-center justify-between gap-3 px-4 sm:px-6">
            <button onClick={onClose} className="btn-ghost !pl-3">
              <ArrowLeft size={16} /> <span className="hidden sm:inline">Back to map</span>
            </button>
            <div className="flex min-w-0 items-center gap-2.5">
              <img src="selco-logo.png" alt="SELCO Foundation" className="h-9 w-9 shrink-0 object-contain" />
              <span className="hidden truncate font-display text-[15px] font-bold sm:inline">SELCO Foundation · Champion End Users</span>
            </div>
            {!preview ? <ShareMenu championId={c.id} title={`${c.name} — SELCO Champion`} label="Share" variant="dark" /> : <span className="w-10" />}
          </div>
        </header>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} className="flex">
          {body}
        </motion.div>
      </div>
    );

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label={`${c.name} — champion profile`}
    >
      <motion.div className="absolute inset-0 bg-ink/45 backdrop-blur-md" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 220, damping: 28 }}
        className="relative flex h-[94vh] w-[96vw] overflow-hidden rounded-[28px] bg-[#F7F8FA] shadow-2xl sm:h-[90vh] sm:w-[90vw]"
      >
        {body}
      </motion.div>
    </motion.div>
  );
}
