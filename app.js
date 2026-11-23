/* UNO Kids — bolalar uchun xavfsiz YouTube video ilova.
 * Faqat ota-ona qo'shgan videolar ko'rsatiladi. Hammasi brauzer xotirasida (localStorage) saqlanadi.
 */
'use strict';

const STORE_KEY = 'unoKids.v1';
const ALL = '__all__';

/* ---------------- Holat (state) ---------------- */
const defaultState = () => ({
  pinHash: null,
  apiKey: '',
  categories: ['Multfilmlar', "Ta'limiy", "Qo'shiqlar"],
  videos: [], // {id, title, channel, thumb, category, addedAt}
  settings: { dailyLimitMin: 0, hideShorts: true, blockedWords: [], maxImport: 100 },
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
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* to'lgan xotira */ }
}
function today() { return new Date().toISOString().slice(0, 10); }
function hashPin(pin) {
  // Oddiy FNV-1a xesh: PIN ochiq matnda saqlanmasligi uchun.
  let h = 0x811c9dc5;
  const str = 'uno-kids:' + pin;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16);
}

/* ---------------- Yordamchilar ---------------- */
const $ = (sel) => document.querySelector(sel);
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null) node.setAttribute(k, v);
  }
  for (const c of children) node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return node;
}
function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
}
function thumbUrl(id) { return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`; }
function showScreen(name) {
  document.querySelectorAll('.screen').forEach((s) => { s.hidden = s.id !== 'screen-' + name; });
  window.scrollTo(0, 0);
}

/* ---------------- YouTube havolasini tahlil qilish ---------------- */
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
  if (['shorts', 'embed', 'live', 'v'].includes(parts[0]) && parts[1] && VID_RE.test(parts[1])) {
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

/* ---------------- Ma'lumot olish ---------------- */
async function fetchOEmbed(id) {
  try {
    const res = await fetch('https://www.youtube.com/oembed?format=json&url=' +
      encodeURIComponent('https://www.youtube.com/watch?v=' + id));
    if (!res.ok) return null; // o'chirilgan, yopiq yoki joylashtirish taqiqlangan video
    const j = await res.json();
    return { title: j.title, channel: j.author_name };
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
  const j = await ytApi('channels', Object.assign({ part: 'contentDetails,snippet' }, params));
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

/** Video ma'lumotlarini oladi va filtrlaydi: joylashtirib bo'lmaydigan, Shorts, taqiqlangan so'zli videolar o'tkaziladi. */
async function videoDetailsFiltered(ids) {
  const out = [];
  let skipped = 0;
  const words = state.settings.blockedWords.map((w) => w.toLowerCase()).filter(Boolean);
  for (let i = 0; i < ids.length; i += 50) {
    const j = await ytApi('videos', { part: 'snippet,contentDetails,status', id: ids.slice(i, i + 50).join(',') });
    for (const v of j.items || []) {
      const title = v.snippet.title || '';
      const low = (title + ' ' + (v.snippet.tags || []).join(' ')).toLowerCase();
      const dur = isoDurationToSec(v.contentDetails.duration);
      const bad =
        !v.status.embeddable ||
        v.status.privacyStatus === 'private' ||
        (v.contentDetails.contentRating && v.contentDetails.contentRating.ytRating === 'ytAgeRestricted') ||
        (state.settings.hideShorts && dur > 0 && dur <= 60) ||
        words.some((w) => low.includes(w));
      if (bad) { skipped++; continue; }
      out.push({ id: v.id, title, channel: v.snippet.channelTitle });
    }
  }
  return { items: out, skipped };
}

async function addLinks(text, category) {
  const lines = text.split(/[\s,]+/).filter(Boolean);
  let added = 0, dup = 0, skipped = 0;
  const errors = [];
  const existing = new Set(state.videos.map((v) => v.id));
  const push = (v) => {
    if (existing.has(v.id)) { dup++; return; }
    existing.add(v.id);
    state.videos.unshift({ id: v.id, title: v.title || 'Video', channel: v.channel || '', thumb: thumbUrl(v.id), category, addedAt: Date.now() });
    added++;
  };

  for (const line of lines) {
    const p = parseYouTube(line);
    if (!p) { errors.push("Tanilmagan havola: " + line); continue; }
    try {
      if (p.type === 'video') {
        if (existing.has(p.id)) { dup++; continue; }
        if (state.apiKey) {
          const r = await videoDetailsFiltered([p.id]);
          // Bitta videoni ota-ona o'zi tanlagan — faqat joylashtirib bo'lmasa rad etamiz.
          if (!r.items.length) {
            const meta = await fetchOEmbed(p.id);
            if (meta === null) { errors.push("Bu videoni ilovada ko'rsatib bo'lmaydi: " + line); continue; }
            push({ id: p.id, ...(meta || {}) });
          } else push(r.items[0]);
        } else {
          const meta = await fetchOEmbed(p.id);
          if (meta === null) { errors.push("Video topilmadi yoki joylashtirish taqiqlangan: " + line); continue; }
          push({ id: p.id, ...(meta || {}) });
        }
      } else {
        const plId = p.type === 'playlist' ? p.id : await resolveUploadsPlaylist(p);
        const ids = await playlistVideoIds(plId, state.settings.maxImport || 100);
        const r = await videoDetailsFiltered(ids.filter((id) => !existing.has(id)));
        skipped += r.skipped;
        r.items.forEach(push);
      }
    } catch (e) {
      errors.push(e.message);
    }
    save();
  }
  save();
  return { added, dup, skipped, errors };
}

/* ---------------- Bola rejimi ---------------- */
let currentCat = ALL;

function visibleVideos() {
  return currentCat === ALL ? state.videos : state.videos.filter((v) => v.category === currentCat);
}

function videoCard(v, onClick) {
  return el('button', { class: 'vcard', onclick: onClick, 'aria-label': v.title },
    el('div', { class: 'thumb' },
      el('img', { src: v.thumb || thumbUrl(v.id), alt: '', loading: 'lazy' }),
      el('div', { class: 'play-badge' }, '▶')),
    el('div', { class: 'vtitle' }, v.title));
}

function renderKids() {
  const cats = $('#categories');
  cats.innerHTML = '';
  const used = state.categories.filter((c) => state.videos.some((v) => v.category === c));
  if (!used.includes(currentCat)) currentCat = ALL;
  [[ALL, '⭐ Hammasi'], ...used.map((c) => [c, c])].forEach(([key, label]) => {
    cats.append(el('button', {
      class: 'chip' + (key === currentCat ? ' active' : ''),
      onclick: () => { currentCat = key; renderKids(); },
    }, label));
  });
  cats.hidden = used.length < 1;

  const grid = $('#video-grid');
  grid.innerHTML = '';
  const list = visibleVideos();
  list.forEach((v, i) => grid.append(videoCard(v, () => openPlayer(list, i))));
  $('#empty-kids').hidden = list.length > 0;
}

function goKids() {
  if (timeIsUp()) { showScreen('timeup'); return; }
  renderKids();
  showScreen('kids');
}

/* ---------------- Ekran vaqti ---------------- */
function resetUsageIfNewDay() {
  if (state.usage.date !== today()) { state.usage = { date: today(), seconds: 0 }; save(); }
}
function timeIsUp() {
  resetUsageIfNewDay();
  const lim = state.settings.dailyLimitMin;
  return lim > 0 && state.usage.seconds >= lim * 60;
}

/* ---------------- Pleyer ---------------- */
let ytReady = false, ytApiLoading = false, player = null;
let queue = [], qIndex = 0;
let tickTimer = null, countdownTimer = null, seeking = false;

function loadYtApi() {
  if (ytReady || ytApiLoading) return;
  ytApiLoading = true;
  const s = document.createElement('script');
  s.src = 'https://www.youtube.com/iframe_api';
  s.onerror = () => { ytApiLoading = false; alert("YouTube'ga ulanib bo'lmadi. Internetni tekshiring."); closePlayer(); };
  document.head.append(s);
}
globalThis.onYouTubeIframeAPIReady = () => {
  ytReady = true;
  if (queue.length) createPlayer(queue[qIndex].id);
};

function openPlayer(list, index) {
  if (timeIsUp()) { showScreen('timeup'); return; }
  queue = list.slice();
  qIndex = index;
  showScreen('player');
  hideCurtain();
  updateTitle();
  if (!ytReady) { loadYtApi(); return; }
  if (player) player.loadVideoById(queue[qIndex].id);
  else createPlayer(queue[qIndex].id);
}

function createPlayer(videoId) {
  player = new YT.Player('yt-player', {
    host: 'https://www.youtube-nocookie.com',
    videoId,
    playerVars: {
      autoplay: 1, controls: 0, rel: 0, modestbranding: 1, iv_load_policy: 3,
      fs: 0, disablekb: 1, playsinline: 1, cc_load_policy: 0,
      origin: location.origin,
    },
    events: {
      onReady: (e) => { e.target.playVideo(); startTick(); },
      onStateChange: onPlayerState,
      onError: () => { // video o'chirilgan yoki ko'rsatish taqiqlangan — keyingisiga o'tamiz
        if (queue.length > 1) next(); else closePlayer();
      },
    },
  });
}

function onPlayerState(e) {
  const S = YT.PlayerState;
  if (e.data === S.PLAYING) { hideCurtain(); $('#ctl-play').textContent = '⏸'; }
  else if (e.data === S.PAUSED) { showCurtain(false); $('#ctl-play').textContent = '▶'; }
  else if (e.data === S.ENDED) { showCurtain(true); $('#ctl-play').textContent = '▶'; }
}

function showCurtain(ended) {
  const v = queue[qIndex];
  $('#curtain-thumb').src = v ? (v.thumb || thumbUrl(v.id)) : '';
  $('#curtain').hidden = false;
  $('#curtain-play').hidden = ended;
  const endPanel = $('#end-panel');
  endPanel.hidden = !ended;
  clearInterval(countdownTimer);
  if (ended) {
    const up = $('#up-next');
    up.innerHTML = '';
    const nextItems = [];
    for (let k = 1; k <= Math.min(3, queue.length - 1); k++) nextItems.push((qIndex + k) % queue.length);
    nextItems.forEach((idx) => up.append(videoCard(queue[idx], () => playIndex(idx))));
    if (!nextItems.length) {
      $('#countdown').textContent = '';
      up.append(el('button', { class: 'btn primary', onclick: () => playIndex(qIndex) }, '🔁 Qayta ko\'rish'));
      return;
    }
    let n = 8;
    $('#countdown').textContent = `(${n})`;
    countdownTimer = setInterval(() => {
      n--;
      $('#countdown').textContent = `(${n})`;
      if (n <= 0) { clearInterval(countdownTimer); next(); }
    }, 1000);
  }
}
function hideCurtain() { clearInterval(countdownTimer); $('#curtain').hidden = true; }

function playIndex(i) {
  if (timeIsUp()) { closePlayer(); showScreen('timeup'); return; }
  qIndex = (i + queue.length) % queue.length;
  hideCurtain();
  updateTitle();
  if (player && player.loadVideoById) player.loadVideoById(queue[qIndex].id);
}
function next() { playIndex(qIndex + 1); }
function prev() { playIndex(qIndex - 1); }
function updateTitle() { $('#player-title').textContent = queue[qIndex] ? queue[qIndex].title : ''; }

function startTick() {
  clearInterval(tickTimer);
  let last = Date.now();
  tickTimer = setInterval(() => {
    const now = Date.now();
    const dt = (now - last) / 1000;
    last = now;
    if (!player || !player.getPlayerState) return;
    if (player.getPlayerState() === YT.PlayerState.PLAYING) {
      resetUsageIfNewDay();
      state.usage.seconds += dt;
      if (Math.round(state.usage.seconds) % 10 === 0) save();
      if (timeIsUp()) { save(); closePlayer(); showScreen('timeup'); return; }
    }
    const dur = player.getDuration ? player.getDuration() : 0;
    const cur = player.getCurrentTime ? player.getCurrentTime() : 0;
    if (!seeking && dur > 0) $('#ctl-seek').value = Math.round((cur / dur) * 1000);
    $('#ctl-time').textContent = fmtTime(cur) + ' / ' + fmtTime(dur);
  }, 500);
}

function closePlayer() {
  clearInterval(countdownTimer);
  if (player && player.stopVideo) player.stopVideo();
  save();
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  hideCurtain();
  if (!timeIsUp()) goKids();
}

function togglePlay() {
  if (!player || !player.getPlayerState) return;
  const st = player.getPlayerState();
  if (st === YT.PlayerState.PLAYING) player.pauseVideo();
  else if (st === YT.PlayerState.ENDED) playIndex(qIndex);
  else player.playVideo();
}

/* ---------------- PIN oynasi ---------------- */
let pinBuffer = '', pinResolve = null;

function askPin() {
  return new Promise((resolve) => {
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
  if (pinResolve) pinResolve(result);
  pinResolve = null;
}
function pinKey(k) {
  if (k === '⌫') pinBuffer = pinBuffer.slice(0, -1);
  else if (pinBuffer.length < 4) pinBuffer += k;
  drawPinDots();
  if (pinBuffer.length === 4) {
    if (hashPin(pinBuffer) === state.pinHash) { closePinModal(true); }
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

async function enterParent() {
  if (await askPin()) { renderParent(); showScreen('parent'); }
}

/* ---------------- Ota-ona bo'limi ---------------- */
function renderParent() {
  const sel = $('#add-category');
  sel.innerHTML = '';
  state.categories.forEach((c) => sel.append(el('option', { value: c }, c)));
  sel.append(el('option', { value: '' }, '— Bo\'limsiz —'));

  const cl = $('#cat-list');
  cl.innerHTML = '';
  state.categories.forEach((c) => cl.append(el('span', { class: 'cat-tag' }, c,
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
  const list = $('#parent-list');
  list.innerHTML = '';
  $('#video-count').textContent = state.videos.length;
  state.videos
    .filter((v) => !q || (v.title + ' ' + v.channel).toLowerCase().includes(q))
    .forEach((v) => {
      const sel = el('select', {
        onchange: (e) => { v.category = e.target.value; save(); },
      });
      [...state.categories, ''].forEach((c) => {
        const o = el('option', { value: c }, c || '— Bo\'limsiz —');
        if (c === (v.category || '')) o.selected = true;
        sel.append(o);
      });
      list.append(el('div', { class: 'pitem' },
        el('img', { src: v.thumb || thumbUrl(v.id), alt: '', loading: 'lazy' }),
        el('div', { class: 'pinfo' },
          el('div', { class: 'ptitle', title: v.title }, v.title),
          el('div', { class: 'pmeta' }, v.channel || '')),
        sel,
        el('button', {
          class: 'btn small danger', 'aria-label': "O'chirish",
          onclick: () => { state.videos = state.videos.filter((x) => x.id !== v.id); save(); renderParentList(); },
        }, '🗑')));
    });
}

/* ---------------- Hodisalar ---------------- */
function bindEvents() {
  // Birinchi sozlash
  $('#setup-save').addEventListener('click', () => {
    const a = $('#setup-pin').value, b = $('#setup-pin2').value;
    if (!/^\d{4}$/.test(a)) { $('#setup-error').textContent = 'PIN 4 ta raqamdan iborat bo\'lsin'; return; }
    if (a !== b) { $('#setup-error').textContent = 'PIN kodlar mos emas'; return; }
    state.pinHash = hashPin(a);
    save();
    renderParent();
    showScreen('parent');
  });

  $('#btn-parent').addEventListener('click', enterParent);
  $('#timeup-parent').addEventListener('click', enterParent);
  $('#btn-exit-parent').addEventListener('click', goKids);
  $('#pin-cancel').addEventListener('click', () => closePinModal(false));
  document.addEventListener('keydown', (e) => {
    if ($('#pin-modal').hidden) return;
    if (/^\d$/.test(e.key)) pinKey(e.key);
    else if (e.key === 'Backspace') pinKey('⌫');
    else if (e.key === 'Escape') closePinModal(false);
  });

  // Video qo'shish
  $('#add-btn').addEventListener('click', async () => {
    const text = $('#add-links').value;
    if (!text.trim()) return;
    const btn = $('#add-btn');
    btn.disabled = true;
    $('#add-status').style.color = '';
    $('#add-status').textContent = 'Yuklanmoqda...';
    const r = await addLinks(text, $('#add-category').value);
    btn.disabled = false;
    let msg = `✅ ${r.added} ta video qo'shildi.`;
    if (r.dup) msg += ` ${r.dup} tasi oldin bor edi.`;
    if (r.skipped) msg += ` ${r.skipped} tasi filtr bo'yicha o'tkazildi.`;
    if (r.errors.length) msg += '\n⚠️ ' + r.errors.join('\n⚠️ ');
    $('#add-status').style.color = r.errors.length && !r.added ? 'var(--danger)' : '';
    $('#add-status').textContent = msg;
    if (r.added) $('#add-links').value = '';
    renderParentList();
  });

  // Bo'limlar
  $('#cat-add').addEventListener('click', () => {
    const name = $('#cat-new').value.trim();
    if (!name || state.categories.includes(name) || name === ALL) return;
    state.categories.push(name);
    $('#cat-new').value = '';
    save(); renderParent();
  });

  $('#parent-search').addEventListener('input', renderParentList);

  // Sozlamalar
  $('#settings-save').addEventListener('click', () => {
    state.settings.dailyLimitMin = Math.max(0, parseInt($('#set-limit').value, 10) || 0);
    state.settings.hideShorts = $('#set-shorts').checked;
    state.settings.blockedWords = $('#set-words').value.split(',').map((w) => w.trim()).filter(Boolean);
    state.settings.maxImport = Math.min(500, Math.max(1, parseInt($('#set-max').value, 10) || 100));
    save();
    $('#settings-status').textContent = '✅ Saqlandi';
    setTimeout(() => { $('#settings-status').textContent = ''; }, 2000);
  });
  $('#reset-today').addEventListener('click', () => {
    state.usage = { date: today(), seconds: 0 }; save(); $('#used-today').textContent = '0';
  });
  $('#apikey-save').addEventListener('click', () => {
    state.apiKey = $('#set-apikey').value.trim(); save();
    $('#settings-status').textContent = '✅ API kaliti saqlandi';
    setTimeout(() => { $('#settings-status').textContent = ''; }, 2000);
  });
  $('#pin-save').addEventListener('click', () => {
    const p = $('#pin-new').value;
    if (!/^\d{4}$/.test(p)) { $('#pin-status').style.color = 'var(--danger)'; $('#pin-status').textContent = '4 ta raqam kiriting'; return; }
    state.pinHash = hashPin(p); save();
    $('#pin-new').value = '';
    $('#pin-status').style.color = '';
    $('#pin-status').textContent = '✅ PIN o\'zgartirildi';
  });

  // Zaxira
  $('#export-btn').addEventListener('click', () => {
    const data = { app: 'uno-kids', version: 1, categories: state.categories, videos: state.videos, settings: state.settings };
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
          state.videos.push({ id: v.id, title: String(v.title || 'Video'), channel: String(v.channel || ''),
            thumb: thumbUrl(v.id), category: String(v.category || ''), addedAt: v.addedAt || Date.now() });
          ids.add(v.id); n++;
        }
      }
      (data.categories || []).forEach((c) => { if (typeof c === 'string' && !state.categories.includes(c)) state.categories.push(c); });
      save(); renderParent();
      $('#backup-status').textContent = `✅ ${n} ta video import qilindi`;
    } catch (err) {
      $('#backup-status').style.color = 'var(--danger)';
      $('#backup-status').textContent = "Fayl noto'g'ri";
    }
    e.target.value = '';
  });

  // Pleyer boshqaruvi
  $('#ctl-back').addEventListener('click', closePlayer);
  $('#ctl-play').addEventListener('click', togglePlay);
  $('#click-shield').addEventListener('click', togglePlay);
  $('#curtain-play').addEventListener('click', () => player && player.playVideo());
  $('#ctl-next').addEventListener('click', next);
  $('#ctl-prev').addEventListener('click', prev);
  const seek = $('#ctl-seek');
  seek.addEventListener('input', () => { seeking = true; });
  seek.addEventListener('change', () => {
    seeking = false;
    if (player && player.getDuration) player.seekTo((seek.value / 1000) * player.getDuration(), true);
  });
  $('#ctl-full').addEventListener('click', () => {
    const scr = $('#screen-player');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (scr.requestFullscreen) scr.requestFullscreen().catch(() => {});
    else if (scr.webkitRequestFullscreen) scr.webkitRequestFullscreen();
  });

  // Bola rejimida uzoq bosish menyusini o'chirish
  document.addEventListener('contextmenu', (e) => {
    if ($('#screen-parent').hidden) e.preventDefault();
  });
  // Ilova fonga o'tganda pauza
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && player && player.pauseVideo) { player.pauseVideo(); save(); }
  });
}

/* ---------------- Ishga tushirish ---------------- */
function init() {
  buildKeypad();
  bindEvents();
  if (!state.pinHash) showScreen('setup');
  else goKids();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

if (typeof module !== 'undefined') module.exports = { parseYouTube, isoDurationToSec };
else document.addEventListener('DOMContentLoaded', init);
