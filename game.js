"use strict";
/* ============ Níveis, conquistas, desafios, estatísticas, mapa, tutorial ============ */
const COLORS = { branco: "#f4f4f2", preto: "#1b1d21", cinzento: "#7d848c", prata: "#c4c9cf", vermelho: "#d0312d", azul: "#2f5fd0", verde: "#2f9e57", amarelo: "#f2c230", laranja: "#ef7d22", outra: "conic-gradient(#e44,#fb2,#4c4,#29f,#a4f,#e44)" };
const XP_ACH = 20;
const xpNeed = L => 15 * (L - 1) * L; // XP total para chegar ao nível L
function levelOf(xp) { let L = 1; while (xpNeed(L + 1) <= xp && L < 99) L++; return L; }
const titleOf = L => t("title_" + (L >= 30 ? 6 : L >= 20 ? 5 : L >= 15 ? 4 : L >= 10 ? 3 : L >= 5 ? 2 : 1));
let game = { ach: [], chDone: {}, init: false };

/* --- informação extra de cada carro --- */
function carInfo(c) {
  const d = DEX_BY_KEY[norm(c.fabricante || c.marca)];
  const s = d ? specForCar(c) : null;
  const base = d ? (() => { const mi = matchModel(d.name, c.modelo); if (mi == null) return null; const m = MODELS[d.name][mi], vi = matchVersion(d.name, mi, c.modelo); return (vi != null && SPECS[`${d.name}|${m.name}|${m.vers[vi].name}`]) || SPECS[`${d.name}|${m.name}|`] || null; })() : null;
  const y = base && base.anos ? +((String(base.anos).match(/\d{4}/) || [])[0] || 0) : 0;
  return { d, s, year: y, electric: !!(d && d.tipo === "eletrica") || /el[eé]tric|electric/i.test((base && base.motor) || "") || /electric|elétric/i.test(c.modelo || "") };
}
function gameStats() {
  const rua = data.rua, expo = data.expo, all = [...rua, ...expo];
  const info = all.map(c => ({ c, ...carInfo(c) }));
  const brands = caughtMap();
  const countries = new Set([...brands.keys()].map(n => DEX[n - 1].pais));
  const cnt = name => info.filter(x => x.d && x.d.name === name).length;
  const st = typeof streakInfo === "function" ? streakInfo() : { cur: 0, best: 0 };
  return { rua, expo, all, info, brands, countries, cnt, friends: friends.length, chN: Object.keys(game.chDone).length, streak: st };
}
const ACH = [
  ["first", "🚗", s => s.all.length >= 1], ["c10", "🔟", s => s.all.length >= 10], ["c25", "🦅", s => s.all.length >= 25],
  ["c50", "🏅", s => s.all.length >= 50], ["c100", "💯", s => s.all.length >= 100], ["c250", "🏟️", s => s.all.length >= 250],
  ["epic", "💎", s => s.rua.some(c => c.raridade >= 7)], ["leg", "👑", s => s.rua.some(c => c.raridade >= 8)],
  ["myth", "🐉", s => s.rua.some(c => c.raridade >= 9)], ["uni", "🦄", s => s.rua.some(c => c.raridade >= 10)],
  ["b5", "🧭", s => s.brands.size >= 5], ["b10", "🗺️", s => s.brands.size >= 10], ["b25", "📚", s => s.brands.size >= 25], ["b50", "🌍", s => s.brands.size >= 50],
  ["ctry5", "✈️", s => s.countries.size >= 5], ["ctry10", "🛂", s => s.countries.size >= 10],
  ["tifosi", "🐎", s => s.cnt("Ferrari") >= 3], ["toro", "🐂", s => s.cnt("Lamborghini") >= 3], ["p911", "🏁", s => s.cnt("Porsche") >= 5],
  ["classic", "🕰️", s => s.info.filter(x => x.year && x.year < 1980).length >= 5], ["old", "⏳", s => s.info.some(x => x.year && x.year < 1950)],
  ["volt", "⚡", s => s.info.filter(x => x.electric).length >= 3], ["bus", "🚌", s => s.all.some(c => /autocarro|bus/i.test(c.marca || ""))],
  ["speed", "🚀", s => s.info.some(x => x.s && x.s.vmax >= 300)], ["hp", "🔥", s => s.info.some(x => x.s && x.s.cv > 500)],
  ["million", "💰", s => s.info.some(x => x.s && x.s.valor_max >= 1e6)],
  ["expo1", "🎪", s => s.expo.length >= 1], ["expo10", "🎟️", s => s.expo.length >= 10],
  ["streak3", "🔥", s => s.streak.best >= 3], ["streak7", "🌋", s => s.streak.best >= 7], ["quiz10", "🧠", s => (game.quiz?.best || 0) >= 10], ["quiz5", "📝", s => (game.quiz?.rounds || 0) >= 5], ["set1", "🗂️", s => Object.keys(game.setsDone || {}).length >= 1], ["set4", "🏛️", s => Object.keys(game.setsDone || {}).length >= 4], ["duel1", "⚔️", s => (game.duel?.w || 0) >= 1], ["duel5", "🛡️", s => !!game.duel?.perfect], ["friend", "🤝", s => s.friends >= 1], ["friends3", "👥", s => s.friends >= 3], ["week", "🎯", s => s.chN >= 5],
];

