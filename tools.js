"use strict";
/* ================= v8: ferramentas úteis ================= */

/* novas conquistas */
ACH.push(
  ["trip1", "🚶", () => (game.trips || []).some(x => x.n >= 3)],
  ["trip5", "🥾", () => (game.trips || []).length >= 5],
  ["cmp", "⚖️", () => !!game.cmpUsed],
  ["wrap", "📅", () => !!game.wrapSeen],
);

/* janelas extra dentro da janela principal */
const OV_EXTRA = {}, OV_CLICK = {};
const carYear = c => c.data ? +c.data.slice(0, 4) : c.createdAt ? new Date(c.createdAt).getFullYear() : 0;
const carTime = c => c.data ? Date.parse(c.data + "T12:00:00") || c.createdAt || 0 : c.createdAt || 0;
const allCars = () => [...data.rua, ...data.expo];
async function shareOrSave(blob, name, title) {
  const file = new File([blob], name, { type: blob.type || "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title }); return; } catch (e) { if (e && e.name === "AbortError") return; }
  }
  downloadFile(file); toast({ icon: "📤", title, text: t("imgSaved") });
}

/* ============ 1. Data verdadeira da foto (EXIF) ============ */
async function exifDate(file) {
  try {
    const buf = await file.slice(0, 262144).arrayBuffer(), v = new DataView(buf);
    if (v.byteLength < 12 || v.getUint16(0) !== 0xFFD8) return null;
    let o = 2;
    while (o + 10 < v.byteLength) {
      const mk = v.getUint16(o), len = v.getUint16(o + 2);
      if ((mk & 0xFF00) !== 0xFF00) return null;
      if (mk === 0xFFE1 && v.getUint32(o + 4) === 0x45786966) {
        const ts = o + 10, le = v.getUint16(ts) === 0x4949;
        const g16 = p => v.getUint16(p, le), g32 = p => v.getUint32(p, le);
        const ifd = st => { const n = g16(st), out = {}; for (let i = 0; i < n && st + 2 + i * 12 + 12 <= v.byteLength; i++) { const e = st + 2 + i * 12; out[g16(e)] = e; } return out; };
        const str = e => { const n = g32(e + 4), off = n > 4 ? ts + g32(e + 8) : e + 8; let s = ""; for (let i = 0; i < n - 1 && off + i < v.byteLength; i++) s += String.fromCharCode(v.getUint8(off + i)); return s; };
        const i0 = ifd(ts + g32(ts + 4));
        let s = "";
        if (i0[0x8769]) { const ex = ifd(ts + g32(i0[0x8769] + 8)); s = ex[0x9003] ? str(ex[0x9003]) : ex[0x9004] ? str(ex[0x9004]) : ""; }
        if (!s && i0[0x0132]) s = str(i0[0x0132]);
        const m = /^(\d{4}):(\d{2}):(\d{2})/.exec(s);
        if (!m || +m[1] < 1990) return null;
        const d = `${m[1]}-${m[2]}-${m[3]}`;
        return d <= iso(new Date()) ? d : null;
      }
      o += 2 + len;
    }
  } catch {}
  return null;
}

/* ============ 2. Receber fotos partilhadas e atalhos do ícone ============ */
const SHARE_KEY = "./__partilha__";
async function receiveShared() {
  try {
    const c = await caches.open("partilha-in"), r = await c.match(SHARE_KEY);
    if (!r) return;
    const blob = await r.blob(); await c.delete(SHARE_KEY);
    let name = "foto.jpg"; try { name = decodeURIComponent(r.headers.get("x-nome") || name); } catch {}
    const f = new File([blob], name, { type: blob.type || "image/jpeg", lastModified: +(r.headers.get("x-mod") || 0) || Date.now() });
    if (mode !== "rua" && mode !== "expo") setMode("rua");
    resetForm(); $("addPanel").hidden = false; $("openAdd").hidden = true;
    await handlePhoto(f, true);
    $("addPanel").scrollIntoView({ block: "start" });
    toast({ icon: "📥", title: t("sharedIn"), text: t("sharedInText") });
  } catch {}
}
async function afterBoot() {
  const q = new URLSearchParams(location.search), acao = q.get("acao"), part = q.has("partilha");
  if (acao || part) { try { history.replaceState(null, "", location.pathname); } catch {} }
  if (!profile) return;
  let tut2 = false; try { tut2 = localStorage.getItem("tut-visto2") === "1"; } catch {}
  if (!tut2 && !part && !acao && !window.PREVIEW) { openTutorial(); toast({ icon: "✨", title: t("howItWorks"), text: t("tutNew") }); return; }
  if (part) await receiveShared();
  else if (acao === "novo") { if (mode !== "rua" && mode !== "expo") setMode("rua"); $("openAdd").click(); }
  else if (acao === "dex") setMode("dex");
  else if (acao === "duelo") { setMode("dex"); openDuel(); }
  else if (acao === "eu") setMode("me");
  else if (acao === "saida") { if (mode !== "rua" && mode !== "expo") setMode("rua"); if (!sessGet()) sessStart(); }
}

/* ============ 3. Neste dia ============ */
function renderMemory() {
  const el = $("memory"); if (!el) return;
  const now = new Date(), today = iso(now), md = today.slice(5), y = now.getFullYear();
  let closed = ""; try { closed = localStorage.getItem("memoria-fechada") || ""; } catch {}
  const hits = sortBest(allCars().filter(c => c.data && c.data.slice(5) === md && +c.data.slice(0, 4) < y));
  if (!hits.length || closed === today || (mode !== "rua" && mode !== "expo")) { el.hidden = true; return; }
  const c = hits[0], n = y - +c.data.slice(0, 4), u = c.foto ? blobUrl(c.foto) : "";
  el._hits = hits;
  el.innerHTML = `<button type="button" class="memo" data-memo="0">${u ? `<img src="${u}" alt="">` : `<span class="mi">📅</span>`}
    <span class="mt2"><small>${esc(t("onThisDay", { n }))}</small><b>${esc(`${c.marca || ""} ${c.modelo || ""}`.trim())}</b>${hits.length > 1 ? `<small>${esc(t("onThisDayMore", { n: hits.length - 1 }))}</small>` : ""}</span></button>
    <button type="button" class="memx" aria-label="${esc(t("close"))}">✕</button>`;
  el.hidden = false;
}
document.addEventListener("click", e => {
  const el = $("memory"); if (!el || !el.contains(e.target)) return;
  if (e.target.closest(".memx")) { try { localStorage.setItem("memoria-fechada", iso(new Date())); } catch {} el.hidden = true; return; }
  if (e.target.closest("[data-memo]")) ovPush({ type: "car", list: el._hits.slice(), i: 0 });
});

/* ============ 4. Saídas de spotting ============ */
const SESS_KEY = "saida-atual";
const sessGet = () => { try { return JSON.parse(localStorage.getItem(SESS_KEY) || "null"); } catch { return null; } };
const sessCars = (s, end) => allCars().filter(c => c.createdAt && c.createdAt >= s.start && c.createdAt <= (end || Date.now()));
const durTxt = ms => { const m = Math.max(0, Math.round(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}` : `${m} min`; };
const sessLine = (s, cs) => `${durTxt(Date.now() - s.start)} · ${t("nCars", { n: cs.length })} · ${t("nPts", { n: ptsOf(cs) })}`;
let sessTimer = null;
function sessStart() {
  try { localStorage.setItem(SESS_KEY, JSON.stringify({ start: Date.now() })); } catch {}
  sfx("flip"); vib(40); toast({ icon: "🚶", title: t("sessOn"), text: t("sessStarted") }); renderSession();
}
async function sessEnd(auto) {
  const s = sessGet(); if (!s) return;
  const end = auto ? s.start + 12 * 36e5 : Date.now(), cs = sessCars(s, end);
  try { localStorage.removeItem(SESS_KEY); } catch {}
  const best = sortBest(cs)[0];
  const trip = { start: s.start, end, n: cs.length, p: ptsOf(cs), best: best ? { marca: best.marca, modelo: best.modelo, r: best.raridade } : null };
  game.trips ||= []; game.trips.unshift(trip); game.trips = game.trips.slice(0, 30);
  await saveGame();
  renderSession(); render();
  if (!auto) ovPush({ type: "trip", trip, ids: cs.map(c => c.id) });
}
function renderSession() {
  const el = $("sessBar"); if (!el) return;
  let s = sessGet();
  if (s && Date.now() - s.start > 12 * 36e5) { sessEnd(true); s = null; }
  if (!s) {
    clearInterval(sessTimer); sessTimer = null;
    el.className = "sess";
    el.innerHTML = `<button type="button" class="btn ghost" id="sessStart">🚶 ${esc(t("sessStart"))}</button><small>${esc(t("sessHint"))}</small>`;
    return;
  }
  el.className = "sess on";
  el.innerHTML = `<span class="recdot" aria-hidden="true"></span><span class="st"><b>${esc(t("sessOn"))}</b><small id="sessTxt">${esc(sessLine(s, sessCars(s)))}</small></span><button type="button" class="btn" id="sessEnd">${esc(t("sessEnd"))}</button>`;
  if (!sessTimer) sessTimer = setInterval(() => { const x = sessGet(), e = $("sessTxt"); if (x && e) e.textContent = sessLine(x, sessCars(x)); }, 20000);
}
document.addEventListener("click", e => {
  if (e.target.closest("#sessStart")) sessStart();
  else if (e.target.closest("#sessEnd")) sessEnd(false);
});
OV_EXTRA.trip = v => {
  const tr = v.trip, cs = allCars().filter(c => v.ids.includes(c.id));
  v._list = sortBest(cs);
  $("ovTitle").textContent = t("tripTitle");
  const df = new Intl.DateTimeFormat(locale(), { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  $("ovBody").innerHTML = `<div class="tripv">
    <p class="ptext" style="margin:0">${esc(df.format(new Date(tr.start)))}</p>
    <div class="tripnums"><div><b>${esc(durTxt(tr.end - tr.start))}</b><small>${esc(t("tripTime"))}</small></div><div><b>${tr.n}</b><small>${esc(t("statCars"))}</small></div><div><b>${tr.p}</b><small>${esc(t("statPts"))}</small></div></div>
    ${tr.n ? `<h3 class="sect">${esc(t("tripCars"))}</h3><div class="grid">${v._list.map(c => card(c, false)).join("")}</div>`
      : `<div class="empty"><b>${esc(t("tripEmpty"))}</b>${esc(t("tripEmptyText"))}</div>`}
  </div>`;
};
OV_CLICK.trip = (e, v) => { const c = e.target.closest(".card"); if (!c) return; const i = v._list.findIndex(x => x.id === c.dataset.id); if (i >= 0) ovPush({ type: "car", list: v._list, i }); };
function tripsHtml() {
  const l = game.trips || [];
  const df = new Intl.DateTimeFormat(locale(), { day: "2-digit", month: "short", year: "numeric" });
  return `<section class="fsec"><h2>🚶 ${esc(t("trips"))}</h2><p class="ptext">${esc(t("tripsSub"))}</p>
    ${l.length ? `<ul class="trips">${l.slice(0, 6).map((x, i) => `<li><button type="button" data-trip="${i}"><span><b>${esc(df.format(new Date(x.start)))}</b><small>${esc(durTxt(x.end - x.start))}${x.best ? ` · ${esc(`${x.best.marca || ""} ${x.best.modelo || ""}`.trim())}` : ""}</small></span><span class="tn">${esc(t("nCars", { n: x.n }))}<small>${esc(t("nPts", { n: x.p }))}</small></span></button></li>`).join("")}</ul>`
      : `<p class="ptext">${esc(t("tripsEmpty"))}</p>`}</section>`;
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-trip]"); if (!b) return;
  const tr = (game.trips || [])[+b.dataset.trip]; if (!tr) return;
  ovPush({ type: "trip", trip: tr, ids: sessCars(tr, tr.end).map(c => c.id) });
});

/* ============ 5. Comparador ============ */
function cmpItemOfCar(c) { const s = specForCar(c); return s ? { c, s, r: +c.raridade, name: `${c.marca || ""} ${c.modelo || ""}`.trim(), foto: c.foto } : null; }
function cmpThumb(x) {
  const u = x.foto && blobUrl(x.foto);
  return u ? `<img src="${u}" alt="">` : `<span class="dmono">${esc(initials(x.c ? x.c.marca || "?" : x.brand || "?"))}</span>`;
}
OV_EXTRA.cmpPick = v => {
  $("ovTitle").textContent = t("compare");
  if (!$("cmpQ")) {
    $("ovBody").innerHTML = `<div class="cmpp">
      <p class="ptext" style="margin:0">${esc(t("cmpPickText", { c: v.a.name }))}</p>
      <input type="search" id="cmpQ" class="cmpq" placeholder="${esc(t("cmpSearch"))}" autocomplete="off">
      <div id="cmpList"></div></div>`;
    $("cmpQ").addEventListener("input", () => cmpList(v));
  }
  cmpList(v);
};
function cmpList(v) {
  const q = norm($("cmpQ").value);
  const mine = myDeck().filter(x => x.c.id !== v.a.c?.id && (!q || norm(x.name).includes(q)));
  const dex = q.length >= 2 ? cpuDeck().filter(x => norm(x.name).includes(q)).slice(0, 30) : [];
  v._mine = mine; v._dex = dex;
  const row = (x, k) => `<button type="button" class="cmpi" data-pk="${k}"><span class="ct">${cmpThumb(x)}</span><span class="cn"><b>${esc(x.name)}</b><small>${esc([x.s.cv != null ? `${nf(x.s.cv)} ${t("hp")}` : "", x.s.vmax != null ? `${x.s.vmax} km/h` : ""].filter(Boolean).join(" · "))}</small></span>${badgeOf(Math.max(1, Math.min(10, x.r)), "rua")}</button>`;
  $("cmpList").innerHTML = `<h3 class="sect">${esc(t("cmpMine"))}</h3>
    ${mine.length ? `<div class="cmpl">${mine.map((x, i) => row(x, "m" + i)).join("")}</div>` : `<p class="ptext">${esc(t("cmpMineNone"))}</p>`}
    <h3 class="sect">${esc(t("cmpDex"))}</h3>
    ${q.length < 2 ? `<p class="ptext">${esc(t("cmpDexHint"))}</p>` : dex.length ? `<div class="cmpl">${dex.map((x, i) => row(x, "d" + i)).join("")}</div>` : `<p class="ptext">${esc(t("noResults"))}</p>`}`;
}
OV_CLICK.cmpPick = (e, v) => {
  const b = e.target.closest("[data-pk]"); if (!b) return;
  const k = b.dataset.pk, x = k[0] === "m" ? v._mine[+k.slice(1)] : v._dex[+k.slice(1)];
  if (x) ovPush({ type: "cmp", a: v.a, b: x });
};
OV_EXTRA.cmp = v => {
  const { a, b } = v;
  $("ovTitle").textContent = t("compare");
  let sa = 0, sb = 0;
  const rows = DUEL_STATS.map(k => {
    const r = beats(a, b, k); if (r === 1) sa++; else if (r === -1) sb++;
    const x = statVal(a, k), y = statVal(b, k);
    const w = (p, q) => p == null ? 0 : q == null ? 100 : k === "acc" ? Math.min(p, q) / p * 100 : p / Math.max(p, q) * 100;
    return `<div class="cmprow"><span class="cl">${esc(t("st_" + k))}</span>
      <div class="cmpv${r === 1 ? " win" : ""}"><b>${esc(statTxt(a, k))}</b><span class="cb"><span data-w="${w(x, y).toFixed(0)}"></span></span></div>
      <div class="cmpv r${r === -1 ? " win" : ""}"><b>${esc(statTxt(b, k))}</b><span class="cb"><span data-w="${w(y, x).toFixed(0)}"></span></span></div></div>`;
  }).join("");
  const head = x => `<div class="cmph" style="${tierVar(Math.max(1, Math.min(10, x.r)))}"><span class="ct">${cmpThumb(x)}</span><b>${esc(x.name)}</b></div>`;
  const verdict = sa > sb ? t("cmpWins", { c: a.name, a: sa, b: sb }) : sb > sa ? t("cmpWins", { c: b.name, a: sb, b: sa }) : t("cmpTie", { a: sa, b: sb });
  $("ovBody").innerHTML = `<div class="cmpv-wrap"><div class="cmpheads">${head(a)}<span class="vs">VS</span>${head(b)}</div>
    <div class="cmprows">${rows}</div><p class="cmpverd">${esc(verdict)}</p>
    <div class="actions" style="justify-content:center"><button type="button" class="btn ghost" id="cmpSwap">🔁 ${esc(t("cmpSwap"))}</button></div></div>`;
  requestAnimationFrame(() => requestAnimationFrame(() => document.querySelectorAll(".cmprows .cb span[data-w]").forEach(s => s.style.width = s.dataset.w + "%")));
  if (!game.cmpUsed) { game.cmpUsed = true; saveGame().then(() => checkGame()); }
};
OV_CLICK.cmp = (e, v) => { if (e.target.closest("#cmpSwap")) { [v.a, v.b] = [v.b, v.a]; renderOv(true); } };
function openCompare(c) { const a = cmpItemOfCar(c); if (a) ovPush({ type: "cmpPick", a }); }

/* ============ 6. Resumo do ano ============ */
let wrap = null;
function yearsWithCars() { return [...new Set(allCars().map(carYear).filter(Boolean))].sort((a, b) => b - a); }
function wrapData(Y) {
  const cs = allCars().filter(c => carYear(c) === Y);
  const brandOf = c => DEX_BY_KEY[norm(c.fabricante || c.marca)];
  const bc = new Map(); cs.forEach(c => { const d = brandOf(c); if (d) bc.set(d.name, (bc.get(d.name) || 0) + 1); });
  const topB = [...bc.entries()].sort((a, b) => b[1] - a[1])[0];
  const months = Array(12).fill(0); cs.forEach(c => { const tt = carTime(c); if (tt) months[new Date(tt).getMonth()]++; });
  const bm = months.indexOf(Math.max(...months));
  const withS = cs.map(c => ({ c, s: specForCar(c) })).filter(x => x.s && x.s.cv != null).sort((a, b) => b.s.cv - a.s.cv);
  const colMap = {}; cs.forEach(c => { if (c.cor) colMap[c.cor] = (colMap[c.cor] || 0) + 1; });
  const topC = Object.entries(colMap).sort((a, b) => b[1] - a[1])[0];
  const first = new Map(); allCars().slice().sort((a, b) => carTime(a) - carTime(b)).forEach(c => { const d = brandOf(c); if (d && !first.has(d.name)) first.set(d.name, carYear(c)); });
  const newB = [...first.entries()].filter(([, y]) => y === Y).map(([n]) => n);
  return { Y, cs, n: cs.length, p: ptsOf(cs), rare: sortBest(cs)[0], topB, nB: bc.size, months, bm, power: withS[0], topC, newB, rua: cs.filter(c => c.src === "rua").length, expo: cs.filter(c => c.src === "expo").length };
}
function wrapSlides(w) {
  const mName = i => new Intl.DateTimeFormat(locale(), { month: "long" }).format(new Date(2000, i, 1));
  const ph = c => { const u = c && c.foto && blobUrl(c.foto); return u ? `<div class="wph"><img src="${u}" alt=""></div>` : ""; };
  const S = [];
  S.push({ g: "linear-gradient(160deg,#1F46C4,#0B1230)", h: `<small>${esc(t("wrapHi", { n: profile ? profile.nick : "" }))}</small><h2>${esc(t("wrapYear", { y: w.Y }))}</h2><div class="wbig">${w.n}</div><p>${esc(t("wrapCars", { n: w.n }))}</p><p class="wsm">${esc(t("wrapSplit", { a: w.rua, b: w.expo }))} · ${esc(t("nPts", { n: w.p }))}</p>` });
  if (w.rare) S.push({ g: w.rare.raridade === 10 ? "linear-gradient(160deg,#ff6aa8,#ffb347,#6be3a8,#6fa8ff,#b77bff)" : `linear-gradient(160deg,var(--t${w.rare.raridade}),#000)`, h: `<small>${esc(t("wrapRare"))}</small>${ph(w.rare)}<h2>${esc(`${w.rare.marca || ""} ${w.rare.modelo || ""}`.trim())}</h2>${badgeOf(w.rare.raridade, w.rare.src)}` });
  if (w.topB) S.push({ g: "linear-gradient(160deg,#C93A6E,#3a0a1e)", h: `<small>${esc(t("wrapBrand"))}</small><div class="wmono">${esc(initials(w.topB[0]))}</div><h2>${esc(w.topB[0])}</h2><p>${esc(t("nCars", { n: w.topB[1] }))}</p><p class="wsm">${esc(t("wrapBrands", { n: w.nB }))}</p>` });
  if (w.n >= 2) { const mx = Math.max(...w.months, 1); S.push({ g: "linear-gradient(160deg,#23855F,#06281b)", h: `<small>${esc(t("wrapMonth"))}</small><h2>${esc(mName(w.bm))}</h2><p>${esc(t("nCars", { n: w.months[w.bm] }))}</p><div class="wmonths">${w.months.map((n, i) => `<span class="${i === w.bm ? "on" : ""}" style="height:${Math.max(4, n / mx * 100)}%"></span>`).join("")}</div>` }); }
  if (w.power) S.push({ g: "linear-gradient(160deg,#C05E0A,#2b1302)", h: `<small>${esc(t("wrapPower"))}</small>${ph(w.power.c)}<h2>${esc(`${w.power.c.marca} ${w.power.c.modelo}`)}</h2><div class="wbig s">${nf(w.power.s.cv)} <span>${esc(t("hp"))}</span></div>${w.power.s.vmax ? `<p>${w.power.s.vmax} km/h</p>` : ""}` });
  if (w.topC) S.push({ g: "linear-gradient(160deg,#6447D0,#170d3b)", h: `<small>${esc(t("wrapColor"))}</small><div class="wsw" style="background:${COLORS[w.topC[0]] || "#999"}"></div><h2>${esc(t("col_" + w.topC[0]))}</h2><p>${esc(t("nCars", { n: w.topC[1] }))}</p>` });
  if (w.newB.length) S.push({ g: "linear-gradient(160deg,#0E8C9B,#04262b)", h: `<small>${esc(t("wrapNew"))}</small><div class="wbig">${w.newB.length}</div><p>${esc(t("wrapNewTxt", { n: w.newB.length }))}</p><div class="wchips">${w.newB.slice(0, 10).map(n => `<span>${esc(n)}</span>`).join("")}</div>` });
  S.push({ g: "linear-gradient(160deg,#14181D,#1F46C4)", end: true, h: `<small>${esc(t("wrapEnd"))}</small><h2>${esc(t("wrapYear", { y: w.Y }))}</h2>
    <div class="wgrid"><div><b>${w.n}</b><small>${esc(t("statCars"))}</small></div><div><b>${w.p}</b><small>${esc(t("statPts"))}</small></div><div><b>${w.nB}</b><small>${esc(t("wrapBrandsShort"))}</small></div><div><b>${w.newB.length}</b><small>${esc(t("wrapNewShort"))}</small></div></div>
    <p>${esc(t("wrapBye"))}</p>
    <div class="actions"><button type="button" class="btn" id="wrapImg">📤 ${esc(t("wrapSave"))}</button><button type="button" class="btn ghost" id="wrapClose">${esc(t("close"))}</button></div>` });
  return S;
}
function openWrap(Y) {
  const w = wrapData(Y); if (!w.n) return;
  wrap = { w, S: wrapSlides(w), i: 0 };
  $("wrapUp").hidden = false; document.body.style.overflow = "hidden";
  renderWrap();
  if (!game.wrapSeen) { game.wrapSeen = true; saveGame(); }
}
function renderWrap() {
  const { S, i } = wrap, s = S[i];
  $("wrapBody").innerHTML = `<div class="wbars">${S.map((_, k) => `<span class="${k < i ? "done" : k === i ? "on" : ""}"></span>`).join("")}</div>
    <div class="wslide" style="background:${s.g}">${s.h}</div>
    ${s.end ? "" : `<div class="wnav"><button type="button" class="wprev" aria-label="${esc(t("prev"))}"></button><button type="button" class="wnext" aria-label="${esc(t("next"))}"></button></div><p class="whint">${esc(t("wrapTap"))}</p>`}
    <button type="button" class="wx" id="wrapX" aria-label="${esc(t("close"))}">✕</button>`;
  sfx(s.end ? "level" : "flip");
}
function closeWrap() { $("wrapUp").hidden = true; wrap = null; document.body.style.overflow = $("ov").hidden ? "" : "hidden"; checkGame(); if (mode === "me") renderPlayer(); }
document.addEventListener("click", e => {
  const y = e.target.closest("[data-wrap]"); if (y) { openWrap(+y.dataset.wrap); return; }
  if (!wrap || $("wrapUp").hidden) return;
  if (e.target.closest("#wrapX") || e.target.closest("#wrapClose")) { closeWrap(); return; }
  if (e.target.closest("#wrapImg")) { wrapImage(wrap.w); return; }
  if (e.target.closest(".wnext")) { if (wrap.i < wrap.S.length - 1) { wrap.i++; renderWrap(); } return; }
  if (e.target.closest(".wprev")) { if (wrap.i > 0) { wrap.i--; renderWrap(); } }
});
document.addEventListener("keydown", e => {
  if (!wrap || $("wrapUp").hidden) return;
  if (e.key === "Escape") closeWrap();
  else if (e.key === "ArrowRight" && wrap.i < wrap.S.length - 1) { wrap.i++; renderWrap(); }
  else if (e.key === "ArrowLeft" && wrap.i > 0) { wrap.i--; renderWrap(); }
});
async function wrapImage(w) {
  if (window.PREVIEW) { toast({ icon: "📤", title: t("wrapSave"), text: t("shareCardPreview") }); return; }
  try {
    const W = 1080, H = 1920, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d"), font = (wt, s) => `${wt} ${s}px "Chakra Petch", "Arial Narrow", sans-serif`;
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#1F46C4"); g.addColorStop(.55, "#14181D"); g.addColorStop(1, "#C93A6E");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fff"; ctx.textBaseline = "top"; ctx.textAlign = "center";
    ctx.font = font(600, 44); ctx.globalAlpha = .85; ctx.fillText(t("appName").toUpperCase(), W / 2, 110); ctx.globalAlpha = 1;
    ctx.font = font(700, 120); ctx.fillText(t("wrapYear", { y: w.Y }), W / 2, 180);
    if (profile) { ctx.font = font(600, 48); ctx.globalAlpha = .85; ctx.fillText(profile.nick, W / 2, 330); ctx.globalAlpha = 1; }
    const tiles = [[w.n, t("statCars")], [w.p, t("statPts")], [w.nB, t("wrapBrandsShort")], [w.newB.length, t("wrapNewShort")]];
    tiles.forEach(([n, l], i) => {
      const x = 90 + (i % 2) * 460, y0 = 450 + Math.floor(i / 2) * 260;
      rr(ctx, x, y0, 440, 230, 28); ctx.fillStyle = "rgba(255,255,255,.12)"; ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = font(700, 110); ctx.fillText(String(n), x + 220, y0 + 30);
      ctx.font = font(600, 36); ctx.globalAlpha = .8; ctx.fillText(l.toUpperCase(), x + 220, y0 + 160); ctx.globalAlpha = 1;
    });
    const lines = [];
    if (w.rare) lines.push([t("wrapRare"), `${w.rare.marca || ""} ${w.rare.modelo || ""}`.trim() + ` · ${w.rare.raridade}/10`]);
    if (w.topB) lines.push([t("wrapBrand"), `${w.topB[0]} · ${t("nCars", { n: w.topB[1] })}`]);
    if (w.power) lines.push([t("wrapPower"), `${w.power.c.marca} ${w.power.c.modelo} · ${nf(w.power.s.cv)} ${t("hp")}`]);
    if (w.n >= 2) lines.push([t("wrapMonth"), new Intl.DateTimeFormat(locale(), { month: "long" }).format(new Date(2000, w.bm, 1))]);
    ctx.textAlign = "left";
    lines.slice(0, 4).forEach(([k, val], i) => {
      const y0 = 1010 + i * 175;
      rr(ctx, 90, y0, W - 180, 150, 24); ctx.fillStyle = "rgba(0,0,0,.28)"; ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = font(600, 32); ctx.globalAlpha = .75; ctx.fillText(k.toUpperCase(), 130, y0 + 24); ctx.globalAlpha = 1;
      ctx.font = font(700, 50); let s = val; while (ctx.measureText(s).width > W - 260 && s.length > 4) s = s.slice(0, -2); if (s !== val) s += "…";
      ctx.fillText(s, 130, y0 + 70);
    });
    ctx.textAlign = "center"; ctx.font = font(600, 34); ctx.globalAlpha = .8; ctx.fillText(t("wrapBye"), W / 2, 1760); ctx.globalAlpha = 1;
    const blob = await new Promise(r => cv.toBlob(r, "image/png"));
    await shareOrSave(blob, `resumo-${w.Y}.png`, t("wrapYear", { y: w.Y }));
  } catch { toast({ icon: "⚠️", title: t("wrapSave"), text: t("shareCardFail") }); }
}
function wrapHtml() {
  const ys = yearsWithCars();
  return `<section class="fsec wrapsec"><h2>📅 ${esc(t("wrapTitle"))}</h2><p class="ptext">${esc(t("wrapSub"))}</p>
    ${ys.length ? `<div class="actions">${ys.map((y, i) => `<button type="button" class="btn${i ? " ghost" : ""}" data-wrap="${y}">${y}</button>`).join("")}</div>` : `<p class="ptext">${esc(t("noStats"))}</p>`}</section>`;
}
function toolsHtml() { return wrapHtml() + tripsHtml(); }

/* ============ 7. Imprimir a caderneta (ou guardar em PDF) ============ */
async function printBook() {
  document.getElementById("printView")?.remove();
  const pv = document.createElement("div"); pv.id = "printView";
  const sec = (title, list, key) => list.length ? `<h2>${esc(title)} · ${esc(t("nCars", { n: list.length }))}</h2><div class="pgrid">${sortBest(list).map(c => {
    const u = c.foto ? blobUrl(c.foto) : "";
    return `<div class="pc" style="${tierVar(+c.raridade)}"><div class="pimg">${u ? `<img src="${u}" alt="">` : ""}</div><div class="pt"><small>${esc(c.marca || "")}</small><b>${esc(c.modelo || "")}</b><span>${esc(`${c.raridade} · ${tierOf(+c.raridade, key).name}`)}${c.data ? ` · ${esc(fmtDate(c.data))}` : ""}</span></div></div>`;
  }).join("")}</div>` : "";
  pv.innerHTML = `<header><h1>${esc(t("appName"))}</h1><p>${esc(profile ? profile.nick + " · " : "")}${esc(fmtDate(iso(new Date())))} · ${esc(t("nCars", { n: data.rua.length + data.expo.length }))} · ${esc(t("nPts", { n: ptsOf(data.rua) + ptsOf(data.expo) }))}</p></header>
    ${sec(t("tabRua"), data.rua, "rua")}${sec(t("tabExpo"), data.expo, "expo")}`;
  document.body.appendChild(pv);
  await Promise.race([Promise.all([...pv.querySelectorAll("img")].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; }))), new Promise(r => setTimeout(r, 4000))]);
  window.print();
}
window.addEventListener("afterprint", () => document.getElementById("printView")?.remove());
document.addEventListener("click", e => { if (e.target.closest("#printBtn")) printBook(); });

/* ============ 8. Vista só de fotos ============ */
let galView = false;
try { galView = localStorage.getItem("vista-fotos") === "1"; } catch {}
function applyGal() { $("list").classList.toggle("gal", galView); const b = $("viewBtn"); if (b) { b.setAttribute("aria-pressed", String(galView)); b.title = t(galView ? "viewCards" : "viewPhotos"); b.setAttribute("aria-label", b.title); b.textContent = galView ? "▤" : "▦"; } }
$("viewBtn")?.addEventListener("click", () => { galView = !galView; try { localStorage.setItem("vista-fotos", galView ? "1" : "0"); } catch {} applyGal(); vib(20); });
applyGal();
