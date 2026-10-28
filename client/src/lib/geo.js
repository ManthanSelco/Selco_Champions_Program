import districtsGeo from '@shared/karnataka-districts.json';

// Normalise district names (the boundary file uses official spellings).
export const DISTRICT_ALIASES = {
  bagalkot: 'Bagalkote',
  bellary: 'Ballari',
  belgaum: 'Belagavi',
  bangalore: 'Bengaluru Urban',
  'bangalore urban': 'Bengaluru Urban',
  'bangalore rural': 'Bengaluru Rural',
  bijapur: 'Vijayapura',
  chamarajanagar: 'Chamarajanagara',
  chikmagalur: 'Chikkamagaluru',
  chikkaballapur: 'Chikkaballapura',
  davangere: 'Davanagere',
  gulbarga: 'Kalaburagi',
  mysore: 'Mysuru',
  shimoga: 'Shivamogga',
  tumkur: 'Tumakuru',
  vijayanagara: 'Ballari',
};

export function canonicalDistrict(name = '') {
  const n = name.trim();
  const hit = DISTRICTS.find((d) => d.name.toLowerCase() === n.toLowerCase());
  if (hit) return hit.name;
  return DISTRICT_ALIASES[n.toLowerCase()] || n;
}

function ringArea(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  return a / 2;
}

function ringCentroid(ring) {
  let x = 0, y = 0, a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    x += (ring[j][0] + ring[i][0]) * f;
    y += (ring[j][1] + ring[i][1]) * f;
    a += f;
  }
  a *= 0.5;
  return [x / (6 * a), y / (6 * a)];
}

export const DISTRICTS = districtsGeo.features
  .map((f) => {
    const polys = f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [f.geometry.coordinates];
    // label point = centroid of the largest outer ring
    let best = polys[0][0];
    for (const p of polys) if (Math.abs(ringArea(p[0])) > Math.abs(ringArea(best))) best = p[0];
    return { name: f.properties.district, code: f.properties.dt_code, polygons: polys, centroid: ringCentroid(best) };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

export const DISTRICT_NAMES = DISTRICTS.map((d) => d.name);

// Bounds of the state
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
for (const d of DISTRICTS)
  for (const p of d.polygons)
    for (const [x, y] of p[0]) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
export const BOUNDS = { minX, minY, maxX, maxY };
export const CENTER = [(minX + maxX) / 2, (minY + maxY) / 2];
const COS = Math.cos((CENTER[1] * Math.PI) / 180);

/** lng/lat → planar units for the 3D scene (x = east, y = north). */
export const SCALE = 1.55;
export function project(lng, lat) {
  return [(lng - CENTER[0]) * SCALE * COS, (lat - CENTER[1]) * SCALE];
}

/** lng/lat → SVG coordinates for 2D maps of a given width. */
export function svgProjector(width, pad = 8) {
  const w = (maxX - minX) * COS;
  const h = maxY - minY;
  const k = (width - pad * 2) / w;
  const height = h * k + pad * 2;
  return {
    width,
    height,
    project: (lng, lat) => [pad + (lng - minX) * COS * k, pad + (maxY - lat) * k],
    invert: (x, y) => [minX + (x - pad) / (COS * k), maxY - (y - pad) / k],
  };
}

export function districtPath(d, proj) {
  return d.polygons
    .map((poly) =>
      poly
        .map((ring) => 'M' + ring.map(([x, y]) => proj(x, y).map((v) => v.toFixed(1)).join(',')).join('L') + 'Z')
        .join('')
    )
    .join('');
}

function inRing([x, y], ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

export function districtAt(lng, lat) {
  for (const d of DISTRICTS)
    for (const p of d.polygons) if (inRing([lng, lat], p[0]) && !p.slice(1).some((h) => inRing([lng, lat], h))) return d.name;
  return null;
}

/** Pull "lat,lng" out of a pasted Google Maps link. */
export function parseMapLink(link = '') {
  const s = decodeURIComponent(link);
  const m =
    s.match(/@(-?\d+\.\d+),\s*(-?\d+\.\d+)/) ||
    s.match(/[?&](?:q|query|ll|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/) ||
    s.match(/(-?\d{1,2}\.\d{3,}),\s*(-?\d{1,3}\.\d{3,})/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export function mapsUrl(c) {
  if (c.mapLink) return c.mapLink;
  if (c.lat != null && c.lng != null) return `https://www.google.com/maps?q=${c.lat},${c.lng}`;
  return `https://www.google.com/maps/search/${encodeURIComponent(c.address || `${c.village}, ${c.district}, Karnataka`)}`;
}
