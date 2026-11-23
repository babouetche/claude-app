// Shape Studio — éditeur photo/vidéo 100% dans le navigateur (iPhone)
const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const IMGLY = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm';
const HF = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';

const $ = (s, r = document) => r.querySelector(s);
const view = $('#view');
const vctx = view.getContext('2d');
const frame = document.createElement('canvas');
const fctx = frame.getContext('2d', { willReadFrequently: false });

const S = {
  type: null, file: null, img: null, video: null, W: 0, H: 0,
  tab: null,
  bg: { mode: 'none', color: '#00c2e0', image: null },
  cutout: null,
  texts: [], sel: null, nextId: 1,
  textDefaults: { color: '#ffffff', size: 8, style: 'outline' }, // size en % de la hauteur
  draw: document.createElement('canvas'), brush: { color: '#ff4d8d', size: 8, erase: false }, undo: [],
  face: { mode: 'none', emoji: '😎', image: null, scale: 1.2, cache: null },
  filters: { brightness: 100, contrast: 100, saturate: 100 },
  music: { el: null, name: '', vol: 0.8, offset: 0, gain: null },
  videoVol: 1, videoGain: null,
  photoDur: 10,
  trim: { start: 0, end: 0 },
  exporting: false, cancel: false,
};
const dctx = S.draw.getContext('2d');

/* ---------------- Utilitaires ---------------- */
const fmt = t => { t = Math.max(0, t || 0); const m = Math.floor(t / 60), s = Math.floor(t % 60); return `${m}:${String(s).padStart(2, '0')}`; };
const once = (el, ev) => new Promise((res, rej) => { el.addEventListener(ev, res, { once: true }); el.addEventListener('error', rej, { once: true }); });
const curT = () => S.type === 'video' ? S.video.currentTime : 0;
let mpTs = 0; const ts = () => (mpTs = Math.max(mpTs + 1, Math.floor(performance.now())));
const filterStr = () => { const f = S.filters; return (f.brightness === 100 && f.contrast === 100 && f.saturate === 100) ? 'none' : `brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturate}%)`; };

function overlay(text, prog = null, btns = []) {
  $('#overlay').hidden = false; $('#ovText').textContent = text;
  const p = $('#ovProg'); p.hidden = prog === null; if (prog !== null && prog >= 0) p.value = prog; else p.removeAttribute('value');
  const b = $('#ovBtns'); b.innerHTML = '';
  for (const [label, fn, cls] of btns) { const e = document.createElement('button'); e.className = 'btn ' + (cls || ''); e.textContent = label; e.onclick = fn; b.appendChild(e); }
}
const hideOverlay = () => { $('#overlay').hidden = true; };

/* ---------------- Audio ---------------- */
let AC = null, recDest = null;
function ensureAudio() {
  if (!AC) { AC = new (window.AudioContext || window.webkitAudioContext)(); recDest = AC.createMediaStreamDestination(); }
  if (AC.state === 'suspended') AC.resume();
}
function routeEl(el, vol) {
  ensureAudio();
  const src = AC.createMediaElementSource(el), g = AC.createGain();
  g.gain.value = vol; src.connect(g); g.connect(AC.destination); g.connect(recDest);
  return g;
}

/* ---------------- IA (chargées à la demande) ---------------- */
let visionP = null, faceP = null, segP = null, faceDet = null, segmenter = null;
function vision() {
  visionP ??= (async () => {
    const m = await import(`${MP}/vision_bundle.mjs`);
    const files = await m.FilesetResolver.forVisionTasks(`${MP}/wasm`);
    return { m, files };
  })().catch(e => { visionP = null; throw e; });
  return visionP;
}
function loadFaceDet() {
  faceP ??= (async () => {
    const { m, files } = await vision();
    faceDet = await m.FaceDetector.createFromOptions(files, {
      baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite', delegate: 'CPU' },
      runningMode: 'VIDEO', minDetectionConfidence: 0.45,
    });
    return faceDet;
  })().catch(e => { faceP = null; throw e; });
  return faceP;
}
function loadSegmenter() {
  segP ??= (async () => {
    const { m, files } = await vision();
    segmenter = await m.ImageSegmenter.createFromOptions(files, {
      baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite', delegate: 'CPU' },
      runningMode: 'VIDEO', outputConfidenceMasks: true, outputCategoryMask: false,
    });
    return segmenter;
  })().catch(e => { segP = null; throw e; });
  return segP;
}

const segSmall = document.createElement('canvas'), segMask = document.createElement('canvas'), subj = document.createElement('canvas');
function segmentPerson(src) {
  if (!segmenter) return null;
  const sw = 256, sh = Math.max(1, Math.round(256 * S.H / S.W));
  segSmall.width = sw; segSmall.height = sh;
  segSmall.getContext('2d').drawImage(src, 0, 0, sw, sh);
  let ok = false;
  segmenter.segmentForVideo(segSmall, ts(), r => {
    const ms = r.confidenceMasks; if (!ms || !ms.length) return;
    const mk = ms.length > 1 ? ms[1] : ms[0];
    const f = mk.getAsFloat32Array(), w = mk.width, h = mk.height;
    segMask.width = w; segMask.height = h;
    const mc = segMask.getContext('2d'), id = mc.createImageData(w, h);
    for (let i = 0; i < f.length; i++) { const a = f[i]; id.data[i * 4 + 3] = a < 0.2 ? 0 : a > 0.8 ? 255 : (a - 0.2) / 0.6 * 255; }
    mc.putImageData(id, 0, 0); ok = true;
  });
  if (!ok) return null;
  subj.width = S.W; subj.height = S.H;
  const c = subj.getContext('2d');
  c.clearRect(0, 0, S.W, S.H); c.drawImage(src, 0, 0, S.W, S.H);
  c.globalCompositeOperation = 'destination-in'; c.drawImage(segMask, 0, 0, S.W, S.H);
  c.globalCompositeOperation = 'source-over';
  return subj;
}

