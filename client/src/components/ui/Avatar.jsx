import { assetUrl } from '../../lib/api';
import { vc, tint } from '../../lib/valueChains';

const initials = (name = '') =>
  name
    .replace(/^(mr|mrs|ms|dr)\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase();

/** Photo if we have one, otherwise a value-chain coloured monogram. */
export default function Avatar({ champion, size = 44, rounded = 'rounded-2xl', className = '', ring = false }) {
  const chain = vc(champion?.valueChain);
  const src = assetUrl(champion?.photo);
  const style = { width: size, height: size };
  if (src)
    return (
      <img
        src={src}
        alt={champion.name}
        loading="lazy"
        style={style}
        className={`${rounded} shrink-0 object-cover object-[center_25%] ${ring ? 'ring-2 ring-white' : ''} ${className}`}
      />
    );
  const Icon = chain.Icon;
  return (
    <div
      style={{ ...style, background: `linear-gradient(140deg, ${tint(chain.color, 0.55)}, ${chain.color})` }}
      className={`${rounded} relative grid shrink-0 place-items-center overflow-hidden text-white ${ring ? 'ring-2 ring-white' : ''} ${className}`}
    >
      <Icon
        className="absolute -bottom-[12%] -right-[12%] opacity-25"
        style={{ width: size * 0.75, height: size * 0.75 }}
        strokeWidth={1.5}
      />
      <span className="relative font-display font-bold" style={{ fontSize: size * 0.36 }}>
        {initials(champion?.name)}
      </span>
    </div>
  );
}

/** Large cover used in the profile hero when no photo exists. */
export function CoverArt({ champion, className = '' }) {
  const chain = vc(champion?.valueChain);
  const Icon = chain.Icon;
  return (
    <div
      className={`${/\babsolute\b/.test(className) ? '' : 'relative'} overflow-hidden ${className}`}
      style={{ background: `linear-gradient(135deg, ${tint(chain.color, 0.35)} 0%, ${chain.color} 55%, #16181D 140%)` }}
    >
      <div className="sun-rays absolute -right-1/4 -top-1/2 h-[200%] w-[120%] opacity-70 mix-blend-overlay" />
      <Icon className="absolute -bottom-10 right-6 h-64 w-64 text-white/15" strokeWidth={1} />
      <div className="absolute left-8 top-8 font-display text-[120px] font-extrabold leading-none text-white/20">
        {initials(champion?.name)}
      </div>
    </div>
  );
}
