import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Pause, Play, Images, Maximize2, X } from 'lucide-react';
import { assetUrl } from '../../lib/api';

export default function Gallery({ images = [], name }) {
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [playing, setPlaying] = useState(true);
  const [hover, setHover] = useState(false);
  const [full, setFull] = useState(false);
  const n = images.length;

  const go = useCallback(
    (d) => {
      setDir(d);
      setI((x) => (x + d + n) % n);
    },
    [n]
  );

  useEffect(() => {
    if (!playing || hover || n < 2) return;
    const t = setInterval(() => go(1), 4500);
    return () => clearInterval(t);
  }, [playing, hover, n, go]);

  useEffect(() => {
    if (!full) return;
    const k = (e) => {
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'Escape') {
        e.stopPropagation();
        setFull(false);
      }
    };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [full, go]);

  if (!n)
    return (
      <div className="grid place-items-center rounded-3xl border border-dashed border-black/10 bg-black/[0.02] px-6 py-14 text-center">
        <Images className="mb-3 text-ink-faint" />
        <p className="text-sm font-semibold">Photos coming soon</p>
        <p className="mt-1 text-xs text-ink-mute">Site photos for {name} will appear here once they are uploaded.</p>
      </div>
    );

  const slide = (big = false) => (
    <AnimatePresence initial={false} custom={dir} mode="popLayout">
      <motion.div
        key={i}
        custom={dir}
        initial={{ opacity: 0, x: dir * 60, scale: 1.04 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: dir * -60, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 260, damping: 32 }}
        className="absolute inset-0"
      >
        {!big && <img src={assetUrl(images[i])} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl" />}
        <img src={assetUrl(images[i])} alt={`${name} — photo ${i + 1}`} className="absolute inset-0 h-full w-full object-contain" draggable={false} />
      </motion.div>
    </AnimatePresence>
  );

  const arrows = (
    <>
      <button onClick={() => go(-1)} className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow-card backdrop-blur transition hover:scale-105" aria-label="Previous photo">
        <ChevronLeft size={20} />
      </button>
      <button onClick={() => go(1)} className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow-card backdrop-blur transition hover:scale-105" aria-label="Next photo">
        <ChevronRight size={20} />
      </button>
    </>
  );

  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div className="relative aspect-[16/9] overflow-hidden rounded-3xl bg-ink">
        {slide()}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/50 to-transparent" />
        {n > 1 && arrows}
        <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
          <div className="flex gap-1.5">
            {images.map((_, k) => (
              <button
                key={k}
                onClick={() => {
                  setDir(k > i ? 1 : -1);
                  setI(k);
                }}
                className="relative h-1.5 overflow-hidden rounded-full bg-white/40 transition-all"
                style={{ width: k === i ? 28 : 8 }}
                aria-label={`Photo ${k + 1}`}
              >
                {k === i && playing && !hover && n > 1 && (
                  <motion.span key={i} className="absolute inset-y-0 left-0 bg-white" initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 4.5, ease: 'linear' }} />
                )}
                {k === i && (!playing || hover || n < 2) && <span className="absolute inset-0 bg-white" />}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-black/40 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
              {i + 1} / {n}
            </span>
            {n > 1 && (
              <button onClick={() => setPlaying((p) => !p)} className="grid h-8 w-8 place-items-center rounded-full bg-black/40 text-white backdrop-blur" aria-label={playing ? 'Pause slideshow' : 'Play slideshow'}>
                {playing ? <Pause size={14} /> : <Play size={14} />}
              </button>
            )}
            <button onClick={() => setFull(true)} className="grid h-8 w-8 place-items-center rounded-full bg-black/40 text-white backdrop-blur" aria-label="Full screen">
              <Maximize2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {n > 1 && (
        <div className="scroll-thin mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((src, k) => (
            <button
              key={k}
              onClick={() => {
                setDir(k > i ? 1 : -1);
                setI(k);
              }}
              className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-xl transition ${k === i ? 'ring-2 ring-ink ring-offset-2' : 'opacity-60 hover:opacity-100'}`}
            >
              <img src={assetUrl(src)} alt="" className="h-full w-full object-cover object-[center_30%]" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {full && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] bg-black/95">
            <div className="absolute inset-6 md:inset-12">{slide(true)}</div>
            {n > 1 && arrows}
            <button onClick={() => setFull(false)} className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white" aria-label="Close full screen">
              <X size={20} />
            </button>
            <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white/70">
              {i + 1} / {n}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
