/* UNO Kids — bolalar uchun xavfsiz video ilova.
 * Interfeys mashhur video ilovalar uslubida: lenta, Shorts, mini-pleyer, kanallar, qidiruv.
 * Faqat ota-ona qo'shgan videolar ko'rsatiladi. Hammasi brauzer xotirasida (localStorage) saqlanadi.
 */
'use strict';

const STORE_KEY = 'unoKids.v1';
const ALL = '__all__';
const YT_HOST = 'https://www.youtube-nocookie.com';

/* ================= Holat ================= */
const defaultState = () => ({
  pinHash: null,
  apiKey: '',
  categories: ['Multfilmlar', "Ta'limiy", "Qo'shiqlar"],
  videos: [], // {id,title,channel,channelId,channelThumb,thumb,category,addedAt,duration,isShort,views,publishedAt}
  history: [], // video id'lari, oxirgisi boshida
  liked: [],
  settings: { dailyLimitMin: 0, hideShorts: true, blockedWords: [], maxImport: 100, autoplay: true },
  usage: { date: today(), seconds: 0 },
});

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultState();
    const s = Object.assign(defaultState(), JSON.parse(raw));
    s.settings = Object.assign(defaultState().settings, s.settings);
    return s;
  } catch (e) {
    return defaultState();
  }
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* xotira to'lgan */ }
}
function today() { return new Date().toISOString().slice(0, 10); }
function strHash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h;
}
function hashPin(pin) { return strHash('uno-kids:' + pin).toString(16); }

/* ================= Yordamchilar ================= */
const $ = (sel) => document.querySelector(sel);

function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

const F = 'fill="currentColor" stroke="none"';
const ICONS = {
  home: '<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>',
  shorts: '<rect x="6.5" y="2.5" width="11" height="19" rx="4"/><path d="M10.5 9v6l4.5-3z" ' + F + '/>',
  channels: '<rect x="3" y="7" width="18" height="13.5" rx="2.5"/><path d="M7 3.5h10"/><path d="M10.5 11v6l4.5-3z" ' + F + '/>',
  library: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.8-4.8"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>',
  back: '<path d="M19 12H5M11 5l-7 7 7 7"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  play: '<path d="M7 4.5v15l12.5-7.5z" ' + F + '/>',
  pause: '<path d="M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z" ' + F + '/>',
  next: '<path d="M5 5v14l10-7z" ' + F + '/><path d="M17 5h2.2v14H17z" ' + F + '/>',
  prev: '<path d="M19 5v14L9 12z" ' + F + '/><path d="M4.8 5H7v14H4.8z" ' + F + '/>',
  full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  like: '<path d="M7 10.5V20H4v-9.5zM7 10.5 11 3a2.2 2.2 0 0 1 3.1 2.4L13.3 9.5H19a2 2 0 0 1 2 2.3l-1.4 6.6A2 2 0 0 1 17.6 20H7"/>',
  autoplay: '<rect x="2.5" y="7" width="19" height="10" rx="5"/><circle cx="16.5" cy="12" r="3" ' + F + '/>',
  history: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
};
function ic(name, cls) {
  const s = document.createElement('span');
  s.className = 'ic' + (cls ? ' ' + cls : '');
  s.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  return s;
}
function setIc(container, name) { container.replaceChildren(ic(name)); }

function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
}
function fmtCount(n) {
  const f = (x) => (Math.round(x * 10) / 10).toString().replace('.', ',');
  if (n >= 1e9) return f(n / 1e9) + ' mlrd';
  if (n >= 1e6) return f(n / 1e6) + ' mln';
  if (n >= 1e3) return f(n / 1e3) + ' ming';
  return String(n);
}
function timeAgo(ts) {
  if (!ts) return '';
  const d = (Date.now() - ts) / 1000;
  if (d < 60) return 'hozirgina';
  if (d < 3600) return Math.floor(d / 60) + ' daqiqa oldin';
  if (d < 86400) return Math.floor(d / 3600) + ' soat oldin';
  if (d < 86400 * 30) return Math.floor(d / 86400) + ' kun oldin';
  if (d < 86400 * 365) return Math.floor(d / 86400 / 30) + ' oy oldin';
  return Math.floor(d / 86400 / 365) + ' yil oldin';
}
function thumbUrl(id) { return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`; }
function metaLine(v) {
  return [v.channel, v.views ? fmtCount(v.views) + " marta ko'rilgan" : null, timeAgo(v.publishedAt || v.addedAt)]
    .filter(Boolean).join(' · ');
}
function dayShuffle(list) {
  const d = today();
  return list.slice().sort((a, b) => strHash(a.id + d) - strHash(b.id + d));
}
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3000);
}
const byId = (id) => state.videos.find((v) => v.id === id);
const longVideos = () => state.videos.filter((v) => !v.isShort);
const shortVideos = () => state.videos.filter((v) => v.isShort);

/* ================= YouTube havolasini tahlil qilish ================= */
const VID_RE = /^[A-Za-z0-9_-]{11}$/;

function parseYouTube(input) {
  const text = input.trim();
  if (!text) return null;
  if (VID_RE.test(text)) return { type: 'video', id: text };
  let url;
  try { url = new URL(/^https?:\/\//i.test(text) ? text : 'https://' + text); } catch (e) { return null; }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, '');
  const parts = url.pathname.split('/').filter(Boolean);

  if (host === 'youtu.be') {
    return parts[0] && VID_RE.test(parts[0]) ? { type: 'video', id: parts[0] } : null;
  }
  if (!/(^|\.)youtube(-nocookie)?\.com$/.test(host)) return null;

  const v = url.searchParams.get('v');
  if (v && VID_RE.test(v)) return { type: 'video', id: v };
  if (parts[0] === 'shorts' && parts[1] && VID_RE.test(parts[1])) return { type: 'video', id: parts[1], short: true };
  if (['embed', 'live', 'v'].includes(parts[0]) && parts[1] && VID_RE.test(parts[1])) {
    return { type: 'video', id: parts[1] };
  }
  const list = url.searchParams.get('list');
  if (list) return { type: 'playlist', id: list };
  if (parts[0] === 'channel' && parts[1]) return { type: 'channel', by: 'id', value: parts[1] };
  if (parts[0] && parts[0].startsWith('@')) return { type: 'channel', by: 'handle', value: decodeURIComponent(parts[0]) };
  if (parts[0] === 'user' && parts[1]) return { type: 'channel', by: 'username', value: parts[1] };
  if (parts[0] === 'c' && parts[1]) return { type: 'channel', by: 'search', value: decodeURIComponent(parts[1]) };
  return null;
}

/* ================= Ma'lumot olish ================= */
async function fetchOEmbed(id) {
  try {
    const res = await fetch('https://www.youtube.com/oembed?format=json&url=' +
      encodeURIComponent('https://www.youtube.com/watch?v=' + id));
    if (!res.ok) return null; // o'chirilgan, yopiq yoki joylashtirish taqiqlangan
    const j = await res.json();
    return { title: j.title, channel: j.author_name, vertical: j.height > j.width };
  } catch (e) {
    return undefined; // tarmoq xatosi — baribir qo'shamiz
  }
}

async function ytApi(path, params) {
  if (!state.apiKey) throw new Error("Pleylist/kanal uchun YouTube API kaliti kerak (pastdagi bo'limda).");
  const qs = new URLSearchParams(Object.assign({ key: state.apiKey }, params));
  const res = await fetch(`https://www.googleapis.com/youtube/v3/${path}?${qs}`);
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error('YouTube API xatosi: ' + ((j.error && j.error.message) || res.status));
  return j;
}

