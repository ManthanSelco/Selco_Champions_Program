import list from '@shared/valueChains.json';
import { Wheat, Sprout, Droplet, Tractor, Recycle, Fish, Milk, Apple, Leaf } from 'lucide-react';

const ICONS = { Wheat, Sprout, Droplet, Tractor, Recycle, Fish, Milk, Apple, Leaf };

export const VALUE_CHAINS = list.map((v) => ({ ...v, Icon: ICONS[v.icon] || Leaf }));
const OTHER = VALUE_CHAINS.find((v) => v.name === 'Other');

export function vc(name) {
  return VALUE_CHAINS.find((v) => v.name === name) || { ...OTHER, name: name || 'Other' };
}

export function tint(hex, amount = 0.85) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const m = (c) => Math.round(c + (255 - c) * amount);
  return `rgb(${m(r)}, ${m(g)}, ${m(b)})`;
}
