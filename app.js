"use strict";
/* ============ Idiomas ============ */
const LANGS = {
  pt: { name: "Português", locale: "pt-PT" },
  en: { name: "English", locale: "en-GB" },
  es: { name: "Español", locale: "es-ES" },
  fr: { name: "Français", locale: "fr-FR" },
  de: { name: "Deutsch", locale: "de-DE" },
};
let lang = "pt", UI = {}, UIpt = {}, C = {}, Cpt = {};
const jget = async path => { const r = await fetch(path); if (!r.ok) throw new Error(path); return r.json(); };
async function loadLang(l) {
  if (!LANGS[l]) l = "pt";
  if (!UIpt.appName) { [UIpt, Cpt] = await Promise.all([jget("i18n/ui-pt.json"), jget("i18n/content-pt.json")]); }
  if (l === "pt") { UI = UIpt; C = Cpt; }
  else { try { [UI, C] = await Promise.all([jget(`i18n/ui-${l}.json`), jget(`i18n/content-${l}.json`)]); } catch { UI = UIpt; C = Cpt; l = "pt"; } }
  lang = l;
  document.documentElement.lang = LANGS[l].locale;
}
function t(key, vars = {}) {
  let v = UI[key] ?? UIpt[key] ?? key;
  if (Array.isArray(v)) v = v[vars.n === 1 ? 0 : 1];
  return String(v).replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
}
const locale = () => LANGS[lang].locale;
const tiersOf = key => (C.tiers && C.tiers[key]) || Cpt.tiers[key];
const tierOf = (n, key) => tiersOf(key)[n - 1] || { name: "", desc: "", ex: "" };
const typeName = k => (C.types && C.types[k]) || Cpt.types[k] || k;
const country = p => (C.countries && C.countries[p]) || p;
const dispName = n => (C.names && C.names[n]) || n;
const factOf = d => (C.facts && C.facts[d.name]) || (Cpt.facts && Cpt.facts[d.name]) || d.facto;
const histOf = d => (C.hist && C.hist[d.name]) || (Cpt.hist && Cpt.hist[d.name]) || "";
function applyI18n() {
  document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-ph]").forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  document.title = t("appName");
  const md = document.querySelector('meta[name="description"]'); if (md) md.content = t("appDesc");
  $("plateCv").setAttribute("aria-label", t("plateAria"));
}

/* ============ Básicos ============ */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const MODES = { rua: { coll: "cars" }, expo: { coll: "expo" } };
const MAXT = 10;
let mode = "rua";
try { const m = localStorage.getItem("caderneta-modo"); if (["rua", "expo", "dex", "friends", "me"].includes(m)) mode = m; } catch {}
const tierVar = c => c === 10 ? "" : `--c: var(--t${c})`;
const badgeOf = (n, key) => `<span class="badge t${n}" style="${tierVar(n)}"><i>${n}</i>${esc(tierOf(n, key === "expo" ? "expo" : "rua").name)}</span>`;
const badge = n => badgeOf(n, mode);
const data = { rua: [], expo: [] }, loadedM = { rua: false, expo: false };
let filter = null, dbOk = null, lastShown = [];
let pickedBlob = null, confirmId = null, saving = false;
const cars = () => data[mode] || [];
const nf = n => Number(n).toLocaleString(locale());
function fmtDate(d) {
  if (!d) return "";
  try { return new Intl.DateTimeFormat(locale(), { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(d.length === 10 ? d + "T12:00:00" : d)); } catch { return d; }
}
const ptsOf = list => list.reduce((s, c) => s + (+c.raridade || 0), 0);

/* ============ Armazenamento no telemóvel (IndexedDB) ============ */
const urlCache = new Map();
const blobUrl = id => urlCache.get(id) || "";
const Store = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open("caderneta-carros", 2);
    r.onupgradeneeded = () => {
      const d = r.result;
      for (const s of ["docs", "photos", "meta", "friends"]) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s);
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  const run = async (store, md, fn) => {
    const d = await open();
    return new Promise((res, rej) => {
      const tx = d.transaction(store, md), s = tx.objectStore(store);
      let out; const r = fn(s);
      if (r) r.onsuccess = () => { out = r.result; };
      tx.oncomplete = () => res(out);
      tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error);
    });
  };
  const entries = async store => {
    const d = await open();
    return new Promise((res, rej) => {
      const out = [], r = d.transaction(store).objectStore(store).openCursor();
      r.onsuccess = () => { const c = r.result; if (c) { out.push([c.key, c.value]); c.continue(); } else res(out); };
      r.onerror = () => rej(r.error);
    });
  };
  return {
    get: (store, key) => run(store, "readonly", s => s.get(key)),
    put: (store, key, val) => run(store, "readwrite", s => s.put(val, key)),
    del: (store, key) => run(store, "readwrite", s => s.delete(key)),
    entries,
  };
})();
const newId = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
async function loadCars() {
  const docs = (await Store.entries("docs")).map(e => e[1]);
  for (const k of ["rua", "expo"]) {
    data[k] = docs.filter(x => x.coll === MODES[k].coll)
      .map(x => ({ id: x.id, ...x.data, src: k }))
      .filter(c => c.raridade >= 1 && c.raridade <= MAXT)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    loadedM[k] = true;
  }
}
async function loadPhotos() {
  for (const [id, blob] of await Store.entries("photos")) if (!urlCache.has(id)) urlCache.set(id, URL.createObjectURL(blob));
}
async function addCar(coll, carData) { const id = newId("c"); await Store.put("docs", coll + "/" + id, { coll, id, data: carData }); return id; }
async function deleteCar(coll, id) { await Store.del("docs", coll + "/" + id); }
async function savePhoto(blob) { const id = newId("p"); await Store.put("photos", id, blob); urlCache.set(id, URL.createObjectURL(blob)); return id; }
async function deletePhoto(id) { await Store.del("photos", id); const u = urlCache.get(id); if (u) URL.revokeObjectURL(u); urlCache.delete(id); }

/* ============ Perfil ============ */
const AVATARS = ["🏎️", "🚗", "🚙", "🚕", "🛻", "🚓", "🚐", "🚌", "🏍️", "🚜", "🏁", "🛞", "🔧", "⛽", "🚦", "🏆", "⭐", "🔥", "⚡", "🐎", "🐂", "🦄", "🐉", "🚀"];
const AVCOLORS = ["#1F46C4", "#C93A6E", "#23855F", "#C05E0A", "#6447D0", "#D4A72C", "#0E8C9B", "#14181D"];
let profile = null;
const safeAv = a => AVATARS.includes(a) ? a : AVATARS[0];
function renderMe() {
  if (!profile) { $("meBtn").hidden = true; return; }
  $("meBtn").hidden = false; $("meAv").textContent = safeAv(profile.avatar); $("meNick").textContent = profile.nick;
  $("meAv").style.background = profile.avColor || "var(--bg)";
  $("meBtn").setAttribute("aria-label", t("tabMe"));
}
let wState = null;
function openWelcome(edit) {
  wState = { edit, lang, avatar: profile ? safeAv(profile.avatar) : AVATARS[0], avColor: profile?.avColor || AVCOLORS[0] };
  $("wNick").value = profile ? profile.nick : "";
  renderWelcome(); $("welcome").hidden = false; document.body.style.overflow = "hidden";
  setTimeout(() => $("wNick").focus(), 50);
}
function renderWelcome() {
  $("wTitle").textContent = wState.edit ? t("profileTitle") : t("welcomeTitle");
  $("wText").textContent = wState.edit ? "" : t("welcomeText"); $("wText").hidden = wState.edit;
  $("wGo").textContent = wState.edit ? t("saveProfile") : t("start");
  $("wCancel").hidden = !wState.edit;
  $("langPick").innerHTML = Object.entries(LANGS).map(([k, v]) => `<button type="button" class="chip" data-l="${k}" aria-pressed="${k === lang}">${esc(v.name)}</button>`).join("");
  $("avPick").innerHTML = AVATARS.map(a => `<button type="button" class="avb" data-a="${a}" aria-pressed="${a === wState.avatar}" aria-label="${a}">${a}</button>`).join("");
  $("colPick").innerHTML = AVCOLORS.map(c => `<button type="button" class="colb" data-c="${c}" aria-pressed="${c === wState.avColor}" style="background:${c}" aria-label="${c}"></button>`).join("");
  $("wMsg").hidden = true;
  renderPreviewCard(false);
}
$("langPick").addEventListener("click", async e => {
  const b = e.target.closest("[data-l]"); if (!b || b.dataset.l === lang) return;
  await loadLang(b.dataset.l); applyI18n(); renderWelcome(); refreshAll();
});
$("avPick").addEventListener("click", e => { const b = e.target.closest("[data-a]"); if (!b) return; wState.avatar = b.dataset.a;
  document.querySelectorAll("#avPick .avb").forEach(x => x.setAttribute("aria-pressed", x.dataset.a === wState.avatar)); renderPreviewCard("av"); });
$("colPick").addEventListener("click", e => { const b = e.target.closest("[data-c]"); if (!b) return; wState.avColor = b.dataset.c;
  document.querySelectorAll("#colPick .colb").forEach(x => x.setAttribute("aria-pressed", x.dataset.c === wState.avColor)); renderPreviewCard("col"); });