async function resolveUploadsPlaylist(ch) {
  let params;
  if (ch.by === 'id') params = { id: ch.value };
  else if (ch.by === 'handle') params = { forHandle: ch.value };
  else if (ch.by === 'username') params = { forUsername: ch.value };
  else {
    const s = await ytApi('search', { part: 'snippet', type: 'channel', q: ch.value, maxResults: 1 });
    if (!s.items || !s.items.length) throw new Error('Kanal topilmadi: ' + ch.value);
    params = { id: s.items[0].snippet.channelId };
  }
  const j = await ytApi('channels', Object.assign({ part: 'contentDetails' }, params));
  if (!j.items || !j.items.length) throw new Error('Kanal topilmadi: ' + ch.value);
  return j.items[0].contentDetails.relatedPlaylists.uploads;
}

async function playlistVideoIds(playlistId, max) {
  const ids = [];
  let pageToken;
  do {
    const j = await ytApi('playlistItems', {
      part: 'contentDetails', playlistId, maxResults: 50, ...(pageToken ? { pageToken } : {}),
    });
    for (const it of j.items || []) ids.push(it.contentDetails.videoId);
    pageToken = j.nextPageToken;
  } while (pageToken && ids.length < max);
  return ids.slice(0, max);
}

function isoDurationToSec(iso) {
  const m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || '');
  if (!m) return 0;
  return (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0);
}

async function videoDetails(ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 50) {
    const j = await ytApi('videos', { part: 'snippet,contentDetails,status,statistics', id: ids.slice(i, i + 50).join(',') });
    for (const v of j.items || []) {
      const title = v.snippet.title || '';
      const duration = isoDurationToSec(v.contentDetails.duration);
      out.push({
        id: v.id, title, channel: v.snippet.channelTitle, channelId: v.snippet.channelId,
        duration, views: +((v.statistics && v.statistics.viewCount) || 0),
        publishedAt: Date.parse(v.snippet.publishedAt) || 0,
        isShort: (duration > 0 && duration <= 60) || /#shorts/i.test(title + ' ' + (v.snippet.description || '')),
        okEmbed: v.status.embeddable && v.status.privacyStatus !== 'private' &&
          !(v.contentDetails.contentRating && v.contentDetails.contentRating.ytRating === 'ytAgeRestricted'),
        text: (title + ' ' + (v.snippet.tags || []).join(' ')).toLowerCase(),
      });
    }
  }
  return out;
}

/** Pleylist/kanal importi uchun filtr: joylashtirib bo'lmaydigan, Shorts, taqiqlangan so'zli videolar o'tkaziladi. */
function filterImported(items) {
  const words = state.settings.blockedWords.map((w) => w.toLowerCase()).filter(Boolean);
  const ok = items.filter((v) => v.okEmbed && !(state.settings.hideShorts && v.isShort) && !words.some((w) => v.text.includes(w)));
  return { items: ok, skipped: items.length - ok.length };
}

async function fillChannelThumbs() {
  if (!state.apiKey) return;
  const need = [...new Set(state.videos.filter((v) => v.channelId && !v.channelThumb).map((v) => v.channelId))];
  for (let i = 0; i < need.length; i += 50) {
    try {
      const j = await ytApi('channels', { part: 'snippet', id: need.slice(i, i + 50).join(',') });
      const map = {};
      for (const c of j.items || []) map[c.id] = c.snippet.thumbnails && c.snippet.thumbnails.default && c.snippet.thumbnails.default.url;
      state.videos.forEach((v) => { if (map[v.channelId]) v.channelThumb = map[v.channelId]; });
    } catch (e) { /* rasm muhim emas */ }
  }
  save();
}

async function addLinks(text, category) {
  const lines = text.split(/[\s,]+/).filter(Boolean);
  let added = 0, dup = 0, skipped = 0;
  const errors = [];
  const existing = new Set(state.videos.map((v) => v.id));
  const push = (v) => {
    if (existing.has(v.id)) { dup++; return; }
    existing.add(v.id);
    state.videos.unshift({
      id: v.id, title: v.title || 'Video', channel: v.channel || '', channelId: v.channelId || '',
      channelThumb: '', thumb: thumbUrl(v.id), category, addedAt: Date.now(),
      duration: v.duration || 0, isShort: !!v.isShort, views: v.views || 0, publishedAt: v.publishedAt || 0,
    });
    added++;
  };

  for (const line of lines) {
    const p = parseYouTube(line);
    if (!p) { errors.push('Tanilmagan havola: ' + line); continue; }
    try {
      if (p.type === 'video') {
        if (existing.has(p.id)) { dup++; continue; }
        let item = null;
        if (state.apiKey) {
          try {
            const d = await videoDetails([p.id]);
            if (d.length && !d[0].okEmbed) { errors.push("Bu videoni ilovada ko'rsatib bo'lmaydi: " + line); continue; }
            if (d.length) item = d[0];
          } catch (e) { errors.push(e.message); }
        }
        if (!item) {
          const meta = await fetchOEmbed(p.id);
          if (meta === null) { errors.push('Video topilmadi yoki joylashtirish taqiqlangan: ' + line); continue; }
          item = { id: p.id, ...(meta || {}), isShort: !!(meta && meta.vertical) };
        }
        if (p.short) item.isShort = true;
        push(item);
      } else {
        const plId = p.type === 'playlist' ? p.id : await resolveUploadsPlaylist(p);
        const ids = await playlistVideoIds(plId, state.settings.maxImport || 100);
        const r = filterImported(await videoDetails(ids.filter((id) => !existing.has(id))));
        skipped += r.skipped;
        r.items.forEach(push);
      }
    } catch (e) {
      errors.push(e.message);
    }
    save();
  }
  await fillChannelThumbs();
  save();
  return { added, dup, skipped, errors };
}