function detectFaces(src) {
  if (!faceDet) { loadFaceDet().then(() => { S.face.cache = null; req(); }).catch(() => {}); return []; }
  if (S.type === 'image' && S.face.cache) return S.face.cache;
  let res = [];
  try { res = faceDet.detectForVideo(src, ts()).detections.map(d => d.boundingBox); } catch (e) { console.warn(e); }
  if (S.type === 'image') S.face.cache = res;
  return res;
}

/* ---------------- Rendu ---------------- */
const tiny = document.createElement('canvas');
function cheapBlur(ctx, src, W, H, k = 24) {
  tiny.width = Math.max(1, Math.round(W / k)); tiny.height = Math.max(1, Math.round(H / k));
  const t = tiny.getContext('2d'); t.imageSmoothingEnabled = true; t.drawImage(src, 0, 0, tiny.width, tiny.height);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(tiny, 0, 0, W, H);
}
function drawCover(ctx, img, W, H) {
  const iw = img.naturalWidth || img.videoWidth || img.width, ih = img.naturalHeight || img.videoHeight || img.height;
  const s = Math.max(W / iw, H / ih), w = iw * s, h = ih * s;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
}

function faceRect(b, k = 1) {
  const cx = b.originX + b.width / 2, cy = b.originY + b.height / 2 - b.height * 0.08;
  return { cx, cy, w: b.width * k, h: b.height * 1.25 * k };
}
const pix = document.createElement('canvas');
function applyFaces(ctx, faces) {
  for (const b of faces) {
    const r = faceRect(b, S.face.scale);
    if (S.face.mode === 'pixel') {
      ctx.save(); ctx.beginPath(); ctx.ellipse(r.cx, r.cy, r.w / 2, r.h / 2, 0, 0, Math.PI * 2); ctx.clip();
      const n = 10; pix.width = n; pix.height = Math.round(n * r.h / r.w);
      const p = pix.getContext('2d'); p.drawImage(view, r.cx - r.w / 2, r.cy - r.h / 2, r.w, r.h, 0, 0, pix.width, pix.height);
      ctx.imageSmoothingEnabled = false; ctx.drawImage(pix, r.cx - r.w / 2, r.cy - r.h / 2, r.w, r.h); ctx.imageSmoothingEnabled = true;
      ctx.restore();
    } else if (S.face.mode === 'emoji') {
      ctx.save(); ctx.font = `${Math.round(r.h * 1.05)}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(S.face.emoji, r.cx, r.cy + r.h * 0.05); ctx.restore();
    } else if (S.face.mode === 'image' && S.face.image) {
      const fi = S.face.image, h = r.h * 1.1, w = h * fi.width / fi.height;
      ctx.drawImage(fi, r.cx - w / 2, r.cy - h / 2, w, h);
    }
  }
}

function textFont(t) { return `900 ${t.size}px -apple-system,"Helvetica Neue",Arial,sans-serif`; }
function textBox(t) {
  vctx.save(); vctx.font = textFont(t);
  const lines = t.text.split('\n'), lh = t.size * 1.18;
  const w = Math.max(...lines.map(l => vctx.measureText(l).width), 10); vctx.restore();
  const h = lh * lines.length, pad = t.size * 0.35;
  return { x: t.x - w / 2 - pad, y: t.y - h / 2 - pad, w: w + pad * 2, h: h + pad * 2, lines, lh };
}
function drawText(ctx, t, selected) {
  const bx = textBox(t);
  ctx.save(); ctx.font = textFont(t); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  if (t.style === 'box') { ctx.fillStyle = 'rgba(0,0,0,.6)'; roundRect(ctx, bx.x, bx.y, bx.w, bx.h, t.size * 0.3); ctx.fill(); }
  const y0 = t.y - (bx.lines.length - 1) * bx.lh / 2;
  bx.lines.forEach((l, i) => {
    const y = y0 + i * bx.lh;
    if (t.style === 'outline') { ctx.lineWidth = t.size * 0.2; ctx.strokeStyle = '#000'; ctx.strokeText(l, t.x, y); }
    if (t.style === 'shadow') { ctx.shadowColor = 'rgba(0,0,0,.8)'; ctx.shadowBlur = t.size * 0.25; ctx.shadowOffsetY = t.size * 0.06; }
    ctx.fillStyle = t.color; ctx.fillText(l, t.x, y);
  });
  ctx.restore();
  if (selected) { ctx.save(); ctx.setLineDash([10, 8]); ctx.lineWidth = Math.max(2, S.W / 400); ctx.strokeStyle = '#00c2e0'; ctx.strokeRect(bx.x, bx.y, bx.w, bx.h); ctx.restore(); }
}
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
const visibleTexts = () => { const t = curT(); return S.texts.filter(x => S.type !== 'video' || (t >= x.start && t < x.end)); };

function render(exporting = false) {
  if (!S.type) return;
  const W = S.W, H = S.H, ctx = vctx, F = filterStr();
  fctx.drawImage(S.type === 'video' ? S.video : S.img, 0, 0, W, H);
  ctx.clearRect(0, 0, W, H);
  let subject = null;
  if (S.bg.mode !== 'none') subject = S.type === 'image' ? S.cutout : segmentPerson(frame);
  if (!subject) { ctx.filter = F; ctx.drawImage(frame, 0, 0); ctx.filter = 'none'; }
  else {
    const m = S.bg.mode;
    if (m === 'color') { ctx.fillStyle = S.bg.color; ctx.fillRect(0, 0, W, H); }
    else if (m === 'image' && S.bg.image) drawCover(ctx, S.bg.image, W, H);
    else if (m === 'blur') cheapBlur(ctx, frame, W, H);
    else if (m === 'transparent' && S.type === 'video') { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
    ctx.filter = F; ctx.drawImage(subject, 0, 0, W, H); ctx.filter = 'none';
  }
  if (S.face.mode !== 'none') applyFaces(ctx, detectFaces(frame));
  ctx.drawImage(S.draw, 0, 0);
  for (const t of visibleTexts()) drawText(ctx, t, !exporting && t.id === S.sel);
}

let dirty = false;
const req = () => { dirty = true; };
function loop() {
  if (S.type && !S.exporting) {
    const v = S.video;
    if (v && !v.paused) {
      if (v.currentTime >= S.trim.end) { v.currentTime = S.trim.start; syncMusic(); }
      dirty = true; updatePlayer();
    }
    if (dirty) { dirty = false; render(); }
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* ---------------- Ouverture ---------------- */
$('#fileInput').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  ensureAudio();
  try { await openFile(f); } catch (err) { console.error(err); overlay('Impossible d’ouvrir ce fichier 😕\n' + (err.message || ''), null, [['OK', hideOverlay]]); }
});

async function openFile(file) {
  overlay('Ouverture…');
  if (S.video) { S.video.pause(); S.video.remove(); }
  Object.assign(S, { file, img: null, video: null, cutout: null, texts: [], sel: null, undo: [], videoGain: null });
  S.bg.mode = 'none'; S.face.cache = null;
  const url = URL.createObjectURL(file);
  let w, h, cap;
  if (file.type.startsWith('video') || /\.(mov|mp4|m4v|webm)$/i.test(file.name)) {
    const v = document.createElement('video');
    v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto'; v.src = url;
    $('#mediaHost').appendChild(v); v.load();
    await once(v, 'loadedmetadata');
    v.currentTime = 0.01; await once(v, 'seeked').catch(() => {});
    S.video = v; S.type = 'video'; w = v.videoWidth; h = v.videoHeight; cap = 1280;
    S.trim = { start: 0, end: v.duration };
    S.videoGain = routeEl(v, S.videoVol);
    v.onended = () => { if (S.exporting) return; v.currentTime = S.trim.start; v.play(); syncMusic(); };
  } else {
    const img = new Image(); img.src = url; await img.decode();
    S.img = img; S.type = 'image'; w = img.naturalWidth; h = img.naturalHeight; cap = 2048;
  }
  const s = Math.min(1, cap / Math.max(w, h));
  S.W = Math.round(w * s / 2) * 2; S.H = Math.round(h * s / 2) * 2;
  for (const c of [view, frame, S.draw]) { c.width = S.W; c.height = S.H; }
  $('#empty').hidden = true; view.hidden = false;
  $('#player').hidden = S.type !== 'video';
  $('#exportBtn').disabled = false;
  document.querySelector('[data-tab=couper]').hidden = S.type !== 'video';
  hideOverlay(); updatePlayer(); req();
  if (!S.tab) setTab('fond'); else renderPanel();
}

/* ---------------- Lecteur ---------------- */
function updatePlayer() {
  const v = S.video; if (!v) return;
  $('#seek').max = v.duration || 1; $('#seek').value = v.currentTime;
  $('#time').textContent = `${fmt(v.currentTime)} / ${fmt(v.duration)}`;
  $('#playBtn').textContent = v.paused ? '▶︎' : '❚❚';
}
function syncMusic() {
  const m = S.music.el; if (!m) return;
  const t = S.type === 'video' ? S.video.currentTime - S.trim.start : 0;
  try { m.currentTime = Math.max(0, S.music.offset + t); } catch {}
}
async function play() {
  ensureAudio(); const v = S.video;
  if (v.currentTime < S.trim.start || v.currentTime >= S.trim.end - 0.05) v.currentTime = S.trim.start;
  syncMusic(); await v.play(); S.music.el?.play();
  updatePlayer();
}
function pause() { S.video?.pause(); S.music.el?.pause(); updatePlayer(); req(); }
$('#playBtn').onclick = () => S.video.paused ? play() : pause();
$('#seek').oninput = e => { S.video.currentTime = +e.target.value; syncMusic(); updatePlayer(); };
document.addEventListener('visibilitychange', () => { if (document.hidden && !S.exporting) pause(); });
let seekedHook = () => { req(); updatePlayer(); };
document.addEventListener('seeked', e => { if (e.target === S.video) seekedHook(); }, true);

/* ---------------- Interactions canvas ---------------- */
function toMedia(e) { const r = view.getBoundingClientRect(); return { x: (e.clientX - r.left) * S.W / r.width, y: (e.clientY - r.top) * S.H / r.height }; }
let drag = null, last = null;
view.addEventListener('pointerdown', e => {
  if (!S.type) return; view.setPointerCapture(e.pointerId);
  const p = toMedia(e);
  if (S.tab === 'dessin') {
    S.undo.push(dctx.getImageData(0, 0, S.W, S.H)); if (S.undo.length > 8) S.undo.shift();
    last = p; stroke(p, p); return;
  }
  const hit = visibleTexts().reverse().find(t => { const b = textBox(t); return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h; });
  if (hit) { S.sel = hit.id; drag = { id: hit.id, dx: p.x - hit.x, dy: p.y - hit.y }; if (S.tab !== 'texte') setTab('texte'); else renderPanel(); }
  else if (S.sel) { S.sel = null; if (S.tab === 'texte') renderPanel(); }
  req();
});
view.addEventListener('pointermove', e => {
  const p = toMedia(e);
  if (last) { stroke(last, p); last = p; req(); return; }
  if (drag) { const t = S.texts.find(x => x.id === drag.id); if (t) { t.x = p.x - drag.dx; t.y = p.y - drag.dy; req(); } }
});
const endPtr = () => { last = null; drag = null; };
view.addEventListener('pointerup', endPtr); view.addEventListener('pointercancel', endPtr);
function stroke(a, b) {
  const r = view.getBoundingClientRect(), k = S.W / r.width;
  dctx.save(); dctx.lineCap = 'round'; dctx.lineJoin = 'round'; dctx.lineWidth = S.brush.size * k;
  dctx.strokeStyle = S.brush.color; dctx.globalCompositeOperation = S.brush.erase ? 'destination-out' : 'source-over';
  dctx.beginPath(); dctx.moveTo(a.x, a.y); dctx.lineTo(b.x + 0.01, b.y); dctx.stroke(); dctx.restore();
}

/* ---------------- Onglets ---------------- */
document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => setTab(S.tab === b.dataset.tab ? null : b.dataset.tab));
function setTab(t) {
  S.tab = t;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  renderPanel(); req();
}
function renderPanel() {
  const P = $('#panel');
  if (!S.tab) { P.innerHTML = ''; return; }
  if (!S.type) { P.innerHTML = '<p class="muted">Ouvre d’abord une photo ou une vidéo 📂</p>'; return; }
  P.innerHTML = '';
  ({ fond: panelFond, texte: panelTexte, dessin: panelDessin, visage: panelVisage, musique: panelMusique, reglages: panelReglages, couper: panelCouper })[S.tab](P);
}
const h = html => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d; };
function seg(P, opts, cur, onPick) {
  const d = document.createElement('div'); d.className = 'seg';
  for (const [v, label] of opts) { const b = document.createElement('button'); b.textContent = label; b.classList.toggle('on', v === cur); b.onclick = () => onPick(v); d.appendChild(b); }
  P.appendChild(d); return d;
}
function slider(P, label, min, max, step, val, onInput, fmtv = v => v) {
  const d = h(`<div class="row"><label>${label}</label><input type="range" min="${min}" max="${max}" step="${step}" value="${val}"><span class="muted">${fmtv(val)}</span></div>`).firstChild;
  const i = $('input', d), sp = $('span', d);
  i.oninput = () => { sp.textContent = fmtv(+i.value); onInput(+i.value); };
  P.appendChild(d); return i;
}
function filePick(P, label, accept, onFile) {
  const d = h(`<label class="btn sm">${label}<input type="file" accept="${accept}" hidden></label>`).firstChild;
  $('input', d).onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) onFile(f); };
  P.appendChild(d); return d;
}

/* ---- Fond ---- */
function panelFond(P) {
  const opts = [['none', 'Original'], ...(S.type === 'image' ? [['transparent', 'Transparent']] : []), ['color', 'Couleur'], ['blur', 'Flou'], ['image', 'Image']];
  seg(P, opts, S.bg.mode, async m => {
    S.bg.mode = m; renderPanel();
    try { await prepareCutout(); } catch (e) { console.error(e); S.bg.mode = 'none'; overlay('Le détourage a échoué 😕\nVérifie ta connexion (le modèle IA se télécharge la 1ère fois).', null, [['OK', hideOverlay]]); renderPanel(); }
    req();
  });
  const row = document.createElement('div'); row.className = 'row'; P.appendChild(row);
  if (S.bg.mode === 'color') {
    const c = h(`<input type="color" value="${S.bg.color}">`).firstChild; c.oninput = () => { S.bg.color = c.value; req(); };
    row.append('Couleur :', c);
    for (const col of ['#ffffff', '#000000', '#00c2e0', '#ff4d8d', '#ffd60a', '#0a2540']) {
      const s = document.createElement('button'); s.className = 'swatch'; s.style.background = col; s.onclick = () => { S.bg.color = col; c.value = col; req(); }; row.appendChild(s);
    }
  }
  if (S.bg.mode === 'image') filePick(row, '🖼️ Choisir le nouveau fond', 'image/*', async f => { const i = new Image(); i.src = URL.createObjectURL(f); await i.decode(); S.bg.image = i; req(); });
  P.appendChild(h(`<p class="note">${S.type === 'image' ? 'Photo : l’IA détoure n’importe quel sujet (1er usage : ~40 Mo à télécharger).' : 'Vidéo : l’IA détoure les personnes, image par image.'} “Transparent” exporte un PNG sans fond.</p>`));
}
async function prepareCutout() {
  if (S.bg.mode === 'none') return;
  if (S.type === 'video') {
    if (!segmenter) { overlay('Chargement de l’IA de détourage…'); try { await loadSegmenter(); } finally { hideOverlay(); } }
    return;
  }
  if (S.cutout) return;
  overlay('Détourage en cours…\n(1ère fois : téléchargement du modèle IA)', -1);
  fctx.drawImage(S.img, 0, 0, S.W, S.H);
  const blob = await new Promise(r => frame.toBlob(r, 'image/png'));
  try {
    const { removeBackground } = await import(IMGLY);
    const out = await removeBackground(blob, {
      model: 'isnet_quint8', output: { format: 'image/png' },
      progress: (key, cur, tot) => { if (tot) overlay(`Téléchargement du modèle IA…\n${Math.round(cur / tot * 100)} %`, cur / tot); },
    });
    overlay('Détourage en cours…', -1);
    const bmp = await createImageBitmap(out);
    const c = document.createElement('canvas'); c.width = S.W; c.height = S.H; c.getContext('2d').drawImage(bmp, 0, 0, S.W, S.H);
    S.cutout = c;
  } catch (e) {
    console.warn('imgly KO, repli MediaPipe', e);
    await loadSegmenter();
    const c = segmentPerson(frame); if (!c) throw e;
    const k = document.createElement('canvas'); k.width = S.W; k.height = S.H; k.getContext('2d').drawImage(c, 0, 0); S.cutout = k;
  } finally { hideOverlay(); }
}

/* ---- Texte / sous-titres ---- */
function newText(text, extra = {}) {
  const d = S.textDefaults, t0 = curT();
  const t = { id: S.nextId++, text, x: S.W / 2, y: S.type === 'video' ? S.H * 0.8 : S.H / 2, size: Math.round(S.H * d.size / 100), color: d.color, style: d.style, start: t0, end: Math.min(t0 + 3, S.video ? S.video.duration : 3), ...extra };
  S.texts.push(t); return t;
}
function panelTexte(P) {
  const sel = S.texts.find(t => t.id === S.sel);
  const ta = h(`<textarea placeholder="Ton texte ou sous-titre…"></textarea>`).firstChild; P.appendChild(ta);
  const row = h(`<div class="row"></div>`).firstChild; P.appendChild(row);
  const add = h(`<button class="btn primary sm">＋ Ajouter${S.type === 'video' ? ' ici (3 s)' : ''}</button>`).firstChild;
  add.onclick = () => { if (!ta.value.trim()) return ta.focus(); const t = newText(ta.value.trim()); S.sel = t.id; renderPanel(); req(); };
  row.appendChild(add);
  if (S.type === 'video') { const a = h(`<button class="btn pink sm">🪄 Sous-titres auto</button>`).firstChild; a.onclick = autoSubs; row.appendChild(a); }

  const tgt = sel || S.textDefaults;
  const st = document.createElement('div'); P.appendChild(st);
  st.appendChild(h(`<p class="note">${sel ? 'Style du texte sélectionné (glisse-le sur l’image pour le déplacer) :' : 'Style des prochains textes :'}</p>`));
  const crow = h(`<div class="row"></div>`).firstChild; st.appendChild(crow);
  for (const col of ['#ffffff', '#ffd60a', '#00c2e0', '#ff4d8d', '#000000']) {
    const s = document.createElement('button'); s.className = 'swatch' + (tgt.color === col ? ' on' : ''); s.style.background = col;
    s.onclick = () => { tgt.color = col; if (sel) applyToSubs(sel, 'color'); renderPanel(); req(); }; crow.appendChild(s);
  }
  seg(st, [['outline', 'Contour'], ['box', 'Encadré'], ['shadow', 'Ombre']], tgt.style, v => { tgt.style = v; if (sel) applyToSubs(sel, 'style'); renderPanel(); req(); });
  const pct = sel ? Math.round(sel.size / S.H * 100) : S.textDefaults.size;
  slider(st, 'Taille', 2, 25, 1, pct, v => { if (sel) { sel.size = Math.round(S.H * v / 100); applyToSubs(sel, 'size'); } else S.textDefaults.size = v; req(); }, v => v + '%');

  if (!S.texts.length) return;
  const list = h(`<div class="list"></div>`).firstChild; P.appendChild(list);
  const items = S.type === 'video' ? [...S.texts].sort((a, b) => a.start - b.start) : S.texts;
  for (const t of items) {
    const it = h(`<div class="item${t.id === S.sel ? ' on' : ''}"><input type="text"></div>`).firstChild;
    const inp = $('input', it); inp.value = t.text;
    inp.onfocus = () => { if (S.sel !== t.id) { S.sel = t.id; if (S.video) { S.video.currentTime = t.start + 0.01; } req(); highlight(list, it); } };
    inp.oninput = () => { t.text = inp.value; req(); };
    if (S.type === 'video') {
      for (const k of ['start', 'end']) {
        const n = h(`<input type="number" step="0.1" min="0" title="${k === 'start' ? 'Début' : 'Fin'} (s)">`).firstChild; n.value = t[k].toFixed(1);
        n.onchange = () => { t[k] = Math.max(0, +n.value); req(); }; it.appendChild(n);
      }
    }
    const x = h(`<button class="x">✕</button>`).firstChild; x.onclick = () => { S.texts = S.texts.filter(y => y !== t); if (S.sel === t.id) S.sel = null; renderPanel(); req(); };
    it.appendChild(x); list.appendChild(it);
  }
  if (S.texts.length > 1) { const c = h(`<button class="btn sm" style="margin-top:8px">🗑️ Tout effacer</button>`).firstChild; c.onclick = () => { if (confirm('Effacer tous les textes ?')) { S.texts = []; S.sel = null; renderPanel(); req(); } }; P.appendChild(c); }
}
function highlight(list, it) { list.querySelectorAll('.item').forEach(e => e.classList.toggle('on', e === it)); }
function applyToSubs(sel, key) { if (sel.auto) for (const t of S.texts) if (t.auto) t[key] = sel[key]; }

async function autoSubs() {
  pause();
  S.cancel = false;
  overlay('Chargement de l’IA de transcription…\n(1ère fois : ~80 Mo, garde l’écran allumé)', -1, [['Annuler', () => { S.cancel = true; hideOverlay(); }]]);
  try {
    const { pipeline } = await import(HF);
    const files = {};
    const asr = await pipeline('automatic-speech-recognition', 'Xenova/whisper-base', {
      progress_callback: p => {
        if (p.status === 'progress' && p.total) { files[p.file] = [p.loaded, p.total]; const v = Object.values(files); const l = v.reduce((a, x) => a + x[0], 0), tt = v.reduce((a, x) => a + x[1], 0); overlay(`Téléchargement de l’IA… ${Math.round(l / tt * 100)} %`, l / tt, [['Annuler', () => { S.cancel = true; hideOverlay(); }]]); }
      },
    });
    if (S.cancel) return;
    overlay('Extraction du son…', -1);
    const audio = await audio16k(S.file);
    const a = Math.floor(S.trim.start * 16000), b = Math.min(audio.length, Math.ceil(S.trim.end * 16000));
    overlay('Transcription en cours… 🎙️\n(ça peut prendre 1 à 2× la durée de la vidéo)', -1, [['Annuler', () => { S.cancel = true; hideOverlay(); }]]);
    const out = await asr(audio.subarray(a, b), { language: 'french', task: 'transcribe', chunk_length_s: 30, stride_length_s: 5, return_timestamps: true });
    if (S.cancel) return;
    S.texts = S.texts.filter(t => !t.auto);
    const segs = splitSubs(out.chunks || [{ text: out.text, timestamp: [0, (b - a) / 16000] }], (b - a) / 16000);
    for (const s of segs) newText(s.text, { start: S.trim.start + s.start, end: S.trim.start + s.end, auto: true, y: S.H * 0.78, size: Math.round(S.H * 0.055) });
    hideOverlay(); renderPanel(); req();
    if (!segs.length) overlay('Aucune parole détectée 🤷', null, [['OK', hideOverlay]]);
  } catch (e) {
    console.error(e); overlay('La transcription a échoué 😕\n' + (e.message || '') + '\nTu peux ajouter tes sous-titres à la main.', null, [['OK', hideOverlay]]);
  }
}
function splitSubs(chunks, dur) {
  const res = [];
  for (const c of chunks) {
    const txt = (c.text || '').trim(); if (!txt) continue;
    const s = c.timestamp?.[0] ?? 0, e = c.timestamp?.[1] ?? dur;
    const words = txt.split(/\s+/), parts = [];
    for (let i = 0; i < words.length; i += 5) parts.push(words.slice(i, i + 5).join(' '));
    const total = parts.reduce((a, p) => a + p.length, 0) || 1; let t = s;
    for (const p of parts) { const d = (e - s) * p.length / total; res.push({ text: p, start: t, end: t + d }); t += d; }
  }
  return res;
}
async function audio16k(file) {
  ensureAudio();
  const buf = await AC.decodeAudioData(await file.arrayBuffer());
  const off = new OfflineAudioContext(1, Math.ceil(buf.duration * 16000), 16000);
  const src = off.createBufferSource(); src.buffer = buf; src.connect(off.destination); src.start();
  return (await off.startRendering()).getChannelData(0);
}

/* ---- Dessin ---- */
function panelDessin(P) {
  P.appendChild(h(`<p class="note">Dessine directement avec ton doigt sur l’image ✍️</p>`));
  const row = h(`<div class="row"></div>`).firstChild; P.appendChild(row);
  for (const col of ['#ff4d8d', '#00c2e0', '#ffd60a', '#ffffff', '#000000', '#22c55e']) {
    const s = document.createElement('button'); s.className = 'swatch' + (S.brush.color === col && !S.brush.erase ? ' on' : ''); s.style.background = col;
    s.onclick = () => { S.brush.color = col; S.brush.erase = false; renderPanel(); }; row.appendChild(s);
  }
  const c = h(`<input type="color" value="${S.brush.color}">`).firstChild; c.oninput = () => { S.brush.color = c.value; S.brush.erase = false; }; row.appendChild(c);
  slider(P, 'Épaisseur', 2, 40, 1, S.brush.size, v => S.brush.size = v, v => v + ' px');
  const r2 = h(`<div class="row"></div>`).firstChild; P.appendChild(r2);
  const er = h(`<button class="btn sm">${S.brush.erase ? '✅ ' : ''}🧽 Gomme</button>`).firstChild; er.onclick = () => { S.brush.erase = !S.brush.erase; renderPanel(); };
  const un = h(`<button class="btn sm">↩️ Annuler</button>`).firstChild; un.onclick = () => { const d = S.undo.pop(); if (d) { dctx.putImageData(d, 0, 0); req(); } };
  const cl = h(`<button class="btn sm">🗑️ Tout effacer</button>`).firstChild; cl.onclick = () => { S.undo.push(dctx.getImageData(0, 0, S.W, S.H)); dctx.clearRect(0, 0, S.W, S.H); req(); };
  r2.append(er, un, cl);
}

/* ---- Visage ---- */
function panelVisage(P) {
  seg(P, [['none', 'Aucun'], ['pixel', 'Flouter'], ['emoji', 'Emoji'], ['image', 'Autre visage']], S.face.mode, async m => {
    S.face.mode = m; S.face.cache = null; renderPanel();
    if (m !== 'none' && !faceDet) { overlay('Chargement de la détection de visages…', -1); try { await loadFaceDet(); } catch (e) { overlay('Échec du chargement 😕 Vérifie ta connexion.', null, [['OK', hideOverlay]]); S.face.mode = 'none'; renderPanel(); return; } hideOverlay(); }
    req();
  });
  if (S.face.mode === 'emoji') {
    const row = h(`<div class="seg"></div>`).firstChild; P.appendChild(row);
    for (const em of ['😎', '😂', '🤩', '😜', '🥳', '🤖', '🐶', '🦈', '🏊', '💪', '❤️', '⭐']) {
      const b = document.createElement('button'); b.textContent = em; b.classList.toggle('on', S.face.emoji === em); b.style.fontSize = '20px';
      b.onclick = () => { S.face.emoji = em; renderPanel(); req(); }; row.appendChild(b);
    }
  }
  if (S.face.mode === 'image') {
    const row = h(`<div class="row"></div>`).firstChild; P.appendChild(row);
    filePick(row, S.face.image ? '🔁 Changer le visage' : '🖼️ Choisir la photo du visage', 'image/*', loadReplacementFace);
    if (S.face.image) { const pv = document.createElement('canvas'); pv.width = 40; pv.height = 40 * S.face.image.height / S.face.image.width; pv.getContext('2d').drawImage(S.face.image, 0, 0, pv.width, pv.height); row.appendChild(pv); }
  }
  if (S.face.mode !== 'none') {
    slider(P, 'Taille', 0.8, 2, 0.05, S.face.scale, v => { S.face.scale = v; req(); }, v => '×' + v.toFixed(2));
    const n = S.type === 'image' && S.face.cache ? S.face.cache.length : null;
    if (n !== null) P.appendChild(h(`<p class="note">${n ? n + ' visage(s) détecté(s) ✅' : 'Aucun visage détecté (essaie un visage bien de face).'}</p>`));
  }
  P.appendChild(h(`<p class="note">⚠️ “Autre visage” : uniquement avec l’accord des personnes concernées, et pour du fun — pas pour faire croire à quelque chose de faux.</p>`));
}
async function loadReplacementFace(file) {
  overlay('Recherche du visage…', -1);
  try {
    await loadFaceDet();
    const img = new Image(); img.src = URL.createObjectURL(file); await img.decode();
    const s = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const dets = faceDet.detectForVideo(c, ts()).detections.map(d => d.boundingBox);
    if (!dets.length) { overlay('Aucun visage trouvé sur cette photo 😕\nPrends un visage bien de face.', null, [['OK', hideOverlay]]); return; }
    const b = dets.sort((a, z) => z.width * z.height - a.width * a.height)[0];
    const r = faceRect(b, 1.1);
    const out = document.createElement('canvas'); out.width = Math.round(r.w); out.height = Math.round(r.h);
    const o = out.getContext('2d');
    o.drawImage(c, r.cx - r.w / 2, r.cy - r.h / 2, r.w, r.h, 0, 0, out.width, out.height);
    o.globalCompositeOperation = 'destination-in';
    o.save(); o.translate(out.width / 2, out.height / 2); o.scale(out.width / 2, out.height / 2);
    const g = o.createRadialGradient(0, 0, 0.55, 0, 0, 1); g.addColorStop(0, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)');
    o.fillStyle = g; o.beginPath(); o.arc(0, 0, 1, 0, Math.PI * 2); o.fill(); o.restore();
    S.face.image = out; hideOverlay(); renderPanel(); req();
  } catch (e) { console.error(e); overlay('Impossible de charger ce visage 😕', null, [['OK', hideOverlay]]); }
}

/* ---- Musique ---- */
function panelMusique(P) {
  const row = h(`<div class="row"></div>`).firstChild; P.appendChild(row);
  filePick(row, S.music.el ? '🔁 Changer' : '🎵 Ajouter une musique', 'audio/*,.mp3,.m4a,.wav,.aac', loadMusic);
  if (S.music.el) {
    row.appendChild(h(`<span class="muted">${S.music.name}</span>`).firstChild);
    const rm = h(`<button class="x">✕</button>`).firstChild; rm.onclick = () => { S.music.el.pause(); S.music.el = null; renderPanel(); }; row.appendChild(rm);
    slider(P, 'Musique', 0, 1.5, 0.05, S.music.vol, v => { S.music.vol = v; if (S.music.gain) S.music.gain.gain.value = v; }, v => Math.round(v * 100) + '%');
    const md = S.music.el.duration || 0;
    if (md) slider(P, 'Démarrer à', 0, Math.max(0, md - 1), 0.5, S.music.offset, v => { S.music.offset = v; syncMusic(); }, fmt);
    if (S.type === 'image') {
      slider(P, 'Durée vidéo', 3, 60, 1, S.photoDur, v => S.photoDur = v, v => v + ' s');
      const pre = h(`<button class="btn sm">▶︎ Pré-écoute</button>`).firstChild;
      pre.onclick = () => { ensureAudio(); const m = S.music.el; if (!m.paused) { m.pause(); return; } m.currentTime = S.music.offset; m.play(); setTimeout(() => m.pause(), 8000); };
      P.appendChild(pre);
    }
  }
  if (S.type === 'video') slider(P, 'Son vidéo', 0, 1.5, 0.05, S.videoVol, v => { S.videoVol = v; if (S.videoGain) S.videoGain.gain.value = v; }, v => Math.round(v * 100) + '%');
  P.appendChild(h(`<p class="note">${S.type === 'image' ? 'Photo + musique = export en vidéo (parfait pour un Reel). ' : ''}Prends tes fichiers dans l’app Fichiers (MP3/M4A). Les titres Apple Music/Spotify sont protégés et ne peuvent pas être importés. Pour Insta, privilégie des musiques libres de droits.</p>`));
}
async function loadMusic(f) {
  ensureAudio();
  if (S.music.el) S.music.el.pause();
  const a = new Audio(); a.src = URL.createObjectURL(f); a.preload = 'auto'; $('#mediaHost').appendChild(a);
  await once(a, 'loadedmetadata').catch(() => {});
  S.music = { ...S.music, el: a, name: f.name.replace(/\.[^.]+$/, ''), offset: 0, gain: routeEl(a, S.music.vol) };
  renderPanel();
}

/* ---- Réglages ---- */
function panelReglages(P) {
  const f = S.filters;
  slider(P, 'Luminosité', 50, 160, 1, f.brightness, v => { f.brightness = v; req(); }, v => v + '%');
  slider(P, 'Contraste', 50, 160, 1, f.contrast, v => { f.contrast = v; req(); }, v => v + '%');
  slider(P, 'Saturation', 0, 200, 1, f.saturate, v => { f.saturate = v; req(); }, v => v + '%');
  const pre = h(`<div class="seg"></div>`).firstChild; P.appendChild(pre);
  for (const [n, b, c, s] of [['Normal', 100, 100, 100], ['Pop 🌊', 105, 112, 140], ['Soleil ☀️', 112, 105, 120], ['N&B', 105, 120, 0], ['Doux', 108, 90, 90]]) {
    const x = document.createElement('button'); x.textContent = n; x.onclick = () => { Object.assign(f, { brightness: b, contrast: c, saturate: s }); renderPanel(); req(); }; pre.appendChild(x);
  }
}

/* ---- Couper ---- */
function panelCouper(P) {
  const d = S.video.duration;
  slider(P, 'Début', 0, d, 0.1, S.trim.start, v => { S.trim.start = Math.min(v, S.trim.end - 0.5); S.video.currentTime = S.trim.start; }, fmt);
  slider(P, 'Fin', 0, d, 0.1, S.trim.end, v => { S.trim.end = Math.max(v, S.trim.start + 0.5); S.video.currentTime = Math.max(S.trim.start, S.trim.end - 1); }, fmt);
  P.appendChild(h(`<p class="note">Seule la partie entre Début et Fin sera exportée.</p>`));
}

/* ---------------- Export ---------------- */
$('#exportBtn').onclick = () => {
  if (S.type === 'video') return exportVideo();
  const btns = [['🖼️ Photo (PNG)', exportPhoto, 'primary']];
  if (S.music.el) btns.push([`🎬 Vidéo ${S.photoDur} s avec musique`, exportVideo, 'pink']);
  btns.push(['Annuler', hideOverlay]);
  overlay('Exporter en…', null, btns);
};
async function exportPhoto() {
  overlay('Préparation…', -1);
  render(true);
  const blob = await new Promise(r => view.toBlob(r, 'image/png'));
  req();
  offerSave(blob, `shape-studio-${Date.now()}.png`);
}
function pickMime() {
  if (!window.MediaRecorder) return null;
  return ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m)) || '';
}
async function exportVideo() {
  const mime = pickMime();
  if (mime === null || !view.captureStream) { overlay('Ton navigateur ne permet pas l’export vidéo 😕\nMets à jour iOS (16+).', null, [['OK', hideOverlay]]); return; }
  ensureAudio(); pause();
  if (S.bg.mode !== 'none' && S.type === 'video' && !segmenter) await prepareCutout();
  S.exporting = true; S.cancel = false;
  const isVid = S.type === 'video', v = S.video, m = S.music.el;
  const dur = isVid ? S.trim.end - S.trim.start : S.photoDur;
  const cancelBtn = [['Annuler', () => { S.cancel = true; }]];
  overlay('Export en cours… garde l’écran allumé 🎬', 0, cancelBtn);
  if (isVid) { v.currentTime = S.trim.start; await once(v, 'seeked').catch(() => {}); }
  render(true);
  const stream = view.captureStream(30);
  const tracks = [...stream.getVideoTracks(), ...recDest.stream.getAudioTracks()];
  const rec = new MediaRecorder(new MediaStream(tracks), { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 8_000_000 });
  const chunks = []; rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  const stopped = new Promise(r => rec.onstop = r);
  rec.start(500);
  if (m) { m.currentTime = S.music.offset; m.play(); }
  if (isVid) await v.play();
  const t0 = performance.now();
  await new Promise(res => {
    const step = () => {
      const el = isVid ? v.currentTime - S.trim.start : (performance.now() - t0) / 1000;
      if (S.cancel || el >= dur || (isVid && v.ended)) return res();
      render(true);
      $('#ovProg').value = Math.min(1, el / dur);
      requestAnimationFrame(step);
    };
    step();
  });
  v?.pause(); m?.pause(); rec.stop(); await stopped;
  stream.getTracks().forEach(t => t.stop());
  S.exporting = false; req(); updatePlayer();
  if (S.cancel) { hideOverlay(); return; }
  const type = (rec.mimeType || mime || 'video/mp4').split(';')[0];
  offerSave(new Blob(chunks, { type }), `shape-studio-${Date.now()}.${type.includes('mp4') ? 'mp4' : 'webm'}`);
}
function offerSave(blob, name) {
  const file = new File([blob], name, { type: blob.type });
  overlay(`C’est prêt ✅ (${(blob.size / 1e6).toFixed(1)} Mo)`, null, [
    ['💾 Enregistrer / Partager', async () => {
      if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file] }); hideOverlay(); return; } catch (e) { if (e.name === 'AbortError') return; } }
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); hideOverlay();
    }, 'primary'],
    ['Fermer', hideOverlay],
  ]);
}

/* ---------------- PWA ---------------- */
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
setTab(null);
