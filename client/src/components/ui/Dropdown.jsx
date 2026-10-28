import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, Check, Search } from 'lucide-react';

/**
 * Searchable dropdown.
 * options: [{ value, label, count?, color?, Icon?, muted? }]
 */
export default function Dropdown({ value, onChange, options, placeholder = 'Select…', allLabel, Icon: LeadIcon, searchable = true, id }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);
  const input = useRef(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    window.addEventListener('keydown', esc);
    setTimeout(() => input.current?.focus(), 30);
    return () => {
      document.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? options.filter((o) => o.label.toLowerCase().includes(s)) : options;
  }, [options, q]);

  const pick = (v) => {
    onChange(v);
    setOpen(false);
    setQ('');
  };

  return (
    <div ref={ref} className="relative">
      <button
        id={id}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center gap-2.5 rounded-2xl border bg-white px-3.5 py-2.5 text-left text-sm font-semibold transition ${open ? 'border-ink/30 ring-4 ring-black/[0.04]' : 'border-black/[0.08] hover:border-black/20'}`}
      >
        {current?.color ? (
          <span className="h-3 w-3 shrink-0 rounded-full ring-2 ring-white" style={{ background: current.color }} />
        ) : (
          LeadIcon && <LeadIcon size={16} className="shrink-0 text-ink-mute" />
        )}
        <span className={`min-w-0 flex-1 truncate ${current ? 'text-ink' : 'text-ink-mute'}`}>{current ? current.label : placeholder}</span>
        {current?.count != null && <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[11px] tabular-nums text-ink-soft">{current.count}</span>}
        <ChevronDown size={16} className={`shrink-0 text-ink-mute transition ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 450, damping: 32 }}
            className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-lift"
            role="listbox"
          >
            {searchable && (
              <div className="border-b border-black/[0.06] p-2">
                <label className="relative block">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                  <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="w-full rounded-xl bg-black/[0.04] py-2 pl-8 pr-3 text-sm outline-none" />
                </label>
              </div>
            )}
            <div className="scroll-thin max-h-[300px] overflow-y-auto p-1.5">
              {allLabel && !q && (
                <button type="button" onClick={() => pick(null)} className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-semibold hover:bg-black/[0.04] ${value == null ? 'text-ink' : 'text-ink-soft'}`}>
                  <span className="flex-1">{allLabel}</span>
                  {value == null && <Check size={15} />}
                </button>
              )}
              {list.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  onClick={() => pick(o.value)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] transition hover:bg-black/[0.04] ${o.value === value ? 'bg-black/[0.05] font-semibold' : ''} ${o.muted ? 'text-ink-faint' : 'text-ink'}`}
                >
                  {o.color ? <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: o.color, opacity: o.muted ? 0.4 : 1 }} /> : o.Icon ? <o.Icon size={14} /> : null}
                  <span className="flex-1 truncate">{o.label}</span>
                  {o.count != null && (
                    <span className={`min-w-[22px] rounded-full px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums ${o.count ? 'bg-selco-soft text-selco' : 'text-ink-faint'}`}>{o.count}</span>
                  )}
                  {o.value === value && <Check size={15} />}
                </button>
              ))}
              {!list.length && <p className="px-3 py-4 text-center text-xs text-ink-mute">No match</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
