"use strict";
/* ============ Duelo de cartas (estilo Super Trunfo) ============ */
const DUEL_ROUNDS = 5, DUEL_STATS = ["rar", "cv", "vmax", "acc", "val"];
const statVal = (c, k) => {
  if (k === "rar") return c.r;
  const s = c.s || {};
  if (k === "cv") return s.cv ?? null;
  if (k === "vmax") return s.vmax ?? null;
  if (k === "acc") return s.zero100 ?? null;
  if (k === "val") return s.valor_min != null && s.valor_max != null ? (s.valor_min + s.valor_max) / 2 : (s.valor_min ?? null);
  return null;
};
const statTxt = (c, k) => {
  const v = statVal(c, k); if (v == null) return "—";
  if (k === "rar") return `${v} · ${tierOf(v, "rua").name}`;
  if (k === "cv") return `${nf(v)} ${t("hp")}`;
  if (k === "vmax") return `${v} km/h`;
  if (k === "acc") return z100(c.s);
  if (k === "val") return v >= 1e6 ? `${(v / 1e6).toLocaleString(locale(), { maximumFractionDigits: 1 })} M€` : `${nf(Math.round(v / 1000))} k€`;
  return "";
};
function beats(a, b, k) { // 1 ganha, -1 perde, 0 empate
  const x = statVal(a, k), y = statVal(b, k);
  if (x == null && y == null) return 0; if (x == null) return -1; if (y == null) return 1;
  if (x === y) return 0;
  return k === "acc" ? (x < y ? 1 : -1) : (x > y ? 1 : -1);
}
function myDeck() {
  return [...data.rua, ...data.expo].map(c => ({ c, s: specForCar(c), r: +c.raridade, name: `${c.marca} ${c.modelo}`.trim(), foto: c.foto }))
    .filter(x => x.s && x.s.cv != null && x.s.vmax != null);
}
let cpuPool = null;
function cpuDeck() {
  if (cpuPool) return cpuPool;
  cpuPool = Object.entries(SPECS).filter(([, s]) => s.cv != null && s.vmax != null).map(([k, s]) => {
    const [b, m, v] = k.split("|"); const mm = (MODELS[b] || []).find(x => x.name === m);
    const vv = mm && v ? mm.vers.find(x => x.name === v) : null;
    return { s, r: vv ? vv.r : mm ? mm.r : 5, name: `${b} ${dispName(m)}${v ? " " + dispName(v) : ""}`, brand: b };
  });
  return cpuPool;
}
let duel = null;
function openDuel() {
  const mine = myDeck();
  if (mine.length < DUEL_ROUNDS) { toast({ icon: "⚔️", title: t("duel"), text: t("duelNeed") }); return; }
  const hand = shuffle(mine).slice(0, DUEL_ROUNDS), pool = cpuDeck(), used = new Set();
  const cpu = hand.map(h => {
    const near = pool.filter(p => !used.has(p.name) && p.name !== h.name && p.s.cv >= h.s.cv * 0.6 && p.s.cv <= h.s.cv * 1.6);
    const pick = (near.length ? near : pool.filter(p => !used.has(p.name)))[Math.floor(Math.random() * (near.length || pool.length - used.size))] || pool[0];
    used.add(pick.name); return pick;
  });
  duel = { hand, cpu, i: 0, me: 0, op: 0, picked: null };
  renderDuel(); $("duel").hidden = false; document.body.style.overflow = "hidden";
}
function closeDuel() { $("duel").hidden = true; document.body.style.overflow = $("ov").hidden ? "" : "hidden"; duel = null; render(); }
function duelCard(x, mine, reveal, picked, res) {
  const col = Math.max(1, Math.min(10, x.r));
  const ph = mine && x.foto && blobUrl(x.foto) ? `<img src="${blobUrl(x.foto)}" alt="">` : `<span class="dmono">${esc(initials(mine ? x.c.marca || "?" : x.brand))}</span>`;
  if (!reveal) return `<div class="dcard back"><span>?</span></div>`;
  return `<div class="dcard${res ? " " + res : ""}" style="${tierVar(col)}">
    <div class="dhead"><b>${esc(x.name)}</b></div>
    <div class="dph">${ph}</div>
    <div class="dstats">${DUEL_STATS.map(k => mine && !picked
      ? `<button type="button" class="dst" data-k="${k}"><span>${esc(t("st_" + k))}</span><b>${esc(statTxt(x, k))}</b></button>`
      : `<div class="dst${picked === k ? " on" : ""}"><span>${esc(t("st_" + k))}</span><b>${esc(statTxt(x, k))}</b></div>`).join("")}</div></div>`;
}
function renderDuel() {
  const d = duel, box = $("duelBody");
  if (d.i >= DUEL_ROUNDS) return renderDuelEnd();
  const me = d.hand[d.i], op = d.cpu[d.i], k = d.picked;
  const r = k ? beats(me, op, k) : null;
  box.innerHTML = `<div class="qtop"><span>${esc(t("duelRound", { i: d.i + 1, n: DUEL_ROUNDS }))}</span><b>${esc(t("duelYou"))} ${d.me} – ${d.op} ${esc(t("duelCpu"))}</b></div>
    ${k ? "" : `<p class="ptext">${esc(t("duelPick"))}</p>`}
    <div class="dtable">
      <div class="dside"><small>${esc(t("duelYou"))}</small>${duelCard(me, true, true, k, r === 1 ? "win" : r === -1 ? "lose" : "")}</div>
      <div class="dside"><small>${esc(t("duelCpu"))}</small>${duelCard(op, false, !!k, k, r === -1 ? "win" : r === 1 ? "lose" : "")}</div>
    </div>
    ${k ? `<p class="qfb ${r === 1 ? "ok" : r === -1 ? "bad" : ""}">${esc(r === 1 ? t("duelWin") : r === -1 ? t("duelLose") : t("duelTie"))}</p>
      <div class="actions" style="justify-content:center"><button type="button" class="btn" id="dNext">${esc(t("duelNext"))}</button></div>` : ""}`;
}
function renderDuelEnd() {
  const d = duel, today = iso(dayKey(new Date()));
  game.duel ||= { w: 0, l: 0, xp: {}, perfect: false };
  if (d.me > d.op) game.duel.w++; else if (d.op > d.me) game.duel.l++;
  if (d.me === DUEL_ROUNDS) game.duel.perfect = true;
  let got = 0;
  if (game.duel.xp[today] == null) { got = d.me * 4; game.duel.xp[today] = got; }
  saveGame();
  const icon = d.me > d.op ? "🏆" : d.me === d.op ? "🤝" : "💥";
  const msg = d.me > d.op ? "duelEndWin" : d.me === d.op ? "duelEndTie" : "duelEndLose";
  $("duelBody").innerHTML = `<div class="qend"><span class="qbig">${icon}</span><h2>${esc(t(msg, { a: d.me, b: d.op }))}</h2>
    <p>${esc(got ? t("duelXp", { n: got }) : t("duelNoXp"))}</p><p class="ptext">${esc(t("duelRecord", { w: game.duel.w, l: game.duel.l }))}</p>
    <div class="actions"><button class="btn" type="button" id="dAgain">${esc(t("duelAgain"))}</button><button class="btn ghost" type="button" id="dClose">${esc(t("close"))}</button></div></div>`;
  if (typeof sfx === "function") sfx(d.me > d.op ? "level" : "undo");
  checkGame();
}
document.addEventListener("click", e => {
  if (e.target.closest("[data-duel]")) { openDuel(); return; }
  if (!duel || $("duel").hidden) return;
  if (e.target.closest("#dAgain")) { openDuel(); return; }
  if (e.target.closest("#dClose") || e.target === $("duel")) { closeDuel(); return; }
  if (e.target.closest("#dNext")) { duel.i++; duel.picked = null; renderDuel(); return; }
  const b = e.target.closest(".dst[data-k]"); if (!b || duel.picked) return;
  duel.picked = b.dataset.k;
  const r = beats(duel.hand[duel.i], duel.cpu[duel.i], duel.picked);
  if (r === 1) duel.me++; else if (r === -1) duel.op++;
  if (typeof sfx === "function") sfx(r === 1 ? "flip" : r === -1 ? "undo" : "ach");
  if (typeof vib === "function") vib(r === 1 ? 40 : [60, 40, 60]);
  renderDuel();
});
document.addEventListener("keydown", e => { if (!$("duel").hidden && e.key === "Escape") closeDuel(); });
const duelXp = () => Object.values((game.duel && game.duel.xp) || {}).reduce((a, b) => a + b, 0) + Object.values(game.wishXp || {}).reduce((a, b) => a + b, 0);
function duelHtml() {
  const n = myDeck().length;
  return `<section class="fsec"><h2>${esc(t("duel"))}</h2><p class="ptext">${esc(t("duelSub"))}</p>
    ${game.duel ? `<p class="ptext">${esc(t("duelRecord", { w: game.duel.w, l: game.duel.l }))}</p>` : ""}
    ${n >= DUEL_ROUNDS ? `<div class="actions"><button class="btn" type="button" data-duel="1">${esc(t("duelStart"))}</button></div>` : `<p class="ptext">${esc(t("duelNeed"))}</p>`}</section>`;
}