let prevNick = "";
function renderPreviewCard(what) {
  const nick = $("wNick").value.replace(/\s+/g, " ").trimStart().slice(0, 20);
  const pc = $("wCard");
  pc.style.setProperty("--avc", wState.avColor);
  $("wcAv").textContent = wState.avatar;
  const grew = nick.length > prevNick.length && nick.startsWith(prevNick);
  $("wcNick").innerHTML = nick ? [...nick].map((ch, i) => `<span class="${grew && i >= prevNick.length ? "pop" : ""}">${ch === " " ? "&nbsp;" : esc(ch)}</span>`).join("") : `<span class="ph">${esc(t("nickPh"))}</span>`;
  if (grew && !reduceMotion) {
    for (let i = 0; i < 3; i++) { const sp = document.createElement("i"); sp.className = "spark"; sp.textContent = ["✨", "⭐", "💥", "🏁"][Math.floor(Math.random() * 4)];
      sp.style.left = (30 + Math.random() * 60) + "%"; sp.style.top = (20 + Math.random() * 50) + "%"; pc.appendChild(sp); setTimeout(() => sp.remove(), 900); }
  }
  if (what && !reduceMotion) { const a = $("wcAv"); a.classList.remove("bounce"); void a.offsetWidth; a.classList.add("bounce"); }
  prevNick = nick;
}
$("wNick").addEventListener("input", () => renderPreviewCard(false));
$("wGo").addEventListener("click", async () => {
  const nick = $("wNick").value.replace(/\s+/g, " ").trim().slice(0, 20);
  if (!nick) { $("wMsg").textContent = t("needNick"); $("wMsg").hidden = false; return; }
  const first = !profile;
  profile = { uid: profile?.uid || newId("u"), nick, avatar: wState.avatar, avColor: wState.avColor, lang, created: profile?.created || new Date().toISOString() };
  try { await Store.put("meta", "profile", profile); } catch {}
  try { localStorage.setItem("caderneta-lang", lang); } catch {}
  $("welcome").hidden = true; document.body.style.overflow = "";
  renderMe(); refreshAll(); checkGame();
  let seen = false; try { seen = localStorage.getItem("tut-visto") === "1"; } catch {}
  if (first && !seen) openTutorial();
});
$("wCancel").addEventListener("click", async () => {
  if (profile && profile.lang !== lang) { await loadLang(profile.lang); applyI18n(); refreshAll(); }
  $("welcome").hidden = true; document.body.style.overflow = "";
});
$("meBtn").addEventListener("click", () => setMode("me"));
$("lvlBar").addEventListener("click", () => setMode("me"));

/* ============ Separadores ============ */
function setMode(m) {
  mode = m; filter = null; confirmId = null;
  try { localStorage.setItem("caderneta-modo", m); } catch {}
  $("addPanel").hidden = true;
  resetCounters(); applyMode(); render();
}
function applyMode() {
  document.querySelectorAll(".tab").forEach(b => b.setAttribute("aria-selected", b.dataset.mode === mode ? "true" : "false"));
  const isCad = mode === "rua" || mode === "expo";
  $("cadView").hidden = !isCad; $("dexView").hidden = mode !== "dex"; $("friendsView").hidden = mode !== "friends"; $("playerView").hidden = mode !== "me";
  $("openAdd").hidden = !isCad;
  $("meBtn").setAttribute("aria-pressed", mode === "me" ? "true" : "false");
  if (!isCad) { $("sub").textContent = mode === "dex" ? (C.modeSub || Cpt.modeSub).dex : mode === "me" ? t("meSub") : t("friendsSub"); return; }
  $("sub").textContent = (C.modeSub || Cpt.modeSub)[mode];
  $("scale").style.setProperty("--n", MAXT);
  $("scaleLow").textContent = tierOf(1, mode).name; $("scaleHigh").textContent = tierOf(MAXT, mode).name;
  $("guideTitle").textContent = t("guideTitle", { n: MAXT });
  $("addTitle").textContent = mode === "rua" ? t("newCarRua") : t("newCarExpo");
  $("guide").innerHTML = tiersOf(mode).map((x, i) => `<li>${badge(i + 1)}<div>${esc(x.desc)}<small>${esc(x.ex)}</small></div></li>`).join("");
  updateTierNow();
}
document.querySelector(".tabs").addEventListener("click", e => { const b = e.target.closest(".tab"); if (b && b.dataset.mode !== mode) setMode(b.dataset.mode); });

/* ============ Escala ============ */
function renderScale() {
  const counts = Array(11).fill(0);
  cars().forEach(c => counts[c.raridade]++);
  $("scale").innerHTML = tiersOf(mode).map((x, i) => {
    const n = i + 1, k = counts[n];
    return `<button type="button" class="seg ${k ? "has" : ""} ${filter === n ? "on" : ""}" data-t="${n}" data-c="${n}" style="${tierVar(n)}" aria-label="${esc(t("levelAria", { n, t: x.name, k }))}">
      <span class="bar">${k || ""}</span><span class="lvl">${n}</span></button>`;
  }).join("");
  const fn = $("filterNote");
  if (filter) { fn.hidden = false; fn.innerHTML = `${esc(t("showingOnly"))} ${badge(filter)} <button class="linkbtn" type="button" id="clearF">${esc(t("seeAll"))}</button>`; }
  else fn.hidden = true;
}
$("scale").addEventListener("click", e => { const b = e.target.closest(".seg"); if (!b) return; const n = +b.dataset.t; filter = filter === n ? null : n; render(); });
$("filterNote").addEventListener("click", e => { if (e.target.id === "clearF") { filter = null; render(); } });

/* ============ Marcadex ============ */
function caughtMapOf(list) {
  const m = new Map();
  list.forEach(c => { const d = DEX_BY_KEY[norm(c.fabricante || c.marca)]; if (d) { if (!m.has(d.num)) m.set(d.num, []); m.get(d.num).push(c); } });
  return m;
}
const caughtMap = () => caughtMapOf([...data.rua, ...data.expo]);
const initials = n => n.replace(/&/g, " ").split(/[\s-]+/).filter(Boolean).map(w => w[0]).join("").slice(0, 2).toUpperCase();
let dexF = "all", dexT = null, dexQ = "";
function renderDex() {
  const got = caughtMap();
  countTo($("dexCount"), got.size); $("dexTotal").textContent = DEX.length;
  growBar($("dexBar"), (got.size / DEX.length * 100).toFixed(1) + "%");
  const ready = loadedM.rua && loadedM.expo; let k = 0;
  $("dexTypes").innerHTML = Object.keys(TYPES).map(key =>
    `<button class="chip" type="button" data-t="${key}" aria-pressed="${dexT === key}" style="--ty: var(--ty-${key})"><span class="dot"></span>${esc(typeName(key))}</button>`).join("");
  document.querySelectorAll("#dexFilter .chip").forEach(c => c.setAttribute("aria-pressed", c.dataset.f === dexF ? "true" : "false"));
  const q = norm(dexQ);
  const list = DEX.filter(d => (dexF === "all" || (dexF === "got") === got.has(d.num)) && (!dexT || d.tipo === dexT) && (!q || norm(d.name).includes(q)));
  if (!list.length) { $("dexGrid").innerHTML = `<div class="empty" style="grid-column:1/-1"><b>${esc(t("noBrand"))}</b>${esc(t("tryOther"))}</div>`; return; }
  $("dexGrid").innerHTML = list.map(d => {
    const cs = got.get(d.num), num = "#" + String(d.num).padStart(3, "0");
    const total = (MODELS[d.name] || []).length;
    if (!cs) return `<button type="button" class="dex locked" data-num="${d.num}" style="--ty: var(--ty-${d.tipo})">
      <div class="top"><span class="num">${num}</span><span class="type">${esc(typeName(d.tipo))}</span></div>
      <div class="mono" aria-hidden="true">?</div>
      <h3>${esc(d.name)}</h3><span class="meta">${esc(country(d.pais))}</span>
      <span class="lock">${esc(t("toCatch"))}</span><span class="mc">${esc(t("modelsN", { a: 0, b: total }))}</span></button>`;
    const models = [...new Set(cs.slice().sort((a, b) => b.raridade - a.raridade).map(c => c.modelo).filter(Boolean))];
    const gotM = new Set(cs.map(c => matchModel(d.name, c.modelo)).filter(x => x != null)).size;
    const isNew = ready && !dexSeenFresh && !dexSeen.has(d.name);
    const delay = isNew ? `; --d: ${Math.min(k++, 12) * 0.07}s` : "";
    return `<button type="button" class="dex${isNew ? " unlock" : ""}" data-num="${d.num}" style="--ty: var(--ty-${d.tipo})${delay}">
      <div class="top"><span class="num">${num}</span>${isNew ? `<span class="newtag">${esc(t("newTag"))}</span>` : ""}<span class="type ${d.tipo}">${esc(typeName(d.tipo))}</span></div>
      <div class="mono ${d.tipo}" aria-hidden="true">${esc(initials(d.name))}</div>
      <h3>${esc(d.name)}</h3><span class="meta">${esc(country(d.pais))} · ${esc(t("since", { y: d.ano }))}</span>
      <p>${esc(factOf(d))}</p>
      <div class="seen">${esc(t("caughtTimes", { n: cs.length, list: models.slice(0, 3).join(", ") + (models.length > 3 ? "…" : "") }))}</div>
      <span class="mc">${esc(t("modelsN", { a: gotM, b: total }))}</span></button>`;
  }).join("");
  if (ready) { got.forEach((_, n) => dexSeen.add(DEX[n - 1].name)); dexSeenFresh = false; saveDexSeen(); }
  if (typeof renderDexExtra === "function") renderDexExtra();
}
$("dexGrid").addEventListener("click", e => { const b = e.target.closest(".dex"); if (b) ovPush({ type: "brand", num: +b.dataset.num }); });
$("dexFilter").addEventListener("click", e => { const c = e.target.closest(".chip"); if (c) { dexF = c.dataset.f; renderDex(); } });
$("dexTypes").addEventListener("click", e => { const c = e.target.closest(".chip"); if (c) { dexT = dexT === c.dataset.t ? null : c.dataset.t; renderDex(); } });
$("dexSearch").addEventListener("input", () => { dexQ = $("dexSearch").value; renderDex(); });

