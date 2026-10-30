"use strict";
/* ============ Coleções temáticas ============ */
const SET_XP = 60;
const SETS = [
  ["italia", "🇮🇹", [["Ferrari"], ["Lamborghini"], ["Maserati"], ["Alfa Romeo"], ["Pagani"]]],
  ["alemaes", "🇩🇪", [["Mercedes-Benz"], ["BMW"], ["Audi"], ["Porsche"], ["Maybach"]]],
  ["japao", "🇯🇵", [["Toyota"], ["Honda"], ["Nissan"], ["Mazda"], ["Mitsubishi"], ["Subaru"], ["Suzuki"]]],
  ["muscle", "🇺🇸", [["Ford", "Mustang"], ["Chevrolet", "Camaro"], ["Chevrolet", "Corvette"], ["Dodge", "Challenger"], ["Dodge", "Charger"]]],
  ["porsche", "🏁", [["Porsche", "911"], ["Porsche", "Cayman"], ["Porsche", "Boxster"], ["Porsche", "Panamera"], ["Porsche", "Cayenne"], ["Porsche", "Macan"], ["Porsche", "Taycan"]]],
  ["classicos", "🕰️", [["Volkswagen", "Carocha"], ["Mini", "Mini clássico"], ["Renault", "4"], ["Citroën", "2CV"], ["Fiat", "500 (clássico)"], ["Volkswagen", "Pão de Forma"]]],
  ["eletricos", "⚡", [["Tesla", "Model 3"], ["Tesla", "Model Y"], ["Porsche", "Taycan"], ["Hyundai", "Ioniq 5"], ["Renault", "Zoe"], ["Nissan", "Leaf"]]],
  ["britanicos", "🇬🇧", [["Rolls-Royce"], ["Bentley"], ["Aston Martin"], ["Jaguar"], ["Land Rover"], ["McLaren"]]],
  ["lendas", "⭐", [["Volkswagen", "Golf"], ["Mercedes-Benz", "Classe G"], ["BMW", "M3"], ["Peugeot", "205"], ["Toyota", "Supra"], ["Nissan", "GT-R"]]],
  ["jipes", "⛰️", [["Land Rover", "Defender"], ["Jeep", "Wrangler"], ["Suzuki", "Jimny"], ["Mercedes-Benz", "Classe G"], ["UMM"]]],
  ["hiper", "🚀", [["Bugatti"], ["Pagani"], ["Koenigsegg"], ["McLaren"], ["Rimac"]]],
  ["portugal", "🇵🇹", [["UMM"], ["Portaro"]]],
];
function setItemCaught(item, all) {
  const [b, m] = item;
  return all.some(c => {
    const d = DEX_BY_KEY[norm(c.fabricante || c.marca)];
    if (!d || d.name !== b) return false;
    if (!m) return true;
    const mi = matchModel(b, c.modelo);
    return mi != null && MODELS[b][mi].name === m;
  });
}
function setsState() {
  const all = [...data.rua, ...data.expo];
  return SETS.map(([id, icon, items]) => {
    const got = items.map(it => setItemCaught(it, all));
    return { id, icon, items, got, n: got.filter(Boolean).length, done: got.every(Boolean) };
  });
}
function checkSets(news) {
  game.setsDone ||= {};
  for (const s of setsState()) if (s.done && !game.setsDone[s.id]) {
    game.setsDone[s.id] = SET_XP;
    news.push({ icon: s.icon, title: t("sets"), text: t("setDone", { s: t("set_" + s.id) }), xp: SET_XP });
  }
}
const funXp = () => Object.values(game.setsDone || {}).reduce((a, b) => a + b, 0) + Object.values((game.quiz && game.quiz.xp) || {}).reduce((a, b) => a + b, 0);
function setsHtml() {
  const st = setsState();
  return `<section class="fsec"><h2>${esc(t("sets"))}</h2><p class="ptext">${esc(t("setsSub", { n: SET_XP }))}</p>
    <div class="sets">${st.map(s => `<div class="set${s.done ? " done" : ""}">
      <div class="sh"><span class="si">${s.icon}</span><b>${esc(t("set_" + s.id))}</b><small>${s.done ? "✅" : esc(t("setProg", { a: s.n, b: s.items.length }))}</small></div>
      <div class="sp"><span style="width:${(s.n / s.items.length * 100).toFixed(0)}%"></span></div>
      <div class="chips">${s.items.map((it, i) => `<span class="chip${s.got[i] ? " got" : ""}">${s.got[i] ? "✓ " : ""}${esc(it[1] ? `${it[0] === "Mini" ? "" : it[0] + " "}${dispName(it[1])}` : it[0])}</span>`).join("")}</div>
    </div>`).join("")}</div></section>`;
}

