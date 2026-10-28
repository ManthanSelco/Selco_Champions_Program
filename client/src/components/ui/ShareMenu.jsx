import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Share2, Copy, Mail, Check, Smartphone, Wifi, QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import { WhatsAppIcon, LinkedInIcon, XIcon, FacebookIcon } from './BrandIcons';
import { trackShare } from '../../lib/track';
import { useToast } from './Toast';
import { useShareBase } from '../../lib/siteUrl';

export function shareUrl(championId, base = window.location.href.split('#')[0]) {
  return championId ? `${base}#/champion/${championId}` : `${base}#/`;
}

/**
 * Share popover for the whole site (no championId) or a single profile.
 * `align` controls which side the panel opens to.
 */
export default function ShareMenu({ championId, title, text, align = 'right', className = '', label = 'Share', variant = 'ghost', up = false }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef(null);
  const toast = useToast();
  const { base, kind } = useShareBase();
  const url = shareUrl(championId, base);
  const [qr, setQr] = useState('');
  const [showQr, setShowQr] = useState(false);
  useEffect(() => {
    if (!open || !showQr) return;
    QRCode.toDataURL(url, { margin: 1, width: 360, color: { dark: '#16181D', light: '#FFFFFF' } })
      .then(setQr)
      .catch(() => setQr(''));
  }, [open, showQr, url]);
  const message = text || title || 'SELCO Foundation · Champion End Users of Karnataka';

  useEffect(() => {
    if (!open) return;
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const go = (channel) => {
    trackShare(channel, championId);
    setTimeout(() => setOpen(false), 50);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {
        /* ignore */
      }
      ta.remove();
    }
    trackShare('copy', championId);
    setCopied(true);
    toast('Link copied');
    setTimeout(() => setCopied(false), 1600);
  };

  const native = async () => {
    try {
      await navigator.share({ title: title || document.title, text: message, url });
      trackShare('native', championId);
      setOpen(false);
    } catch {
      /* user cancelled */
    }
  };

  const enc = encodeURIComponent;
  const items = [
    { k: 'whatsapp', label: 'WhatsApp', Icon: WhatsAppIcon, color: '#25D366', href: `https://wa.me/?text=${enc(`${message}\n${url}`)}` },
    { k: 'linkedin', label: 'LinkedIn', Icon: LinkedInIcon, color: '#0A66C2', href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}` },
    { k: 'x', label: 'X', Icon: XIcon, color: '#111', href: `https://twitter.com/intent/tweet?text=${enc(message)}&url=${enc(url)}` },
    { k: 'facebook', label: 'Facebook', Icon: FacebookIcon, color: '#1877F2', href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
    { k: 'email', label: 'Email', Icon: Mail, color: '#E3242B', href: `mailto:?subject=${enc(title || 'SELCO Champions')}&body=${enc(`${message}\n\n${url}`)}` },
  ];

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={variant === 'dark' ? 'btn-dark' : variant === 'red' ? 'btn-red' : 'btn-ghost'}
        aria-expanded={open}
      >
        <Share2 size={16} />
        {label}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: up ? 8 : -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: up ? 6 : -6, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            className={`absolute z-50 w-[300px] rounded-3xl border border-black/5 bg-white p-4 shadow-lift ${
              align === 'left' ? 'left-0' : 'right-0'
            } ${up ? 'bottom-full mb-2' : 'top-full mt-2'}`}
          >
            <p className="eyebrow mb-3">{championId ? 'Share this profile' : 'Share this website'}</p>
            <div className="grid grid-cols-5 gap-2">
              {items.map(({ k, label: l, Icon, color, href }) => (
                <a key={k} href={href} target="_blank" rel="noopener noreferrer" onClick={() => go(k)} className="group flex flex-col items-center gap-1.5">
                  <span
                    className="grid h-11 w-11 place-items-center rounded-2xl text-white transition group-hover:-translate-y-0.5"
                    style={{ background: color }}
                  >
                    <Icon size={18} />
                  </span>
                  <span className="text-[10.5px] font-medium text-ink-mute">{l}</span>
                </a>
              ))}
            </div>
            {kind === 'wifi' && (
              <p className="mt-4 flex items-start gap-2 rounded-2xl bg-emerald-50 px-3 py-2 text-[11.5px] leading-snug text-emerald-800">
                <Wifi size={14} className="mt-px shrink-0" /> Wi-Fi link — works for anyone on the same Wi-Fi / office network.
              </p>
            )}
            {kind === 'local' && (
              <p className="mt-4 rounded-2xl bg-amber-50 px-3 py-2 text-[11.5px] leading-snug text-amber-800">
                This is a localhost link — it only opens on this computer. Connect to Wi-Fi to get a shareable link.
              </p>
            )}
            <div className="mt-3 flex items-center gap-2 rounded-2xl bg-black/[0.04] p-1.5 pl-3">
              <span className="min-w-0 flex-1 truncate text-xs text-ink-mute">{url}</span>
              <button type="button" onClick={copy} className="btn-dark !px-3 !py-1.5 text-xs">
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <button type="button" onClick={() => setShowQr((v) => !v)} className="btn-ghost mt-2 w-full !py-2 text-xs">
              <QrCode size={14} /> {showQr ? 'Hide QR code' : 'Show QR code (scan with phone)'}
            </button>
            {showQr && (
              <div className="mt-2 grid place-items-center rounded-2xl border border-black/[0.06] bg-white p-3">
                {qr ? <img src={qr} alt="QR code for this link" className="h-44 w-44" /> : <span className="h-44 w-44 animate-pulse rounded-xl bg-black/[0.04]" />}
                <p className="mt-2 text-center text-[11px] text-ink-mute">Scan with a phone camera to open</p>
              </div>
            )}
            {typeof navigator !== 'undefined' && navigator.share && (
              <button type="button" onClick={native} className="btn-ghost mt-2 w-full !py-2 text-xs">
                <Smartphone size={14} /> More options
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
