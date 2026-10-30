"use strict";
/* ============ Definições: tema, sons, vibração ============ */
const SETTINGS_DEF = { theme: "auto", sounds: true, vibration: true, text: "normal" };
let settings = { ...SETTINGS_DEF };
try { settings = { ...SETTINGS_DEF, ...JSON.parse(localStorage.getItem("definicoes") || "{}") }; } catch {}
function saveSettings() { try { localStorage.setItem("definicoes", JSON.stringify(settings)); } catch {} }
function applyTheme() {
  const r = document.documentElement;
  if (settings.theme === "light" || settings.theme === "dark") r.setAttribute("data-theme", settings.theme);
  else r.removeAttribute("data-theme");
  r.classList.toggle("bigtext", settings.text === "big");
  const dark = settings.theme === "dark" || (settings.theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = dark ? "#0E1114" : "#EDEFF2";
}
applyTheme();
try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme); } catch {}
function vib(p) { if (!settings.vibration) return; try { navigator.vibrate?.(p); } catch {} }

/* sons sintetizados (sem ficheiros) */
let actx = null;
function sfx(kind) {
  if (!settings.sounds) return;
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === "suspended") actx.resume();
    const notes = { flip: [523, 659, 784], rare: [523, 659, 784, 1047, 1319], ach: [784, 988, 1175], level: [392, 523, 659, 784, 1047], undo: [440, 330] }[kind] || [600];
    const t0 = actx.currentTime;
    notes.forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = kind === "undo" ? "sine" : "triangle"; o.frequency.value = f;
      const st = t0 + i * 0.09;
      g.gain.setValueAtTime(0.0001, st); g.gain.exponentialRampToValueAtTime(0.18, st + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, st + 0.28);
      o.connect(g).connect(actx.destination); o.start(st); o.stop(st + 0.3);
    });
  } catch {}
}

