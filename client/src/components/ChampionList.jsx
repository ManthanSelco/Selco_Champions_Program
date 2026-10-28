import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Search, X, ChevronRight, MapPin, Users } from 'lucide-react';
import Avatar from './ui/Avatar';
import { vc, tint } from '../lib/valueChains';

export default function ChampionList({ champions, district, onClearDistrict, chain, onClearChain, hoveredId, onHover, onOpen }) {
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return champions;
    return champions.filter((c) =>
      [c.name, c.village, c.district, c.valueChain, c.tagline, c.occupation].join(' ').toLowerCase().includes(s)
    );
  }, [champions, q]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-5 pb-3 pt-5 [&>div:first-child]:pr-10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">{district ? 'Selected area' : 'All areas'}</p>
            <h2 className="mt-1 font-display text-[22px] font-bold leading-tight tracking-tight">
              {district || 'Karnataka'}
            </h2>
          </div>
          <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-white">
            <Users size={13} /> {list.length}
          </span>
        </div>

        {(district || chain) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {district && (
              <button onClick={onClearDistrict} className="inline-flex items-center gap-1 rounded-full bg-selco-soft px-2.5 py-1 text-xs font-semibold text-selco">
                <MapPin size={12} /> {district} <X size={12} />
              </button>
            )}
            {chain && (
              <button
                onClick={onClearChain}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
                style={{ background: tint(vc(chain).color, 0.85), color: vc(chain).color }}
              >
                {chain} <X size={12} />
              </button>
            )}
          </div>
        )}

        <label className="relative mt-3 block">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, village, value chain…"
            className="input !rounded-full !bg-black/[0.035] !pl-10 !border-transparent focus:!bg-white"
          />
        </label>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <AnimatePresence initial={false} mode="popLayout">
          {list.map((c, i) => {
            const chainInfo = vc(c.valueChain);
            const active = hoveredId === c.id;
            return (
              <motion.button
                layout
                key={c.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0, transition: { delay: Math.min(i * 0.035, 0.4) } }}
                exit={{ opacity: 0, x: -10 }}
                onMouseEnter={() => onHover(c.id)}
                onMouseLeave={() => onHover(null)}
                onClick={() => onOpen(c)}
                className={`group mb-1 flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition ${
                  active ? 'bg-black/[0.045]' : 'hover:bg-black/[0.03]'
                }`}
              >
                <Avatar champion={c} size={48} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold text-ink">{c.name}</span>
                  <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-ink-mute">
                    <MapPin size={11} className="shrink-0" /> {c.village ? `${c.village}, ` : ''}
                    {c.district}
                  </span>
                  <span
                    className="mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                    style={{ background: tint(chainInfo.color, 0.86), color: chainInfo.color }}
                  >
                    <chainInfo.Icon size={11} /> {c.valueChain}
                  </span>
                </span>
                <ChevronRight size={18} className="shrink-0 text-ink-faint transition group-hover:translate-x-0.5 group-hover:text-ink" />
              </motion.button>
            );
          })}
        </AnimatePresence>
        {!list.length && (
          <div className="px-4 py-12 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-black/[0.04]">
              <MapPin size={20} className="text-ink-faint" />
            </div>
            <p className="text-sm font-semibold">No champions here yet</p>
            <p className="mt-1 text-xs text-ink-mute">Pick another district on the map, or clear the filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