/* ================= Ekran vaqti ================= */
function resetUsageIfNewDay() {
  if (state.usage.date !== today()) { state.usage = { date: today(), seconds: 0 }; save(); }
}
function timeIsUp() {
  resetUsageIfNewDay();
  const lim = state.settings.dailyLimitMin;
  return lim > 0 && state.usage.seconds >= lim * 60;
}

/* ================= Kartochkalar ================= */
function avatar(v, size) {
  const cls = 'avatar' + (size ? ' ' + size : '');
  if (v.channelThumb) return el('img', { class: cls, src: v.channelThumb, alt: '', loading: 'lazy' });
  const name = v.channel || '?';
  return el('div', { class: cls, style: `background:hsl(${strHash(name) % 360} 55% 45%)` }, name.trim().charAt(0).toUpperCase() || '?');
}
function feedCard(v) {
  return el('a', { class: 'feed-card', href: '#/watch/' + v.id },
    el('div', { class: 'thumb' },
      el('img', { src: v.thumb || thumbUrl(v.id), alt: '', loading: 'lazy' }),
      v.duration ? el('span', { class: 'dur' }, fmtTime(v.duration)) : null),
    el('div', { class: 'meta-row' },
      avatar(v),
      el('div', { class: 'meta' },
        el('div', { class: 'title' }, v.title),
        el('div', { class: 'sub' }, metaLine(v)))));
}
function shortCard(v) {
  return el('a', { class: 'short-card', href: '#/shorts/' + v.id },
    el('img', { src: v.thumb || thumbUrl(v.id), alt: '', loading: 'lazy' }),
    el('div', { class: 'st' }, v.title));
}
function miniCard(v) {
  return el('a', { class: 'mini-card', href: v.isShort ? '#/shorts/' + v.id : '#/watch/' + v.id },
    el('div', { class: 'thumb' },
      el('img', { src: v.thumb || thumbUrl(v.id), alt: '', loading: 'lazy' }),
      v.duration ? el('span', { class: 'dur' }, fmtTime(v.duration)) : null),
    el('div', { class: 't' }, v.title),
    el('div', { class: 's' }, v.channel || ''));
}
function shortsShelf(list) {
  return el('section', { class: 'shelf' },
    el('div', { class: 'shelf-head' }, ic('shorts'), 'Shorts'),
    el('div', { class: 'shelf-row' }, list.map(shortCard)));
}
function emptyBox(emoji, text) {
  return el('div', { class: 'empty' }, el('div', { class: 'big-emoji' }, emoji), el('p', {}, text));
}
/** Lenta: avval 2 ta video, keyin Shorts tokchasi, keyin qolganlari. */
function buildFeed(longs, shorts) {
  const feed = el('div', { class: 'feed' });
  longs.slice(0, 2).forEach((v) => feed.append(feedCard(v)));
  if (shorts.length) feed.append(shortsShelf(shorts));
  longs.slice(2).forEach((v) => feed.append(feedCard(v)));
  return feed;
}

/* ================= Sahifalar ================= */
const view = () => $('#view');
let currentCat = ALL;

function renderHome() {
  const root = view();
  root.replaceChildren();
  if (!state.videos.length) {
    root.append(emptyBox('📺', "Hozircha videolar yo'q. Ota-onangizdan video qo'shishni so'rang."));
    return;
  }
  const used = state.categories.filter((c) => state.videos.some((v) => v.category === c));
  if (!used.includes(currentCat)) currentCat = ALL;
  if (used.length) {
    root.append(el('nav', { class: 'chips' },
      [[ALL, 'Hammasi'], ...used.map((c) => [c, c])].map(([key, label]) =>
        el('button', {
          class: 'chip' + (key === currentCat ? ' active' : ''),
          onclick: () => { currentCat = key; renderHome(); },
        }, label))));
  }
  const inCat = (v) => currentCat === ALL || v.category === currentCat;
  const longs = dayShuffle(longVideos().filter(inCat));
  const shorts = dayShuffle(shortVideos().filter(inCat));
  if (!longs.length && !shorts.length) { root.append(emptyBox('🙈', "Bu bo'limda video yo'q")); return; }
  root.append(buildFeed(longs, shorts));
}

function channelsMap() {
  const map = new Map();
  for (const v of state.videos) {
    const name = v.channel || 'Boshqa';
    if (!map.has(name)) map.set(name, { name, sample: v, videos: [] });
    const c = map.get(name);
    c.videos.push(v);
    if (!c.sample.channelThumb && v.channelThumb) c.sample = v;
  }
  return [...map.values()].sort((a, b) => b.videos.length - a.videos.length);
}

function renderChannels() {
  const root = view();
  root.replaceChildren();
  const chans = channelsMap();
  if (!chans.length) { root.append(emptyBox('📡', "Hozircha kanallar yo'q")); return; }
  root.append(el('div', { class: 'chan-strip' }, chans.map((c) =>
    el('a', { href: '#/channel/' + encodeURIComponent(c.name) }, avatar(c.sample, 'md'), el('span', {}, c.name)))));
  root.append(el('div', { class: 'section-title' }, 'Barcha kanallar'));
  chans.forEach((c) => root.append(
    el('a', { class: 'chan-row', href: '#/channel/' + encodeURIComponent(c.name) },
      avatar(c.sample, 'md'),
      el('div', {}, el('div', { class: 'cn' }, c.name), el('div', { class: 'cs' }, c.videos.length + ' ta video')))));
}

function renderChannel(name) {
  const root = view();
  root.replaceChildren();
  const c = channelsMap().find((x) => x.name === name);
  if (!c) { root.append(emptyBox('📡', 'Kanal topilmadi')); return; }
  root.append(el('div', { class: 'chan-head' },
    avatar(c.sample, 'lg'), el('h2', {}, c.name), el('div', { class: 'muted' }, c.videos.length + ' ta video')));
  const longs = c.videos.filter((v) => !v.isShort);
  const shorts = c.videos.filter((v) => v.isShort);
  root.append(buildFeed(longs, shorts));
}

function renderLibrary() {
  const root = view();
  root.replaceChildren();
  const hist = state.history.map(byId).filter(Boolean);
  const liked = state.liked.map(byId).filter(Boolean);
  root.append(el('div', { class: 'section-title' }, 'Tarix'));
  root.append(hist.length
    ? el('div', { class: 'shelf-row' }, hist.slice(0, 30).map(miniCard))
    : el('p', { class: 'muted', style: 'padding:0 12px' }, "Siz hali video ko'rmadingiz."));
  root.append(el('div', { class: 'section-title' }, 'Yoqqan videolar'));
  root.append(liked.length
    ? el('div', { class: 'shelf-row' }, liked.map(miniCard))
    : el('p', { class: 'muted', style: 'padding:0 12px' }, '👍 tugmasini bosgan videolaringiz shu yerda chiqadi.'));
  const longs = longVideos();
  if (longs.length) {
    root.append(el('div', { class: 'section-title' }, 'Barcha videolar'));
    root.append(el('div', { class: 'feed' }, longs.map(feedCard)));
  }
}