function settingsHtml() {
  const seg = (key, opts) => `<div class="seg2 s${opts.length}" data-set="${key}">${opts.map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${String(settings[key]) === String(v)}">${esc(l)}</button>`).join("")}</div>`;
  return `<section class="fsec"><h2>${esc(t("settings"))}</h2>
    <div class="setrow"><span>${esc(t("theme"))}</span>${seg("theme", [["auto", t("theme_auto")], ["light", t("theme_light")], ["dark", t("theme_dark")]])}</div>
    <div class="setrow"><span>${esc(t("sounds"))}</span>${seg("sounds", [[true, t("on")], [false, t("off")]])}</div>
    <div class="setrow"><span>${esc(t("vibration"))}</span>${seg("vibration", [[true, t("on")], [false, t("off")]])}</div>
    <div class="setrow"><span>${esc(t("textSize"))}</span>${seg("text", [["normal", t("text_normal")], ["big", t("text_big")]])}</div>
  </section>`;
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-set] [data-v]"); if (!b) return;
  const key = b.closest("[data-set]").dataset.set, raw = b.dataset.v;
  settings[key] = raw === "true" ? true : raw === "false" ? false : raw;
  saveSettings(); applyTheme();
  b.closest("[data-set]").querySelectorAll("[data-v]").forEach(x => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
  if (key === "sounds" && settings.sounds) sfx("ach");
  if (key === "vibration" && settings.vibration) vib(40);
});

/* ============ Sequência de dias ============ */
function dayNum(ms) { const d = new Date(ms); return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5); }
function streakInfo() {
  const days = new Set([...data.rua, ...data.expo].map(c => c.createdAt).filter(Boolean).map(dayNum));
  const today = dayNum(Date.now());
  let cur = 0, d = days.has(today) ? today : today - 1;
  while (days.has(d)) { cur++; d--; }
  let best = 0, run = 0, prev = null;
  [...days].sort((a, b) => a - b).forEach(x => { run = prev != null && x === prev + 1 ? run + 1 : 1; best = Math.max(best, run); prev = x; });
  return { cur, best, today: days.has(today) };
}

/* ============ Partilhar a carta como imagem ============ */
function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
async function cardImage(c) {
  const W = 1080, H = 1440, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d"), css = getComputedStyle(document.documentElement);
  const col = +c.raridade, base = col === 10 ? "#b77bff" : (css.getPropertyValue(`--t${col}`).trim() || "#2F72C4");
  const dark = col === 9 || col === 10 ? "#1b1030" : "#fff";
  // fundo
  ctx.fillStyle = "#0E1114"; ctx.fillRect(0, 0, W, H);
  const g = ctx.createLinearGradient(0, 0, W, H);
  if (col === 10) ["#ff6aa8", "#ffb347", "#6be3a8", "#6fa8ff", "#b77bff"].forEach((x, i) => g.addColorStop(i / 4, x));
  else { g.addColorStop(0, base); g.addColorStop(1, "#000"); }
  rr(ctx, 40, 40, W - 80, H - 80, 48); ctx.fillStyle = g; ctx.fill();
  // brilho
  const sh = ctx.createLinearGradient(0, 0, W, H); sh.addColorStop(0.35, "rgba(255,255,255,0)"); sh.addColorStop(0.5, "rgba(255,255,255,.18)"); sh.addColorStop(0.65, "rgba(255,255,255,0)");
  ctx.fillStyle = sh; rr(ctx, 40, 40, W - 80, H - 80, 48); ctx.fill();
  const font = (w, s) => `${w} ${s}px "Chakra Petch", "Arial Narrow", sans-serif`;
  ctx.fillStyle = dark; ctx.textBaseline = "top";
  ctx.font = font(600, 34); ctx.globalAlpha = .85; ctx.fillText((c.marca || "").toUpperCase(), 90, 90); ctx.globalAlpha = 1;
  ctx.font = font(700, 72); let name = c.modelo || ""; while (ctx.measureText(name).width > W - 330 && name.length > 3) name = name.slice(0, -2); if (name !== (c.modelo || "")) name += "…";
  ctx.fillText(name, 90, 132);
  const num = dexNum(c); if (num) { ctx.font = font(600, 40); ctx.textAlign = "right"; ctx.globalAlpha = .85; ctx.fillText(num, W - 90, 96); ctx.globalAlpha = 1; ctx.textAlign = "left"; }
  // foto
  const px = 90, py = 240, pw = W - 180, ph = 720;
  ctx.save(); rr(ctx, px, py, pw, ph, 28); ctx.clip(); ctx.fillStyle = "#000"; ctx.fillRect(px, py, pw, ph);
  const u = c.foto ? blobUrl(c.foto) : "";
  if (u) { try { const img = await loadImg(u); const s = Math.max(pw / img.width, ph / img.height); const iw = img.width * s, ih = img.height * s; ctx.drawImage(img, px + (pw - iw) / 2, py + (ph - ih) / 2, iw, ih); } catch {} }
  ctx.restore(); ctx.lineWidth = 8; ctx.strokeStyle = "rgba(255,255,255,.6)"; rr(ctx, px, py, pw, ph, 28); ctx.stroke();
  // raridade
  const tierName = tierOf(col, c.src).name.toUpperCase();
  ctx.font = font(700, 44); const tw = ctx.measureText(`${col}  ${tierName}`).width;
  rr(ctx, 90, 995, tw + 60, 76, 16); ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.fill();
  ctx.fillStyle = "#fff"; ctx.fillText(`${col}  ${tierName}`, 120, 1010);
  for (let i = 0; i < col; i++) { ctx.beginPath(); ctx.arc(W - 110 - i * 34, 1033, 11, 0, Math.PI * 2); ctx.fillStyle = "rgba(255,255,255,.95)"; ctx.fill(); }
  // stats
  const sp = specForCar(c);
  const stats = sp ? [[t("power"), sp.cv != null ? `${nf(sp.cv)} ${t("hp")}` : ""], [t("speed"), sp.vmax != null ? `${sp.vmax} km/h` : ""], ["0–100", sp.zero100 != null ? z100(sp) : ""]].filter(x => x[1]) : [];
  if (stats.length) {
    const bw = (W - 180 - (stats.length - 1) * 20) / stats.length;
    stats.forEach(([k, v], i) => {
      const x = 90 + i * (bw + 20); rr(ctx, x, 1100, bw, 130, 18); ctx.fillStyle = "rgba(0,0,0,.28)"; ctx.fill();
      ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.font = font(600, 28); ctx.globalAlpha = .85; ctx.fillText(k.toUpperCase(), x + bw / 2, 1120); ctx.globalAlpha = 1;
      ctx.font = font(700, 48); ctx.fillText(v, x + bw / 2, 1160); ctx.textAlign = "left";
    });
  }
  // rodapé
  ctx.fillStyle = dark; ctx.font = font(600, 32); ctx.globalAlpha = .85;
  ctx.fillText(t("appName"), 90, 1290);
  if (profile) { ctx.textAlign = "right"; ctx.fillText(t("caughtBy", { n: profile.nick }), W - 90, 1290); ctx.textAlign = "left"; }
  ctx.globalAlpha = 1;
  return new Promise(res => cv.toBlob(b => res(b), "image/png"));
}
async function shareCard(c) {
  if (window.PREVIEW) { toast({ icon: "📤", title: t("shareCard"), text: t("shareCardPreview") }); return; }
  try {
    const blob = await cardImage(c); if (!blob) throw 0;
    const file = new File([blob], `carta-${safeName((c.marca || "") + "-" + (c.modelo || ""))}.png`, { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: `${c.marca} ${c.modelo}` }); return; } catch (e) { if (e && e.name === "AbortError") return; }
    }
    downloadFile(file); toast({ icon: "📤", title: t("shareCard"), text: t("shareCardMade") });
  } catch { toast({ icon: "⚠️", title: t("shareCard"), text: t("shareCardFail") }); }
}

/* ============ Anular remoção ============ */
let undoBox = null, undoTimer = null;
function offerUndo(entry) {
  if (undoBox) finishUndo();
  undoBox = { ...entry };
  const el = document.createElement("div"); el.className = "toast undo in"; el.setAttribute("role", "status");
  el.innerHTML = `<span class="ti">🗑️</span><span class="tt"><b>${esc(t("removed"))}</b><span>${esc(`${entry.doc.data.marca || ""} ${entry.doc.data.modelo || ""}`.trim())}</span></span><button type="button" class="btn">${esc(t("undo2"))}</button>`;
  el.querySelector("button").addEventListener("click", async () => {
    const u = undoBox; if (!u) return; clearTimeout(undoTimer); undoBox = null; el.remove();
    try {
      await Store.put("docs", u.doc.coll + "/" + u.doc.id, u.doc);
      if (u.photoId && u.photo) { await Store.put("photos", u.photoId, u.photo); if (!urlCache.has(u.photoId)) urlCache.set(u.photoId, URL.createObjectURL(u.photo)); }
      await loadCars(); render(); sfx("undo"); toast({ icon: "↩️", title: t("restored"), text: `${u.doc.data.marca || ""} ${u.doc.data.modelo || ""}`.trim() });
    } catch {}
  });
  undoBox.el = el; $("toasts").appendChild(el);
  undoTimer = setTimeout(finishUndo, 6000);
}
function finishUndo() {
  const u = undoBox; if (!u) return; undoBox = null; clearTimeout(undoTimer);
  if (u.el) { u.el.classList.remove("in"); setTimeout(() => u.el.remove(), 400); }
  if (u.photoId) deletePhoto(u.photoId).catch(() => {});
}

/* ============ Aviso de nova versão ============ */
if ("serviceWorker" in navigator) {
  let hadController = !!navigator.serviceWorker.controller, shown = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController) { hadController = true; return; }
    if (shown) return; shown = true;
    const bar = $("updateBar"); if (!bar) return;
    bar.querySelector("span").textContent = t("updateReady"); bar.querySelector("button").textContent = t("updateBtn"); bar.hidden = false;
  });
  document.addEventListener("click", e => { if (e.target.closest("#updateBar button")) location.reload(); });
}