/* --- desafios (iguais para toda a gente no mesmo dia/semana) --- */
function rng(seed) { let h = 2166136261; for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; }; }
const dayKey = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
function weekStart(d) { const x = dayKey(d); const wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); return x; }
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const CH_COUNTRIES = ["Alemanha", "Itália", "Japão", "França", "Reino Unido", "EUA", "Coreia do Sul", "Suécia"];
const CH_TYPES = ["desportiva", "premium", "eletrica", "classica", "luxo"];
function makeChallenges(now = new Date()) {
  const d0 = dayKey(now), w0 = weekStart(now);
  const r = rng("d" + iso(d0)), rw = rng("w" + iso(w0));
  const pick = (f, a) => a[Math.floor(f() * a.length)];
  const daily = [
    () => ({ k: "catch", n: 1 + Math.floor(r() * 2), xp: 15 }),
    () => ({ k: "rar", n: 4 + Math.floor(r() * 2), xp: 20 }),
    () => ({ k: "ctry", c: pick(r, CH_COUNTRIES), xp: 20 }),
    () => ({ k: "type", c: pick(r, CH_TYPES), xp: 20 }),
  ];
  const weekly = [
    () => ({ k: "catch", n: 5 + Math.floor(rw() * 4), xp: 40 }),
    () => ({ k: "rar", n: 6 + Math.floor(rw() * 2), xp: 50 }),
    () => ({ k: "brand", n: 1 + Math.floor(rw() * 2), xp: 45 }),
    () => ({ k: "ctry", c: pick(rw, CH_COUNTRIES), xp: 35 }),
    () => ({ k: "expo", n: 1, xp: 35 }),
  ];
  const D = pick(r, daily)(); D.id = "d" + iso(d0) + D.k; D.from = +d0; D.to = +d0 + 864e5;
  const wi = Math.floor(rw() * weekly.length), wj = (wi + 1 + Math.floor(rw() * (weekly.length - 1))) % weekly.length;
  const W = [weekly[wi](), weekly[wj]()].map((x, i) => ({ ...x, id: "w" + iso(w0) + x.k + i, from: +w0, to: +w0 + 7 * 864e5 }));
  return { daily: D, weekly: W };
}
function chText(ch) {
  if (ch.k === "catch") return t("ch_catch", { n: ch.n });
  if (ch.k === "rar") return t("ch_rar", { t: tierOf(ch.n, "rua").name });
  if (ch.k === "ctry") return t("ch_ctry", { c: country(ch.c) });
  if (ch.k === "type") return t("ch_type", { t: typeName(ch.c) });
  if (ch.k === "brand") return t("ch_brand", { n: ch.n });
  if (ch.k === "expo") return t("ch_expo", { n: ch.n });
  return "";
}
function chProgress(ch, s) {
  const inP = c => (c.createdAt || 0) >= ch.from && (c.createdAt || 0) < ch.to;
  const rua = s.rua.filter(inP), all = s.all.filter(inP);
  let have = 0, need = ch.n || 1;
  if (ch.k === "catch") have = all.length;
  else if (ch.k === "rar") have = rua.some(c => c.raridade >= ch.n) ? 1 : 0, need = 1;
  else if (ch.k === "ctry") have = all.some(c => { const d = DEX_BY_KEY[norm(c.fabricante || c.marca)]; return d && d.pais === ch.c; }) ? 1 : 0, need = 1;
  else if (ch.k === "type") have = all.some(c => { const d = DEX_BY_KEY[norm(c.fabricante || c.marca)]; return d && d.tipo === ch.c; }) ? 1 : 0, need = 1;
  else if (ch.k === "expo") have = s.expo.filter(inP).length;
  else if (ch.k === "brand") {
    const first = new Map();
    s.all.forEach(c => { const d = DEX_BY_KEY[norm(c.fabricante || c.marca)]; if (d) first.set(d.num, Math.min(first.get(d.num) ?? Infinity, c.createdAt || 0)); });
    have = [...first.values()].filter(v => v >= ch.from && v < ch.to).length;
  }
  return { have: Math.min(have, need), need, done: have >= need || !!game.chDone[ch.id] };
}