function renderSearch(q) {
  const root = view();
  root.replaceChildren();
  const input = $('#search-input');
  if (document.activeElement !== input) input.value = q;
  const query = q.trim().toLowerCase();
  if (!query) { root.append(emptyBox('🔎', 'Video nomini yozing')); return; }
  const res = state.videos.filter((v) => (v.title + ' ' + v.channel).toLowerCase().includes(query));
  if (!res.length) { root.append(emptyBox('🙈', 'Hech narsa topilmadi')); return; }
  const feed = el('div', { class: 'feed', style: 'margin-top:8px' });
  res.forEach((v) => feed.append(feedCard(v)));
  root.append(feed);
}

/** Keyingi videolar: avval shu kanal, keyin shu bo'lim, keyin qolganlari. */
function upNext(v) {
  if (!v) return [];
  const rest = dayShuffle(longVideos().filter((x) => x.id !== v.id));
  const score = (x) => (x.channel && x.channel === v.channel ? 0 : x.category && x.category === v.category ? 1 : 2);
  return rest.sort((a, b) => score(a) - score(b)).slice(0, 40);
}

function renderWatch(id) {
  const v = byId(id);
  if (!v) { history.replaceState(null, '', '#/home'); route(); return; }
  const root = view();
  root.replaceChildren();
  root.append(el('div', { class: 'player-spacer' }));
  const liked = state.liked.includes(v.id);
  const chanCount = state.videos.filter((x) => x.channel === v.channel).length;
  const body = el('div', { class: 'watch-body' },
    el('h1', { class: 'w-title' }, v.title),
    el('div', { class: 'w-sub' }, [v.views ? fmtCount(v.views) + " marta ko'rilgan" : null, timeAgo(v.publishedAt || v.addedAt)].filter(Boolean).join(' · ')),
    el('a', { class: 'w-chan', href: '#/channel/' + encodeURIComponent(v.channel || 'Boshqa') },
      avatar(v),
      el('div', {}, el('div', { class: 'cn' }, v.channel || 'Boshqa'), el('div', { class: 'cs' }, chanCount + ' ta video'))),
    el('div', { class: 'w-actions' },
      el('button', {
        class: 'btn' + (liked ? ' on' : ''),
        onclick: (e) => {
          const i = state.liked.indexOf(v.id);
          if (i >= 0) state.liked.splice(i, 1); else state.liked.unshift(v.id);
          save();
          e.currentTarget.classList.toggle('on', i < 0);
        },
      }, ic('like'), 'Yoqdi'),
      el('button', {
        class: 'btn' + (state.settings.autoplay ? ' on' : ''),
        onclick: (e) => {
          state.settings.autoplay = !state.settings.autoplay;
          save();
          e.currentTarget.classList.toggle('on', state.settings.autoplay);
          toast(state.settings.autoplay ? 'Avtomatik ijro yoqildi' : "Avtomatik ijro o'chirildi");
        },
      }, ic('autoplay'), 'Avto-ijro')),
    el('div', { class: 'feed' }, upNext(v).map(feedCard)));
  root.append(body);
  window.scrollTo(0, 0);
  playMain(v);
}

/* ================= Asosiy pleyer ================= */
let ytPromise = null;
function ensureYT() {
  if (globalThis.YT && YT.Player) return Promise.resolve();
  if (ytPromise) return ytPromise;
  ytPromise = new Promise((resolve, reject) => {
    globalThis.onYouTubeIframeAPIReady = resolve;
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => { ytPromise = null; s.remove(); reject(new Error('net')); };
    document.head.append(s);
  });
  return ytPromise;
}
const playerVars = () => ({
  autoplay: 1, controls: 0, rel: 0, modestbranding: 1, iv_load_policy: 3,
  fs: 0, disablekb: 1, playsinline: 1, cc_load_policy: 0, origin: location.origin,
});

let mainPlayer = null, mainReady = false, pendingId = null, current = null, dockMode = 'hidden';
let ovlTimer = null, countdownTimer = null, seeking = false, mutedPlayer = null;
const dock = () => $('#player-dock');

function setDock(mode) {
  dockMode = mode;
  dock().dataset.mode = mode;
  document.body.classList.toggle('has-mini', mode === 'mini');
  if (mode !== 'full') { dock().classList.remove('fs'); hideOvl(); hideEnd(); }
  if (mode === 'hidden') {
    current = null;
    try { if (mainReady) mainPlayer.stopVideo(); } catch (e) { /* */ }
  }
}
function updateDockInfo() {
  if (!current) return;
  $('#mini-title').textContent = current.title;
  $('#mini-channel').textContent = current.channel || '';
  $('#curtain-img').src = current.thumb || thumbUrl(current.id);
}
function setCurtain(show) { $('#curtain').classList.toggle('show', show); }
function setPlayIcons(playing) {
  setIc($('#ovl-play'), playing ? 'pause' : 'play');
  setIc($('#mini-play'), playing ? 'pause' : 'play');
}

async function playMain(v, keepMini) {
  if (current && current.id === v.id && mainPlayer) { setDock(keepMini ? dockMode : 'full'); return; }
  current = v;
  setDock(keepMini && dockMode === 'mini' ? 'mini' : 'full');
  updateDockInfo();
  hideEnd();
  setCurtain(true);
  setPlayIcons(false);
  try { await ensureYT(); } catch (e) { toast("YouTube'ga ulanib bo'lmadi. Internetni tekshiring."); return; }
  if (current !== v) return;
  if (mainPlayer) {
    if (mainReady) mainPlayer.loadVideoById(v.id); else pendingId = v.id;
    autoplayFallback(mainPlayer);
    return;
  }
  pendingId = v.id;
  const startId = v.id;
  mainPlayer = new YT.Player('yt-player', {
    host: YT_HOST, videoId: startId, playerVars: playerVars(),
    events: {
      onReady: (e) => {
        mainReady = true;
        if (pendingId && pendingId !== startId) e.target.loadVideoById(pendingId);
        else if (current) e.target.playVideo();
        pendingId = null;
        if (!current) e.target.stopVideo();
        autoplayFallback(e.target);
      },
      onStateChange: onMainState,
      onError: () => {
        toast("Bu video ochilmadi");
        const n = upNext(current)[0];
        if (n && state.settings.autoplay) setTimeout(() => goTo(n), 1500);
      },
    },
  });
}

