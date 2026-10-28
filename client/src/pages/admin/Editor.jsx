import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft, MapPin, UserRound, BookOpen, Route, Sparkles, Images, Save, Eye, ImagePlus, Trash2, Star, ChevronLeft, ChevronRight, Crosshair, Link2, Upload,
} from 'lucide-react';
import { api, assetUrl } from '../../lib/api';
import { DISTRICT_NAMES, parseMapLink, districtAt } from '../../lib/geo';
import { VALUE_CHAINS } from '../../lib/valueChains';
import MiniMap from './MiniMap';
import ProfileModal from '../../components/profile/ProfileModal';
import { useToast } from '../../components/ui/Toast';

const EMPTY = {
  name: '', tagline: '', gender: '', age: '', occupation: '', organisation: '', photo: '',
  district: '', village: '', address: '', lat: '', lng: '', mapLink: '', phonePrimary: '', phoneSecondary: '',
  valueChain: 'Millets', valueChainDetail: '', implementation: '',
  profile: '', whyChampion: '', achievement: '', successStory: '', uniqueness: '', selcoEngagement: '',
  highlights: [{ value: '', label: '' }, { value: '', label: '' }, { value: '', label: '' }, { value: '', label: '' }],
  gallery: [], published: true,
};

const STORY = [
  { k: 'profile', label: 'Champion profile', hint: 'Who they are — age, land, crops, enterprise.' },
  { k: 'whyChampion', label: 'Why is a champion?', hint: 'What makes them a role model for others.' },
  { k: 'achievement', label: 'Achievement & influence', hint: 'Awards, farmers trained, reach.' },
  { k: 'successStory', label: 'Success story', hint: 'Before → after, income and life changes.' },
  { k: 'uniqueness', label: 'Uniqueness of this site', hint: 'Why visitors should come here.' },
  { k: 'selcoEngagement', label: 'SELCO engagement', hint: 'How SELCO Foundation identified and supported them.' },
];

function Block({ n, title, Icon, children, desc }) {
  return (
    <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: n * 0.05 }} className="card p-5 sm:p-7">
      <div className="mb-5 flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-sm font-bold text-white">{n}</span>
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <Icon size={17} className="text-selco" /> {title}
          </h2>
          {desc && <p className="text-[13px] text-ink-mute">{desc}</p>}
        </div>
      </div>
      {children}
    </motion.section>
  );
}

const Field = ({ label, children, className = '' }) => (
  <label className={`block ${className}`}>
    <span className="label">{label}</span>
    {children}
  </label>
);