/* --- XP e verificação --- */
const xpOf = () => ptsOf(data.rua) + ptsOf(data.expo) + game.ach.length * XP_ACH + Object.values(game.chDone).reduce((a, b) => a + b, 0) + (typeof funXp === "function" ? funXp() : 0) + (typeof duelXp === "function" ? duelXp() : 0);
let gameReady = false, lastLevel = null, checking = false;
async function saveGame() { try { await Store.put("meta", "game", game); } catch {} }
async function loadGame() { try { const g = await Store.get("meta", "game"); if (g) game = { ach: [], chDone: {}, ...g }; } catch {} gameReady = true; }
async function checkGame() {
  if (!gameReady || checking || !(loadedM.rua && loadedM.expo)) return;
  checking = true;
  try {
    const s = gameStats(), news = [];
    for (const [id, icon, test] of ACH) if (!game.ach.includes(id)) { let ok = false; try { ok = test(s); } catch {} if (ok) { game.ach.push(id); news.push({ icon, title: t("achUnlocked"), text: t(`ach_${id}_n`), xp: XP_ACH }); } }
    if (typeof checkSets === "function") checkSets(news);
    if (typeof checkWish === "function") checkWish(news);
    const ch = makeChallenges();
    for (const c of [ch.daily, ...ch.weekly]) if (!game.chDone[c.id] && chProgress(c, s).done) { game.chDone[c.id] = c.xp; news.push({ icon: "🎯", title: t("challengeDone", { c: "" }).replace(/[:：]\s*$/, ""), text: chText(c), xp: c.xp }); }
    const L = levelOf(xpOf());
    if (!game.init) { game.init = true; await saveGame(); lastLevel = L; }
    else {
      if (news.length) {
        await saveGame();
        if (news.length <= 3) news.forEach(toast);
        else { news.slice(0, 2).forEach(toast); toast({ icon: "🏆", title: t("achievements"), text: `+${news.length - 2} · ${t("achCount", { a: game.ach.length, b: ACH.length })}`, xp: news.slice(2).reduce((x, n) => x + (n.xp || 0), 0) }); }
      }
      if (lastLevel != null && L > lastLevel) toast({ icon: "⬆️", title: t("levelUp", { n: L }), text: titleOf(L), big: true });
      lastLevel = L;
    }
    renderLevelBar();
    if (mode === "me") renderPlayer();
  } finally { checking = false; }
}

/* --- avisos animados --- */
const toastQ = []; let toastOn = false;
function toast(x) { toastQ.push(x); if (!toastOn) nextToast(); }
function nextToast() {
  const x = toastQ.shift(); if (!x) { toastOn = false; return; }
  toastOn = true;
  const el = document.createElement("div");
  el.className = "toast" + (x.big ? " big" : ""); el.setAttribute("role", "status");
  el.innerHTML = `<span class="ti">${esc(x.icon)}</span><span class="tt"><b>${esc(x.title)}</b><span>${esc(x.text)}</span></span>${x.xp ? `<span class="tx">${esc(t("rewardXp", { n: x.xp }))}</span>` : ""}`;
  $("toasts").appendChild(el);
  if (typeof sfx === "function") sfx(x.big ? "level" : "ach"); if (typeof vib === "function") vib(x.big ? [60, 40, 60, 40, 120] : 40);
  const wait = $("rv").hidden ? 0 : 400;
  setTimeout(() => el.classList.add("in"), 30 + wait);
  setTimeout(() => { el.classList.remove("in"); setTimeout(() => { el.remove(); nextToast(); }, 400); }, 2800 + wait);
}