/* ============ Marca do dia ============ */
function brandOfDay() { const r = rng("b" + iso(dayKey(new Date()))); return DEX[Math.floor(r() * DEX.length)]; }
function renderDexExtra() {
  const box = $("dexExtra"); if (!box) return;
  const d = brandOfDay(), have = caughtMap().has(d.num);
  box.innerHTML = `<button type="button" class="bod" data-num="${d.num}" style="--ty: var(--ty-${d.tipo})">
      <span class="bod-l">${esc(t("brandOfDay"))}</span>
      <span class="mono ${have ? d.tipo : "lockd"}" aria-hidden="true">${have ? esc(initials(d.name)) : "?"}</span>
      <span class="bod-t"><b>${esc(d.name)}</b><small>${esc(country(d.pais))} · ${esc(typeName(d.tipo))}</small><span>${esc(factOf(d))}</span>
      <em>${esc(have ? t("brandOfDayHave") : t("brandOfDayMiss"))}</em></span></button>
    <div class="actions"><button type="button" class="btn quizbtn" data-quiz="1">${esc(t("quiz"))}</button><button type="button" class="btn ghost quizbtn" data-duel="1">${esc(t("duel"))}</button></div>`;
}
document.addEventListener("click", e => {
  const b = e.target.closest(".bod"); if (b) { ovPush({ type: "brand", num: +b.dataset.num }); return; }
  if (e.target.closest("[data-quiz]")) openQuiz();
});

