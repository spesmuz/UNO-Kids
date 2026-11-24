(function () {
  "use strict";

  const D = window.MAKLER_DATA;
  const app = document.getElementById("app");
  const LS_FAV = "makler.favorites";
  const LS_MINE = "makler.myListings";

  // ---------- Saqlash ----------
  const store = {
    get(key, def) { try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; } },
    set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* xotira yopiq */ } },
  };
  let favorites = new Set(store.get(LS_FAV, []));
  const myListings = () => store.get(LS_MINE, []);
  const allListings = () => [...myListings(), ...D.listings];
  const byId = (id) => allListings().find((l) => l.id === id);
  const agentOf = (l) => D.agents.find((a) => a.id === l.agentId) || l.agent;

  // ---------- Yordamchilar ----------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => "$" + Number(n).toLocaleString("ru-RU").replace(/,/g, " ");
  const priceLabel = (l) => money(l.price) + (l.deal === "rent" ? " / oy" : "");
  const ago = (t) => {
    const d = Math.floor((Date.now() - t) / 86400000);
    return d <= 0 ? "Bugun" : d === 1 ? "Kecha" : `${d} kun oldin`;
  };
  const specLine = (l) => [
    l.rooms ? `${l.rooms} xona` : null,
    l.type === "land" ? `${l.land} sotix` : `${l.area} m²`,
    l.floor ? `${l.floor}/${l.floors} qavat` : l.type === "house" ? `${l.floors} qavatli` : null,
  ].filter(Boolean).join(" · ");

  function toast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 2400);
  }

  function updateFavCount() {
    const b = document.getElementById("favCount");
    b.textContent = favorites.size; b.hidden = favorites.size === 0;
  }

  function toggleFav(id) {
    favorites.has(id) ? favorites.delete(id) : favorites.add(id);
    store.set(LS_FAV, [...favorites]);
    updateFavCount();
    return favorites.has(id);
  }

  // ---------- Rasm o'rnini bosuvchi SVG ----------
  function photo(l, i = 0) {
    if (l.images && l.images[i]) return `<img src="${esc(l.images[i])}" alt="" loading="lazy">`;
    const gid = "g" + (++photo.n || (photo.n = 1));
    const h = (l.hue + i * 37) % 360;
    const sky = `hsl(${h},55%,82%)`, sky2 = `hsl(${(h + 30) % 360},60%,92%)`;
    const wall = `hsl(${(h + 180) % 360},25%,${62 + (i % 3) * 6}%)`, roof = `hsl(${(h + 200) % 360},30%,35%)`;
    let scene = "";
    if (i % 3 === 2 && l.type !== "land") {
      // ichki ko'rinish
      scene = `<rect width="400" height="300" fill="hsl(${h},20%,90%)"/><rect y="210" width="400" height="90" fill="hsl(${(h + 30) % 360},30%,62%)"/>
        <rect x="230" y="50" width="120" height="110" fill="${sky}" stroke="#fff" stroke-width="8"/><line x1="290" y1="50" x2="290" y2="160" stroke="#fff" stroke-width="6"/>
        <rect x="40" y="160" width="150" height="60" rx="10" fill="${roof}"/><rect x="40" y="140" width="150" height="35" rx="10" fill="${wall}"/>
        <rect x="250" y="190" width="70" height="30" rx="4" fill="hsl(${h},20%,40%)"/>`;
    } else if (l.type === "flat" || l.type === "office") {
      const fl = Math.max(3, Math.min(l.floors || 5, 9)), w = 150 + (i % 2) * 40, x = 200 - w / 2, top = 270 - fl * 24;
      let win = "";
      for (let r = 0; r < fl; r++) for (let c = 0; c < 4; c++)
        win += `<rect x="${x + 14 + c * ((w - 28) / 4)}" y="${top + 10 + r * 24}" width="${(w - 28) / 4 - 10}" height="13" rx="2" fill="${(r + c + i) % 5 ? "hsl(200,40%,75%)" : "#fde68a"}"/>`;
      scene = `<rect width="400" height="300" fill="url(#${gid})"/><rect x="${x}" y="${top}" width="${w}" height="${280 - top}" fill="${wall}"/>${win}
        <rect x="20" y="${top + 50}" width="60" height="${230 - top}" fill="hsl(${(h + 160) % 360},15%,70%)"/><rect x="320" y="${top + 30}" width="64" height="${250 - top}" fill="hsl(${(h + 140) % 360},15%,74%)"/>
        <rect y="270" width="400" height="30" fill="hsl(100,25%,55%)"/>`;
    } else if (l.type === "house") {
      scene = `<rect width="400" height="300" fill="url(#${gid})"/><rect y="240" width="400" height="60" fill="hsl(100,35%,52%)"/>
        <rect x="110" y="140" width="180" height="110" fill="${wall}"/><path d="M95 145 200 75l105 70z" fill="${roof}"/>
        <rect x="180" y="190" width="40" height="60" fill="hsl(25,45%,35%)"/><rect x="128" y="165" width="36" height="30" fill="hsl(200,40%,75%)"/><rect x="236" y="165" width="36" height="30" fill="hsl(200,40%,75%)"/>
        <circle cx="${50 + i * 8}" cy="200" r="34" fill="hsl(120,35%,38%)"/><rect x="${46 + i * 8}" y="225" width="8" height="25" fill="hsl(25,40%,30%)"/>
        <circle cx="350" cy="210" r="26" fill="hsl(110,35%,42%)"/>`;
    } else {
      scene = `<rect width="400" height="300" fill="url(#${gid})"/><path d="M0 170 Q100 140 200 165 T400 155 V300 H0z" fill="hsl(80,35%,55%)"/>
        <path d="M0 220 Q120 200 240 215 T400 205 V300 H0z" fill="hsl(70,40%,48%)"/>
        <path d="M70 250 l60 -40 l140 10 l-40 50z" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="8 6"/>
        <circle cx="330" cy="60" r="26" fill="#fde68a"/>`;
    }
    return `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky}"/><stop offset="1" stop-color="${sky2}"/></linearGradient></defs>${scene}</svg>`;
  }

  // ---------- Router ----------
  function parseHash() {
    const raw = location.hash.slice(1) || "/";
    const [path, qs] = raw.split("?");
    return { path, params: new URLSearchParams(qs || "") };
  }

  function render() {
    const { path, params } = parseHash();
    const m = path.match(/^\/listing\/(\w+)/);
    document.querySelectorAll(".topnav a").forEach((a) => a.classList.toggle("active", a.getAttribute("href") === location.hash));
    if (m) return renderDetail(m[1]);
    if (path === "/favorites") return renderFavorites();
    if (path === "/new") return renderNew();
    return renderHome(params);
  }

  window.addEventListener("hashchange", () => { render(); window.scrollTo(0, 0); });

  // ---------- Kartochka ----------
  function card(l) {
    const fav = favorites.has(l.id);
    return `<article class="card">
      <a href="#/listing/${l.id}" class="card-img">${photo(l)}
        <span class="tag tag-${l.deal}">${l.deal === "sale" ? "Sotuv" : "Ijara"}</span>
        ${l.top ? '<span class="tag tag-top">TOP</span>' : ""}
        ${l.mine ? '<span class="tag tag-mine">Mening e\'lonim</span>' : ""}
      </a>
      <button class="fav-btn ${fav ? "on" : ""}" data-fav="${l.id}" aria-label="Saralanganlarga qo'shish" aria-pressed="${fav}">${fav ? "♥" : "♡"}</button>
      <a href="#/listing/${l.id}" class="card-body">
        <div class="price">${priceLabel(l)}</div>
        <h3>${esc(l.title)}</h3>
        <div class="spec">${specLine(l)}</div>
        <div class="meta"><span>📍 ${esc(l.city)}</span><span>${ago(l.createdAt)}</span></div>
      </a>
    </article>`;
  }

  function bindFavButtons(root) {
    root.querySelectorAll("[data-fav]").forEach((b) => b.addEventListener("click", (e) => {
      e.preventDefault();
      const on = toggleFav(b.dataset.fav);
      b.classList.toggle("on", on); b.textContent = on ? "♥" : "♡"; b.setAttribute("aria-pressed", on);
      toast(on ? "Saralanganlarga qo'shildi" : "Saralanganlardan olib tashlandi");
      if (parseHash().path === "/favorites") renderFavorites();
    }));
  }

  // ---------- Bosh sahifa ----------
  function filterListings(p) {
    const q = (p.get("q") || "").toLowerCase().trim();
    const n = (k) => (p.get(k) ? Number(p.get(k)) : null);
    const pmin = n("pmin"), pmax = n("pmax"), amin = n("amin"), amax = n("amax");
    const rooms = p.get("rooms");
    let list = allListings().filter((l) =>
      (!p.get("deal") || l.deal === p.get("deal")) &&
      (!p.get("city") || l.city === p.get("city")) &&
      (!p.get("type") || l.type === p.get("type")) &&
      (!rooms || (rooms === "5" ? l.rooms >= 5 : l.rooms === Number(rooms))) &&
      (pmin == null || l.price >= pmin) && (pmax == null || l.price <= pmax) &&
      (amin == null || l.area >= amin) && (amax == null || l.area <= amax) &&
      (!q || [l.title, l.district, l.city, l.description].join(" ").toLowerCase().includes(q))
    );
    const sort = p.get("sort") || "new";
    const sorters = {
      new: (a, b) => (b.top - a.top) || b.createdAt - a.createdAt,
      cheap: (a, b) => a.price - b.price,
      expensive: (a, b) => b.price - a.price,
      area: (a, b) => b.area - a.area,
    };
    return list.sort(sorters[sort] || sorters.new);
  }

  const opt = (v, label, cur) => `<option value="${esc(v)}" ${cur === v ? "selected" : ""}>${esc(label)}</option>`;

  function renderHome(p) {
    const deal = p.get("deal") || "";
    const list = filterListings(p);
    const val = (k) => esc(p.get(k) || "");
    const activeCount = ["city", "type", "rooms", "pmin", "pmax", "amin", "amax", "q"].filter((k) => p.get(k)).length;

    app.innerHTML = `
      <section class="hero">
        <div class="wrap">
          <h1>Uy-joyni oson toping</h1>
          <p class="hero-sub">O'zbekiston bo'ylab ${allListings().length} ta e'lon: kvartira, hovli, ofis va yer uchastkalari</p>
          <form class="search" id="searchForm">
            <div class="seg" role="tablist">
              ${[["", "Hammasi"], ["sale", "Sotib olish"], ["rent", "Ijaraga olish"]].map(([v, t]) =>
                `<button type="button" role="tab" class="${deal === v ? "on" : ""}" data-deal="${v}" aria-selected="${deal === v}">${t}</button>`).join("")}
            </div>
            <div class="search-row">
              <input name="q" type="search" placeholder="Tuman, ko'cha yoki kalit so'z..." value="${val("q")}" aria-label="Qidiruv">
              <select name="city" aria-label="Shahar">${opt("", "Barcha shaharlar", p.get("city") || "")}${Object.keys(D.cities).map((c) => opt(c, c, p.get("city"))).join("")}</select>
              <select name="type" aria-label="Mulk turi">${opt("", "Barcha turlar", p.get("type") || "")}${Object.entries(D.types).map(([k, t]) => opt(k, t, p.get("type"))).join("")}</select>
              <button class="btn btn-primary" type="submit">Qidirish</button>
            </div>
          </form>
        </div>
      </section>

      <section class="wrap results">
        <aside class="filters" id="filters">
          <div class="filters-head"><h2>Filtr</h2>${activeCount ? `<a href="#/${deal ? "?deal=" + deal : ""}" class="link">Tozalash</a>` : ""}</div>
          <form id="filterForm">
            <label>Xonalar soni</label>
            <div class="chips">${["", "1", "2", "3", "4", "5"].map((r) =>
              `<label class="chip"><input type="radio" name="rooms" value="${r}" ${(p.get("rooms") || "") === r ? "checked" : ""}><span>${r === "" ? "Farqi yo'q" : r === "5" ? "5+" : r}</span></label>`).join("")}</div>
            <label>Narx, $</label>
            <div class="range"><input name="pmin" type="number" min="0" placeholder="dan" value="${val("pmin")}"><input name="pmax" type="number" min="0" placeholder="gacha" value="${val("pmax")}"></div>
            <label>Maydon, m²</label>
            <div class="range"><input name="amin" type="number" min="0" placeholder="dan" value="${val("amin")}"><input name="amax" type="number" min="0" placeholder="gacha" value="${val("amax")}"></div>
            <button class="btn btn-primary btn-block" type="submit">Natijalarni ko'rsatish</button>
          </form>
        </aside>

        <div class="results-main">
          <div class="results-bar">
            <div><strong>${list.length}</strong> ta e'lon topildi</div>
            <div class="results-tools">
              <button class="btn btn-ghost filter-toggle" id="filterToggle">⚙ Filtr${activeCount ? ` (${activeCount})` : ""}</button>
              <select id="sortSel" aria-label="Saralash">
                ${opt("new", "Avval yangilari", p.get("sort") || "new")}${opt("cheap", "Avval arzonlari", p.get("sort"))}${opt("expensive", "Avval qimmatlari", p.get("sort"))}${opt("area", "Maydon bo'yicha", p.get("sort"))}
              </select>
            </div>
          </div>
          ${list.length ? `<div class="grid">${list.map(card).join("")}</div>` :
            `<div class="empty"><div class="empty-ico">🔍</div><h3>Hech narsa topilmadi</h3><p class="muted">Filtrlarni o'zgartirib ko'ring.</p><a href="#/" class="btn btn-ghost">Barcha e'lonlar</a></div>`}
        </div>
      </section>`;

    const go = (changes) => {
      const np = new URLSearchParams(p);
      Object.entries(changes).forEach(([k, v]) => (v === "" || v == null ? np.delete(k) : np.set(k, v)));
      const s = np.toString();
      location.hash = "#/" + (s ? "?" + s : "");
    };
    const formVals = (form) => Object.fromEntries(new FormData(form).entries());

    app.querySelectorAll("[data-deal]").forEach((b) => b.addEventListener("click", () => go({ deal: b.dataset.deal })));
    document.getElementById("searchForm").addEventListener("submit", (e) => { e.preventDefault(); go(formVals(e.target)); });
    document.getElementById("filterForm").addEventListener("submit", (e) => { e.preventDefault(); go({ rooms: "", ...formVals(e.target) }); });
    document.getElementById("sortSel").addEventListener("change", (e) => go({ sort: e.target.value === "new" ? "" : e.target.value }));
    document.getElementById("filterToggle").addEventListener("click", () => document.getElementById("filters").classList.toggle("open"));
    bindFavButtons(app);
  }

  // ---------- E'lon sahifasi ----------
  function renderDetail(id) {
    const l = byId(id);
    if (!l) {
      app.innerHTML = `<div class="wrap empty"><div class="empty-ico">🏚️</div><h3>E'lon topilmadi</h3><p class="muted">U o'chirilgan yoki manzil noto'g'ri.</p><a href="#/" class="btn btn-ghost">Bosh sahifaga</a></div>`;
      return;
    }
    const a = agentOf(l) || {};
    const fav = favorites.has(l.id);
    const n = l.images?.length || l.photos || 4;
    const specs = [
      ["Bitim turi", l.deal === "sale" ? "Sotuv" : "Ijara"],
      ["Mulk turi", D.types[l.type]],
      ["Shahar", l.city], ["Tuman", l.district],
      l.rooms ? ["Xonalar", l.rooms] : null,
      l.type !== "land" ? ["Umumiy maydon", `${l.area} m²`] : null,
      l.land ? ["Yer maydoni", `${l.land} sotix`] : null,
      l.floor ? ["Qavat", `${l.floor} / ${l.floors}`] : l.floors ? ["Qavatlar", l.floors] : null,
      ["E'lon raqami", "№" + l.id],
    ].filter(Boolean);
    const perM2 = l.deal === "sale" && l.type !== "land" ? `<div class="muted small">${money(Math.round(l.price / l.area))} / m²</div>` : "";
    const similar = allListings().filter((x) => x.id !== l.id && x.type === l.type && x.deal === l.deal && x.city === l.city).slice(0, 4);
    const initials = (a.name || "?").split(" ").map((s) => s[0]).join("").slice(0, 2);

    app.innerHTML = `
      <div class="wrap detail">
        <nav class="crumbs"><a href="#/">Bosh sahifa</a> › <a href="#/?deal=${l.deal}">${l.deal === "sale" ? "Sotuv" : "Ijara"}</a> › <a href="#/?deal=${l.deal}&city=${encodeURIComponent(l.city)}">${esc(l.city)}</a></nav>
        <div class="detail-grid">
          <div>
            <div class="gallery">
              <div class="gallery-main" id="gMain">${photo(l, 0)}</div>
              <div class="gallery-thumbs">${Array.from({ length: n }, (_, i) => `<button class="${i ? "" : "on"}" data-i="${i}" aria-label="Rasm ${i + 1}">${photo(l, i)}</button>`).join("")}</div>
            </div>
            <h1 class="detail-title">${esc(l.title)}</h1>
            <div class="muted">📍 ${esc(l.city)}, ${esc(l.district)} · ${ago(l.createdAt)} · 👁 ${l.views || 0}</div>
            <div class="pills">${specLine(l).split(" · ").map((s) => `<span class="pill">${s}</span>`).join("")}</div>
            <h2>Tavsif</h2>
            <p class="desc">${esc(l.description)}</p>
            ${l.amenities?.length ? `<h2>Qulayliklar</h2><ul class="amen">${l.amenities.map((x) => `<li>✓ ${esc(x)}</li>`).join("")}</ul>` : ""}
            <h2>Ma'lumotlar</h2>
            <dl class="specs">${specs.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
          </div>
          <aside class="side">
            <div class="box">
              <div class="price big">${priceLabel(l)}</div>${perM2}
              <div class="agent">
                <div class="avatar">${esc(initials)}</div>
                <div><strong>${esc(a.name)}</strong><div class="muted small">${esc(a.agency || "Xususiy shaxs")}${a.deals ? ` · ${a.deals} ta bitim` : ""}</div></div>
              </div>
              <button class="btn btn-primary btn-block" id="showPhone">📞 Raqamni ko'rsatish</button>
              ${a.tg ? `<a class="btn btn-tg btn-block" href="https://t.me/${esc(a.tg)}" target="_blank" rel="noopener">✈ Telegramda yozish</a>` : ""}
              <button class="btn btn-ghost btn-block fav-detail ${fav ? "on" : ""}" id="favDetail">${fav ? "♥ Saralanganda" : "♡ Saralanganlarga"}</button>
              <button class="btn btn-ghost btn-block" id="shareBtn">↗ Ulashish</button>
              ${l.mine ? `<button class="btn btn-danger btn-block" id="delBtn">🗑 E'lonni o'chirish</button>` : ""}
            </div>
            <p class="muted small safety">⚠ Oldindan pul o'tkazmang. Mulkni ko'rmasdan va hujjatlarini tekshirmasdan bitim tuzmang.</p>
          </aside>
        </div>
        ${similar.length ? `<h2 class="similar-title">O'xshash e'lonlar</h2><div class="grid">${similar.map(card).join("")}</div>` : ""}
      </div>`;

    app.querySelectorAll(".gallery-thumbs button").forEach((b) => b.addEventListener("click", () => {
      document.getElementById("gMain").innerHTML = photo(l, Number(b.dataset.i));
      app.querySelectorAll(".gallery-thumbs button").forEach((x) => x.classList.toggle("on", x === b));
    }));
    document.getElementById("showPhone").addEventListener("click", (e) => {
      const btn = e.currentTarget;
      if (btn.dataset.shown) { location.href = "tel:" + (a.phone || "").replace(/\s/g, ""); return; }
      btn.dataset.shown = 1; btn.textContent = "📞 " + (a.phone || "—");
    });
    document.getElementById("favDetail").addEventListener("click", (e) => {
      const on = toggleFav(l.id);
      e.currentTarget.classList.toggle("on", on);
      e.currentTarget.textContent = on ? "♥ Saralanganda" : "♡ Saralanganlarga";
    });
    document.getElementById("shareBtn").addEventListener("click", async () => {
      const url = location.href;
      try {
        if (navigator.share) await navigator.share({ title: l.title, url });
        else { await navigator.clipboard.writeText(url); toast("Havola nusxalandi"); }
      } catch { /* bekor qilindi */ }
    });
    const del = document.getElementById("delBtn");
    if (del) del.addEventListener("click", () => {
      if (!confirm("E'lonni o'chirasizmi?")) return;
      store.set(LS_MINE, myListings().filter((x) => x.id !== l.id));
      toast("E'lon o'chirildi");
      location.hash = "#/";
    });
    bindFavButtons(app);
  }

  // ---------- Saralanganlar ----------
  function renderFavorites() {
    const list = allListings().filter((l) => favorites.has(l.id));
    app.innerHTML = `<div class="wrap page">
      <h1>Saralangan e'lonlar</h1>
      ${list.length ? `<div class="grid">${list.map(card).join("")}</div>` :
        `<div class="empty"><div class="empty-ico">♡</div><h3>Hozircha bo'sh</h3><p class="muted">Yoqqan e'lonlardagi ♡ tugmasini bosing — ular shu yerda saqlanadi.</p><a href="#/" class="btn btn-primary">E'lonlarni ko'rish</a></div>`}
    </div>`;
    bindFavButtons(app);
  }

  // ---------- E'lon joylash ----------
  function renderNew() {
    app.innerHTML = `<div class="wrap page narrow">
      <h1>Yangi e'lon joylash</h1>
      <p class="muted">Prototip: e'lon faqat shu brauzerda saqlanadi.</p>
      <form id="newForm" class="form" novalidate>
        <fieldset><legend>Asosiy</legend>
          <div class="seg seg-form">
            <label><input type="radio" name="deal" value="sale" checked><span>Sotaman</span></label>
            <label><input type="radio" name="deal" value="rent"><span>Ijaraga beraman</span></label>
          </div>
          <div class="row2">
            <div><label for="f-type">Mulk turi</label><select id="f-type" name="type">${Object.entries(D.types).map(([k, t]) => `<option value="${k}">${t}</option>`).join("")}</select></div>
            <div><label for="f-city">Shahar</label><select id="f-city" name="city">${Object.keys(D.cities).map((c) => `<option>${c}</option>`).join("")}</select></div>
          </div>
          <label for="f-district">Tuman / mahalla</label><select id="f-district" name="district"></select>
        </fieldset>
        <fieldset><legend>Parametrlar</legend>
          <div class="row3">
            <div data-for="flat house"><label for="f-rooms">Xonalar</label><input id="f-rooms" name="rooms" type="number" min="1" max="20" value="2"></div>
            <div data-for="flat house office"><label for="f-area">Maydon, m²</label><input id="f-area" name="area" type="number" min="5" required></div>
            <div data-for="house land"><label for="f-land">Yer, sotix</label><input id="f-land" name="land" type="number" min="1"></div>
            <div data-for="flat office"><label for="f-floor">Qavat</label><input id="f-floor" name="floor" type="number" min="1"></div>
            <div data-for="flat house office"><label for="f-floors">Binoda qavatlar</label><input id="f-floors" name="floors" type="number" min="1"></div>
          </div>
          <label>Qulayliklar</label>
          <div class="chips">${D.amenities.map((x) => `<label class="chip"><input type="checkbox" name="amenities" value="${esc(x)}"><span>${esc(x)}</span></label>`).join("")}</div>
        </fieldset>
        <fieldset><legend>Narx va tavsif</legend>
          <label for="f-price">Narx, $ <span class="muted small" id="priceHint"></span></label><input id="f-price" name="price" type="number" min="1" required>
          <label for="f-title">Sarlavha <span class="muted small">(bo'sh qoldirsangiz avtomatik)</span></label><input id="f-title" name="title" maxlength="90">
          <label for="f-desc">Tavsif</label><textarea id="f-desc" name="description" rows="5" maxlength="2000" required placeholder="Ta'mir holati, atrofdagi infratuzilma, hujjatlar..."></textarea>
          <label for="f-photos">Rasmlar <span class="muted small">(6 tagacha)</span></label><input id="f-photos" type="file" accept="image/*" multiple>
          <div class="previews" id="previews"></div>
        </fieldset>
        <fieldset><legend>Aloqa</legend>
          <div class="row2">
            <div><label for="f-name">Ismingiz</label><input id="f-name" name="name" required autocomplete="name"></div>
            <div><label for="f-phone">Telefon</label><input id="f-phone" name="phone" type="tel" required placeholder="+998 90 123 45 67" autocomplete="tel"></div>
          </div>
          <label for="f-tg">Telegram <span class="muted small">(ixtiyoriy)</span></label><input id="f-tg" name="tg" placeholder="username">
        </fieldset>
        <div class="form-error" id="formErr" hidden></div>
        <button class="btn btn-primary btn-block btn-lg" type="submit">E'lonni joylash</button>
      </form>
    </div>`;

    const f = document.getElementById("newForm");
    const fillDistricts = () => { f.district.innerHTML = D.cities[f.city.value].map((d) => `<option>${esc(d)}</option>`).join(""); };
    const syncType = () => {
      const t = f.type.value;
      f.querySelectorAll("[data-for]").forEach((el) => (el.hidden = !el.dataset.for.split(" ").includes(t)));
      f.querySelector('[value="rent"]').disabled = t === "land";
      if (t === "land") f.querySelector('[value="sale"]').checked = true;
      syncDeal();
    };
    const syncDeal = () => { document.getElementById("priceHint").textContent = f.deal.value === "rent" ? "(oyiga)" : ""; };
    f.city.addEventListener("change", fillDistricts);
    f.type.addEventListener("change", syncType);
    f.querySelectorAll('[name="deal"]').forEach((r) => r.addEventListener("change", syncDeal));
    fillDistricts(); syncType();

    let images = [];
    document.getElementById("f-photos").addEventListener("change", async (e) => {
      const files = [...e.target.files].slice(0, 6);
      images = (await Promise.all(files.map(shrinkImage))).filter(Boolean);
      document.getElementById("previews").innerHTML = images.map((src) => `<img src="${src}" alt="">`).join("");
    });

    f.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(f);
      const t = fd.get("type");
      const num = (k) => (fd.get(k) ? Number(fd.get(k)) : null);
      const errs = [];
      const area = t === "land" ? (num("land") || 0) * 100 : num("area");
      if (t !== "land" && !area) errs.push("maydonni");
      if (t === "land" && !num("land")) errs.push("yer maydonini");
      if (!num("price")) errs.push("narxni");
      if (!fd.get("description").trim()) errs.push("tavsifni");
      if (!fd.get("name").trim()) errs.push("ismingizni");
      if (!/^\+?[\d\s()-]{9,}$/.test(fd.get("phone").trim())) errs.push("to'g'ri telefon raqamini");
      const err = document.getElementById("formErr");
      if (errs.length) { err.textContent = "Iltimos, " + errs.join(", ") + " kiriting."; err.hidden = false; err.scrollIntoView({ behavior: "smooth", block: "center" }); return; }

      const rooms = ["flat", "house"].includes(t) ? num("rooms") || 0 : 0;
      const district = fd.get("district");
      const autoTitle =
        t === "flat" ? `${rooms} xonali kvartira, ${district}` :
        t === "house" ? `${rooms} xonali hovli${num("land") ? `, ${num("land")} sotix` : ""}, ${district}` :
        t === "office" ? `Tijorat binosi ${area} m², ${district}` : `Yer uchastka ${num("land")} sotix, ${district}`;
      const l = {
        id: "u" + Date.now().toString(36),
        mine: true,
        deal: fd.get("deal"), type: t, city: fd.get("city"), district,
        title: fd.get("title").trim() || autoTitle,
        price: num("price"), currency: "USD",
        rooms, area,
        floor: ["flat", "office"].includes(t) ? num("floor") : null,
        floors: t !== "land" ? num("floors") : null,
        land: ["house", "land"].includes(t) ? num("land") : null,
        amenities: fd.getAll("amenities"),
        description: fd.get("description").trim(),
        agent: { name: fd.get("name").trim(), phone: fd.get("phone").trim(), tg: fd.get("tg").trim().replace(/^@/, ""), agency: "Xususiy shaxs" },
        createdAt: Date.now(), views: 0,
        hue: Math.floor(Math.random() * 360), photos: 4,
        images,
      };
      try {
        localStorage.setItem(LS_MINE, JSON.stringify([l, ...myListings()]));
      } catch {
        err.textContent = "Brauzer xotirasi to'ldi. Kamroq yoki kichikroq rasm tanlang."; err.hidden = false; return;
      }
      toast("E'lon joylandi!");
      location.hash = "#/listing/" + l.id;
    });
  }

  // Rasmni kichraytirib, localStorage'ga sig'adigan qilish
  function shrinkImage(file) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const max = 900, s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        resolve(c.toDataURL("image/jpeg", 0.72));
      };
      img.onerror = () => resolve("");
      img.src = URL.createObjectURL(file);
    });
  }

  updateFavCount();
  render();
})();