/** iOS ovozli avto-ijroni bloklasa: ovozsiz boshlab, "Ovozni yoqish" tugmasini ko'rsatamiz. */
function autoplayFallback(p) {
  setTimeout(() => {
    try {
      const st = p.getPlayerState();
      if (st === -1 || st === 5) { // boshlanmagan
        p.mute(); p.playVideo();
        mutedPlayer = p;
        $('#ovl-unmute').hidden = false;
        if (p === mainPlayer) showOvl(true);
        else toast('🔇 Ovoz uchun ekranga teging');
      }
    } catch (e) { /* */ }
  }, 2000);
}
function unmute() {
  try { if (mutedPlayer) { mutedPlayer.unMute(); mutedPlayer.setVolume(100); } } catch (e) { /* */ }
  mutedPlayer = null;
  $('#ovl-unmute').hidden = true;
}

function onMainState(e) {
  const S = YT.PlayerState;
  if (!current) { if (e.data === S.PLAYING) e.target.stopVideo(); return; }
  if (e.data === S.PLAYING) {
    setCurtain(false); setPlayIcons(true); hideEnd(); scheduleOvlHide();
    recordHistory(current);
    const d = e.target.getDuration();
    if (d && !current.duration) { current.duration = Math.round(d); save(); }
  } else if (e.data === S.PAUSED) {
    setCurtain(true); setPlayIcons(false); showOvl(true);
  } else if (e.data === S.ENDED) {
    setCurtain(true); setPlayIcons(false); onEnded();
  }
}

function recordHistory(v) {
  if (state.history[0] === v.id) return;
  state.history = [v.id, ...state.history.filter((x) => x !== v.id)].slice(0, 100);
  save();
}

function goTo(v) {
  if (dockMode === 'full') location.hash = '#/watch/' + v.id;
  else playMain(v, true);
}

function onEnded() {
  const nxt = upNext(current)[0];
  if (dockMode === 'mini') { if (state.settings.autoplay && nxt) playMain(nxt, true); return; }
  hideOvl();
  const panel = $('#end-panel');
  panel.replaceChildren();
  clearInterval(countdownTimer);
  if (!nxt) {
    panel.append(el('button', { class: 'btn primary', onclick: replay }, "🔁 Qayta ko'rish"));
    panel.hidden = false;
    return;
  }
  const lbl = el('div', { class: 'lbl' }, 'Keyingi video');
  panel.append(lbl,
    el('button', { class: 'next-card', onclick: () => goTo(nxt) },
      el('img', { src: nxt.thumb || thumbUrl(nxt.id), alt: '' }),
      el('div', {}, el('div', { class: 't' }, nxt.title), el('div', { class: 'lbl' }, nxt.channel || ''))),
    el('div', { class: 'acts' },
      el('button', { class: 'btn', onclick: () => { clearInterval(countdownTimer); lbl.textContent = 'Keyingi video'; } }, 'Bekor qilish'),
      el('button', { class: 'btn', onclick: replay }, "🔁 Qayta"),
      el('button', { class: 'btn primary', onclick: () => goTo(nxt) }, '▶ Ijro')));
  panel.hidden = false;
  if (state.settings.autoplay) {
    let n = 8;
    lbl.textContent = `Keyingi video ${n} soniyadan keyin`;
    countdownTimer = setInterval(() => {
      n--;
      lbl.textContent = `Keyingi video ${n} soniyadan keyin`;
      if (n <= 0) { clearInterval(countdownTimer); goTo(nxt); }
    }, 1000);
  }
}
function replay() { hideEnd(); if (mainReady) { mainPlayer.seekTo(0, true); mainPlayer.playVideo(); } }
function hideEnd() { clearInterval(countdownTimer); $('#end-panel').hidden = true; }

function showOvl(sticky) {
  if (dockMode !== 'full') return;
  $('#ovl').classList.add('show');
  clearTimeout(ovlTimer);
  if (!sticky) scheduleOvlHide();
}
function hideOvl() { clearTimeout(ovlTimer); $('#ovl').classList.remove('show'); }
function scheduleOvlHide() {
  clearTimeout(ovlTimer);
  ovlTimer = setTimeout(() => { if (isPlaying(mainPlayer) && !seeking) hideOvl(); }, 3000);
}
function togglePlay() {
  if (!mainReady) return;
  if (mutedPlayer === mainPlayer) unmute();
  const st = mainPlayer.getPlayerState();
  if (st === YT.PlayerState.PLAYING) mainPlayer.pauseVideo();
  else if (st === YT.PlayerState.ENDED) replay();
  else mainPlayer.playVideo();
}
function seekBy(sec) {
  if (!mainReady) return;
  mainPlayer.seekTo(Math.max(0, mainPlayer.getCurrentTime() + sec), true);
  const f = $('#seek-flash');
  f.className = 'seek-flash show ' + (sec < 0 ? 'left' : 'right');
  f.textContent = (sec < 0 ? '« ' : '') + Math.abs(sec) + ' soniya' + (sec > 0 ? ' »' : '');
  setTimeout(() => f.classList.remove('show'), 500);
}
function toggleFullscreen() {
  const d = dock();
  const on = !d.classList.contains('fs');
  d.classList.toggle('fs', on);
  if (on) {
    if (d.requestFullscreen) d.requestFullscreen().catch(() => {});
    else if (d.webkitRequestFullscreen) d.webkitRequestFullscreen();
    try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* */ }
  } else {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    try { screen.orientation.unlock(); } catch (e) { /* */ }
  }
}
function minimize() {
  // Mini-pleyer bilan oxirgi ko'rilgan sahifaga qaytamiz (bosh sahifa, kanal, qidiruv...)
  location.replace(lastBrowse || '#/home');
}
function closeMini() { setDock('hidden'); }

function isPlaying(p) {
  try { return !!p && typeof p.getPlayerState === 'function' && p.getPlayerState() === YT.PlayerState.PLAYING; } catch (e) { return false; }
}
function pauseAll() {
  try { if (mainReady) mainPlayer.pauseVideo(); } catch (e) { /* */ }
  try { if (shortsPlayer) shortsPlayer.pauseVideo(); } catch (e) { /* */ }
}
function stopAll() { setDock('hidden'); destroyShorts(); }

/* ================= Shorts ================= */
let shortsPlayer = null, shortsObserver = null, activeSlide = null;

function destroyShorts() {
  if (shortsObserver) { shortsObserver.disconnect(); shortsObserver = null; }
  if (shortsPlayer) { try { shortsPlayer.destroy(); } catch (e) { /* */ } shortsPlayer = null; }
  activeSlide = null;
}