/* ============ Quiz ============ */
const shuffle = (a, r = Math.random) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pickN = (arr, n, ex = []) => shuffle(arr.filter(x => !ex.includes(x))).slice(0, n);
function qCountry() {
  const d = DEX[Math.floor(Math.random() * DEX.length)], all = [...new Set(DEX.map(x => x.pais))].filter(p => !p.includes("/"));
  if (d.pais.includes("/")) return null;
  return { q: t("q_country", { b: d.name }), a: country(d.pais), opts: [d.pais, ...pickN(all, 3, [d.pais])].map(country) };
}
function qYear() {
  const d = DEX[Math.floor(Math.random() * DEX.length)], ys = new Set([d.ano]);
  while (ys.size < 4) { const y = d.ano + (Math.random() < .5 ? -1 : 1) * (4 + Math.floor(Math.random() * 30)); if (y < 2026 && y > 1800) ys.add(y); }
  return { q: t("q_year", { b: d.name }), a: String(d.ano), opts: [...ys].map(String) };
}
function qMaker() {
  const pool = [];
  for (const [b, ms] of Object.entries(MODELS)) for (const m of ms) if (/[a-zà-ú]{3,}/i.test(m.name) && m.r >= 3) pool.push([b, m.name]);
  const [b, m] = pool[Math.floor(Math.random() * pool.length)];
  if (Object.entries(MODELS).some(([bb, ms]) => bb !== b && ms.some(x => x.name === m))) return null;
  return { q: t("q_maker", { m: dispName(m) }), a: b, opts: [b, ...pickN(DEX.map(d => d.name), 3, [b])] };
}
function qSpec(field) {
  const keys = Object.keys(SPECS).filter(k => SPECS[k][field] != null);
  const ch = pickN(keys, 2); if (ch.length < 2 || SPECS[ch[0]][field] === SPECS[ch[1]][field]) return null;
  const name = k => { const [b, m, v] = k.split("|"); return `${b} ${dispName(m)}${v ? " " + dispName(v) : ""}`; };
  const best = SPECS[ch[0]][field] > SPECS[ch[1]][field] ? ch[0] : ch[1];
  const val = k => field === "cv" ? `${nf(SPECS[k].cv)} ${t("hp")}` : `${SPECS[k].vmax} km/h`;
  return { q: t(field === "cv" ? "q_power" : "q_speed"), a: name(best), opts: ch.map(name), info: ch.map(k => `${name(k)}: ${val(k)}`).join(" · ") };
}
function qFact() {
  const d = DEX[Math.floor(Math.random() * DEX.length)];
  let f = factOf(d); const re = new RegExp(d.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  f = f.replace(re, "___");
  return { q: t("q_fact", { f }), a: d.name, opts: [d.name, ...pickN(DEX.map(x => x.name), 3, [d.name])] };
}
function qRarity() {
  const pool = [];
  for (const [b, ms] of Object.entries(MODELS)) for (const m of ms) pool.push([b, m.name, m.r]);
  const ch = []; const used = new Set();
  for (let tries = 0; ch.length < 4 && tries < 200; tries++) { const x = pool[Math.floor(Math.random() * pool.length)]; if (!used.has(x[2])) { used.add(x[2]); ch.push(x); } }
  if (ch.length < 4) return null;
  const best = ch.reduce((a, b) => b[2] > a[2] ? b : a), lab = x => `${x[0]} ${dispName(x[1])}`;
  return { q: t("q_rarity"), a: lab(best), opts: ch.map(lab) };
}
function makeQuiz() {
  const gens = [qCountry, qYear, qMaker, () => qSpec("cv"), () => qSpec("vmax"), qFact, qRarity];
  const qs = [];
  for (let tries = 0; qs.length < 10 && tries < 200; tries++) {
    const g = gens[(qs.length + tries) % gens.length]; let q = null; try { q = g(); } catch {}
    if (q && !qs.some(x => x.q === q.q && x.a === q.a) && new Set(q.opts).size === q.opts.length) { q.opts = shuffle(q.opts); qs.push(q); }
  }
  return qs;
}
let quiz = null;
function openQuiz() { quiz = { qs: makeQuiz(), i: 0, score: 0, locked: false }; renderQuiz(); $("quiz").hidden = false; document.body.style.overflow = "hidden"; }
function closeQuiz() { $("quiz").hidden = true; document.body.style.overflow = $("ov").hidden ? "" : "hidden"; quiz = null; render(); }
function renderQuiz() {
  const box = $("quizBody"), n = quiz.qs.length;
  if (quiz.i >= n) return renderQuizEnd();
  const q = quiz.qs[quiz.i];
  box.innerHTML = `<div class="qtop"><span>${esc(t("quizQ", { i: quiz.i + 1, n }))}</span><b>${quiz.score} ✓</b></div>
    <div class="qbar"><span style="width:${(quiz.i / n * 100).toFixed(0)}%"></span></div>
    <h2 class="qq">${esc(q.q)}</h2>
    <div class="qopts">${q.opts.map((o, i) => `<button type="button" class="qopt" data-i="${i}">${esc(o)}</button>`).join("")}</div>
    <p class="qfb" id="qfb" role="status"></p>`;
  const card = $("quizCard"); card.classList.remove("swap"); void card.offsetWidth; card.classList.add("swap");
}
function renderQuizEnd() {
  const n = quiz.qs.length, today = iso(dayKey(new Date()));
  game.quiz ||= { best: 0, rounds: 0, xp: {} };
  game.quiz.rounds++; game.quiz.best = Math.max(game.quiz.best || 0, quiz.score);
  let got = 0;
  if (game.quiz.xp[today] == null) { got = quiz.score * 3; game.quiz.xp[today] = got; }
  saveGame();
  const stars = quiz.score >= 9 ? "🏆" : quiz.score >= 6 ? "🥈" : quiz.score >= 3 ? "🥉" : "🚗";
  $("quizBody").innerHTML = `<div class="qend"><span class="qbig">${stars}</span><h2>${esc(t("quizEnd", { a: quiz.score, n }))}</h2>
    <p>${esc(got ? t("quizXp", { n: got }) : t("quizNoXp"))}</p><p class="ptext">${esc(t("quizBest", { a: game.quiz.best, n }))}</p>
    <div class="actions"><button class="btn" type="button" id="qAgain">${esc(t("quizAgain"))}</button><button class="btn ghost" type="button" id="qClose">${esc(t("close"))}</button></div></div>`;
  if (typeof sfx === "function") sfx(quiz.score >= 7 ? "level" : "ach");
  checkGame();
}
$("quiz").addEventListener("click", e => {
  if (!quiz) return;
  if (e.target.closest("#qAgain")) { openQuiz(); return; }
  if (e.target.closest("#qClose") || e.target === $("quiz")) { closeQuiz(); return; }
  const b = e.target.closest(".qopt"); if (!b || quiz.locked) return;
  quiz.locked = true;
  const q = quiz.qs[quiz.i], pick = q.opts[+b.dataset.i], ok = pick === q.a;
  document.querySelectorAll(".qopt").forEach(x => { const o = q.opts[+x.dataset.i]; if (o === q.a) x.classList.add("ok"); else if (x === b) x.classList.add("bad"); x.disabled = true; });
  if (ok) quiz.score++;
  $("qfb").textContent = (ok ? t("quizRight") : t("quizWrong", { a: q.a })) + (q.info ? ` (${q.info})` : "");
  $("qfb").className = "qfb " + (ok ? "ok" : "bad");
  if (typeof sfx === "function") sfx(ok ? "flip" : "undo"); if (typeof vib === "function") vib(ok ? 30 : [60, 40, 60]);
  setTimeout(() => { if (!quiz) return; quiz.i++; quiz.locked = false; renderQuiz(); }, q.info ? 1900 : 1200);
});
document.addEventListener("keydown", e => { if (!$("quiz").hidden && e.key === "Escape") closeQuiz(); });