/* ============ Lista de desejos ============ */
const WISH_XP = 15;
const wishList = () => (game.wish ||= []);
const wishKey = (b, m) => `${b}|${m}`;
function wishBtn(b, m) {
  const on = wishList().includes(wishKey(b, m));
  return `<button type="button" class="btn ${on ? "" : "ghost"} wishbtn" data-wish="${esc(wishKey(b, m))}">${esc(on ? t("wishDel") : t("wishAdd"))}</button>`;
}
function modelCaught(b, m) {
  return [...data.rua, ...data.expo].some(c => { const d = DEX_BY_KEY[norm(c.fabricante || c.marca)]; if (!d || d.name !== b) return false; const mi = matchModel(b, c.modelo); return mi != null && MODELS[b][mi].name === m; });
}
function checkWish(news) {
  game.wishXp ||= {};
  for (const k of wishList().slice()) {
    const [b, m] = k.split("|");
    if (modelCaught(b, m)) {
      game.wish = wishList().filter(x => x !== k);
      if (!game.wishXp[k]) { game.wishXp[k] = WISH_XP; news.push({ icon: "💭", title: t("wish"), text: t("wishGot", { m: `${b} ${dispName(m)}` }), xp: WISH_XP }); }
    }
  }
}
function wishHtml() {
  const l = wishList();
  return `<section class="fsec"><h2>💭 ${esc(t("wish"))}</h2><p class="ptext">${esc(t("wishSub", { n: WISH_XP }))}</p>
    ${l.length ? `<div class="chips wishes">${l.map(k => { const [b, m] = k.split("|"); return `<button type="button" class="chip" data-wopen="${esc(k)}">${esc(b)} ${esc(dispName(m))}</button>`; }).join("")}</div>`
    : `<p class="ptext">${esc(t("wishEmpty"))}</p>`}</section>`;
}
document.addEventListener("click", async e => {
  const w = e.target.closest("[data-wish]");
  if (w) {
    const k = w.dataset.wish, l = wishList();
    const [b, m] = k.split("|");
    if (l.includes(k)) game.wish = l.filter(x => x !== k);
    else if (!modelCaught(b, m)) l.push(k);
    await saveGame(); renderOv(true); if (typeof vib === "function") vib(25);
    return;
  }
  const o = e.target.closest("[data-wopen]");
  if (o) {
    const [b, m] = o.dataset.wopen.split("|");
    const d = DEX.find(x => x.name === b), mi = (MODELS[b] || []).findIndex(x => x.name === m);
    if (d && mi >= 0) ovPush({ type: "model", num: d.num, mi });
  }
});