function renderShorts(startId) {
  destroyShorts();
  if (current) setDock('hidden'); // mini-pleyerni to'xtatamiz
  const root = view();
  root.replaceChildren();
  const list = dayShuffle(shortVideos());
  if (!list.length) {
    root.append(emptyBox('📱', "Hozircha Shorts yo'q. Ota-ona youtube.com/shorts/... havolasini qo'shishi mumkin."));
    return;
  }
  if (startId) {
    const i = list.findIndex((v) => v.id === startId);
    if (i > 0) list.unshift(...list.splice(i, 1));
  }
  const box = el('div', { class: 'shorts' });
  list.forEach((v) => {
    const liked = state.liked.includes(v.id);
    const slide = el('div', { class: 'slide', 'data-id': v.id },
      el('div', { class: 's-slot' }),
      el('div', { class: 's-cover' }, el('img', { src: v.thumb || thumbUrl(v.id), alt: '', loading: 'lazy' })),
      el('div', { class: 's-shield' }),
      el('div', { class: 's-pause' }, ic('play')),
      el('div', { class: 's-info' },
        el('div', { class: 's-chan' }, avatar(v), v.channel || ''),
        el('div', { class: 's-title' }, v.title)),
      el('div', { class: 's-side' },
        el('div', {},
          el('button', {
            class: liked ? 'on' : '', 'aria-label': 'Yoqdi',
            onclick: (e) => {
              const i = state.liked.indexOf(v.id);
              if (i >= 0) state.liked.splice(i, 1); else state.liked.unshift(v.id);
              save();
              e.currentTarget.classList.toggle('on', i < 0);
            },
          }, ic('like')),
          el('small', {}, 'Yoqdi'))));
    slide.querySelector('.s-shield').addEventListener('click', () => {
      if (activeSlide !== slide || !shortsPlayer) return;
      if (mutedPlayer === shortsPlayer) { unmute(); return; }
      if (isPlaying(shortsPlayer)) shortsPlayer.pauseVideo(); else shortsPlayer.playVideo();
    });
    box.append(slide);
  });
  root.append(el('div', { class: 'shorts-head' }, 'Shorts'), box);
  shortsObserver = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (en.isIntersecting && en.intersectionRatio >= 0.6) {
        const v = byId(en.target.dataset.id);
        if (v) activateShort(en.target, v);
      }
    }
  }, { root: box, threshold: [0.6] });
  box.querySelectorAll('.slide').forEach((s) => shortsObserver.observe(s));
}

async function activateShort(slide, v) {
  if (activeSlide === slide) return;
  if (shortsPlayer) { try { shortsPlayer.destroy(); } catch (e) { /* */ } shortsPlayer = null; }
  if (activeSlide) activeSlide.classList.remove('playing', 'paused');
  activeSlide = slide;
  const slot = slide.querySelector('.s-slot');
  const holder = el('div');
  slot.replaceChildren(holder);
  try { await ensureYT(); } catch (e) { toast("YouTube'ga ulanib bo'lmadi"); return; }
  if (activeSlide !== slide) return;
  const p = new YT.Player(holder, {
    host: YT_HOST, videoId: v.id, playerVars: playerVars(),
    events: {
      onReady: (e) => { e.target.playVideo(); autoplayFallback(e.target); },
      onStateChange: (e) => {
        if (shortsPlayer !== p) return;
        const S = YT.PlayerState;
        if (e.data === S.PLAYING) { slide.classList.add('playing'); slide.classList.remove('paused'); recordHistory(v); }
        else if (e.data === S.PAUSED) { slide.classList.add('paused'); slide.classList.remove('playing'); }
        else if (e.data === S.ENDED) { e.target.seekTo(0, true); e.target.playVideo(); } // Shorts takrorlanadi
      },
      onError: () => slide.classList.add('errored'),
    },
  });
  shortsPlayer = p;
}

/* ================= Taymer: vaqt hisobi va progress ================= */
let lastTick = Date.now(), tickCount = 0;
function tick() {
  const now = Date.now(), dt = Math.min(5, (now - lastTick) / 1000);
  lastTick = now;
  if (isPlaying(mainPlayer) || isPlaying(shortsPlayer)) {
    resetUsageIfNewDay();
    state.usage.seconds += dt;
    if (++tickCount % 20 === 0) save();
    if (timeIsUp()) { save(); stopAll(); route(); return; }
  }
  if (mainReady && current) {
    try {
      const cur = mainPlayer.getCurrentTime() || 0, dur = mainPlayer.getDuration() || 0;
      const pct = dur ? (cur / dur) * 100 : 0;
      const seek = $('#seek');
      if (!seeking) { seek.value = Math.round(pct * 10); seek.style.setProperty('--p', pct + '%'); }
      $('#ovl-time').textContent = fmtTime(cur) + ' / ' + fmtTime(dur);
      $('#mini-bar').style.width = pct + '%';
    } catch (e) { /* */ }
  }
}

/* ================= Marshrutlash ================= */
let parentUnlocked = false, pinOpen = false, lastBrowse = '#/home';

function setScreen(kind) {
  document.body.dataset.screen = kind;
  $('#screen-setup').hidden = kind !== 'setup';
  $('#app').hidden = kind !== 'app';
  $('#screen-parent').hidden = kind !== 'parent';
  $('#screen-timeup').hidden = kind !== 'timeup';
}
function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const i = h.indexOf('/');
  if (i < 0) return { name: h || 'home', arg: '' };
  let arg = h.slice(i + 1);
  try { arg = decodeURIComponent(arg); } catch (e) { /* */ }
  return { name: h.slice(0, i), arg };
}

async function route() {
  if (!state.pinHash) { setScreen('setup'); return; }
  const { name, arg } = parseHash();

  if (name === 'parent') {
    if (!parentUnlocked) {
      if (pinOpen) return;
      pauseAll();
      const ok = await askPin();
      if (!ok) { history.replaceState(null, '', '#/home'); route(); return; }
      parentUnlocked = true;
    }
    pauseAll();
    setScreen('parent');
    renderParent();
    window.scrollTo(0, 0);
    return;
  }
  parentUnlocked = false;

  if (timeIsUp()) { stopAll(); setScreen('timeup'); return; }
  setScreen('app');
  document.body.dataset.route = name;
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === name));
  $('#searchbar').hidden = name !== 'search';

  if (name !== 'watch' && name !== 'shorts') lastBrowse = location.hash || '#/home';
  if (name !== 'shorts') destroyShorts();
  if (name !== 'watch' && dockMode === 'full') {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    setDock(current ? 'mini' : 'hidden');
  }

  switch (name) {
    case 'watch': renderWatch(arg); return;
    case 'shorts': renderShorts(arg); break;
    case 'channels': renderChannels(); break;
    case 'channel': renderChannel(arg); break;
    case 'library': renderLibrary(); break;
    case 'search': renderSearch(arg); break;
    default: renderHome();
  }
  if (name !== 'search') window.scrollTo(0, 0);
}

