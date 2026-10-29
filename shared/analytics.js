// Aggregates raw visitor events into the numbers shown on the admin dashboard.
// Shared by the Node server and the in-browser demo mode so both report identically.
//
// event: { type: 'pageview' | 'profile_view' | 'share', visitorId, sessionId, ts (ISO),
//          path, championId, referrer, device, channel }

const DAY = 86400000;

function dayKey(d) {
  // Local calendar day in India (UTC+05:30) so "today" matches the team's clock.
  const ist = new Date(new Date(d).getTime() + 5.5 * 3600000);
  return ist.toISOString().slice(0, 10);
}

function refHost(ref) {
  if (!ref) return 'Direct';
  try {
    const h = new URL(ref).hostname.replace(/^www\./, '');
    if (/google\./.test(h)) return 'Google';
    if (/whatsapp|wa\.me/.test(h)) return 'WhatsApp';
    if (/facebook|fb\./.test(h)) return 'Facebook';
    if (/linkedin|lnkd/.test(h)) return 'LinkedIn';
    if (/t\.co|twitter|x\.com/.test(h)) return 'X / Twitter';
    return h;
  } catch {
    return 'Direct';
  }
}

// `extra` (optional, used by the MongoDB store, which only loads the selected period):
//   { allTime: { visits, visitors }, recent: [latest events, newest first] }
export function aggregate(events, champions = [], days = 30, now = Date.now(), extra = {}) {
  const nameOf = Object.fromEntries(champions.map((c) => [c.id, c.name]));
  const since = now - days * DAY;
  const todayKey = dayKey(now);

  const all = events;
  const windowed = all.filter((e) => new Date(e.ts).getTime() >= since);
  const views = (list) => list.filter((e) => e.type === 'pageview');

  const uniq = (list) => new Set(list.map((e) => e.visitorId)).size;
  const sessions = (list) => new Set(list.map((e) => e.sessionId)).size;

  // Daily series
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = dayKey(now - i * DAY);
    series.push({ date: key, visits: 0, visitors: 0, profileViews: 0, _v: new Set() });
  }
  const byKey = Object.fromEntries(series.map((s) => [s.date, s]));
  for (const e of windowed) {
    const s = byKey[dayKey(e.ts)];
    if (!s) continue;
    if (e.type === 'pageview') {
      s.visits++;
      s._v.add(e.visitorId);
    } else if (e.type === 'profile_view') s.profileViews++;
  }
  for (const s of series) {
    s.visitors = s._v.size;
    delete s._v;
  }

  const countBy = (list, fn) => {
    const m = {};
    for (const e of list) {
      const k = fn(e);
      if (!k) continue;
      m[k] = (m[k] || 0) + 1;
    }
    return Object.entries(m)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  };

  const profileViews = windowed.filter((e) => e.type === 'profile_view');
  const shares = windowed.filter((e) => e.type === 'share');
  const todayViews = views(all).filter((e) => dayKey(e.ts) === todayKey);

  return {
    days,
    totals: {
      allTimeVisits: extra.allTime ? extra.allTime.visits : views(all).length,
      allTimeVisitors: extra.allTime ? extra.allTime.visitors : uniq(views(all)),
      visits: views(windowed).length,
      visitors: uniq(views(windowed)),
      sessions: sessions(windowed),
      todayVisits: todayViews.length,
      todayVisitors: uniq(todayViews),
      profileViews: profileViews.length,
      shares: shares.length,
    },
    series,
    topChampions: countBy(profileViews, (e) => e.championId)
      .map((r) => ({ ...r, id: r.name, name: nameOf[r.name] || r.name }))
      .slice(0, 8),
    devices: countBy(views(windowed), (e) => e.device || 'Unknown'),
    referrers: countBy(views(windowed), (e) => refHost(e.referrer)).slice(0, 6),
    shareChannels: countBy(shares, (e) => e.channel || 'link'),
    recent: (extra.recent || all.slice(-12).reverse())
      .map((e) => ({ ...e, championName: e.championId ? nameOf[e.championId] : undefined })),
  };
}