/* ============ Animações ============ */
const reduceMotion = (() => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } })();
function countTo(el, to) {
  const from = el._v ?? 0; el._v = to;
  cancelAnimationFrame(el._raf);
  if (reduceMotion || from === to) { el.textContent = nf(to); return; }
  const t0 = performance.now(), dur = Math.min(1400, 500 + Math.abs(to - from) * 6);
  const step = tm => { const k = Math.min(1, (tm - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    el.textContent = nf(Math.round(from + (to - from) * e)); if (k < 1) el._raf = requestAnimationFrame(step); };
  el._raf = requestAnimationFrame(step);
}
function growBar(el, pct) {
  if (!el) return;
  if (el._p == null && !reduceMotion) { el.style.transition = "none"; el.style.width = "0%"; void el.offsetWidth; el.style.transition = ""; }
  requestAnimationFrame(() => { el.style.width = pct; }); el._p = pct;
}
function popPoints(n) {
  if (reduceMotion || n <= 0) return;
  const host = $("sPts").parentElement, sp = document.createElement("span");
  sp.className = "pop"; sp.textContent = "+" + n; host.appendChild(sp); setTimeout(() => sp.remove(), 1700);
}
let dexSeen = new Set();
try { const v2 = localStorage.getItem("dex-vistas2"); dexSeen = new Set(v2 ? JSON.parse(v2) : []); } catch {}
let dexSeenFresh = (() => { try { return !localStorage.getItem("dex-vistas2"); } catch { return true; } })();
function saveDexSeen() { try { localStorage.setItem("dex-vistas2", JSON.stringify([...dexSeen])); } catch {} }
let lastPts = null;
function resetCounters() { ["sCount", "sPts", "dexCount"].forEach(id => { $(id)._v = 0; }); $("dexBar")._p = null; lastPts = null; }

/* ============ Revelar carta nova ============ */
let rvTimers = [];
function showReveal(c, photoUrl, newBrand, newModel) {
  const col = +c.raridade;
  $("rv").style.setProperty("--c", col === 10 ? "#b77bff" : `var(--t${col})`);
  $("rvFront").className = "rv-face rv-front" + (col === 10 ? " uni" : "");
  $("rvFront").innerHTML = `<div class="ph">${photoUrl ? `<img src="${esc(photoUrl)}" alt="">` : `<span class="none">${esc(t("noPhoto"))}</span>`}</div>
    <div class="bd"><div>${badgeOf(c.raridade, c.src)}</div>${c.marca ? `<span class="brand">${esc(c.marca)}</span>` : ""}<h3>${esc(c.modelo || t("noName"))}</h3></div>`;
  const tierName = tierOf(c.raridade, c.src).name;
  $("rvMsg").innerHTML = `<b>${esc(t("plusPts", { n: c.raridade }))}</b><span>${esc(t(c.src === "expo" ? "rvInExpo" : "rvInRua", { tier: tierName }))}</span>${newBrand ? `<span class="nb">${esc(t("newBrand", { b: newBrand }))}</span>` : newModel ? `<span class="nb">${esc(t("newModelRv", { m: newModel }))}</span>` : ""}`;
  const card = $("rvCard"), rv = $("rv");
  card.className = "rv-card"; rv.classList.remove("done"); rv.hidden = false; document.body.style.overflow = "hidden";
  rvTimers.forEach(clearTimeout); rvTimers = [];
  if (reduceMotion) { card.classList.add("flip"); rv.classList.add("done"); }
  else {
    void card.offsetWidth; card.classList.add("wiggle");
    rvTimers.push(setTimeout(() => { card.classList.remove("wiggle"); card.classList.add("flip"); if (typeof vib === "function") vib(c.raridade >= 7 ? [40, 60, 40, 60, 160] : [30, 50, 60]); if (typeof sfx === "function") sfx(c.raridade >= 7 ? "rare" : "flip"); }, 1050));
    rvTimers.push(setTimeout(() => rv.classList.add("done"), 1700));
  }
  $("rvOk").focus();
}
function closeReveal() { rvTimers.forEach(clearTimeout); $("rv").hidden = true; document.body.style.overflow = $("ov").hidden ? "" : "hidden"; }
$("rvOk").addEventListener("click", closeReveal);
document.addEventListener("keydown", e => { if (!$("rv").hidden && e.key === "Escape") closeReveal(); });

/* ============ Fichas técnicas ============ */
function specOf(b, m, v) {
  const key = `${b}|${m}|${v || ""}`, base = SPECS[key];
  if (!base) return null;
  return { ...base, ...((C.specs && C.specs[key]) || {}) };
}
const valorTxt = s => s.valor_min != null && s.valor_max != null ? t("range", { a: nf(s.valor_min) + " €", b: nf(s.valor_max) + " €" }) : (s.valor_min != null ? `${nf(s.valor_min)} €` : "");
const z100 = s => s.zero100 != null ? `${Number(s.zero100).toLocaleString(locale(), { maximumFractionDigits: 1 })} s` : "";
function specForCar(c) {
  const d = DEX_BY_KEY[norm(c.fabricante || c.marca)]; if (!d) return null;
  const mi = matchModel(d.name, c.modelo); if (mi == null) return null;
  const m = MODELS[d.name][mi], vi = matchVersion(d.name, mi, c.modelo);
  return (vi != null && specOf(d.name, m.name, m.vers[vi].name)) || specOf(d.name, m.name, "");
}
function specLine(s) {
  return [s.cv != null ? `${nf(s.cv)} ${t("hp")}` : "", s.vmax != null ? s.vmax + " km/h" : "", s.zero100 != null ? t("zeroTo", { s: z100(s) }) : "", valorTxt(s) ? t("worth", { v: valorTxt(s) }) : ""].filter(Boolean).join(" · ");
}
function specHtml(s) {
  const clamp = x => Math.max(0.04, Math.min(1, x));
  const avg = s.valor_min != null && s.valor_max != null ? (s.valor_min + s.valor_max) / 2 : s.valor_min;
  const bars = [
    [t("power"), s.cv != null ? `${nf(s.cv)} ${t("hp")}` : "", s.cv != null ? clamp(s.cv / 1600) : 0, "#e4572e"],
    [t("speed"), s.vmax != null ? `${s.vmax} km/h` : "", s.vmax != null ? clamp((s.vmax - 60) / 440) : 0, "#2f72c4"],
    [t("accel"), s.zero100 != null ? t("zeroTo", { s: z100(s) }) : "", s.zero100 != null ? clamp((20 - s.zero100) / 18) : 0, "#23855f"],
    [t("value"), avg != null ? valorTxt(s) : "", avg ? clamp((Math.log10(avg) - 3) / 4.2) : 0, "#d4a72c"],
  ].filter(b => b[1]);
  const kv = [[t("gen"), s.geracao], [t("years"), s.anos], [t("engine"), s.motor], [t("drive"), s.tracao ? t("drive_" + s.tracao) : ""], [t("units"), s.unidades]].filter(r => r[1]);
  return `<div class="spec">
    <div class="stats2">${bars.map(b => `<div class="st"><span class="lab">${esc(b[0])}</span><span class="tr"><span data-w="${(b[2] * 100).toFixed(1)}" style="--sc:${b[3]}"></span></span><b>${esc(b[1])}</b></div>`).join("")}</div>
    <dl class="kv">${kv.map(r => `<dt>${esc(r[0])}</dt><dd>${esc(r[1])}</dd>`).join("")}</dl>
    ${s.valor_nota ? `<span class="vn">${esc(t("approxValue", { v: s.valor_nota }))}</span>` : ""}
    ${s.curiosidade ? `<p class="cur">${esc(s.curiosidade)}</p>` : ""}</div>`;
}
function growSpecBars() {
  const els = document.querySelectorAll("#ovBody .st .tr span[data-w]");
  if (reduceMotion) { els.forEach(e => e.style.width = e.dataset.w + "%"); return; }
  requestAnimationFrame(() => requestAnimationFrame(() => els.forEach(e => e.style.width = e.dataset.w + "%")));
}
document.addEventListener("toggle", e => { if (e.target.matches && e.target.matches("details.vspec") && e.target.open) growSpecBars(); }, true);

/* ============ Janela (foto em grande, marca, modelo, amigo) ============ */
const ovStack = [];
let ovReturn = null;
function ovPush(v) { if (!ovStack.length) ovReturn = document.activeElement; ovStack.push(v); renderOv(); }
function ovPop() { ovStack.pop(); renderOv(); if (!ovStack.length && ovReturn && ovReturn.focus) { try { ovReturn.focus(); } catch {} } }
function renderOv(keepScroll) {
  const v = ovStack[ovStack.length - 1];
  $("ov").hidden = !v; document.body.style.overflow = v ? "hidden" : "";
  if (!v) return;
  $("ovClose").textContent = ovStack.length > 1 ? t("back") : t("close");
  if (v.type === "car") renderCarView(v); else if (v.type === "model") renderModelView(v); else if (v.type === "friend") renderFriendView(v); else if (typeof OV_EXTRA !== "undefined" && OV_EXTRA[v.type]) OV_EXTRA[v.type](v); else renderBrandView(v);
  if (!keepScroll) $("ov").scrollTop = 0;
  if (!keepScroll) $("ovClose").focus();
}
function renderCarView(v) {
  const c = v.list[v.i];
  $("ovTitle").textContent = (v.owner ? v.owner + " · " : "") + (c.src === "expo" ? t("tabExpo") : t("tabRua"));
  const meta = [fmtDate(c.data), c.local].filter(Boolean).map(esc).join(" · ");
  const s = specForCar(c), col = +c.raridade;
  const u = c.foto ? blobUrl(c.foto) : "";
  $("ovBody").innerHTML = `<div style="display:flex;flex-direction:column;gap:16px;align-items:center">
    <div class="holo-wrap"><div class="holo${col === 10 ? " uni" : col >= 7 ? " rare" : col >= 5 ? " foil" : ""}" style="${tierVar(col)}">
      <div class="chead"><span class="cname"><small>${esc(c.marca || "")}</small><b>${esc(c.modelo || t("noName"))}</b></span><span class="cnum">${dexNum(c)}</span></div>
      <div class="hph">${u ? `<img src="${u}" alt="${esc(c.marca)} ${esc(c.modelo)}">` : `<span class="none">${esc(t("noPhoto"))}</span>`}</div>
      <div class="cfoot">${badgeOf(c.raridade, c.src)}<span class="pips" aria-hidden="true">${"<i></i>".repeat(Math.min(10, col))}</span></div>
      ${s ? `<div class="hstats">${[[t("power"), s.cv != null ? `${nf(s.cv)} ${t("hp")}` : ""], [t("speed"), s.vmax != null ? `${s.vmax} km/h` : ""], ["0–100", s.zero100 != null ? z100(s) : ""]].filter(x => x[1]).map(([k, x]) => `<span><small>${esc(k)}</small><b>${esc(x)}</b></span>`).join("")}</div>` : ""}
      <span class="glare" aria-hidden="true"></span>
    </div></div>
    ${!v.owner && (data[c.src] || []).some(x => x.id === c.id) ? `<div class="actions" style="justify-content:center"><button class="btn ghost" type="button" data-fav="${esc(c.id)}">${esc(c.fav ? t("unfav") : t("fav"))}</button><button class="btn ghost" type="button" data-edit="${esc(c.id)}">✏️ ${esc(t("edit"))}</button><button class="btn ghost" type="button" data-sharecard="1">${esc(t("shareCard"))}</button></div>` : ""}
    ${s && typeof openCompare === "function" ? `<div class="actions" style="justify-content:center;margin-top:-6px"><button class="btn ghost" type="button" data-cmp="1">⚖️ ${esc(t("compare"))}</button></div>` : ""}
    <div class="lb-info" style="width:100%">
      ${meta ? `<span class="meta">${meta}</span>` : ""}
      ${c.nota ? `<p>${esc(c.nota)}</p>` : ""}
      ${s && valorTxt(s) ? `<div class="lb-spec">${esc(t("worth", { v: valorTxt(s) }))}</div>` : ""}
    </div>
    ${v.list.length > 1 ? `<div class="lb-nav" style="width:100%">
      <button class="btn ghost" type="button" data-step="-1" ${v.i === 0 ? "disabled" : ""}>${esc(t("prev"))}</button>
      <span>${v.i + 1} / ${v.list.length}</span>
      <button class="btn ghost" type="button" data-step="1" ${v.i === v.list.length - 1 ? "disabled" : ""}>${esc(t("next"))}</button></div>` : ""}
  </div>`;
  if (typeof tiltHandlers === "function") tiltHandlers();
}
const rBadge = n => `<span class="rb">${badgeOf(n, "rua")}</span>`;
const sortBest = arr => arr.slice().sort((a, b) => (b.raridade - a.raridade) || (!!b.foto - !!a.foto));
function brandBuckets(d) {
  const cs = caughtMap().get(d.num) || [], models = MODELS[d.name] || [];
  const buckets = models.map(() => []), others = [];
  cs.forEach(c => { const i = matchModel(d.name, c.modelo); (i == null ? others : buckets[i]).push(c); });
  return { cs, models, buckets: buckets.map(sortBest), others: sortBest(others) };
}
function tileHtml(name, arr, attr, r) {
  const best = sortBest(arr), f = best.find(c => c.foto && blobUrl(c.foto));
  if (!arr.length) return `<button type="button" class="mt locked" ${attr}><div class="th">${r ? rBadge(r) : ""}<span class="q">?</span></div><div class="tx"><b>${esc(name)}</b><small>${esc(t("toCatch"))}</small></div></button>`;
  return `<button type="button" class="mt" ${attr}>
    <div class="th">${r ? rBadge(r) : ""}${f ? `<img src="${blobUrl(f.foto)}" alt="" loading="lazy">` : `<span class="q">✓</span>`}</div>
    <div class="tx"><b>${esc(name)}</b><small>${esc(t("caughtN", { n: arr.length }))}</small></div></button>`;
}
function renderBrandView(v) {
  const d = DEX[v.num - 1];
  const { cs, models, buckets, others } = brandBuckets(d);
  const gotN = buckets.filter(b => b.length).length;
  v._others = others;
  $("ovTitle").textContent = "Marcadex";
  $("ovBody").innerHTML = `<div style="display:flex;flex-direction:column;gap:14px">
    <div class="bh" style="--ty: var(--ty-${d.tipo})">
      <div class="mono ${cs.length ? d.tipo : "lockd"}" aria-hidden="true">${cs.length ? esc(initials(d.name)) : "?"}</div>
      <div><span class="num">#${String(d.num).padStart(3, "0")} · ${esc(typeName(d.tipo))}</span><h2>${esc(d.name)}</h2>
      <span class="meta">${esc(country(d.pais))}${cs.length ? ` · ${esc(t("since", { y: d.ano }))}` : ""}</span></div>
    </div>
    <p class="bfact">${esc(cs.length ? factOf(d) : t("brandLocked"))}</p>
    <h3 class="sect">${esc(t("history"))}</h3>
    <p class="hist ${cs.length ? "" : "lockd"}">${esc(cs.length ? histOf(d) : t("histLocked"))}</p>
    <div class="dexhead"><div class="dexprog"><b>${gotN}</b> / ${models.length} ${esc(t("modelsCaught"))}</div>
      <div class="pbar"><span id="brandBar"></span></div></div>
    <p class="meta" style="margin:0;color:var(--muted);font-size:13px">${esc(t("modelHint"))}</p>
    <div class="mgrid">${models.map((m, i) => tileHtml(dispName(m.name), buckets[i], `data-m="${i}"`, m.r)).join("")}</div>
    ${others.length ? `<h3 class="sect">${esc(t("otherModels"))}</h3><div class="mgrid">${others.map((c, i) => tileHtml(c.modelo || t("noName"), [c], `data-o="${i}"`, 0)).join("")}</div>` : ""}
  </div>`;
  growBar($("brandBar"), (models.length ? (gotN / models.length * 100).toFixed(1) : 0) + "%");
}
function renderModelView(v) {
  const d = DEX[v.num - 1], m = (MODELS[d.name] || [])[v.mi];
  const { buckets } = brandBuckets(d);
  const mine = buckets[v.mi] || [];
  const vb = m.vers.map(() => []);
  mine.forEach(c => { const i = matchVersion(d.name, v.mi, c.modelo); if (i != null) vb[i].push(c); });
  v._mine = mine; v._vb = vb.map(sortBest);
  const gotV = vb.filter(b => b.length).length;
  const ms = specOf(d.name, m.name, "");
  const vs = m.vers.map(ver => [ver, specOf(d.name, m.name, ver.name)]).filter(x => x[1]);
  const specBlock = (!ms && !vs.length) ? `<p class="meta" style="margin:0;color:var(--muted);font-size:13px">${esc(t("noSpec"))}</p>`
    : `<h3 class="sect">${esc(t("specTitle"))}</h3>${ms ? specHtml(ms) : ""}
      ${vs.map(([ver, s]) => `<details class="vspec"${!ms && vs.length === 1 ? " open" : ""}><summary>${esc(dispName(ver.name))} <small>${esc([s.cv != null ? nf(s.cv) + " " + t("hp") : "", s.vmax != null ? s.vmax + " km/h" : ""].filter(Boolean).join(" · "))}</small></summary>${specHtml(s)}</details>`).join("")}`;
  $("ovTitle").textContent = "Marcadex";
  $("ovBody").innerHTML = `<div style="display:flex;flex-direction:column;gap:14px">
    <div class="mh"><span class="num">${esc(t("modelOf", { b: d.name, i: v.mi + 1, n: MODELS[d.name].length }))}</span><h2>${esc(dispName(m.name))}</h2>
      <div class="rr">${badgeOf(m.r, "rua")}<span>${esc(t("rarityStreet"))}</span></div>
      ${!mine.length && typeof wishBtn === "function" ? wishBtn(d.name, m.name) : ""}</div>
    ${specBlock}
    ${m.vers.length ? `<div class="dexhead"><div class="dexprog"><b>${gotV}</b> / ${m.vers.length} ${esc(t("versionsCaught"))}</div><div class="pbar"><span id="modelBar"></span></div></div>
      <div class="mgrid">${m.vers.map((ver, i) => tileHtml(dispName(ver.name), vb[i], `data-v="${i}"`, ver.r)).join("")}</div>` : `<p class="meta" style="margin:0;color:var(--muted)">${esc(t("noVersions"))}</p>`}
    <h3 class="sect">${esc(t("yourModels", { m: dispName(m.name) }))}</h3>
    ${mine.length ? `<div class="mgrid">${v._mine.map((c, i) => tileHtml(c.modelo || m.name, [c], `data-c="${i}"`, 0)).join("")}</div>` : `<p class="meta" style="margin:0;color:var(--muted)">${esc(t("notCaughtModel"))}</p>`}
  </div>`;
  if (m.vers.length) growBar($("modelBar"), (gotV / m.vers.length * 100).toFixed(1) + "%");
  growSpecBars();
}
$("ovBody").addEventListener("click", e => {
  const v = ovStack[ovStack.length - 1]; if (!v) return;
  if (typeof OV_CLICK !== "undefined" && OV_CLICK[v.type]) { OV_CLICK[v.type](e, v); return; }
  if (e.target.closest("[data-cmp]") && v.type === "car" && typeof openCompare === "function") { openCompare(v.list[v.i]); return; }
  const st = e.target.closest("[data-step]");
  if (st && v.type === "car") { v.i = Math.max(0, Math.min(v.list.length - 1, v.i + +st.dataset.step)); renderOv(); return; }
  if (v.type === "friend") { onFriendViewClick(e, v); return; }
  const fe = e.target.closest("[data-edit]");
  if (fe && v.type === "car") { const c = v.list[v.i]; openEdit(c); return; }
  if (e.target.closest("[data-sharecard]") && v.type === "car") { shareCard(v.list[v.i]); return; }
  const ff = e.target.closest("[data-fav]");
  if (ff && v.type === "car") { toggleFav(v); return; }
  const mt = e.target.closest("button.mt"); if (!mt) return;
  const ds = mt.dataset;
  if (v.type === "brand") {
    if (ds.m != null) ovPush({ type: "model", num: v.num, mi: +ds.m });
    else if (ds.o != null) ovPush({ type: "car", list: v._others, i: +ds.o });
  } else if (v.type === "model") {
    if (ds.v != null) { if (v._vb[+ds.v].length) ovPush({ type: "car", list: v._vb[+ds.v], i: 0 }); }
    else if (ds.c != null) ovPush({ type: "car", list: v._mine, i: +ds.c });
  }
});
$("ovClose").addEventListener("click", ovPop);
$("ov").addEventListener("click", e => { if (e.target === $("ov")) { ovStack.length = 0; renderOv(); } });
document.addEventListener("keydown", e => {
  if ($("ov").hidden) return;
  if (e.key === "Escape") ovPop();
  const v = ovStack[ovStack.length - 1];
  if (v && v.type === "car" && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
    v.i = Math.max(0, Math.min(v.list.length - 1, v.i + (e.key === "ArrowRight" ? 1 : -1))); renderOv();
  }
});

async function toggleFav(v) {
  const c = v.list[v.i], coll = MODES[c.src].coll;
  const { id, src, ...rest } = c;
  const d = { ...rest }; if (c.fav) delete d.fav; else d.fav = true;
  try {
    await Store.put("docs", coll + "/" + id, { coll, id, data: d });
    await loadCars();
    const fresh = (data[src] || []).find(x => x.id === id);
    if (fresh) v.list[v.i] = fresh;
    renderOv(true); render();
    if (!c.fav && typeof toast === "function") toast({ icon: "⭐", title: t("vitrine"), text: `${c.marca} ${c.modelo}`.trim() });
  } catch {}
}
/* ============ Lista da caderneta ============ */
function refreshAll() {
  applyMode(); render(); renderMe(); if (typeof renderLevelBar === "function") renderLevelBar(); renderColorPick();
  if (!$("ov").hidden) renderOv(true);
}
function render() {
  const nBrands = caughtMap().size;
  $("cnt-rua").textContent = t("nCars", { n: data.rua.length });
  $("cnt-expo").textContent = t("nCars", { n: data.expo.length });
  $("cnt-dex").textContent = t("nBrandsOf", { a: nBrands, b: DEX.length });
  $("cnt-friends").textContent = t("nFriends", { n: friends.length });
  if (typeof checkGame === "function") checkGame();
  if (mode === "dex") { renderDex(); return; }
  if (mode === "friends") { renderFriends(); return; }
  if (mode === "me") { if (typeof renderPlayer === "function") renderPlayer(); return; }
  if (typeof renderMemory === "function") { renderMemory(); renderSession(); }
  renderScale();
  const cs = cars();
  countTo($("sCount"), cs.length);
  const top = cs.reduce((m, c) => Math.max(m, c.raridade || 0), 0);
  $("sTop").textContent = top ? t("lvlShort", { n: top }) : "–";
  const pts = ptsOf(cs);
  if (loadedM[mode]) { if (lastPts != null && pts > lastPts) popPoints(pts - lastPts); lastPts = pts; }
  countTo($("sPts"), pts);
  const list = $("list");
  if (!loadedM[mode]) { list.innerHTML = `<div class="empty"><b>${esc(t("opening"))}</b>${dbOk === false ? esc(t("loadFail")) : ""}</div>`; return; }
  if (!cs.length) { list.innerHTML = `<div class="empty"><b>${esc(t("emptyTitle"))}</b>${esc(t("emptyText"))}</div>`; return; }
  const q = norm($("qCars").value);
  let shown = filter ? cs.filter(c => c.raridade === filter) : cs;
  if (q) shown = shown.filter(c => norm([c.marca, c.modelo, c.nota, c.local].join(" ")).includes(q));
  if (!shown.length) {
    if (q) { list.innerHTML = `<div class="empty"><b>${esc(t("noResults"))}</b>${esc(t("noResultsText"))}</div>`; return; }
    const x = tierOf(filter, mode); list.innerHTML = `<div class="empty"><b>${esc(t("noneTier", { t: x.name }))}</b>${esc(t("keepLooking", { ex: x.ex }))}</div>`; return;
  }
  const sort = $("sortCars").value || "rar";
  if (sort === "rar") { lastShown = groupedHtmlList(shown); list.innerHTML = groupedHtml(shown, true); }
  else {
    const dt = c => c.data ? Date.parse(c.data + "T12:00:00") || c.createdAt || 0 : c.createdAt || 0;
    const arr = shown.slice().sort(sort === "new" ? (a, b) => dt(b) - dt(a) : sort === "old" ? (a, b) => dt(a) - dt(b)
      : (a, b) => (a.marca || "").localeCompare(b.marca || "", locale()) || (a.modelo || "").localeCompare(b.modelo || "", locale()));
    lastShown = arr; list.innerHTML = `<div class="grid">${arr.map(c => card(c, true)).join("")}</div>`;
  }
}
function groupBy(shown) {
  const groups = {};
  shown.forEach(c => (groups[c.raridade] ||= []).push(c));
  return Object.keys(groups).map(Number).sort((a, b) => b - a).map(n => [n, groups[n]]);
}
const groupedHtmlList = shown => groupBy(shown).flatMap(g => g[1]);
function groupedHtml(shown, editable) {
  return groupBy(shown).map(([n, arr]) => `
    <div class="group">
      <div class="group-head">${badgeOf(n, arr[0].src)}<small>${esc(t("nCars", { n: arr.length }))}</small></div>
      <div class="grid">${arr.map(c => card(c, editable)).join("")}</div>
    </div>`).join("");
}
function cardStats(c) {
  const sp = specForCar(c);
  return sp ? [sp.cv != null ? `${nf(sp.cv)} ${t("hp")}` : "", sp.vmax != null ? `${sp.vmax} km/h` : ""].filter(Boolean) : [];
}
function dexNum(c) { const d = DEX_BY_KEY[norm(c.fabricante || c.marca)]; return d ? "#" + String(d.num).padStart(3, "0") : ""; }
function card(c, editable) {
  const u = c.foto ? blobUrl(c.foto) : "";
  const img = u ? `<img src="${u}" alt="${esc(c.marca)} ${esc(c.modelo)}" loading="lazy" onerror="this.remove()">` : "";
  const meta = [fmtDate(c.data), c.local].filter(Boolean).map(esc).join(" · ");
  const col = +c.raridade, fx = col === 10 ? " uni shine" : col >= 7 ? " rare shine" : col >= 5 ? " foil" : "";
  const st = cardStats(c), num = dexNum(c);
  return `<article class="card${fx}" style="${tierVar(col)}" data-id="${esc(c.id)}" tabindex="0" aria-label="${esc(t("viewBig", { c: (c.marca + " " + c.modelo).trim() }))}">
    <div class="cframe">
      <div class="chead"><span class="cname"><small>${esc(c.marca || "")}</small><b>${esc(c.modelo || t("noName"))}</b></span><span class="cnum">${num}</span></div>
      <div class="ph"><span class="none">${esc(t("noPhoto"))}</span>${img}${c.cor ? `<i class="cdot" style="background:${COLORS[c.cor] || "#999"}" title="${esc(t("col_" + c.cor))}"></i>` : ""}</div>
      <div class="cfoot">${badgeOf(c.raridade, c.src)}<span class="pips" aria-hidden="true">${"<i></i>".repeat(Math.min(10, col))}</span></div>
      ${st.length ? `<div class="cstats">${st.map(x => `<span>${esc(x)}</span>`).join("")}</div>` : ""}
    </div>
    <div class="bd">
      ${meta ? `<span class="meta">${meta}</span>` : ""}
      ${c.nota ? `<p>${esc(c.nota)}</p>` : ""}
      ${editable ? `<div class="cact"><button type="button" class="edt" data-id="${esc(c.id)}">${esc(t("edit"))}</button><button type="button" class="del" data-id="${esc(c.id)}">${esc(t("remove"))}</button></div>` : ""}
    </div>
  </article>`;
}
function openCardFrom(el) { const i = lastShown.findIndex(c => c.id === el.dataset.id); if (i >= 0) ovPush({ type: "car", list: lastShown.slice(), i }); }
$("list").addEventListener("keydown", e => { const c = e.target.closest(".card"); if (c && (e.key === "Enter" || e.key === " ") && e.target === c) { e.preventDefault(); openCardFrom(c); } });
$("list").addEventListener("click", async e => {
  const ed = e.target.closest(".edt");
  if (ed) { const car = cars().find(c => c.id === ed.dataset.id); if (car) openEdit(car); return; }
  const b = e.target.closest(".del");
  if (!b) { const c = e.target.closest(".card"); if (c) openCardFrom(c); return; }
  const id = b.dataset.id, coll = MODES[mode].coll;
  const car = cars().find(c => c.id === id); if (!car) return;
  try {
    const doc = await Store.get("docs", coll + "/" + id);
    const photo = car.foto ? await Store.get("photos", car.foto) : null;
    await deleteCar(coll, id);
    if (car.foto) await Store.del("photos", car.foto);
    await loadCars(); render(); renderBackupBar();
    if (typeof offerUndo === "function" && doc) offerUndo({ doc, photoId: car.foto || "", photo });
  } catch { alertMsg(t("delFail")); }
});
$("qCars").addEventListener("input", () => render());
$("sortCars").addEventListener("change", () => { try { localStorage.setItem("ordem", $("sortCars").value); } catch {} render(); });
try { const o = localStorage.getItem("ordem"); if (o) $("sortCars").value = o; } catch {}
function alertMsg(x) { const m = $("formMsg"); m.textContent = x; m.hidden = false; }

/* ============ Formulário ============ */
let formSrc = "rua", editing = null, tierTouched = false;
function updateTierNow() {
  const n = +$("fTier").value;
  $("tierNow").innerHTML = `${badgeOf(n, formSrc)} <span>${esc(tierOf(n, formSrc).desc)}</span>`;
}
$("fTier").addEventListener("input", () => { tierTouched = true; updateTierNow(); });
function setFormSrc(src) {
  formSrc = src === "expo" ? "expo" : "rua";
  document.querySelectorAll("#srcPick button").forEach(b => b.setAttribute("aria-pressed", b.dataset.s === formSrc ? "true" : "false"));
  $("addTitle").textContent = editing ? t("editTitle") : formSrc === "rua" ? t("newCarRua") : t("newCarExpo");
  updateTierNow(); suggest();
}
$("srcPick").addEventListener("click", e => { const b = e.target.closest("[data-s]"); if (b) setFormSrc(b.dataset.s); });
/* sugestões ao escrever */
function fillModelList() {
  const d = DEX_BY_KEY[norm($("fBrand").value)];
  if (!d || $("modelList")._brand === d.name) return;
  $("modelList")._brand = d.name;
  const opts = [];
  (MODELS[d.name] || []).forEach(m => { opts.push(m.name); m.vers.forEach(v => opts.push(`${m.name} ${v.name}`)); });
  $("modelList").innerHTML = opts.map(o => `<option value="${esc(o)}">`).join("");
}
function suggest() {
  const box = $("suggest"); if (!box) return;
  const marca = $("fBrand").value.trim(), modelo = $("fModel").value.trim();
  const d = DEX_BY_KEY[norm(marca)];
  if (!d) { box.hidden = true; return; }
  const parts = [];
  const others = [...data.rua, ...data.expo].filter(c => !editing || c.id !== editing.id);
  const caught = caughtMapOf(others);
  if (!caught.has(d.num)) parts.push(`<span class="sg new">${esc(t("newBrandHint"))}</span>`);
  if (modelo) {
    const mi = matchModel(d.name, modelo);
    if (mi != null) {
      const m = MODELS[d.name][mi], vi = matchVersion(d.name, mi, modelo);
      const r = vi != null ? m.vers[vi].r : m.r;
      if (formSrc === "rua") {
        parts.push(`<span class="sg">${esc(t("sugRar"))} ${badgeOf(r, "rua")}</span>`);
        if (!tierTouched && !editing) { $("fTier").value = r; updateTierNow(); }
      }
      const same = (caught.get(d.num) || []).filter(c => matchModel(d.name, c.modelo) === mi).length;
      const todayD = new Date().toDateString();
      if (!editing && (caught.get(d.num) || []).some(c => matchModel(d.name, c.modelo) === mi && c.createdAt && new Date(c.createdAt).toDateString() === todayD))
        parts.push(`<span class="sg warn">${esc(t("dupWarn", { m: dispName(m.name) }))}</span>`);
      if (caught.has(d.num)) parts.push(`<span class="sg${same ? "" : " new"}">${esc(same ? t("haveModel", { n: same }) : t("newModel"))}</span>`);
    }
  }
  box.innerHTML = parts.join(""); box.hidden = !parts.length;
}
$("fBrand").addEventListener("input", () => { fillModelList(); suggest(); });
$("fModel").addEventListener("input", suggest);
let pickedColor = "";
function renderColorPick() {
  const el = $("colorPick"); if (!el) return;
  el.innerHTML = Object.keys(COLORS).map(k => `<button type="button" class="colb sm" data-k="${k}" aria-pressed="${pickedColor === k}" title="${esc(t("col_" + k))}" aria-label="${esc(t("col_" + k))}" style="background:${COLORS[k]}"></button>`).join("");
}
$("colorPick").addEventListener("click", e => { const b = e.target.closest("[data-k]"); if (!b) return; pickedColor = pickedColor === b.dataset.k ? "" : b.dataset.k; renderColorPick(); });
function resetForm() {
  editing = null; tierTouched = false;
  pickedColor = ""; renderColorPick();
  $("fCam").value = "";
  try { $("useGps").checked = localStorage.getItem("usar-gps") === "1"; } catch {}
  ["fBrand", "fModel", "fPlace", "fNote"].forEach(id => $(id).value = "");
  $("fPhoto").value = ""; $("fTier").value = 2;
  $("fDate").value = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  $("plateBox").hidden = true; plateHist = []; updatePlateUi(); $("formMsg").hidden = true;
  pickedBlob = null; setFormSrc(mode === "expo" ? "expo" : "rua");
}
$("openAdd").addEventListener("click", () => { resetForm(); $("addPanel").hidden = false; $("openAdd").hidden = true; $("addPanel").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" }); });
async function openEdit(c) {
  ovStack.length = 0; renderOv();
  if (mode !== c.src) setMode(c.src);
  resetForm();
  editing = { id: c.id, src: c.src, foto: c.foto || "", createdAt: c.createdAt, lat: c.lat, lng: c.lng, fav: c.fav, fabricante: c.fabricante };
  tierTouched = true;
  $("fBrand").value = c.marca || ""; $("fModel").value = c.modelo || ""; $("fPlace").value = c.local || ""; $("fNote").value = c.nota || "";
  $("fDate").value = c.data || ""; $("fTier").value = c.raridade || 1;
  pickedColor = c.cor || ""; renderColorPick(); $("useGps").checked = false;
  setFormSrc(c.src); fillModelList(); suggest();
  if (c.foto) { try { const blob = await Store.get("photos", c.foto); if (blob) await loadPlateEditor(blob); } catch {} }
  $("addPanel").hidden = false; $("openAdd").hidden = true;
  $("addPanel").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
}
$("cancelBtn").addEventListener("click", () => { $("addPanel").hidden = true; $("openAdd").hidden = false; });
async function shrink(file, max = 1600, q = 0.84) {
  try {
    const bmp = await createImageBitmap(file);
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const cv = document.createElement("canvas");
    cv.width = Math.round(bmp.width * s); cv.height = Math.round(bmp.height * s);
    cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
    return await new Promise(r => cv.toBlob(b => r(b || file), "image/jpeg", q));
  } catch { return file; }
}
async function handlePhoto(f, fromGallery) {
  if (!f) return;
  pickedBlob = await shrink(f);
  await loadPlateEditor(pickedBlob);
  if (fromGallery && !editing) {
    const ex = typeof exifDate === "function" ? await exifDate(f) : null;
    if (ex) $("fDate").value = ex;
    else if (f.lastModified) { const d = new Date(f.lastModified); if (d.getFullYear() > 2000 && d <= new Date()) $("fDate").value = iso(d); }
  }
}
$("fPhoto").addEventListener("change", () => handlePhoto($("fPhoto").files[0], true));
$("fCam").addEventListener("change", () => handlePhoto($("fCam").files[0], false));

/* ============ Tapar matrículas e caras ============ */
const pcv = $("plateCv"), pctx = pcv.getContext("2d", { willReadFrequently: true });
let plateHist = [], drag = null;
function updatePlateUi() { $("plateUndo").disabled = !plateHist.length; $("plateCount").textContent = plateHist.length ? t("zones", { n: plateHist.length }) : ""; }
async function loadPlateEditor(blob) {
  try {
    const bmp = await createImageBitmap(blob);
    pcv.width = bmp.width; pcv.height = bmp.height; pctx.drawImage(bmp, 0, 0);
    plateHist = []; updatePlateUi(); $("plateBox").hidden = false;
  } catch { $("plateBox").hidden = true; }
}
function cvPoint(e) {
  const r = pcv.getBoundingClientRect();
  return { x: Math.max(0, Math.min(pcv.width, (e.clientX - r.left) * pcv.width / r.width)), y: Math.max(0, Math.min(pcv.height, (e.clientY - r.top) * pcv.height / r.height)) };
}
function rectOf(a, b) { return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) }; }
function pixelate(r) {
  const x = Math.round(r.x), y = Math.round(r.y), w = Math.max(1, Math.round(r.w)), h = Math.max(1, Math.round(r.h));
  const k = Math.max(6, Math.round(Math.min(w, h) / 3));
  const tc = document.createElement("canvas"); tc.width = Math.max(1, Math.round(w / k)); tc.height = Math.max(1, Math.round(h / k));
  tc.getContext("2d").drawImage(pcv, x, y, w, h, 0, 0, tc.width, tc.height);
  pctx.save(); pctx.imageSmoothingEnabled = true;
  try { pctx.filter = `blur(${Math.max(2, Math.round(k / 2))}px)`; } catch {}
  pctx.beginPath(); pctx.rect(x, y, w, h); pctx.clip();
  pctx.drawImage(tc, 0, 0, tc.width, tc.height, x - k, y - k, w + 2 * k, h + 2 * k);
  pctx.restore();
}
const canvasBlob = () => new Promise(res => pcv.toBlob(b => res(b), "image/jpeg", 0.86));
pcv.addEventListener("pointerdown", e => { e.preventDefault(); pcv.setPointerCapture(e.pointerId); drag = { a: cvPoint(e), base: pctx.getImageData(0, 0, pcv.width, pcv.height) }; });
pcv.addEventListener("pointermove", e => {
  if (!drag) return;
  const r = rectOf(drag.a, cvPoint(e));
  pctx.putImageData(drag.base, 0, 0);
  pctx.save(); pctx.fillStyle = "rgba(255,215,0,.25)"; pctx.strokeStyle = "#ffd700"; pctx.lineWidth = Math.max(2, pcv.width / 300);
  pctx.fillRect(r.x, r.y, r.w, r.h); pctx.strokeRect(r.x, r.y, r.w, r.h); pctx.restore();
});
pcv.addEventListener("pointerup", async e => {
  if (!drag) return;
  const d = drag; drag = null;
  const r = rectOf(d.a, cvPoint(e));
  pctx.putImageData(d.base, 0, 0);
  if (r.w < pcv.width / 60 || r.h < pcv.height / 80) return;
  pixelate(r); plateHist.push(d.base); updatePlateUi();
  pickedBlob = await canvasBlob() || pickedBlob;
});
pcv.addEventListener("pointercancel", () => { if (drag) { pctx.putImageData(drag.base, 0, 0); drag = null; } });
$("plateUndo").addEventListener("click", async () => { if (!plateHist.length) return; pctx.putImageData(plateHist.pop(), 0, 0); updatePlateUi(); pickedBlob = await canvasBlob() || pickedBlob; });

$("saveBtn").addEventListener("click", async () => {
  if (saving) return;
  const modelo = $("fModel").value.trim(), marca = $("fBrand").value.trim();
  if (!modelo && !marca) { alertMsg(t("needName")); return; }
  saving = true; $("saveBtn").disabled = true; $("saveBtn").textContent = t("saving"); $("formMsg").hidden = true;
  try {
    let foto = editing ? editing.foto : "";
    if (pickedBlob) { try { foto = await savePhoto(pickedBlob); } catch { alertMsg(t("photoFail")); foto = editing ? editing.foto : ""; } }
    const others = [...data.rua, ...data.expo].filter(c => !editing || c.id !== editing.id);
    const bd = DEX_BY_KEY[norm(marca)], caught = caughtMapOf(others), wasCaught = bd ? caught.has(bd.num) : true;
    let newModel = "";
    if (bd && wasCaught) { const mi = matchModel(bd.name, modelo); if (mi != null && !(caught.get(bd.num) || []).some(c => matchModel(bd.name, c.modelo) === mi)) newModel = dispName(MODELS[bd.name][mi].name); }
    const novo = { marca, modelo, raridade: +$("fTier").value, data: $("fDate").value, local: $("fPlace").value.trim(), nota: $("fNote").value.trim(), foto,
      createdAt: editing ? editing.createdAt : Date.now() };
    if (pickedColor) novo.cor = pickedColor;
    if (editing) { if (editing.lat != null) { novo.lat = editing.lat; novo.lng = editing.lng; } if (editing.fav) novo.fav = true; if (editing.fabricante) novo.fabricante = editing.fabricante; }
    try { localStorage.setItem("usar-gps", $("useGps").checked ? "1" : "0"); } catch {}
    if ($("useGps").checked) { const pos = await getPos(); if (pos) { novo.lat = pos.lat; novo.lng = pos.lng; } else alertMsg(t("gpsFail")); }
    const coll = MODES[formSrc].coll;
    if (editing) {
      const oldColl = MODES[editing.src].coll;
      if (oldColl !== coll) await Store.del("docs", oldColl + "/" + editing.id);
      await Store.put("docs", coll + "/" + editing.id, { coll, id: editing.id, data: novo });
      if (pickedBlob && editing.foto && foto !== editing.foto) deletePhoto(editing.foto).catch(() => {});
    } else await addCar(coll, novo);
    const wasEdit = !!editing;
    await loadCars();
    $("addPanel").hidden = true; $("openAdd").hidden = false; filter = null;
    if (mode !== formSrc) setMode(formSrc); else render();
    renderBackupBar();
    if (wasEdit) { if (typeof toast === "function") toast({ icon: "✏️", title: t("editSaved"), text: `${marca} ${modelo}`.trim() }); editing = null; }
    else showReveal({ ...novo, src: formSrc }, foto ? blobUrl(foto) : "", wasCaught ? "" : bd.name, newModel);
  } catch { alertMsg(t("saveFail")); }
  finally { saving = false; $("saveBtn").disabled = false; $("saveBtn").textContent = t("save"); }
});

/* ============ Lembrete de cópia de segurança ============ */
function renderBackupBar() {
  const n = data.rua.length + data.expo.length;
  let last = 0, snooze = 0;
  try { last = +localStorage.getItem("ultima-copia") || 0; snooze = +localStorage.getItem("copia-adiada") || 0; } catch {}
  const days = last ? Math.floor((Date.now() - last) / 864e5) : null;
  const show = n >= 5 && Date.now() > snooze && (days == null || days >= 14) && !window.PREVIEW;
  $("backupBar").hidden = !show;
  if (show) $("backupTxt").textContent = days == null ? t("backupNever", { n }) : t("backupOld", { d: days });
}
$("backupNow").addEventListener("click", () => $("exportBtn").click());
$("backupLater").addEventListener("click", () => { try { localStorage.setItem("copia-adiada", String(Date.now() + 3 * 864e5)); } catch {} renderBackupBar(); });

/* ============ Cópia de segurança ============ */
function setMsg(id, x, err) { const m = $(id); m.textContent = x; m.className = "app-msg" + (err ? " err" : ""); }
const toDataUrl = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
function downloadFile(file) {
  const url = URL.createObjectURL(file), a = document.createElement("a");
  a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
$("exportBtn").addEventListener("click", async () => {
  try {
    setMsg("appMsg", t("preparing"));
    const docs = (await Store.entries("docs")).map(e => e[1]);
    const photos = {};
    for (const [id, blob] of await Store.entries("photos")) photos[id] = await toDataUrl(blob);
    const json = JSON.stringify({ app: "caderneta-de-carros", versao: 2, criado: new Date().toISOString(), perfil: profile, docs, photos });
    downloadFile(new File([json], `caderneta-${new Date().toISOString().slice(0, 10)}.json`, { type: "application/json" }));
    setMsg("appMsg", t("saved", { n: docs.length }));
    try { localStorage.setItem("ultima-copia", String(Date.now())); } catch {} renderBackupBar();
  } catch { setMsg("appMsg", t("exportFail"), true); }
});
let pendingImport = null;
$("importFile").addEventListener("change", async () => {
  const f = $("importFile").files[0]; $("importFile").value = "";
  if (!f) return;
  try {
    const j = JSON.parse(await f.text());
    if (j.app !== "caderneta-de-carros" || !Array.isArray(j.docs)) throw 0;
    pendingImport = j;
    $("importInfo").textContent = t("importInfo", { a: j.docs.filter(d => d.coll === "cars").length, b: j.docs.filter(d => d.coll === "expo").length });
    $("importConfirm").hidden = false; setMsg("appMsg", "");
  } catch { setMsg("appMsg", t("notBackup"), true); }
});
$("importNo").addEventListener("click", () => { pendingImport = null; $("importConfirm").hidden = true; });
$("importYes").addEventListener("click", async () => {
  const j = pendingImport; if (!j) return;
  $("importYes").disabled = true; setMsg("appMsg", t("importing"));
  try {
    for (const [id, dataUrl] of Object.entries(j.photos || {})) {
      if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) continue;
      await Store.put("photos", id, await (await fetch(dataUrl)).blob());
    }
    let n = 0;
    for (const d of j.docs) if (d && (d.coll === "cars" || d.coll === "expo") && d.id && d.data) { await Store.put("docs", d.coll + "/" + d.id, { coll: d.coll, id: String(d.id), data: d.data }); n++; }
    await loadPhotos(); await loadCars();
    $("importConfirm").hidden = true; pendingImport = null;
    setMsg("appMsg", t("imported", { n })); render(); renderBackupBar();
  } catch { setMsg("appMsg", t("importFail"), true); }
  finally { $("importYes").disabled = false; }
});

/* ============ Amigos ============ */
let friends = [];
async function loadFriends() {
  const list = (await Store.entries("friends")).map(e => e[1]);
  friends = list.map(f => {
    const all = (f.carros || []).map((c, i) => {
      const id = `f:${f.uid}:${i}`;
      if (c.photo instanceof Blob && !urlCache.has(id)) urlCache.set(id, URL.createObjectURL(c.photo));
      return { ...c.data, id, foto: c.photo ? id : "", src: c.coll === "expo" ? "expo" : "rua" };
    }).filter(c => c.raridade >= 1 && c.raridade <= MAXT);
    return { uid: f.uid, nick: f.nick, avatar: safeAv(f.avatar), shared: f.shared, rua: all.filter(c => c.src === "rua"), expo: all.filter(c => c.src === "expo") };
  }).sort((a, b) => a.nick.localeCompare(b.nick));
}
function statsOf(rua, expo) {
  const all = [...rua, ...expo];
  return { cars: all.length, pts: ptsOf(rua) + ptsOf(expo), brands: caughtMapOf(all).size, top: all.reduce((m, c) => Math.max(m, c.raridade || 0), 0) };
}
function renderFriends() {
  const me = { uid: "me", nick: profile ? profile.nick : t("you"), avatar: profile ? safeAv(profile.avatar) : AVATARS[0], me: true, ...statsOf(data.rua, data.expo) };
  const rows = [me, ...friends.map(f => ({ ...f, ...statsOf(f.rua, f.expo) }))].sort((a, b) => b.pts - a.pts);
  $("rank").innerHTML = rows.map((r, i) => `<li class="${r.me ? "me-row" : ""}" ${r.me ? "" : `data-uid="${esc(r.uid)}" tabindex="0" role="button"`}>
    <span class="pos">${i + 1}</span><span class="av">${r.avatar}</span>
    <span class="who"><b>${esc(r.nick)}</b>${r.me ? ` <em>${esc(t("you"))}</em>` : ""}<small>${esc(t("nCars", { n: r.cars }))} · ${esc(t("brandsN", { n: r.brands }))}</small></span>
    <span class="pts">${nf(r.pts)}</span></li>`).join("");
  $("friendList").innerHTML = friends.length ? `<h2>${esc(t("tabFriends"))}</h2><div class="fgrid">${friends.map(f => {
    const s = statsOf(f.rua, f.expo);
    return `<button type="button" class="fcard" data-uid="${esc(f.uid)}"><span class="av big">${f.avatar}</span>
      <span class="who"><b>${esc(f.nick)}</b><small>${esc(t("nCars", { n: s.cars }))} · ${esc(t("pointsN", { n: nf(s.pts) }))}</small><small>${esc(t("updatedOn", { d: fmtDate(f.shared) }))}</small></span>
      ${s.top ? badgeOf(s.top, "rua") : ""}</button>`;
  }).join("")}</div>` : `<div class="empty"><b>${esc(t("noFriends"))}</b>${esc(t("noFriendsText"))}</div>`;
}
const openFriend = uid => { const f = friends.find(x => x.uid === uid); if (f) ovPush({ type: "friend", uid }); };
$("rank").addEventListener("click", e => { const li = e.target.closest("[data-uid]"); if (li) openFriend(li.dataset.uid); });
$("rank").addEventListener("keydown", e => { const li = e.target.closest("[data-uid]"); if (li && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openFriend(li.dataset.uid); } });
$("friendList").addEventListener("click", e => { const b = e.target.closest(".fcard"); if (b) openFriend(b.dataset.uid); });
function renderFriendView(v) {
  const f = friends.find(x => x.uid === v.uid); if (!f) { ovPop(); return; }
  const s = statsOf(f.rua, f.expo);
  const theirs = caughtMapOf([...f.rua, ...f.expo]), mine = caughtMap();
  const diff = (a, b) => [...a.keys()].filter(k => !b.has(k)).map(k => DEX[k - 1].name);
  const they = diff(theirs, mine), you = diff(mine, theirs);
  const chips = arr => arr.length ? `<div class="chips">${arr.map(n => `<span class="chip">${esc(n)}</span>`).join("")}</div>` : `<p class="meta" style="margin:0;color:var(--muted)">${esc(t("noneDiff"))}</p>`;
  v._list = [...groupedHtmlList(f.rua), ...groupedHtmlList(f.expo)];
  $("ovTitle").textContent = t("tabFriends");
  $("ovBody").innerHTML = `<div style="display:flex;flex-direction:column;gap:16px">
    <div class="fhead"><span class="av big">${f.avatar}</span><div><h2>${esc(f.nick)}</h2><span class="meta">${esc(t("updatedOn", { d: fmtDate(f.shared) }))}</span></div></div>
    <section class="stats">
      <div class="stat"><b>${nf(s.cars)}</b><span>${esc(t("statCars"))}</span></div>
      <div class="stat"><b>${s.top ? esc(t("lvlShort", { n: s.top })) : "–"}</b><span>${esc(t("statTop"))}</span></div>
      <div class="stat"><b>${nf(s.pts)}</b><span>${esc(t("statPts"))}</span></div>
    </section>
    <h3 class="sect">${esc(t("theyHave", { n: f.nick }))}</h3>${chips(they)}
    <h3 class="sect">${esc(t("youHave", { n: f.nick }))}</h3>${chips(you)}
    <h3 class="sect">${esc(t("tabRua"))}</h3>
    ${f.rua.length ? `<div style="display:flex;flex-direction:column;gap:20px">${groupedHtml(f.rua, false)}</div>` : `<p class="meta" style="margin:0;color:var(--muted)">${esc(t("friendNoCars"))}</p>`}
    <h3 class="sect">${esc(t("tabExpo"))}</h3>
    ${f.expo.length ? `<div style="display:flex;flex-direction:column;gap:20px">${groupedHtml(f.expo, false)}</div>` : `<p class="meta" style="margin:0;color:var(--muted)">${esc(t("friendNoCars"))}</p>`}
    <div class="actions"><button type="button" class="btn ghost danger" id="rmFriend">${esc(v._sure ? t("removeFriendSure") : t("removeFriend"))}</button></div>
  </div>`;
}
async function onFriendViewClick(e, v) {
  if (e.target.closest("#rmFriend")) {
    if (!v._sure) { v._sure = true; renderOv(true); return; }
    try { await Store.del("friends", v.uid); } catch {}
    for (const k of [...urlCache.keys()]) if (k.startsWith(`f:${v.uid}:`)) { URL.revokeObjectURL(urlCache.get(k)); urlCache.delete(k); }
    await loadFriends(); ovPop(); render(); return;
  }
  const c = e.target.closest(".card"); if (!c) return;
  const i = v._list.findIndex(x => x.id === c.dataset.id);
  const f = friends.find(x => x.uid === v.uid);
  if (i >= 0) ovPush({ type: "car", list: v._list, i, owner: f ? f.nick : "" });
}
const safeName = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9_-]+/g, "").slice(0, 20) || "amigo";
$("shareBtn").addEventListener("click", async () => {
  if (!profile) { openWelcome(false); return; }
  const btn = $("shareBtn"); btn.disabled = true; setMsg("shareMsg", t("sharing"));
  try {
    const withPhotos = $("shareWithPhotos").checked;
    const carros = [];
    for (const c of [...data.rua, ...data.expo]) {
      let foto = null;
      if (withPhotos && c.foto) { const r = await Store.get("photos", c.foto); if (r) foto = await toDataUrl(await shrink(r, 720, 0.7)); }
      carros.push({ coll: MODES[c.src].coll, data: { marca: c.marca, modelo: c.modelo, raridade: c.raridade, data: c.data, nota: c.nota, createdAt: c.createdAt, fabricante: c.fabricante, cor: c.cor }, foto });
    }
    const json = JSON.stringify({ app: "caderneta-de-carros", tipo: "partilha", versao: 1, criado: new Date().toISOString(), perfil: { uid: profile.uid, nick: profile.nick, avatar: profile.avatar }, carros });
    // O Android só partilha alguns tipos de ficheiro: usamos .txt (o conteúdo continua a ser JSON).
    const file = new File([json], `caderneta-${safeName(profile.nick)}.txt`, { type: "text/plain" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: t("appName") }); setMsg("shareMsg", ""); }
      catch (err) { if (err && err.name === "AbortError") setMsg("shareMsg", ""); else { downloadFile(file); setMsg("shareMsg", t("shareSaved")); } }
    } else { downloadFile(file); setMsg("shareMsg", t("shareSaved")); }
  } catch { setMsg("shareMsg", t("shareFail"), true); }
  finally { btn.disabled = false; }
});
$("friendFile").addEventListener("change", async () => {
  const f = $("friendFile").files[0]; $("friendFile").value = "";
  if (!f) return;
  try {
    const j = JSON.parse(await f.text());
    if (j.app !== "caderneta-de-carros" || j.tipo !== "partilha" || !j.perfil || !j.perfil.uid || !Array.isArray(j.carros)) throw 0;
    if (profile && j.perfil.uid === profile.uid) { setMsg("friendMsg", t("ownFile"), true); return; }
    const uid = String(j.perfil.uid).slice(0, 40), nick = String(j.perfil.nick || "?").slice(0, 20);
    const exists = friends.some(x => x.uid === uid);
    const carros = [];
    for (const c of j.carros.slice(0, 3000)) {
      if (!c || !c.data) continue;
      const d = c.data;
      const clean = { marca: String(d.marca || "").slice(0, 60), modelo: String(d.modelo || "").slice(0, 80), raridade: Math.max(1, Math.min(10, Math.round(+d.raridade || 1))), data: String(d.data || "").slice(0, 10), nota: String(d.nota || "").slice(0, 400), createdAt: +d.createdAt || 0, fabricante: d.fabricante ? String(d.fabricante).slice(0, 60) : undefined, cor: (typeof COLORS === "object" && COLORS[d.cor]) ? d.cor : undefined };
      let photo = null;
      if (typeof c.foto === "string" && c.foto.startsWith("data:image/")) { try { photo = await (await fetch(c.foto)).blob(); } catch {} }
      carros.push({ coll: c.coll === "expo" ? "expo" : "cars", data: clean, photo });
    }
    for (const k of [...urlCache.keys()]) if (k.startsWith(`f:${uid}:`)) { URL.revokeObjectURL(urlCache.get(k)); urlCache.delete(k); }
    await Store.put("friends", uid, { uid, nick, avatar: safeAv(j.perfil.avatar), shared: String(j.criado || new Date().toISOString()), carros });
    await loadFriends(); render();
    setMsg("friendMsg", t(exists ? "friendUpdated" : "friendAdded", { n: nick }));
  } catch { setMsg("friendMsg", t("notShare"), true); }
});

/* ============ Instalar ============ */
let installEvt = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; $("installBar").hidden = false; });
$("installBtn").addEventListener("click", async () => { if (!installEvt) return; installEvt.prompt(); try { await installEvt.userChoice; } catch {} installEvt = null; $("installBar").hidden = true; });
window.addEventListener("appinstalled", () => { $("installBar").hidden = true; });
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));

/* ============ Arranque ============ */
(async () => {
  try { await navigator.storage?.persist?.(); } catch {}
  try { profile = await Store.get("meta", "profile") || null; } catch { profile = null; }
  let l = profile?.lang;
  if (!l) { try { l = localStorage.getItem("caderneta-lang"); } catch {} }
  if (!l) { const nav = (navigator.language || "pt").slice(0, 2).toLowerCase(); l = LANGS[nav] ? nav : "pt"; }
  await loadLang(l);
  $("brandList").innerHTML = DEX.map(d => `<option value="${esc(d.name)}">`).join("");
  applyI18n(); applyMode(); render(); renderMe();
  try { await loadPhotos(); await loadCars(); await loadFriends(); } catch { dbOk = false; }
  await loadGame();
  render(); renderLevelBar(); renderColorPick(); renderBackupBar();
  if (!profile) openWelcome(false);
  if (typeof afterBoot === "function") { applyGal(); await afterBoot(); }
})();
