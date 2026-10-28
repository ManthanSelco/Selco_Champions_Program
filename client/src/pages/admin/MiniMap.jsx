import { useMemo, useRef } from 'react';
import { motion } from 'motion/react';
import { DISTRICTS, svgProjector, districtPath, districtAt } from '../../lib/geo';
import { vc } from '../../lib/valueChains';

/**
 * 2D Karnataka map (SVG). Used on the login screen and as the district / pin
 * picker in the end-user editor.
 */
export default function MiniMap({ champions = [], selected, pin, onPick, dark = false, width = 400 }) {
  const svg = useRef(null);
  const P = useMemo(() => svgProjector(width), [width]);
  const paths = useMemo(() => DISTRICTS.map((d) => ({ d, path: districtPath(d, P.project), c: P.project(...d.centroid) })), [P]);
  const counts = useMemo(() => {
    const m = {};
    champions.forEach((c) => (m[c.district] = (m[c.district] || 0) + 1));
    return m;
  }, [champions]);

  const click = (e) => {
    if (!onPick) return;
    const r = svg.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * P.width;
    const y = ((e.clientY - r.top) / r.height) * P.height;
    const [lng, lat] = P.invert(x, y);
    const district = districtAt(lng, lat);
    if (district) onPick({ district, lat: +lat.toFixed(6), lng: +lng.toFixed(6) });
  };

  const pinXY = pin && pin.lat != null && pin.lng != null && pin.lat !== '' ? P.project(Number(pin.lng), Number(pin.lat)) : null;

  return (
    <svg ref={svg} viewBox={`0 0 ${P.width} ${P.height}`} className={`h-auto w-full ${onPick ? 'cursor-crosshair' : ''}`} onClick={click} role={onPick ? 'button' : 'img'} aria-label="Map of Karnataka districts">
      {paths.map(({ d, path }, i) => {
        const isSel = selected === d.name;
        const has = counts[d.name];
        const fill = isSel ? '#E3242B' : has ? (dark ? 'rgba(227,36,43,.45)' : '#F2C38A') : dark ? 'rgba(255,255,255,.08)' : '#EFE7DA';
        return (
          <motion.path
            key={d.name}
            d={path}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, fill }}
            transition={{ delay: i * 0.015, duration: 0.4 }}
            stroke={dark ? 'rgba(255,255,255,.35)' : '#fff'}
            strokeWidth={isSel ? 1.6 : 0.9}
            className={onPick ? 'transition-[filter] hover:brightness-95' : ''}
          >
            <title>{d.name}</title>
          </motion.path>
        );
      })}
      {champions
        .filter((c) => c.lat != null && c.lng != null)
        .map((c, i) => {
          const [x, y] = P.project(c.lng, c.lat);
          return (
            <motion.g key={c.id} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5 + i * 0.05, type: 'spring' }} style={{ originX: `${x}px`, originY: `${y}px` }}>
              <circle cx={x} cy={y} r={dark ? 4.5 : 3.5} fill="#fff" />
              <circle cx={x} cy={y} r={dark ? 2.5 : 2} fill={dark ? '#E3242B' : vc(c.valueChain).color} />
            </motion.g>
          );
        })}
      {onPick &&
        paths
          .filter(({ d }) => selected === d.name)
          .map(({ d, c }) => (
            <text key={d.name} x={c[0]} y={c[1]} textAnchor="middle" className="pointer-events-none fill-white text-[10px] font-bold" style={{ paintOrder: 'stroke', stroke: '#E3242B', strokeWidth: 3 }}>
              {d.name}
            </text>
          ))}
      {pinXY && (
        <g transform={`translate(${pinXY[0]},${pinXY[1]})`} className="pointer-events-none">
          <circle r="9" fill="#16181D" opacity=".15" />
          <path d="M0 0 C -6 -8 -7 -12 -7 -15 A 7 7 0 1 1 7 -15 C 7 -12 6 -8 0 0 Z" fill="#16181D" />
          <circle cy="-15" r="2.8" fill="#fff" />
        </g>
      )}
    </svg>
  );
}