/* ================= PIN oynasi ================= */
let pinBuffer = '', pinResolve = null;

function askPin() {
  return new Promise((resolve) => {
    pinOpen = true;
    pinBuffer = '';
    pinResolve = resolve;
    $('#pin-error').textContent = '';
    drawPinDots();
    $('#pin-modal').hidden = false;
  });
}
function drawPinDots() {
  document.querySelectorAll('#pin-dots span').forEach((d, i) => d.classList.toggle('on', i < pinBuffer.length));
}
function closePinModal(result) {
  $('#pin-modal').hidden = true;
  pinOpen = false;
  const r = pinResolve;
  pinResolve = null;
  if (r) r(result);
}
function pinKey(k) {
  if (k === '⌫') pinBuffer = pinBuffer.slice(0, -1);
  else if (pinBuffer.length < 4) pinBuffer += k;
  drawPinDots();
  if (pinBuffer.length === 4) {
    if (hashPin(pinBuffer) === state.pinHash) closePinModal(true);
    else {
      $('#pin-error').textContent = "Noto'g'ri PIN";
      pinBuffer = '';
      setTimeout(drawPinDots, 250);
    }
  }
}
function buildKeypad() {
  const pad = $('#keypad');
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].forEach((k) => {
    const b = el('button', { type: 'button' }, k);
    if (!k) b.style.visibility = 'hidden';
    else b.addEventListener('click', () => pinKey(k));
    pad.append(b);
  });
}

/* ================= Ota-ona bo'limi ================= */
function renderParent() {
  const sel = $('#add-category');
  sel.replaceChildren(...state.categories.map((c) => el('option', { value: c }, c)), el('option', { value: '' }, "— Bo'limsiz —"));

  $('#cat-list').replaceChildren(...state.categories.map((c) => el('span', { class: 'cat-tag' }, c,
    el('button', {
      'aria-label': "O'chirish", onclick: () => {
        if (!confirm(`"${c}" bo'limi o'chirilsinmi? (videolar o'chmaydi)`)) return;
        state.categories = state.categories.filter((x) => x !== c);
        state.videos.forEach((v) => { if (v.category === c) v.category = ''; });
        save(); renderParent();
      },
    }, '✕'))));

  $('#set-limit').value = state.settings.dailyLimitMin;
  $('#set-shorts').checked = state.settings.hideShorts;
  $('#set-words').value = state.settings.blockedWords.join(', ');
  $('#set-max').value = state.settings.maxImport;
  $('#set-apikey').value = state.apiKey;
  resetUsageIfNewDay();
  $('#used-today').textContent = Math.floor(state.usage.seconds / 60);
  renderParentList();
}

function renderParentList() {
  const q = $('#parent-search').value.trim().toLowerCase();
  $('#video-count').textContent = state.videos.length;
  const items = state.videos
    .filter((v) => !q || (v.title + ' ' + v.channel).toLowerCase().includes(q))
    .map((v) => {
      const sel = el('select', { onchange: (e) => { v.category = e.target.value; save(); } },
        [...state.categories, ''].map((c) => {
          const o = el('option', { value: c }, c || "— Bo'limsiz —");
          if (c === (v.category || '')) o.selected = true;
          return o;
        }));
      const shortBox = el('input', { type: 'checkbox', onchange: (e) => { v.isShort = e.target.checked; save(); } });
      shortBox.checked = !!v.isShort;
      return el('div', { class: 'pitem' },
        el('img', { src: v.thumb || thumbUrl(v.id), alt: '', loading: 'lazy' }),
        el('div', { class: 'pinfo' },
          el('div', { class: 'ptitle', title: v.title }, v.title),
          el('div', { class: 'pmeta' }, [v.channel, v.duration ? fmtTime(v.duration) : null].filter(Boolean).join(' · '))),
        sel,
        el('label', {}, shortBox, 'Shorts'),
        el('button', {
          class: 'btn small danger', 'aria-label': "O'chirish",
          onclick: () => {
            state.videos = state.videos.filter((x) => x.id !== v.id);
            state.history = state.history.filter((x) => x !== v.id);
            state.liked = state.liked.filter((x) => x !== v.id);
            if (current && current.id === v.id) setDock('hidden');
            save(); renderParentList();
          },
        }, '🗑'));
    });
  $('#parent-list').replaceChildren(...items);
}

function flash(sel, msg, isError) {
  const n = $(sel);
  n.style.color = isError ? 'var(--red)' : '';
  n.textContent = msg;
}