/* --- barra de nível no topo --- */
function renderLevelBar() {
  if (!profile) { $("lvlBar").hidden = true; return; }
  const xp = xpOf(), L = levelOf(xp), a = xp - xpNeed(L), b = xpNeed(L + 1) - xpNeed(L);
  $("lvlBar").hidden = false;
  $("lvlNum").textContent = L; $("lvlTitle").textContent = titleOf(L);
  $("lvlTxt").textContent = t("xpTo", { a: nf(a), b: nf(b), n: L + 1 });
  growBar($("lvlFill"), (a / b * 100).toFixed(1) + "%");
  $("meLvl").textContent = L;
}

/* --- página do jogador --- */
function hbars(rows, max, colorFn) {
  if (!rows.length) return `<p class="ptext">${esc(t("noStats"))}</p>`;
  return `<div class="hbars">${rows.map(([label, n, extra], i) => `<div class="hb"><span class="hl">${label}</span><span class="ht"><span data-w="${(n / max * 100).toFixed(1)}" style="background:${colorFn ? colorFn(extra, i) : "var(--accent)"}"></span></span><b>${nf(n)}</b></div>`).join("")}</div>`;
}
function renderPlayer() {
  const s = gameStats(), xp = xpOf(), L = levelOf(xp);
  const ch = makeChallenges();
  const chRow = c => { const p = chProgress(c, s); return `<li class="chl${p.done ? " ok" : ""}"><span class="ci">${p.done ? "✅" : "🎯"}</span><span class="ct"><b>${esc(chText(c))}</b><span class="cp"><span style="width:${(p.have / p.need * 100).toFixed(0)}%"></span></span></span><span class="cx">${p.done ? esc(t("done")) : `${p.have}/${p.need}`}<small>${esc(t("rewardXp", { n: c.xp }))}</small></span></li>`; };
  // estatísticas
  const rar = Array.from({ length: 10 }, (_, i) => [badgeOf(i + 1, "rua"), s.all.filter(c => +c.raridade === i + 1).length, i + 1]).filter(r => r[1]);
  const brandRows = [...s.brands.entries()].map(([n, arr]) => [esc(DEX[n - 1].name), arr.length]).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const cMap = {}; s.info.forEach(x => { if (x.d) cMap[x.d.pais] = (cMap[x.d.pais] || 0) + 1; });
  const ctryRows = Object.entries(cMap).sort((a, b) => b[1] - a[1]).map(([p, n]) => [esc(country(p)), n]);
  const tMap = {}; s.info.forEach(x => { if (x.d) tMap[x.d.tipo] = (tMap[x.d.tipo] || 0) + 1; });
  const typeRows = Object.entries(tMap).sort((a, b) => b[1] - a[1]).map(([k, n]) => [esc(typeName(k)), n, k]);
  const colMap = {}; s.all.forEach(c => { if (c.cor) colMap[c.cor] = (colMap[c.cor] || 0) + 1; });
  const colRows = Object.entries(colMap).sort((a, b) => b[1] - a[1]).map(([k, n]) => [`<i class="sw" style="background:${COLORS[k] || "#999"}"></i>${esc(t("col_" + k))}`, n, k]);
  const months = []; const now = new Date();
  for (let i = 11; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push([d, 0]); }
  s.all.forEach(c => { const d = new Date(c.data ? c.data + "T12:00:00" : c.createdAt || 0); months.forEach(m => { if (m[0].getFullYear() === d.getFullYear() && m[0].getMonth() === d.getMonth()) m[1]++; }); });
  const mMax = Math.max(1, ...months.map(m => m[1]));
  const mFmt = new Intl.DateTimeFormat(locale(), { month: "short" });
  const best = (f, cmp) => s.info.filter(f).sort(cmp)[0];
  const recs = [
    ["recFast", best(x => x.s && x.s.vmax, (a, b) => b.s.vmax - a.s.vmax), x => `${x.s.vmax} km/h`],
    ["recPower", best(x => x.s && x.s.cv, (a, b) => b.s.cv - a.s.cv), x => `${nf(x.s.cv)} ${t("hp")}`],
    ["recValue", best(x => x.s && x.s.valor_max, (a, b) => b.s.valor_max - a.s.valor_max), x => valorTxt(x.s)],
    ["recOld", best(x => x.year, (a, b) => a.year - b.year), x => x.s && x.s.anos ? x.s.anos : String(x.year)],
  ].filter(r => r[1]);
  const achHtml = ACH.map(([id, icon]) => { const on = game.ach.includes(id); return `<li class="ach${on ? " on" : ""}" title="${esc(t(`ach_${id}_d`))}"><span class="ai">${on ? icon : "🔒"}</span><b>${esc(t(`ach_${id}_n`))}</b><small>${esc(t(`ach_${id}_d`))}</small></li>`; }).join("");
  $("playerView").innerHTML = `
    <section class="pcard" style="--avc:${profile ? profile.avColor || "var(--accent)" : "var(--accent)"}">
      <span class="pav">${profile ? safeAv(profile.avatar) : "🚗"}</span>
      <div class="pinfo"><h2>${esc(profile ? profile.nick : "")}</h2><span class="ptitle">${esc(t("level", { n: L }))} · ${esc(titleOf(L))}</span>
        <div class="pbar"><span id="meXp"></span></div><small>${esc(t("xpTo", { a: nf(xp - xpNeed(L)), b: nf(xpNeed(L + 1) - xpNeed(L)), n: L + 1 }))} · ${esc(t("xpTotal", { n: nf(xp) }))}</small>
        <span class="streak${s.streak.cur ? " on" : ""}">${esc(s.streak.cur ? t("streak", { n: s.streak.cur }) : t("streakNone"))}${s.streak.best > 1 ? ` · ${esc(t("streakBest", { n: s.streak.best }))}` : ""}</span></div>
    </section>
    <div class="actions"><button class="btn ghost" type="button" id="editProf">${esc(t("editProfile"))}</button><button class="btn ghost" type="button" id="openTut">${esc(t("howItWorks"))}</button></div>
    <section class="fsec"><h2>${esc(t("vitrine"))}</h2>${(() => { const fav = s.all.filter(c => c.fav); return fav.length ? `<div class="grid vit">${fav.map(c => card(c, false)).join("")}</div>` : `<p class="ptext">${esc(t("vitrineEmpty"))}</p>`; })()}</section>
    <section class="fsec"><h2>${esc(t("challenges"))}</h2>
      <h3 class="sect">${esc(t("daily"))}</h3><ul class="chlist">${chRow(ch.daily)}</ul>
      <h3 class="sect">${esc(t("weekly"))}</h3><ul class="chlist">${ch.weekly.map(chRow).join("")}</ul></section>
    <section class="fsec quizsec"><h2>${esc(t("quiz"))}</h2><p class="ptext">${esc(t("quizSub"))}</p>${game.quiz?.best ? `<p class="ptext">${esc(t("quizBest", { a: game.quiz.best, n: 10 }))}</p>` : ""}<div class="actions"><button class="btn" type="button" data-quiz="1">${esc(t("quizStart"))}</button></div></section>
    ${typeof duelHtml === "function" ? duelHtml() : ""}
    ${typeof wishHtml === "function" ? wishHtml() : ""}
    ${typeof setsHtml === "function" ? setsHtml() : ""}
    <section class="fsec"><h2>${esc(t("achievements"))}</h2><p class="ptext">${esc(t("achCount", { a: game.ach.length, b: ACH.length }))}</p><ul class="achs">${achHtml}</ul></section>
    <section class="fsec"><h2>${esc(t("stats"))}</h2>
      ${recs.length ? `<h3 class="sect">${esc(t("records"))}</h3><div class="recs">${recs.map(([k, x, f]) => `<button type="button" class="rec" data-id="${esc(x.c.id)}" data-src="${x.c.src}"><small>${esc(t(k))}</small><b>${esc(x.c.marca)} ${esc(x.c.modelo)}</b><span>${esc(f(x))}</span></button>`).join("")}</div>` : ""}
      <h3 class="sect">${esc(t("byRarity"))}</h3>${hbars(rar.map(r => [r[0], r[1], r[2]]), Math.max(1, ...rar.map(r => r[1])), k => k === 10 ? "linear-gradient(90deg,#ff6aa8,#ffb347,#6be3a8,#6fa8ff,#b77bff)" : `var(--t${k})`)}
      <h3 class="sect">${esc(t("byMonth"))}</h3>
      <div class="months">${months.map(([d, n]) => `<div class="mo"><span class="mv">${n || ""}</span><span class="mbar"><span data-h="${(n / mMax * 100).toFixed(1)}"></span></span><span class="ml">${esc(mFmt.format(d))}</span></div>`).join("")}</div>
      <h3 class="sect">${esc(t("topBrands"))}</h3>${hbars(brandRows, Math.max(1, ...brandRows.map(r => r[1])))}
      <h3 class="sect">${esc(t("byCountry"))}</h3>${hbars(ctryRows, Math.max(1, ...ctryRows.map(r => r[1])), () => "var(--t4)")}
      <h3 class="sect">${esc(t("byType"))}</h3>${hbars(typeRows, Math.max(1, ...typeRows.map(r => r[1])), k => `var(--ty-${k})`)}
      ${colRows.length ? `<h3 class="sect">${esc(t("byColor"))}</h3>${hbars(colRows, Math.max(1, ...colRows.map(r => r[1])), k => COLORS[k] && !COLORS[k].startsWith("conic") ? COLORS[k] : "var(--muted)")}` : ""}
    </section>
    <section class="fsec"><h2>${esc(t("map"))}</h2><p class="ptext">${esc(t("mapText"))}</p><div id="mapBox" class="mapbox"></div></section>
    ${typeof toolsHtml === "function" ? toolsHtml() : ""}
    ${typeof settingsHtml === "function" ? settingsHtml() : ""}`;
  growBar($("meXp"), ((xp - xpNeed(L)) / (xpNeed(L + 1) - xpNeed(L)) * 100).toFixed(1) + "%");
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.querySelectorAll("#playerView .ht span[data-w]").forEach(e => e.style.width = e.dataset.w + "%");
    document.querySelectorAll("#playerView .mbar span[data-h]").forEach(e => e.style.height = e.dataset.h + "%");
  }));
  renderMap(s);
}
document.addEventListener("click", e => {
  if (e.target.closest("#editProf")) openWelcome(true);
  else if (e.target.closest("#openTut")) openTutorial();
  const vc = e.target.closest("#playerView .vit .card");
  if (vc) { const fav = [...data.rua, ...data.expo].filter(c => c.fav); const i = fav.findIndex(c => c.id === vc.dataset.id); if (i >= 0) ovPush({ type: "car", list: fav, i }); return; }
  const r = e.target.closest(".rec"); if (r) {
    const src = r.dataset.src, list = data[src] || []; const i = list.findIndex(c => c.id === r.dataset.id);
    if (i >= 0) ovPush({ type: "car", list, i });
  }
});