export default function Editor({ list, refresh }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const existing = id ? list.find((c) => c.id === id) : null;
  const [f, setF] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState('');
  const [preview, setPreview] = useState(false);
  const [errors, setErrors] = useState({});
  const photoInput = useRef(null);
  const galleryInput = useRef(null);
  const loadedFor = useRef(null);

  useEffect(() => {
    if (id && existing && loadedFor.current !== id) {
      loadedFor.current = id;
      const h = [...(existing.highlights || [])];
      while (h.length < 4) h.push({ value: '', label: '' });
      setF({ ...EMPTY, ...existing, lat: existing.lat ?? '', lng: existing.lng ?? '', highlights: h, gallery: existing.gallery || [] });
    }
    if (!id && loadedFor.current !== 'new') {
      loadedFor.current = 'new';
      setF(EMPTY);
    }
  }, [id, existing]);

  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e }));

  const onMapLink = (e) => {
    const link = e.target.value;
    const p = parseMapLink(link);
    setF((s) => {
      const next = { ...s, mapLink: link };
      if (p) {
        next.lat = p.lat;
        next.lng = p.lng;
        const d = districtAt(p.lng, p.lat);
        if (d) next.district = d;
      }
      return next;
    });
    if (p) toast('Location read from the Google Maps link', 'info');
  };

  const upload = async (files, kind) => {
    if (!files?.length) return;
    setUploading(kind);
    try {
      const urls = await api.upload([...files]);
      setF((s) =>
        kind === 'photo'
          ? { ...s, photo: urls[0], gallery: s.gallery.includes(urls[0]) ? s.gallery : [urls[0], ...s.gallery] }
          : { ...s, gallery: [...s.gallery, ...urls], photo: s.photo || urls[0] }
      );
      toast(`${urls.length} photo${urls.length > 1 ? 's' : ''} uploaded`);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setUploading('');
    }
  };

  const moveImg = (i, d) =>
    setF((s) => {
      const g = [...s.gallery];
      const j = i + d;
      if (j < 0 || j >= g.length) return s;
      [g[i], g[j]] = [g[j], g[i]];
      return { ...s, gallery: g };
    });

  const validate = () => {
    const e = {};
    if (!f.name.trim()) e.name = 'Name is required';
    if (!f.district) e.district = 'Select the district';
    if (f.lat !== '' && (isNaN(Number(f.lat)) || Number(f.lat) < 11 || Number(f.lat) > 19)) e.lat = 'Latitude looks outside Karnataka';
    if (f.lng !== '' && (isNaN(Number(f.lng)) || Number(f.lng) < 73 || Number(f.lng) > 79)) e.lng = 'Longitude looks outside Karnataka';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const save = async () => {
    if (!validate()) {
      toast('Please fix the highlighted fields', 'error');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setSaving(true);
    try {
      const payload = { ...f, highlights: f.highlights.filter((h) => h.value || h.label) };
      if (existing) payload.id = existing.id;
      const saved = await api.saveChampion(payload);
      await refresh();
      toast(existing ? 'Profile updated' : 'End user created');
      loadedFor.current = null;
      navigate(`/admin/users/${saved.id}`, { replace: true });
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (id && !existing && list.length)
    return (
      <div className="card p-10 text-center">
        <p className="font-semibold">That end user doesn’t exist.</p>
        <Link to="/admin/users" className="btn-dark mt-4">Back to list</Link>
      </div>
    );

  const previewData = { ...f, id: f.id || 'preview', lat: f.lat === '' ? null : Number(f.lat), lng: f.lng === '' ? null : Number(f.lng), highlights: f.highlights.filter((h) => h.value || h.label), name: f.name || 'New champion', district: f.district || '—' };

  return (
    <div className="pb-28">
      <Link to="/admin/users" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-mute hover:text-ink">
        <ArrowLeft size={15} /> All end users
      </Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{existing ? 'Edit end user' : 'New end user'}</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">{f.name || 'Add a champion end user'}</h1>
        </div>
        <label className="flex cursor-pointer items-center gap-3 rounded-full bg-white px-4 py-2 shadow-card">
          <span className="text-sm font-medium">Show on website</span>
          <input type="checkbox" className="peer sr-only" checked={f.published} onChange={set('published')} />
          <span className="relative h-6 w-11 rounded-full bg-black/15 transition peer-checked:bg-emerald-500 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5" />
        </label>
      </div>

      <div className="space-y-4">
        <Block n={1} title="Location" Icon={MapPin} desc="Select the district — click the map to pick a district and drop a pin, or paste a Google Maps link.">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
            <div className="rounded-3xl bg-[#F6F3EE] p-4">
              <MiniMap champions={list.filter((c) => c.id !== f.id)} selected={f.district} pin={f} onPick={({ district, lat, lng }) => setF((s) => ({ ...s, district, lat, lng }))} />
              <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-ink-mute">
                <Crosshair size={13} /> Click on the map to set district & pin
              </p>
            </div>
            <div className="grid content-start gap-4 sm:grid-cols-2">
              <Field label="District *" className="sm:col-span-2">
                <select className={`input ${errors.district ? '!border-selco' : ''}`} value={f.district} onChange={set('district')}>
                  <option value="">Select district…</option>
                  {DISTRICT_NAMES.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
                {errors.district && <span className="mt-1 block text-xs text-selco">{errors.district}</span>}
              </Field>
              <Field label="Village / Taluk">
                <input className="input" value={f.village} onChange={set('village')} placeholder="e.g. Kuppelur, Ranebennur" />
              </Field>
              <Field label="Google Maps link">
                <div className="relative">
                  <Link2 size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
                  <input className="input !pl-10" value={f.mapLink} onChange={onMapLink} placeholder="Paste link — lat/long fill in" />
                </div>
              </Field>
              <Field label="Full address" className="sm:col-span-2">
                <textarea rows={2} className="input" value={f.address} onChange={set('address')} placeholder="Village, Post, Taluk, District, Karnataka – PIN" />
              </Field>
              <Field label="Latitude">
                <input className={`input tabular-nums ${errors.lat ? '!border-selco' : ''}`} value={f.lat} onChange={set('lat')} placeholder="14.4869" inputMode="decimal" />
                {errors.lat && <span className="mt-1 block text-xs text-selco">{errors.lat}</span>}
              </Field>
              <Field label="Longitude">
                <input className={`input tabular-nums ${errors.lng ? '!border-selco' : ''}`} value={f.lng} onChange={set('lng')} placeholder="75.6115" inputMode="decimal" />
                {errors.lng && <span className="mt-1 block text-xs text-selco">{errors.lng}</span>}
              </Field>
            </div>
          </div>
        </Block>

        <Block n={2} title="End user details & contact" Icon={UserRound}>
          <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
            <div>
              <span className="label">End user photo</span>
              <button type="button" onClick={() => photoInput.current?.click()} className="group relative grid aspect-square w-full place-items-center overflow-hidden rounded-3xl border-2 border-dashed border-black/10 bg-black/[0.02] transition hover:border-ink/30">
                {f.photo ? (
                  <>
                    <img src={assetUrl(f.photo)} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    <span className="absolute inset-0 grid place-items-center bg-ink/50 text-sm font-semibold text-white opacity-0 transition group-hover:opacity-100">Change photo</span>
                  </>
                ) : (
                  <span className="flex flex-col items-center gap-2 text-ink-mute">
                    {uploading === 'photo' ? <span className="h-6 w-6 animate-spin rounded-full border-2 border-ink/10 border-t-selco" /> : <ImagePlus size={24} />}
                    <span className="text-xs font-medium">Upload photo</span>
                  </span>
                )}
              </button>
              <input ref={photoInput} type="file" accept="image/*" hidden onChange={(e) => { upload(e.target.files, 'photo'); e.target.value = ''; }} />
              {f.photo && (
                <button type="button" onClick={() => setF((s) => ({ ...s, photo: '' }))} className="mt-2 w-full text-xs font-medium text-ink-mute hover:text-selco">
                  Remove photo
                </button>
              )}
            </div>
            <div className="grid content-start gap-4 sm:grid-cols-2">
              <Field label="Full name *">
                <input className={`input ${errors.name ? '!border-selco' : ''}`} value={f.name} onChange={set('name')} placeholder="e.g. Manjunath Adinavar" />
                {errors.name && <span className="mt-1 block text-xs text-selco">{errors.name}</span>}
              </Field>
              <Field label="One-line tagline">
                <input className="input" value={f.tagline} onChange={set('tagline')} placeholder="e.g. Agricultural drone spraying service" />
              </Field>
              <Field label="Gender">
                <select className="input" value={f.gender} onChange={set('gender')}>
                  <option value="">—</option>
                  <option>Female</option>
                  <option>Male</option>
                  <option>Other</option>
                </select>
              </Field>
              <Field label="Age">
                <input className="input" value={f.age} onChange={set('age')} placeholder="e.g. 42" inputMode="numeric" />
              </Field>
              <Field label="Occupation">
                <input className="input" value={f.occupation} onChange={set('occupation')} />
              </Field>
              <Field label="Organisation / SHG / FPO">
                <input className="input" value={f.organisation} onChange={set('organisation')} />
              </Field>
              <Field label="Primary phone">
                <input className="input" value={f.phonePrimary} onChange={set('phonePrimary')} inputMode="tel" />
              </Field>
              <Field label="Secondary phone">
                <input className="input" value={f.phoneSecondary} onChange={set('phoneSecondary')} inputMode="tel" />
              </Field>
              <Field label="Implementation (year & technology)" className="sm:col-span-2">
                <input className="input" value={f.implementation} onChange={set('implementation')} placeholder="e.g. 2025 — Millet processing unit" />
              </Field>
            </div>
          </div>
        </Block>

        <Block n={3} title="Value chain" Icon={Route} desc="Used for the “Value chain” view of the map. Use → between steps to show them as a flow.">
          <div className="mb-4 flex flex-wrap gap-2">
            {VALUE_CHAINS.map((v) => (
              <button
                type="button"
                key={v.name}
                onClick={() => setF((s) => ({ ...s, valueChain: v.name }))}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition ${f.valueChain === v.name ? 'border-transparent text-white' : 'border-black/[0.08] bg-white text-ink-soft hover:bg-black/[0.03]'}`}
                style={f.valueChain === v.name ? { background: v.color } : undefined}
              >
                <v.Icon size={14} /> {v.name}
              </button>
            ))}
          </div>
          <textarea rows={3} className="input" value={f.valueChainDetail} onChange={set('valueChainDetail')} placeholder="Farmers → millet cultivation → processing → packaging → local markets" />
        </Block>

        <Block n={4} title="Profile story" Icon={BookOpen} desc="Each box becomes a section on the profile page. Start a new line for a new paragraph.">
          <div className="grid gap-5 lg:grid-cols-2">
            {STORY.map(({ k, label, hint }) => (
              <Field key={k} label={label}>
                <textarea rows={6} className="input leading-relaxed" value={f[k]} onChange={set(k)} placeholder={hint} />
              </Field>
            ))}
          </div>
        </Block>

        <Block n={5} title="Key numbers" Icon={Sparkles} desc="Up to 4 highlights shown under the profile photo.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {f.highlights.map((h, i) => (
              <div key={i} className="rounded-2xl bg-black/[0.03] p-3">
                <input className="input !bg-white font-display text-lg font-bold" value={h.value} placeholder="1,430+" onChange={(e) => setF((s) => ({ ...s, highlights: s.highlights.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) }))} />
                <input className="input mt-2 !bg-white" value={h.label} placeholder="Acres sprayed" onChange={(e) => setF((s) => ({ ...s, highlights: s.highlights.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) }))} />
              </div>
            ))}
          </div>
        </Block>

        <Block n={6} title="Photo gallery" Icon={Images} desc="Shown as a slideshow at the end of the profile. The star marks the main photo. Photos are resized and compressed automatically when uploaded (up to 25 MB each).">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <AnimatePresence>
              {f.gallery.map((src, i) => (
                <motion.div key={src.slice(-60) + i} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="group relative aspect-[4/3] overflow-hidden rounded-2xl bg-black/5">
                  <img src={assetUrl(src)} alt="" className="h-full w-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                    <div className="flex gap-1">
                      <button type="button" onClick={() => moveImg(i, -1)} className="grid h-7 w-7 place-items-center rounded-lg bg-white/90" aria-label="Move left"><ChevronLeft size={14} /></button>
                      <button type="button" onClick={() => moveImg(i, 1)} className="grid h-7 w-7 place-items-center rounded-lg bg-white/90" aria-label="Move right"><ChevronRight size={14} /></button>
                    </div>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => setF((s) => ({ ...s, photo: src }))} className={`grid h-7 w-7 place-items-center rounded-lg ${f.photo === src ? 'bg-amber-400' : 'bg-white/90'}`} aria-label="Set as main photo"><Star size={14} /></button>
                      <button type="button" onClick={() => setF((s) => ({ ...s, gallery: s.gallery.filter((_, j) => j !== i), photo: s.photo === src ? '' : s.photo }))} className="grid h-7 w-7 place-items-center rounded-lg bg-white/90 text-selco" aria-label="Remove"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  {f.photo === src && <span className="absolute left-1.5 top-1.5 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold">Main</span>}
                </motion.div>
              ))}
            </AnimatePresence>
            <button type="button" onClick={() => galleryInput.current?.click()} className="grid aspect-[4/3] place-items-center rounded-2xl border-2 border-dashed border-black/10 text-ink-mute transition hover:border-ink/30 hover:text-ink">
              <span className="flex flex-col items-center gap-1.5 text-xs font-medium">
                {uploading === 'gallery' ? <span className="h-6 w-6 animate-spin rounded-full border-2 border-ink/10 border-t-selco" /> : <Upload size={20} />}
                Add photos
              </span>
            </button>
            <input ref={galleryInput} type="file" accept="image/*" multiple hidden onChange={(e) => { upload(e.target.files, 'gallery'); e.target.value = ''; }} />
          </div>
        </Block>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-black/[0.06] bg-white/85 backdrop-blur lg:left-[260px]">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <p className="hidden text-sm text-ink-mute sm:block">{existing ? `Last saved ${new Date(existing.updatedAt).toLocaleString('en-IN')}` : 'Not saved yet'}</p>
          <div className="ml-auto flex gap-2">
            <button type="button" className="btn-ghost" onClick={() => setPreview(true)}>
              <Eye size={16} /> Preview
            </button>
            <button type="button" className="btn-red" onClick={save} disabled={saving || !!uploading}>
              <Save size={16} /> {saving ? 'Saving…' : existing ? 'Save changes' : 'Create end user'}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>{preview && <ProfileModal champion={previewData} preview onClose={() => setPreview(false)} />}</AnimatePresence>
    </div>
  );
}