/* ================= Hodisalar ================= */
function bindEvents() {
  // Birinchi sozlash
  $('#setup-save').addEventListener('click', () => {
    const a = $('#setup-pin').value, b = $('#setup-pin2').value;
    if (!/^\d{4}$/.test(a)) { $('#setup-error').textContent = "PIN 4 ta raqamdan iborat bo'lsin"; return; }
    if (a !== b) { $('#setup-error').textContent = 'PIN kodlar mos emas'; return; }
    state.pinHash = hashPin(a);
    save();
    parentUnlocked = true;
    location.hash = '#/parent';
    route();
  });

  $('#btn-parent').addEventListener('click', () => { location.hash = '#/parent'; });
  $('#pin-cancel').addEventListener('click', () => closePinModal(false));
  document.addEventListener('keydown', (e) => {
    if ($('#pin-modal').hidden) return;
    if (/^\d$/.test(e.key)) pinKey(e.key);
    else if (e.key === 'Backspace') pinKey('⌫');
    else if (e.key === 'Escape') closePinModal(false);
  });

  // Qidiruv
  $('#btn-search').addEventListener('click', () => {
    location.hash = '#/search/';
    setTimeout(() => $('#search-input').focus(), 50);
  });
  $('#search-input').addEventListener('input', (e) => {
    history.replaceState(null, '', '#/search/' + encodeURIComponent(e.target.value));
    renderSearch(e.target.value);
  });
  $('#search-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });
  $('#search-clear').addEventListener('click', () => {
    $('#search-input').value = '';
    history.replaceState(null, '', '#/search/');
    renderSearch('');
    $('#search-input').focus();
  });
  $('#search-back').addEventListener('click', () => { location.hash = '#/home'; });

  // Pleyer: bitta teginish — boshqaruv, ikki marta — 10 soniya oldinga/orqaga
  let lastTap = 0, tapTimer = null;
  $('#click-shield').addEventListener('click', (e) => {
    if (dockMode === 'mini') { if (current) location.hash = '#/watch/' + current.id; return; }
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    const now = Date.now();
    if (now - lastTap < 300) {
      clearTimeout(tapTimer);
      lastTap = 0;
      seekBy(x < r.width / 2 ? -10 : 10);
      return;
    }
    lastTap = now;
    tapTimer = setTimeout(() => {
      if (mutedPlayer === mainPlayer) { unmute(); return; }
      if ($('#ovl').classList.contains('show')) hideOvl(); else showOvl(!isPlaying(mainPlayer));
    }, 260);
  });
  // Boshqaruv ochiq bo'lganda bo'sh joyga teginish uni yopadi
  $('#ovl').addEventListener('click', (e) => { if (e.target === e.currentTarget) hideOvl(); });
  $('#ovl-play').addEventListener('click', (e) => { e.stopPropagation(); togglePlay(); scheduleOvlHide(); });
  $('#ovl-next').addEventListener('click', (e) => { e.stopPropagation(); const n = upNext(current)[0]; if (n) goTo(n); });
  $('#ovl-prev').addEventListener('click', (e) => {
    e.stopPropagation();
    if (mainReady && mainPlayer.getCurrentTime() > 3) mainPlayer.seekTo(0, true); else minimize();
  });
  $('#ovl-min').addEventListener('click', (e) => { e.stopPropagation(); if (dock().classList.contains('fs')) toggleFullscreen(); else minimize(); });
  $('#ovl-full').addEventListener('click', (e) => { e.stopPropagation(); toggleFullscreen(); });
  $('#ovl-unmute').addEventListener('click', (e) => { e.stopPropagation(); unmute(); });
  const seek = $('#seek');
  seek.addEventListener('input', () => { seeking = true; seek.style.setProperty('--p', seek.value / 10 + '%'); clearTimeout(ovlTimer); });
  seek.addEventListener('change', () => {
    seeking = false;
    if (mainReady) mainPlayer.seekTo((seek.value / 1000) * mainPlayer.getDuration(), true);
    scheduleOvlHide();
  });
  $('#mini-play').addEventListener('click', togglePlay);
  $('#mini-close').addEventListener('click', closeMini);
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) dock().classList.remove('fs'); });

  // Ota-ona: video qo'shish
  $('#add-btn').addEventListener('click', async () => {
    const text = $('#add-links').value;
    if (!text.trim()) return;
    const btn = $('#add-btn');
    btn.disabled = true;
    flash('#add-status', 'Yuklanmoqda...');
    const r = await addLinks(text, $('#add-category').value);
    btn.disabled = false;
    let msg = `✅ ${r.added} ta video qo'shildi.`;
    if (r.dup) msg += ` ${r.dup} tasi oldin bor edi.`;
    if (r.skipped) msg += ` ${r.skipped} tasi filtr bo'yicha o'tkazildi.`;
    if (r.errors.length) msg += '\n⚠️ ' + r.errors.join('\n⚠️ ');
    flash('#add-status', msg, r.errors.length && !r.added);
    if (r.added) $('#add-links').value = '';
    renderParentList();
  });

  $('#cat-add').addEventListener('click', () => {
    const name = $('#cat-new').value.trim();
    if (!name || state.categories.includes(name) || name === ALL) return;
    state.categories.push(name);
    $('#cat-new').value = '';
    save(); renderParent();
  });
  $('#parent-search').addEventListener('input', renderParentList);

  $('#settings-save').addEventListener('click', () => {
    state.settings.dailyLimitMin = Math.max(0, parseInt($('#set-limit').value, 10) || 0);
    state.settings.hideShorts = $('#set-shorts').checked;
    state.settings.blockedWords = $('#set-words').value.split(',').map((w) => w.trim()).filter(Boolean);
    state.settings.maxImport = Math.min(500, Math.max(1, parseInt($('#set-max').value, 10) || 100));
    save();
    flash('#settings-status', '✅ Saqlandi');
  });
  $('#reset-today').addEventListener('click', () => {
    state.usage = { date: today(), seconds: 0 }; save(); $('#used-today').textContent = '0';
  });
  $('#apikey-save').addEventListener('click', async () => {
    state.apiKey = $('#set-apikey').value.trim(); save();
    flash('#settings-status', '✅ API kaliti saqlandi');
    await fillChannelThumbs();
  });
  $('#pin-save').addEventListener('click', () => {
    const p = $('#pin-new').value;
    if (!/^\d{4}$/.test(p)) { flash('#pin-status', '4 ta raqam kiriting', true); return; }
    state.pinHash = hashPin(p); save();
    $('#pin-new').value = '';
    flash('#pin-status', "✅ PIN o'zgartirildi");
  });

  $('#export-btn').addEventListener('click', () => {
    const data = { app: 'uno-kids', version: 2, categories: state.categories, videos: state.videos, settings: state.settings };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: `uno-kids-${today()}.json` });
    document.body.append(a); a.click(); a.remove();
  });
  $('#import-file').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (data.app !== 'uno-kids' || !Array.isArray(data.videos)) throw new Error('format');
      const ids = new Set(state.videos.map((v) => v.id));
      let n = 0;
      for (const v of data.videos) {
        if (v && VID_RE.test(v.id) && !ids.has(v.id)) {
          state.videos.push({
            id: v.id, title: String(v.title || 'Video'), channel: String(v.channel || ''),
            channelId: String(v.channelId || ''), channelThumb: /^https:\/\/[^"'\s]+$/.test(v.channelThumb || '') ? v.channelThumb : '',
            thumb: thumbUrl(v.id), category: String(v.category || ''), addedAt: +v.addedAt || Date.now(),
            duration: +v.duration || 0, isShort: !!v.isShort, views: +v.views || 0, publishedAt: +v.publishedAt || 0,
          });
          ids.add(v.id); n++;
        }
      }
      (data.categories || []).forEach((c) => { if (typeof c === 'string' && !state.categories.includes(c)) state.categories.push(c); });
      save(); renderParent();
      flash('#backup-status', `✅ ${n} ta video import qilindi`);
    } catch (err) {
      flash('#backup-status', "Fayl noto'g'ri", true);
    }
    e.target.value = '';
  });
  $('#clear-history').addEventListener('click', () => {
    state.history = []; save(); flash('#backup-status', '✅ Tarix tozalandi');
  });

  // Bola rejimida uzoq bosish menyusini o'chirish
  document.addEventListener('contextmenu', (e) => {
    if (document.body.dataset.screen !== 'parent') e.preventDefault();
  });
  // Ilova fonga o'tganda pauza
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { pauseAll(); save(); }
  });
  window.addEventListener('hashchange', route);
}

/* ================= Ishga tushirish ================= */
function init() {
  document.querySelectorAll('[data-ic]').forEach((n) => n.replaceWith(ic(n.dataset.ic)));
  buildKeypad();
  bindEvents();
  setInterval(tick, 500);
  route();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

if (typeof module !== 'undefined') module.exports = { parseYouTube, isoDurationToSec, fmtCount, timeAgo };
else document.addEventListener('DOMContentLoaded', init);