/* --- mapa (Leaflet + OpenStreetMap, só na app instalada) --- */
let leafletP = null, mapObj = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve();
  return leafletP || (leafletP = new Promise((res, rej) => {
    const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"; document.head.appendChild(css);
    const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"; s.onload = res; s.onerror = rej; document.head.appendChild(s);
  }));
}
async function renderMap(s) {
  const box = $("mapBox"); if (!box) return;
  const pts = s.all.filter(c => typeof c.lat === "number" && typeof c.lng === "number");
  if (window.PREVIEW) { box.innerHTML = `<p class="ptext">${esc(t("mapPreview"))}</p>`; box.classList.add("empty"); return; }
  if (!pts.length) { box.innerHTML = `<p class="ptext">${esc(t("mapEmpty"))}</p>`; box.classList.add("empty"); return; }
  box.classList.remove("empty");
  try {
    await loadLeaflet();
    if (!document.body.contains(box)) return;
    if (mapObj) { try { mapObj.remove(); } catch {} }
    mapObj = L.map(box, { zoomControl: true, attributionControl: true });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(mapObj);
    const css = getComputedStyle(document.documentElement);
    const group = pts.map(c => {
      const col = c.raridade === 10 ? "#b77bff" : css.getPropertyValue(`--t${c.raridade}`).trim() || "#2f72c4";
      return L.circleMarker([c.lat, c.lng], { radius: 6 + c.raridade, color: "#fff", weight: 2, fillColor: col, fillOpacity: .9 })
        .bindPopup(`<b>${esc(c.marca)} ${esc(c.modelo)}</b><br>${esc(tierOf(c.raridade, c.src).name)}`);
    });
    const fg = L.featureGroup(group).addTo(mapObj);
    mapObj.fitBounds(fg.getBounds().pad(0.3), { maxZoom: 15 });
  } catch { box.innerHTML = `<p class="ptext">${esc(t("mapFail"))}</p>`; box.classList.add("empty"); }
}

