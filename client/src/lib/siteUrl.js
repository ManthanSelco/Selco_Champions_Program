// Works out the best link to share.
//  1. PUBLIC_URL set on the server (real domain)          → use it
//  2. site opened as localhost/127.0.0.1 on this computer → use the Wi-Fi address
//     (http://192.168.x.x:8080) so people on the same Wi-Fi can open it
//  3. otherwise                                            → the address in the browser
import { useEffect, useState } from 'react';
import { DEMO } from './api';

const isLocal = () => /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
const current = () => window.location.href.split('#')[0];

let info = null;
let pending = null;
function load() {
  if (DEMO) return Promise.resolve(null);
  pending ||= fetch((import.meta.env.VITE_API_BASE || '') + '/api/site')
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .then((d) => (info = d));
  return pending;
}

function compute() {
  if (info?.publicUrl) return { base: info.publicUrl.replace(/\/?$/, '/'), kind: 'public' };
  if (isLocal() && info?.lanUrls?.length) return { base: info.lanUrls[0] + '/', kind: 'wifi' };
  return { base: current(), kind: isLocal() ? 'local' : 'current' };
}

export function useShareBase() {
  const [v, setV] = useState(compute);
  useEffect(() => {
    let on = true;
    load().then(() => on && setV(compute()));
    return () => {
      on = false;
    };
  }, []);
  return v;
}
