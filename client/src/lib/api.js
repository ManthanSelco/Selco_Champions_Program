// Single data layer for the whole app.
//  • Normal build  → talks to the Express API (/api/...)
//  • Demo build    → runs entirely in the browser with localStorage, so the
//                    site can be previewed without a server.
import seed from '@shared/champions.seed.json';
import { aggregate } from '@shared/analytics.js';

export const DEMO = import.meta.env.VITE_DEMO === '1';
const API = (import.meta.env.VITE_API_BASE || '') + '/api';

/* ------------------------------- helpers -------------------------------- */
export function assetUrl(u) {
  if (!u) return '';
  if (/^(https?:|data:|blob:)/.test(u)) return u;
  const base = import.meta.env.VITE_ASSET_BASE || '';
  return base ? `${base.replace(/\/$/, '')}/${u.replace(/^\//, '')}` : u;
}

const store = {
  get(k, fallback) {
    try {
      const v = localStorage.getItem(k);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
      return true;
    } catch {
      return false;
    }
  },
};

let token = store.get('selco_admin_token', null);
export const getToken = () => token;
export function setToken(t) {
  token = t;
  store.set('selco_admin_token', t);
}

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function http(path, { method = 'GET', body, auth = false, form } = {}) {
  const headers = {};
  if (body) headers['content-type'] = 'application/json';
  if (auth && token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(API + path, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && auth) setToken(null);
    throw new ApiError(data.error || `Request failed (${res.status})`, res.status);
  }
  return data;
}

/* ------------------------------ demo store ------------------------------ */
const DEMO_KEYS = { champions: 'selco_demo_champions_v1', events: 'selco_demo_events_v1', admin: 'selco_demo_admin_v1' };
const DEMO_DEFAULT_PASSWORD = 'Selco@2026';

async function sha(s) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return 'plain:' + s;
  }
}

let demoChampions = null;
function demoList() {
  if (!demoChampions) {
    const now = new Date().toISOString();
    demoChampions = store.get(DEMO_KEYS.champions, null) || seed.map((c) => ({ ...c, createdAt: now, updatedAt: now }));
  }
  return demoChampions;
}
function demoSave() {
  if (!store.set(DEMO_KEYS.champions, demoChampions))
    throw new ApiError('Browser storage is full — remove some gallery photos and try again.', 507);
}
let demoEvents = null;
function demoEventList() {
  if (!demoEvents) demoEvents = store.get(DEMO_KEYS.events, []);
  return demoEvents;
}
async function demoAdmin() {
  let a = store.get(DEMO_KEYS.admin, null);
  if (!a) {
    a = { adminId: 'admin', hash: await sha(DEMO_DEFAULT_PASSWORD), version: 1, passwordChangedAt: null };
    store.set(DEMO_KEYS.admin, a);
  }
  return a;
}
const demoTokenFor = (a) => `demo.${a.version}.${Date.now()}`;
async function demoCheckToken() {
  const a = await demoAdmin();
  if (!token || !token.startsWith(`demo.${a.version}.`)) {
    setToken(null);
    throw new ApiError('Please log in again.', 401);
  }
  return a;
}
const wait = (ms = 220) => new Promise((r) => setTimeout(r, ms));
const slug = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'champion';

function resizeToDataUrl(file, max = 1280, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = url;
  });
}

/* --------------------------------- API ---------------------------------- */
export const api = {
  async listChampions({ admin = false } = {}) {
    if (DEMO) {
      await wait(150);
      return demoList().filter((c) => admin || c.published !== false);
    }
    return http('/champions', { auth: admin });
  },

  async login(id, password) {
    if (DEMO) {
      await wait(400);
      const a = await demoAdmin();
      if (id !== a.adminId || (await sha(password)) !== a.hash) throw new ApiError('Incorrect admin ID or password.', 401);
      const t = demoTokenFor(a);
      setToken(t);
      return { token: t, adminId: a.adminId, passwordChangedAt: a.passwordChangedAt };
    }
    const r = await http('/auth/login', { method: 'POST', body: { id, password } });
    setToken(r.token);
    return r;
  },

  logout() {
    setToken(null);
  },

  async me() {
    if (DEMO) {
      const a = await demoCheckToken();
      return { adminId: a.adminId, passwordChangedAt: a.passwordChangedAt };
    }
    return http('/auth/me', { auth: true });
  },

  async changePassword(currentPassword, newPassword) {
    if (DEMO) {
      await wait(400);
      const a = await demoCheckToken();
      if ((await sha(currentPassword)) !== a.hash) throw new ApiError('Current password is incorrect.', 400);
      if (newPassword.length < 8) throw new ApiError('New password must be at least 8 characters.', 400);
      a.hash = await sha(newPassword);
      a.version += 1;
      a.passwordChangedAt = new Date().toISOString();
      store.set(DEMO_KEYS.admin, a);
      setToken(demoTokenFor(a));
      return { ok: true, passwordChangedAt: a.passwordChangedAt };
    }
    const r = await http('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword }, auth: true });
    setToken(r.token);
    return r;
  },

  async saveChampion(data) {
    if (DEMO) {
      await demoCheckToken();
      await wait(350);
      if (!data.name?.trim()) throw new ApiError('Name is required.', 400);
      if (!data.district) throw new ApiError('Please select a district.', 400);
      const list = demoList();
      const now = new Date().toISOString();
      const clean = { ...data, lat: data.lat === '' || data.lat == null ? null : Number(data.lat), lng: data.lng === '' || data.lng == null ? null : Number(data.lng) };
      if (data.id && list.some((c) => c.id === data.id)) {
        const i = list.findIndex((c) => c.id === data.id);
        list[i] = { ...list[i], ...clean, updatedAt: now };
        demoSave();
        return list[i];
      }
      let id = slug(data.name);
      while (list.some((c) => c.id === id)) id = `${slug(data.name)}-${Math.random().toString(16).slice(2, 6)}`;
      const c = { ...clean, id, createdAt: now, updatedAt: now };
      list.push(c);
      demoSave();
      return c;
    }
    if (data.id) return http(`/champions/${encodeURIComponent(data.id)}`, { method: 'PUT', body: data, auth: true });
    return http('/champions', { method: 'POST', body: data, auth: true });
  },

  async deleteChampion(id) {
    if (DEMO) {
      await demoCheckToken();
      await wait(250);
      demoChampions = demoList().filter((c) => c.id !== id);
      demoSave();
      return { ok: true };
    }
    return http(`/champions/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true });
  },

  async upload(files) {
    if (DEMO) {
      await demoCheckToken();
      const urls = [];
      for (const f of files) urls.push(await resizeToDataUrl(f));
      return urls;
    }
    const form = new FormData();
    for (const f of files) form.append('files', f);
    const r = await http('/upload', { method: 'POST', form, auth: true });
    return r.urls;
  },

  async track(evt) {
    if (DEMO) {
      const list = demoEventList();
      list.push({ ...evt, ts: new Date().toISOString(), device: /Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop' });
      if (list.length > 5000) list.splice(0, list.length - 5000);
      store.set(DEMO_KEYS.events, list);
      return;
    }
    try {
      await fetch(API + '/analytics/track', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(evt),
        keepalive: true,
      });
    } catch {
      /* analytics must never break the page */
    }
  },

  async analytics(days = 30) {
    if (DEMO) {
      await demoCheckToken();
      await wait(200);
      return aggregate(demoEventList(), demoList(), days);
    }
    return http(`/analytics?days=${days}`, { auth: true });
  },
};