/* --- localização ao guardar (opcional) --- */
function getPos() {
  return new Promise(res => {
    if (!navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition(p => res({ lat: Math.round(p.coords.latitude * 1000) / 1000, lng: Math.round(p.coords.longitude * 1000) / 1000 }), () => res(null), { timeout: 9000, maximumAge: 60000 });
  });
}

/* --- carta grande com efeito holográfico --- */
function tiltHandlers() {
  const card = document.querySelector("#ovBody .holo"); if (!card || reduceMotion) return;
  const set = (x, y) => { card.style.setProperty("--rx", `${(0.5 - y) * 18}deg`); card.style.setProperty("--ry", `${(x - 0.5) * 22}deg`); card.style.setProperty("--mx", `${x * 100}%`); card.style.setProperty("--my", `${y * 100}%`); };
  card.addEventListener("pointermove", e => { const r = card.getBoundingClientRect(); set((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); });
  card.addEventListener("pointerleave", () => set(0.5, 0.5));
}
let orient = null;
window.addEventListener("deviceorientation", e => {
  const card = document.querySelector("#ovBody .holo"); if (!card || reduceMotion || e.gamma == null) return;
  if (!orient) orient = { b: e.beta, g: e.gamma };
  const x = Math.max(0, Math.min(1, 0.5 + (e.gamma - orient.g) / 50)), y = Math.max(0, Math.min(1, 0.5 + (e.beta - orient.b) / 50));
  card.style.setProperty("--rx", `${(0.5 - y) * 18}deg`); card.style.setProperty("--ry", `${(x - 0.5) * 22}deg`); card.style.setProperty("--mx", `${x * 100}%`); card.style.setProperty("--my", `${y * 100}%`);
});

/* --- tutorial --- */
const TUT = [
  { ic: "📸", cls: "s1" }, { ic: "🫥", cls: "s2" }, { ic: "⭐", cls: "s3" }, { ic: "📖", cls: "s4" }, { ic: "🃏", cls: "s5" },
  { ic: "🚶", cls: "s6" }, { ic: "⚔️", cls: "s7" }, { ic: "🏆", cls: "s8" }, { ic: "🤝", cls: "s9" }, { ic: "💾", cls: "s10" },
];
let tutI = 0;
function openTutorial() { tutI = 0; renderTut(); $("tut").hidden = false; document.body.style.overflow = "hidden"; }
function closeTutorial() { $("tut").hidden = true; document.body.style.overflow = ""; try { localStorage.setItem("tut-visto", "1"); localStorage.setItem("tut-visto2", "1"); } catch {} }
function renderTut() {
  const s = TUT[tutI], n = tutI + 1;
  $("tutScene").className = "tut-scene " + s.cls;
  $("tutScene").innerHTML = `<span class="big">${s.ic}</span><span class="o o1"></span><span class="o o2"></span><span class="o o3"></span>`;
  $("tutT").textContent = t(`tut${n}_t`); $("tutD").textContent = t(`tut${n}_d`);
  $("tutRules").hidden = n !== 2; $("tutRules").textContent = t("rules");
  $("tutDots").innerHTML = TUT.map((_, i) => `<span class="${i === tutI ? "on" : ""}"></span>`).join("");
  $("tutNext").textContent = n === TUT.length ? t("letsGo") : t("next");
  $("tutSkip").textContent = t("skip"); $("tutSkip").hidden = n === TUT.length;
  const box = $("tutCard"); box.classList.remove("swap"); void box.offsetWidth; box.classList.add("swap");
}
$("tutNext").addEventListener("click", () => { if (tutI < TUT.length - 1) { tutI++; renderTut(); } else closeTutorial(); });
$("tutSkip").addEventListener("click", closeTutorial);
let tx0 = null;
$("tut").addEventListener("pointerdown", e => { tx0 = e.clientX; });
$("tut").addEventListener("pointerup", e => { if (tx0 == null) return; const dx = e.clientX - tx0; tx0 = null; if (Math.abs(dx) > 60) { if (dx < 0 && tutI < TUT.length - 1) { tutI++; renderTut(); } else if (dx > 0 && tutI > 0) { tutI--; renderTut(); } } });
document.addEventListener("keydown", e => { if ($("tut").hidden) return; if (e.key === "Escape") closeTutorial(); if (e.key === "ArrowRight") $("tutNext").click(); });
