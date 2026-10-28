import { api } from './api';

function id(storage, key) {
  try {
    let v = storage.getItem(key);
    if (!v) {
      v = Math.random().toString(36).slice(2) + Date.now().toString(36);
      storage.setItem(key, v);
    }
    return v;
  } catch {
    return 'anon-' + Math.random().toString(36).slice(2);
  }
}

let visitorId, sessionId;
function ids() {
  visitorId ||= id(localStorage, 'selco_vid');
  sessionId ||= id(sessionStorage, 'selco_sid');
  return { visitorId, sessionId };
}

let pageviewSent = false;
export function trackPageview() {
  if (pageviewSent) return;
  pageviewSent = true;
  api.track({ type: 'pageview', ...ids(), path: location.hash || '/', referrer: document.referrer });
}

const seenProfiles = new Set();
export function trackProfile(championId) {
  if (seenProfiles.has(championId)) return;
  seenProfiles.add(championId);
  api.track({ type: 'profile_view', ...ids(), championId, path: location.hash });
}

export function trackShare(channel, championId) {
  api.track({ type: 'share', ...ids(), channel, championId, path: location.hash });
}
