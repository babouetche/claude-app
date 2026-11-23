// Shape Studio — éditeur vidéo/photo multi-pistes, 100 % dans le navigateur (iPhone)
const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const IMGLY = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm';
const HF = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

const $ = (s, r = document) => r.querySelector(s);
const cv = $('#view'), vctx = cv.getContext('2d');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const fmt = t => { t = Math.max(0, t || 0); const m = Math.floor(t / 60), s = Math.floor(t % 60), d = Math.floor((t * 10) % 10); return `${m}:${String(s).padStart(2, '0')}.${d}`; };
const once = (el, ev) => new Promise((res, rej) => { el.addEventListener(ev, res, { once: true }); el.addEventListener('error', () => rej(new Error('média illisible')), { once: true }); });
const uid = () => Math.random().toString(36).slice(2, 9);

/* ================= Données ================= */
const FONTS = {
  Classique: ['-apple-system,"Helvetica Neue",Arial,sans-serif', 900],
  Montserrat: ['Montserrat,-apple-system,sans-serif', 800],
  Anton: ['Anton,Impact,sans-serif', 400],
  Bebas: ['"Bebas Neue",Impact,sans-serif', 400],
  Bangers: ['Bangers,Impact,sans-serif', 400],
  Marker: ['"Permanent Marker","Marker Felt",cursive', 400],
  Pacifico: ['Pacifico,"Snell Roundhand",cursive', 400],
  Serif: ['Didot,Georgia,"Times New Roman",serif', 700],
  Typewriter: ['"American Typewriter","Courier New",monospace', 700],
  Rond: ['"Arial Rounded MT Bold","Avenir Next",sans-serif', 800],
};
const COLORS = ['#ffffff', '#000000', '#ffd60a', '#ff4d8d', '#00d1e8', '#22c55e', '#ff7a00', '#8b5cf6', '#ef4444', '#0a2540'];
const TEXT_PRESETS = [
  { name: 'Classique', font: 'Classique', color: '#ffffff', style: 'outline', stroke: '#000000' },
  { name: 'TikTok', font: 'Classique', color: '#000000', style: 'pill', bg: '#ffffff' },
  { name: 'Jaune', font: 'Montserrat', color: '#ffd60a', style: 'outline', stroke: '#000000' },
  { name: 'Impact', font: 'Anton', color: '#ffffff', style: 'shadow' },
  { name: 'Néon', font: 'Bebas', color: '#00e5ff', style: 'neon' },
  { name: 'Encadré', font: 'Montserrat', color: '#ffffff', style: 'box', bg: '#ff4d8d' },
  { name: 'Fun', font: 'Bangers', color: '#ffd60a', style: 'outline', stroke: '#ff4d8d' },
  { name: 'Manuscrit', font: 'Marker', color: '#ffffff', style: 'shadow' },
  { name: 'Script', font: 'Pacifico', color: '#ffffff', style: 'shadow' },
  { name: 'Élégant', font: 'Serif', color: '#ffffff', style: 'plain' },
  { name: 'Machine', font: 'Typewriter', color: '#000000', style: 'box', bg: '#ffffff' },
];
const STYLES = [['plain', 'Simple'], ['outline', 'Contour'], ['shadow', 'Ombre'], ['box', 'Encadré'], ['pill', 'Pastille'], ['neon', 'Néon']];
const ANIM_IN = [['none', 'Aucune'], ['fade', 'Fondu'], ['pop', 'Pop'], ['slide', 'Glisser ↑'], ['left', 'Glisser →'], ['zoom', 'Zoom'], ['type', 'Machine à écrire'], ['bounce', 'Rebond']];
const ANIM_OUT = [['none', 'Aucune'], ['fade', 'Fondu'], ['zoom', 'Zoom'], ['down', 'Glisser ↓']];
const ANIM_LOOP = [['none', 'Aucune'], ['pulse', 'Pulsation'], ['wiggle', 'Balancier'], ['float', 'Flotter'], ['blink', 'Clignoter']];
const FILTERS = {
  'Aucun': {}, 'Pop': { s: 140, c: 112, b: 104 }, 'Soleil': { b: 110, s: 120, w: 25 }, 'Océan': { s: 125, h: -12, c: 106 },
  'Vintage': { w: 40, c: 90, s: 85, b: 105 }, 'N&B': { g: 100, c: 120 }, 'Ciné': { c: 120, s: 80, b: 95 }, 'Froid': { h: 15, s: 90, b: 104 },
  'Doux': { b: 108, c: 88, s: 92 }, 'Punchy': { c: 130, s: 150 },
};
const EFFECTS = [['none', 'Aucun'], ['zoomin', 'Zoom lent'], ['zoomout', 'Dézoom'], ['pulse', 'Battement'], ['shake', 'Tremblement'], ['flash', 'Flash'], ['vignette', 'Vignette'], ['bw', 'Noir & blanc'], ['glow', 'Lumineux'], ['rgb', 'Glitch']];
const TRANSITIONS = [['none', 'Aucune'], ['fade', 'Fondu'], ['black', 'Noir'], ['flash', 'Flash'], ['slide', 'Glisser'], ['up', 'Monter'], ['zoom', 'Zoom']];
const RATIOS = { '9:16': 9 / 16, '1:1': 1, '4:5': 4 / 5, '3:4': 3 / 4, '16:9': 16 / 9, 'Original': 0 };
const EMOJIS = '🔥💪💦🏊‍♀️🏊🚴‍♀️🥊🎉✨⭐❤️😍😂😎🤩🥳😱👏🙌👉👇✅❌⚡🌊☀️🎵🎶💯🏆📍🕖📲💥🌴🍉💙💗🤍🖤'.match(/\p{Extended_Pictographic}(‍\p{Extended_Pictographic}|️|[♀♂]️?)*/gu);

const newProject = () => ({ ratio: '9:16', bg: { mode: 'blur', color: '#000000', mediaId: null }, clips: [], layers: [], audios: [] });
let P = newProject();
const M = {};                    // médias : id -> {kind,name,blob,url,el,w,h,dur,buf,strip,cutout,faces}
const CEL = new Map();           // clip.id -> <video>
const DRAW = new Map();          // layer.id -> canvas de dessin
const UI = { T: 0, playing: false, sel: null, pps: 60, T0: 0, ac0: 0, exporting: false, cancel: false, guides: null, sheet: null, drawing: false, total: 0 };

/* ================= Persistance (IndexedDB) ================= */
const idb = (() => {
  let dbp;
  const db = () => dbp ??= new Promise((res, rej) => {
    const r = indexedDB.open('shape-studio', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('media', { keyPath: 'id' }); r.result.createObjectStore('kv'); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  const tx = async (st, mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction(st, mode); const q = fn(t.objectStore(st)); t.oncomplete = () => res(q?.result); t.onerror = () => rej(t.error); }); };
  return {
    put: (st, v, k) => tx(st, 'readwrite', s => s.put(v, k)), get: (st, k) => tx(st, 'readonly', s => s.get(k)),
    all: st => tx(st, 'readonly', s => s.getAll()), clear: st => tx(st, 'readwrite', s => s.clear()), del: (st, k) => tx(st, 'readwrite', s => s.delete(k)),
  };
})();
const snap = () => JSON.stringify(P, (k, v) => k[0] === '_' ? undefined : v);
let saveTimer = null; const drawDirty = new Set();
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await idb.put('kv', snap(), 'project');
      for (const id of drawDirty) { const c = DRAW.get(id); if (c) await idb.put('kv', await new Promise(r => c.toBlob(r)), 'draw:' + id); }
      drawDirty.clear();
    } catch (e) { console.warn('sauvegarde', e); }
  }, 1200);
}

/* ================= Historique ================= */
let hist = [], hi = -1;
function commit() { const s = snap(); if (s === hist[hi]) return; hist = hist.slice(0, hi + 1); hist.push(s); if (hist.length > 80) hist.shift(); hi = hist.length - 1; updUndo(); scheduleSave(); }
function restore(s) {
  P = JSON.parse(s);
  if (UI.sel && !findSel()) UI.sel = null;
  refreshAll(); scheduleSave();
}
function undo() { if (hi > 0) { hi--; restore(hist[hi]); updUndo(); toast('Annulé'); } }
function redo() { if (hi < hist.length - 1) { hi++; restore(hist[hi]); updUndo(); toast('Rétabli'); } }
function updUndo() { $('#undoBtn').style.opacity = hi > 0 ? 1 : .35; $('#redoBtn').style.opacity = hi < hist.length - 1 ? 1 : .35; }
let changeRaf = 0;
function changed(doCommit = true) {
  req();
  if (!changeRaf) changeRaf = requestAnimationFrame(() => { changeRaf = 0; renderTimeline(); });
  if (doCommit) commit();
  if (UI.playing) startAudio();
}

/* ================= Audio (Web Audio : fiable sur iPhone) ================= */
let AC = null, master = null, recDest = null, live = [];
function ensureAudio() {
  if (!AC) {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.connect(AC.destination);
    recDest = AC.createMediaStreamDestination(); master.connect(recDest);
  }
  if (AC.state !== 'running') AC.resume();
  return AC;
}
function decodeAudio(m) {
  ensureAudio();
  m.bufP = m.blob.arrayBuffer().then(ab => AC.decodeAudioData(ab)).then(b => (m.buf = b)).catch(() => (m.buf = null));
  return m.bufP;
}
function stopAudio() { for (const n of live) { try { n.stop(); } catch {} } live = []; }
function startAudio() {
  ensureAudio(); stopAudio();
  const now = AC.currentTime + 0.06, T = UI.T;
  UI.T0 = T; UI.ac0 = now;
  const at = t => now + (t - T);
  const sched = (buf, tStart, srcIn, len, rate, vol, fi = 0, fo = 0) => {
    const tEnd = tStart + len; if (!buf || tEnd <= T || len <= 0) return;
    const off = Math.max(0, T - tStart), src = AC.createBufferSource(), g = AC.createGain();
    src.buffer = buf; src.playbackRate.value = rate; src.connect(g); g.connect(master);
    const gainAt = t => { let k = 1; if (fi && t < tStart + fi) k = Math.min(k, (t - tStart) / fi); if (fo && t > tEnd - fo) k = Math.min(k, (tEnd - t) / fo); return vol * clamp(k, 0, 1); };
    const t0 = Math.max(T, tStart);
    g.gain.setValueAtTime(gainAt(t0), at(t0));
    if (fi && t0 < tStart + fi) g.gain.linearRampToValueAtTime(vol, at(tStart + fi));
    if (fo) { const a = Math.max(t0, tEnd - fo); g.gain.setValueAtTime(gainAt(a), at(a)); g.gain.linearRampToValueAtTime(0, at(tEnd)); }
    const srcOff = srcIn + off * rate;
    if (srcOff >= buf.duration) return;
    src.start(at(t0), srcOff, Math.max(0.01, (len - off) * rate)); live.push(src);
  };
  layout();
  for (const c of P.clips) { const m = M[c.mediaId]; if (m?.kind === 'video' && c.vol > 0) sched(m.buf, c._s, c.in, c._d, c.speed, c.vol); }
  for (const a of P.audios) { const m = M[a.mediaId]; if (m) sched(m.buf, a.start, a.in, a.out - a.in, 1, a.vol, a.fadeIn, a.fadeOut); }
}

/* ================= IA (chargées à la demande) ================= */
let visionP, faceP, segP, faceDet, segmenter, mpTs = 0;
const ts = () => (mpTs = Math.max(mpTs + 1, Math.floor(performance.now())));
const vision = () => visionP ??= (async () => { const m = await import(`${MP}/vision_bundle.mjs`); return { m, files: await m.FilesetResolver.forVisionTasks(`${MP}/wasm`) }; })().catch(e => { visionP = null; throw e; });
const loadFaceDet = () => faceP ??= (async () => {
  const { m, files } = await vision();
  return (faceDet = await m.FaceDetector.createFromOptions(files, { baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite', delegate: 'CPU' }, runningMode: 'VIDEO', minDetectionConfidence: 0.45 }));
})().catch(e => { faceP = null; throw e; });
const loadSeg = () => segP ??= (async () => {
  const { m, files } = await vision();
  return (segmenter = await m.ImageSegmenter.createFromOptions(files, { baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite', delegate: 'CPU' }, runningMode: 'VIDEO', outputConfidenceMasks: true, outputCategoryMask: false }));
})().catch(e => { segP = null; throw e; });

const segSmall = document.createElement('canvas'), segMask = document.createElement('canvas'), subj = document.createElement('canvas');
function segmentPerson(src, sw, sh) {
  if (!segmenter) { loadSeg().then(req).catch(() => {}); return null; }
  const w = 256, h = Math.max(1, Math.round(256 * sh / sw));
  segSmall.width = w; segSmall.height = h; segSmall.getContext('2d').drawImage(src, 0, 0, w, h);
  let ok = false;
  try {
    segmenter.segmentForVideo(segSmall, ts(), r => {
      const ms = r.confidenceMasks; if (!ms?.length) return;
      const mk = ms.length > 1 ? ms[1] : ms[0], f = mk.getAsFloat32Array();
      segMask.width = mk.width; segMask.height = mk.height;
      const mc = segMask.getContext('2d'), id = mc.createImageData(mk.width, mk.height);
      for (let i = 0; i < f.length; i++) { const a = f[i]; id.data[i * 4 + 3] = a < .2 ? 0 : a > .8 ? 255 : (a - .2) / .6 * 255; }
      mc.putImageData(id, 0, 0); ok = true;
    });
  } catch (e) { console.warn(e); }
  if (!ok) return null;
  const k = Math.min(1, 720 / Math.max(sw, sh));
  subj.width = Math.round(sw * k); subj.height = Math.round(sh * k);
  const c = subj.getContext('2d');
  c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, subj.width, subj.height); c.drawImage(src, 0, 0, subj.width, subj.height);
  c.globalCompositeOperation = 'destination-in'; c.drawImage(segMask, 0, 0, subj.width, subj.height); c.globalCompositeOperation = 'source-over';
  return subj;
}
async function makeCutout(m) {
  if (m.cutout) return m.cutout;
  overlay('Détourage IA en cours…\n(1ère fois : téléchargement du modèle ~40 Mo)', -1);
  const blob = await new Promise(r => m.el.toBlob(r, 'image/png'));
  try {
    const { removeBackground } = await import(IMGLY);
    const out = await removeBackground(blob, { model: 'isnet_quint8', output: { format: 'image/png' }, progress: (k, a, b) => { if (b) overlay(`Téléchargement du modèle IA… ${Math.round(a / b * 100)} %`, a / b); } });
    const bmp = await createImageBitmap(out);
    const c = document.createElement('canvas'); c.width = m.w; c.height = m.h; c.getContext('2d').drawImage(bmp, 0, 0, m.w, m.h);
    m.cutout = c;
  } catch (e) {
    console.warn('imgly indisponible, repli MediaPipe', e);
    await loadSeg(); const s = segmentPerson(m.el, m.w, m.h); if (!s) throw e;
    const c = document.createElement('canvas'); c.width = m.w; c.height = m.h; c.getContext('2d').drawImage(s, 0, 0, m.w, m.h); m.cutout = c;
  } finally { hideOverlay(); }
  return m.cutout;
}
function detectFaces(c, src, m) {
  if (!faceDet) { loadFaceDet().then(req).catch(() => {}); return []; }
  if (m.kind === 'image' && m.faces) return m.faces;
  let r = [];
  try { r = faceDet.detectForVideo(src, ts()).detections.map(d => d.boundingBox); } catch (e) { console.warn(e); }
  if (m.kind === 'image') m.faces = r;
  return r;
}
async function faceImage(mediaId) {
  const m = M[mediaId]; if (!m) return null; if (m.faceCut !== undefined) return m.faceCut;
  await loadFaceDet();
  const d = faceDet.detectForVideo(m.el, ts()).detections.map(x => x.boundingBox).sort((a, b) => b.width * b.height - a.width * a.height)[0];
  if (!d) return (m.faceCut = null);
  const r = faceRect(d, 1.1), out = document.createElement('canvas'); out.width = Math.round(r.w); out.height = Math.round(r.h);
  const o = out.getContext('2d'); o.drawImage(m.el, r.cx - r.w / 2, r.cy - r.h / 2, r.w, r.h, 0, 0, out.width, out.height);
  o.globalCompositeOperation = 'destination-in'; o.save(); o.translate(out.width / 2, out.height / 2); o.scale(out.width / 2, out.height / 2);
  const g = o.createRadialGradient(0, 0, .55, 0, 0, 1); g.addColorStop(0, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)');
  o.fillStyle = g; o.beginPath(); o.arc(0, 0, 1, 0, 7); o.fill(); o.restore();
  return (m.faceCut = out);
}
function faceRect(b, k = 1) { return { cx: b.originX + b.width / 2, cy: b.originY + b.height / 2 - b.height * .08, w: b.width * k, h: b.height * 1.25 * k }; }

/* ================= Médias ================= */
function mkVideo(url) {
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('muted', ''); v.preload = 'auto'; v.src = url;
  $('#mediaHost').appendChild(v); v.load();
  return v;
}
async function loadMedia(rec) {
  const m = { ...rec, url: URL.createObjectURL(rec.blob) };
  if (m.kind === 'video') {
    const v = mkVideo(m.url); await once(v, 'loadedmetadata');
    m.dur = isFinite(v.duration) ? v.duration : 10; m.w = v.videoWidth; m.h = v.videoHeight; m.el = v;
    v.currentTime = 0.05;
    decodeAudio(m); makeStrip(m);
  } else if (m.kind === 'image') {
    const img = new Image(); img.src = m.url; await img.decode();
    const k = Math.min(1, 1920 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    m.el = c; m.w = c.width; m.h = c.height; m.strip = c.toDataURL('image/jpeg', .5);
  } else {
    await decodeAudio(m); m.dur = m.buf?.duration || 0;
    if (!m.buf) throw new Error('fichier audio illisible');
  }
  M[m.id] = m; return m;
}
async function makeStrip(m) {
  try {
    const v = mkVideo(m.url); await once(v, 'loadedmetadata');
    const th = 52, tw = Math.round(th * m.w / m.h), n = clamp(Math.round(m.dur / 2), 1, 16);
    const c = document.createElement('canvas'); c.width = tw * n; c.height = th; const x = c.getContext('2d');
    for (let i = 0; i < n; i++) { v.currentTime = (i + .5) * m.dur / n; await once(v, 'seeked'); x.drawImage(v, i * tw, 0, tw, th); }
    m.strip = c.toDataURL('image/jpeg', .55); v.remove(); renderTimeline();
  } catch (e) { console.warn('miniatures', e); }
}
function kindOf(f) { if (f.type.startsWith('video') || /\.(mov|mp4|m4v|webm)$/i.test(f.name)) return 'video'; if (f.type.startsWith('image')) return 'image'; if (f.type.startsWith('audio') || /\.(mp3|m4a|wav|aac|ogg)$/i.test(f.name)) return 'audio'; return null; }
async function importFile(f) {
  const kind = kindOf(f); if (!kind) throw new Error('format non pris en charge');
  const rec = { id: 'm' + uid(), name: f.name.replace(/\.[^.]+$/, ''), kind, blob: f };
  const m = await loadMedia(rec);
  idb.put('media', rec).catch(e => console.warn(e));
  return m;
}
function pickFiles(accept, multiple = true) {
  return new Promise(res => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.multiple = multiple;
    i.onchange = () => res([...i.files]); i.click();
  });
}
const clipEl = c => { const m = M[c.mediaId]; if (!m) return null; if (m.kind !== 'video') return m.el; if (!CEL.has(c.id)) { const v = mkVideo(m.url); v.addEventListener('seeked', req); CEL.set(c.id, v); } return CEL.get(c.id); };

function newClip(m) {
  return { id: 'c' + uid(), mediaId: m.id, in: 0, out: m.kind === 'video' ? m.dur : 0, dur: m.kind === 'image' ? 3 : 0, speed: 1, vol: 1, fit: 'cover', tf: { x: 0, y: 0, s: 1, r: 0, flip: false }, filter: { name: 'Aucun', b: 100, c: 100, s: 100, w: 0, h: 0, g: 0 }, fx: 'none', trans: 'none', cut: false, face: { mode: 'none', emoji: '😎', mediaId: null, scale: 1.2 } };
}
async function addMediaFiles(files, where = 'auto') {
  if (!files.length) return;
  ensureAudio();
  let i = 0, added = 0;
  const ci = clipIndexAt(UI.T);
  let pos = P.clips.length && where === 'auto' && ci >= 0 ? ci + 1 : P.clips.length;
  for (const f of files) {
    i++; overlay(`Import ${i}/${files.length}…`, -1);
    try {
      const m = await importFile(f);
      if (m.kind === 'audio') { P.audios.push({ id: 'a' + uid(), mediaId: m.id, start: UI.T, in: 0, out: m.dur, vol: .8, fadeIn: 0, fadeOut: 1, kind: 'music', name: m.name }); }
      else { P.clips.splice(pos++, 0, newClip(m)); }
      added++;
    } catch (e) { console.error(e); toast(`${f.name} : ${e.message}`); }
  }
  hideOverlay();
  if (P.ratio === 'Original') setupCanvas();
  if (added) { showEditor(); changed(); }
}

/* ================= Temps / mise en page ================= */
const clipDur = c => { const m = M[c.mediaId]; return !m ? 0 : m.kind === 'video' ? Math.max(.1, (c.out - c.in) / c.speed) : c.dur; };
function layout() {
  let t = 0; for (const c of P.clips) { c._s = t; c._d = clipDur(c); t += c._d; }
  UI.clipsEnd = t;
  UI.total = Math.max(t, ...P.layers.map(l => l.end), 0.5);
  return UI.total;
}
function clipIndexAt(T) {
  layout();
  for (let i = 0; i < P.clips.length; i++) { const c = P.clips[i]; if (T >= c._s && T < c._s + c._d) return i; }
  return P.clips.length && T >= UI.clipsEnd && T <= UI.clipsEnd + 0.05 ? P.clips.length - 1 : -1;
}
const transDur = (c, prev) => Math.min(.6, c._d / 2, prev._d / 2);

/* ================= Canvas ================= */
function dims(q = 720) {
  let r = RATIOS[P.ratio];
  if (!r) { const m = P.clips.length ? M[P.clips[0].mediaId] : null; r = m ? m.w / m.h : 9 / 16; }
  return r < 1 ? [q, Math.round(q / r / 2) * 2] : [Math.round(q * r / 2) * 2, q];
}
function setupCanvas(q = 720) {
  const [w, h] = dims(q);
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  $('#ratioBtn').textContent = P.ratio;
  req();
}

/* ================= Rendu ================= */
const tiny = document.createElement('canvas');
function cheapBlur(ctx, src, x, y, w, h, k = 28) {
  tiny.width = Math.max(1, Math.round(w / k)); tiny.height = Math.max(1, Math.round(h / k));
  tiny.getContext('2d').drawImage(src, 0, 0, tiny.width, tiny.height);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(tiny, x, y, w, h);
}
function coverRect(sw, sh, W, H) { const s = Math.max(W / sw, H / sh); return [(W - sw * s) / 2, (H - sh * s) / 2, sw * s, sh * s]; }
function filterStr(f, extra = '') {
  if (!f) return extra || 'none';
  const p = [];
  if (f.b !== 100) p.push(`brightness(${f.b}%)`); if (f.c !== 100) p.push(`contrast(${f.c}%)`); if (f.s !== 100) p.push(`saturate(${f.s}%)`);
  if (f.w) p.push(`sepia(${f.w}%)`); if (f.h) p.push(`hue-rotate(${f.h}deg)`); if (f.g) p.push(`grayscale(${f.g}%)`);
  if (extra) p.push(extra);
  return p.length ? p.join(' ') : 'none';
}
const pix = document.createElement('canvas');

function drawProjectBg(ctx, W, H, c) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const bg = P.bg;
  if (bg.mode === 'color') { ctx.fillStyle = bg.color; ctx.fillRect(0, 0, W, H); }
  else if (bg.mode === 'image' && M[bg.mediaId]) { const m = M[bg.mediaId]; ctx.drawImage(m.el, ...coverRect(m.w, m.h, W, H)); }
  else if (bg.mode === 'blur' && c) { const m = M[c.mediaId], src = clipEl(c); if (m && src) { const [x, y, w, h] = coverRect(m.w, m.h, W, H); cheapBlur(ctx, src, x, y, w, h); ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.fillRect(0, 0, W, H); } }
}

function drawClip(ctx, c, lt, o = {}) {
  const m = M[c.mediaId], src = clipEl(c); if (!m || !src) return;
  const W = ctx.canvas.width, H = ctx.canvas.height, sw = m.w, sh = m.h;
  const base = c.fit === 'contain' ? Math.min(W / sw, H / sh) : Math.max(W / sw, H / sh);
  let k = c.tf.s * (o.k || 1), dx = 0, dy = 0; const d = c._d || 1;
  if (c.fx === 'zoomin') k *= 1 + .18 * lt / d;
  else if (c.fx === 'zoomout') k *= 1.18 - .18 * lt / d;
  else if (c.fx === 'pulse') k *= 1 + .04 * Math.abs(Math.sin(lt * Math.PI * 2));
  else if (c.fx === 'shake') { dx = Math.sin(lt * 53) * W * .012; dy = Math.cos(lt * 41) * H * .008; }
  let extra = c.fx === 'bw' ? 'grayscale(100%)' : c.fx === 'glow' ? 'brightness(115%) saturate(130%)' : '';
  ctx.save(); ctx.globalAlpha = o.alpha ?? 1;
  ctx.translate(W / 2 + c.tf.x * W + dx + (o.dx || 0), H / 2 + c.tf.y * H + dy + (o.dy || 0));
  ctx.rotate(c.tf.r * Math.PI / 180); ctx.scale(base * k * (c.tf.flip ? -1 : 1), base * k);
  let img = src;
  if (c.cut) { const s = m.kind === 'image' ? m.cutout : segmentPerson(src, sw, sh); if (s) img = s; else if (m.kind === 'image') makeCutout(m).then(req).catch(() => {}); }
  ctx.filter = filterStr(c.filter, extra);
  if (c.fx === 'rgb' && UI.playing !== null) {
    const off = sw * .006 * (1 + Math.sin(lt * 20));
    ctx.globalAlpha *= .9; ctx.drawImage(img, -sw / 2 - off, -sh / 2, sw, sh);
    ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = .45; ctx.drawImage(img, -sw / 2 + off, -sh / 2, sw, sh); ctx.globalCompositeOperation = 'source-over';
  } else ctx.drawImage(img, -sw / 2, -sh / 2, sw, sh);
  ctx.filter = 'none';
  if (c.face.mode !== 'none') applyFaces(ctx, c, src, m);
  ctx.restore();
  ctx.save();
  if (c.fx === 'flash' && lt < .35) { ctx.fillStyle = `rgba(255,255,255,${(1 - lt / .35) * .9})`; ctx.fillRect(0, 0, W, H); }
  if (c.fx === 'vignette') { const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.max(W, H) * .75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.7)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  ctx.restore();
}
function applyFaces(ctx, c, src, m) {
  const fc = c.face, faces = detectFaces(c, src, m);
  let fimg = null;
  if (fc.mode === 'image' && fc.mediaId) { const fm = M[fc.mediaId]; if (fm && fm.faceCut === undefined) faceImage(fc.mediaId).then(req).catch(() => {}); fimg = fm?.faceCut; }
  for (const b of faces) {
    const r = faceRect(b, fc.scale);
    if (fc.mode === 'pixel') {
      ctx.save(); ctx.beginPath(); ctx.ellipse(r.cx, r.cy, r.w / 2, r.h / 2, 0, 0, 7); ctx.clip();
      pix.width = 10; pix.height = Math.max(1, Math.round(10 * r.h / r.w));
      pix.getContext('2d').drawImage(src, r.cx - r.w / 2, r.cy - r.h / 2, r.w, r.h, 0, 0, pix.width, pix.height);
      ctx.imageSmoothingEnabled = false; ctx.drawImage(pix, r.cx - r.w / 2, r.cy - r.h / 2, r.w, r.h); ctx.imageSmoothingEnabled = true; ctx.restore();
    } else if (fc.mode === 'emoji') {
      ctx.save(); ctx.font = `${Math.round(r.h * 1.05)}px ${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(fc.emoji, r.cx, r.cy + r.h * .05); ctx.restore();
    } else if (fimg) { const h = r.h * 1.1, w = h * fimg.width / fimg.height; ctx.drawImage(fimg, r.cx - w / 2, r.cy - h / 2, w, h); }
  }
}
function drawTransition(ctx, a, b, p, lt) {
  const W = ctx.canvas.width, H = ctx.canvas.height, ad = a._d;
  switch (b.trans) {
    case 'fade': drawClip(ctx, a, ad); drawClip(ctx, b, lt, { alpha: p }); break;
    case 'black': ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); if (p < .5) drawClip(ctx, a, ad, { alpha: 1 - 2 * p }); else drawClip(ctx, b, lt, { alpha: 2 * p - 1 }); break;
    case 'flash': if (p < .5) drawClip(ctx, a, ad); else drawClip(ctx, b, lt); ctx.fillStyle = `rgba(255,255,255,${1 - Math.abs(p - .5) * 2})`; ctx.fillRect(0, 0, W, H); break;
    case 'slide': { const e = easeInOut(p); drawClip(ctx, a, ad, { dx: -e * W }); drawClip(ctx, b, lt, { dx: (1 - e) * W }); break; }
    case 'up': { const e = easeInOut(p); drawClip(ctx, a, ad, { dy: -e * H }); drawClip(ctx, b, lt, { dy: (1 - e) * H }); break; }
    case 'zoom': drawClip(ctx, a, ad, { k: 1 + p * .6, alpha: 1 - p }); drawClip(ctx, b, lt, { k: 1.4 - .4 * easeInOut(p), alpha: p }); break;
    default: drawClip(ctx, b, lt);
  }
}
const easeOut = t => 1 - Math.pow(1 - t, 3), easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const backOut = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

/* ---- Calques ---- */
const loadedFonts = new Set();
function fontOf(l, px) {
  const [css, w] = FONTS[l.font] || FONTS.Classique, f = `${w} ${px}px ${css}`;
  if (!loadedFonts.has(l.font)) { loadedFonts.add(l.font); document.fonts?.load(`${w} 40px ${css.split(',')[0]}`).then(req).catch(() => {}); }
  return f;
}
function wrap(ctx, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const w of para.split(' ')) { const t = line ? line + ' ' + w : w; if (line && ctx.measureText(t).width > maxW) { out.push(line); line = w; } else line = t; }
    out.push(line);
  }
  return out;
}
function textMetrics(l, W, H) {
  const px = l.size * H; vctx.save(); vctx.font = fontOf(l, px);
  const lines = wrap(vctx, l.text || ' ', W * .88 / (l.s || 1)), widths = lines.map(x => vctx.measureText(x).width);
  vctx.restore();
  const lh = px * 1.2, pad = px * .35, w = Math.max(...widths, px) + pad * 2, h = lh * lines.length + pad * 2;
  return { px, lines, widths, lh, pad, w, h };
}
function layerBox(l, W, H) {
  if (l.type === 'text') { const t = textMetrics(l, W, H); return [t.w, t.h]; }
  if (l.type === 'sticker') { const s = l.size * H * 1.15; return [s, s]; }
  if (l.type === 'image') { const m = M[l.mediaId]; const w = l.size * W; return [w, m ? w * m.h / m.w : w]; }
  return [W, H];
}
function layerAnim(l, T) {
  const lt = T - l.start, ld = Math.max(.01, l.end - l.start), A = l.anim || {};
  let a = 1, k = 1, dx = 0, dy = 0, rot = 0, reveal = 1;
  const ai = Math.min(.4, ld / 3);
  if (lt < ai) {
    const t = lt / ai, e = easeOut(t);
    switch (A.in) {
      case 'fade': a = e; break;
      case 'pop': k = backOut(t); a = Math.min(1, t * 2); break;
      case 'slide': dy = (1 - e) * .08; a = e; break;
      case 'left': dx = -(1 - e) * .6; break;
      case 'zoom': k = 2.2 - 1.2 * e; a = e; break;
      case 'bounce': dy = -Math.abs(Math.cos(t * Math.PI * 1.5)) * (1 - t) * .12; a = Math.min(1, t * 3); break;
    }
  }
  if (A.in === 'type') reveal = clamp(lt / Math.max(.3, Math.min(ld * .7, (l.text || '').length * .06)), 0, 1);
  const ao = Math.min(.35, ld / 3), rem = ld - lt;
  if (rem < ao) { const t = 1 - rem / ao; if (A.out === 'fade') a *= 1 - t; else if (A.out === 'zoom') { k *= 1 - t * .9; a *= 1 - t; } else if (A.out === 'down') { dy += t * .1; a *= 1 - t; } }
  switch (A.loop) {
    case 'pulse': k *= 1 + .06 * Math.sin(lt * 6); break;
    case 'wiggle': rot = Math.sin(lt * 9) * 6; break;
    case 'float': dy += Math.sin(lt * 3) * .012; break;
    case 'blink': a *= Math.sin(lt * 8) > -.3 ? 1 : .15; break;
  }
  return { a, k, dx, dy, rot, reveal, lt, ld };
}
function roundRect(ctx, x, y, w, h, r) { r = Math.min(r, h / 2, w / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function drawText(ctx, l, an, W, H) {
  const t = textMetrics(l, W, H), px = t.px;
  ctx.font = fontOf(l, px); ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const y0 = -(t.lines.length - 1) * t.lh / 2;
  if (l.style === 'box') { ctx.fillStyle = l.bg || '#000'; roundRect(ctx, -t.w / 2, -t.h / 2, t.w, t.h, px * .3); ctx.fill(); }
  if (l.style === 'pill') { ctx.fillStyle = l.bg || '#fff'; t.lines.forEach((ln, i) => { const w = t.widths[i] + px * .6; roundRect(ctx, -w / 2, y0 + i * t.lh - t.lh / 2 - px * .04, w, t.lh + px * .08, px * .25); ctx.fill(); }); }
  const words = (l.text || '').split(/\s+/).filter(Boolean), nW = words.length;
  const activeW = l.karaoke ? Math.min(nW - 1, Math.floor(an.lt / an.ld * nW)) : -1;
  const totalChars = t.lines.join(' ').length, showChars = Math.floor(totalChars * an.reveal);
  let charIdx = 0, wordIdx = 0;
  const paint = (s, x, y, color) => {
    if (l.style === 'outline') { ctx.lineWidth = px * .2; ctx.strokeStyle = l.stroke || '#000'; ctx.strokeText(s, x, y); }
    if (l.style === 'shadow') { ctx.shadowColor = 'rgba(0,0,0,.75)'; ctx.shadowBlur = px * .25; ctx.shadowOffsetY = px * .06; }
    if (l.style === 'neon') { ctx.shadowColor = color; ctx.shadowBlur = px * .6; ctx.fillStyle = color; ctx.fillText(s, x, y); ctx.shadowBlur = px * .2; ctx.fillStyle = '#ffffff'; ctx.fillText(s, x, y); ctx.shadowBlur = 0; return; }
    ctx.fillStyle = color; ctx.fillText(s, x, y); ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  };
  t.lines.forEach((ln, i) => {
    const y = y0 + i * t.lh;
    if (activeW < 0 && an.reveal >= 1) { ctx.textAlign = 'center'; paint(ln, 0, y, l.color); charIdx += ln.length + 1; return; }
    ctx.textAlign = 'left'; let x = -t.widths[i] / 2;
    for (const w of ln.split(' ')) {
      if (!w) { continue; }
      const vis = clamp(showChars - charIdx, 0, w.length); if (vis <= 0) break;
      const s = w.slice(0, vis);
      const isAct = wordIdx === activeW;
      if (isAct && l.style !== 'pill') { ctx.save(); const ww = ctx.measureText(w).width; ctx.translate(x + ww / 2, y); ctx.scale(1.08, 1.08); ctx.textAlign = 'center'; paint(s, 0, 0, l.hl || '#ffd60a'); ctx.restore(); }
      else paint(s, x, y, isAct ? (l.hl || '#ff4d8d') : l.color);
      x += ctx.measureText(w + ' ').width; charIdx += w.length + 1; wordIdx++;
    }
  });
}
function drawLayer(ctx, l, T, W, H) {
  const an = layerAnim(l, T);
  ctx.save(); ctx.globalAlpha = (l.opacity ?? 1) * an.a;
  ctx.translate(l.x * W + an.dx * W, l.y * H + an.dy * H); ctx.rotate((l.r + an.rot) * Math.PI / 180); ctx.scale(l.s * an.k, l.s * an.k);
  if (l.type === 'text') drawText(ctx, l, an, W, H);
  else if (l.type === 'sticker') { ctx.font = `${l.size * H}px ${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(l.emoji, 0, l.size * H * .05); }
  else if (l.type === 'image') { const m = M[l.mediaId]; if (m) { const src = (l.cut && m.cutout) || m.el, w = l.size * W, h = w * m.h / m.w; if (l.cut && !m.cutout) makeCutout(m).then(req).catch(() => {}); ctx.drawImage(src, -w / 2, -h / 2, w, h); } }
  else if (l.type === 'draw') { const dc = DRAW.get(l.id); if (dc) ctx.drawImage(dc, -W / 2, -H / 2, W, H); }
  ctx.restore();
}
function selCorner(l, W, H) {
  const [bw, bh] = layerBox(l, W, H), a = l.r * Math.PI / 180, hx = bw / 2 * l.s, hy = bh / 2 * l.s;
  return { x: l.x * W + hx * Math.cos(a) - hy * Math.sin(a), y: l.y * H + hx * Math.sin(a) + hy * Math.cos(a) };
}
function render() {
  if (!P.clips.length && !P.layers.length) return;
  const ctx = vctx, W = cv.width, H = cv.height, T = UI.T;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none';
  const ci = clipIndexAt(T), c = P.clips[ci];
  drawProjectBg(ctx, W, H, c);
  if (c) {
    const lt = T - c._s, prev = P.clips[ci - 1];
    if (prev && c.trans !== 'none' && lt < transDur(c, prev)) drawTransition(ctx, prev, c, lt / transDur(c, prev), lt);
    else drawClip(ctx, c, lt);
  }
  for (const l of P.layers) if (T >= l.start && T < l.end) drawLayer(ctx, l, T, W, H);
  if (UI.exporting) return;
  // aides visuelles
  const k = W / (cv.getBoundingClientRect().width || W);
  if (UI.guides) { ctx.save(); ctx.strokeStyle = '#ff4d8d'; ctx.lineWidth = 1.5 * k; ctx.setLineDash([8 * k, 6 * k]); if (UI.guides.v) { ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke(); } if (UI.guides.h) { ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke(); } ctx.restore(); }
  const sel = findSel();
  if (UI.sel?.kind === 'layer' && sel && sel.type !== 'draw' && T >= sel.start && T < sel.end) {
    const [bw, bh] = layerBox(sel, W, H);
    ctx.save(); ctx.translate(sel.x * W, sel.y * H); ctx.rotate(sel.r * Math.PI / 180);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * k; ctx.setLineDash([7 * k, 5 * k]); ctx.strokeRect(-bw * sel.s / 2, -bh * sel.s / 2, bw * sel.s, bh * sel.s); ctx.restore();
    const cn = selCorner(sel, W, H);
    ctx.save(); ctx.fillStyle = '#ffd60a'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2 * k; ctx.beginPath(); ctx.arc(cn.x, cn.y, 13 * k, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#000'; ctx.font = `${14 * k}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('⤡', cn.x, cn.y); ctx.restore();
  }
}

/* ================= Lecture ================= */
let dirty = true;
const req = () => { dirty = true; };
function syncVideos() {
  const T = UI.T, ci = clipIndexAt(T);
  P.clips.forEach((c, i) => {
    const m = M[c.mediaId]; if (m?.kind !== 'video') return;
    const v = clipEl(c); let target = null, playing = false;
    if (i === ci) { target = c.in + (T - c._s) * c.speed; playing = UI.playing; }
    else if (i === ci - 1 && P.clips[ci]?.trans !== 'none' && T - P.clips[ci]._s < .7) target = c.out - .05;
    else if (i === ci + 1) target = c.in;
    if (target === null) { if (!v.paused) v.pause(); return; }
    target = clamp(target, 0, m.dur - .03);
    if (playing) {
      if (v.playbackRate !== c.speed) v.playbackRate = c.speed;
      if (v.paused) { if (Math.abs(v.currentTime - target) > .08) v.currentTime = target; v.play().catch(() => {}); }
      else if (Math.abs(v.currentTime - target) > .3 && !v.seeking) v.currentTime = target;
    } else { if (!v.paused) v.pause(); if (Math.abs(v.currentTime - target) > .03 && !v.seeking) v.currentTime = target; }
  });
}
function tick() {
  if (UI.playing) {
    let T = UI.T0 + Math.max(0, AC.currentTime - UI.ac0);
    if (T >= UI.total) { T = UI.total; UI.T = T; pause(); if (UI.onEnd) { const f = UI.onEnd; UI.onEnd = null; f(); } }
    else UI.T = T;
    dirty = true;
  }
  if (dirty && (P.clips.length || P.layers.length)) {
    dirty = false; syncVideos(); render();
    if (!UI.exporting) { scrollToT(); updTime(); }
  }
  requestAnimationFrame(tick);
}
function play() {
  ensureAudio(); layout();
  if (UI.T >= UI.total - .05) UI.T = 0;
  UI.playing = true; startAudio(); updPlay(); req();
}
function pause() { if (!UI.playing) return; UI.playing = false; stopAudio(); updPlay(); req(); }
function updPlay() { $('#playBtn').textContent = UI.playing ? '❚❚' : '▶'; }
function updTime() { $('#tcur').textContent = fmt(UI.T); $('#ttot').textContent = fmt(UI.total); }
$('#playBtn').onclick = () => UI.playing ? pause() : play();
document.addEventListener('visibilitychange', () => { if (document.hidden && !UI.exporting) pause(); });

/* ================= Timeline ================= */
const tl = $('#timeline'), tli = $('#tlInner');
const pad = () => tl.clientWidth / 2;
function scrollToT() { const x = UI.T * UI.pps; if (Math.abs(tl.scrollLeft - x) > .5) tl.scrollLeft = x; }
tl.addEventListener('scroll', () => {
  const x = UI.T * UI.pps; if (Math.abs(tl.scrollLeft - x) <= 1) return;
  if (UI.playing) pause();
  UI.T = clamp(tl.scrollLeft / UI.pps, 0, UI.total); req();
}, { passive: true });
tl.addEventListener('pointerdown', () => { if (UI.playing) pause(); });
function zoom(f) { UI.pps = clamp(UI.pps * f, 8, 400); renderTimeline(); scrollToT(); }
$('#zoomIn').onclick = () => zoom(1.5); $('#zoomOut').onclick = () => zoom(1 / 1.5);

function packRows(items) { const rows = []; for (const it of [...items].sort((a, b) => a.start - b.start)) { let r = rows.findIndex(end => end <= it.start + 1e-3); if (r < 0) { r = rows.length; rows.push(0); } rows[r] = it.end; it._row = r; } return rows.length; }
const LCOL = { text: '#7c3aed', sticker: '#ea7a12', image: '#0e9488', draw: '#db2777', sub: '#b8860b' };
function renderTimeline() {
  if ($('#tlWrap').hidden) return;
  const total = layout(), pps = UI.pps, pd = pad();
  tli.innerHTML = '';
  tli.style.paddingLeft = pd + 'px';
  const X = t => pd + t * pps;
  // règle
  const ru = document.createElement('div'); ru.className = 'ruler'; ru.style.left = 0; ru.style.width = '100%'; tli.appendChild(ru);
  const step = pps > 90 ? 1 : pps > 35 ? 2 : pps > 15 ? 5 : 10;
  for (let t = 0; t <= total + .01; t += step) { const s = document.createElement('span'); s.className = 'tick'; s.style.left = X(t) + 'px'; s.textContent = t < 60 ? `${t}s` : fmt(t).slice(0, -2); ru.appendChild(s); }
  let y = 20;
  // pistes calques
  const layers = P.layers.map(l => ({ ...l, ref: l }));
  const nL = packRows(layers);
  for (const it of layers) addItem('layer', it.ref, X(it.start), y + it._row * 28, (it.end - it.start) * pps);
  y += nL * 28 + (nL ? 4 : 0);
  // clips
  P.clips.forEach((c, i) => {
    const el = addItem('clip', c, X(c._s), y, c._d * pps);
    if (i > 0) { const b = document.createElement('button'); b.className = 'trans'; b.textContent = c.trans === 'none' ? '｜' : '⇄'; b.style.left = X(c._s) + 'px'; b.style.top = (y + 16) + 'px'; b.onclick = e => { e.stopPropagation(); select('clip', c.id); openTool('transition'); }; tli.appendChild(b); }
  });
  const add = document.createElement('button'); add.className = 'addclip'; add.textContent = '＋'; add.style.left = (X(UI.clipsEnd) + 8) + 'px'; add.style.top = y + 'px';
  add.onclick = async e => { e.stopPropagation(); addMediaFiles(await pickFiles('image/*,video/*'), 'end'); }; tli.appendChild(add);
  y += 58;
  // audio
  const auds = P.audios.map(a => ({ start: a.start, end: a.start + a.out - a.in, ref: a }));
  const nA = packRows(auds);
  for (const it of auds) addItem('audio', it.ref, X(it.start), y + it._row * 28, (it.end - it.start) * pps);
  y += nA * 28;
  tli.style.width = (total * pps + pd * 2 + 70) + 'px';
  tli.style.height = Math.max(y + 8, tl.clientHeight) + 'px';
  scrollToT(); updTime();
}
function addItem(kind, o, x, y, w) {
  const d = document.createElement('div'), sel = UI.sel?.kind === kind && UI.sel.id === o.id;
  d.className = `it ${kind}${sel ? ' sel' : ''}`; d.style.left = x + 'px'; d.style.top = y + 'px'; d.style.width = Math.max(6, w) + 'px';
  if (kind === 'clip') {
    const m = M[o.mediaId];
    if (m?.strip) { d.style.backgroundImage = `url(${m.strip})`; d.style.backgroundPositionX = -(m.kind === 'video' ? o.in * UI.pps / o.speed : 0) + 'px'; }
    const lb = []; if (o.speed !== 1) lb.push(`${o.speed}×`); if (o.vol === 0) lb.push('🔇'); if (o.fx !== 'none') lb.push('✨'); if (o.cut) lb.push('✂️'); if (o.face.mode !== 'none') lb.push('🙂');
    d.innerHTML = `<span class="lbl">${fmt(o._d)}${lb.length ? ' ' + lb.join(' ') : ''}</span>`;
  } else if (kind === 'layer') {
    d.style.background = LCOL[o.auto ? 'sub' : o.type];
    d.textContent = o.type === 'text' ? (o.auto ? '💬 ' : 'T  ') + o.text.replace(/\n/g, ' ') : o.type === 'sticker' ? o.emoji : o.type === 'image' ? '🖼️ Incrustation' : '✏️ Dessin';
  } else {
    d.style.background = o.kind === 'voice' ? '#be123c' : '#15803d';
    d.textContent = (o.kind === 'voice' ? '🎙️ ' : '🎵 ') + (o.name || 'Audio');
  }
  d.onclick = e => { e.stopPropagation(); select(kind, o.id); };
  if (sel) {
    for (const side of ['l', 'r']) { const h = document.createElement('div'); h.className = 'h ' + side; h.textContent = side === 'l' ? '‹' : '›'; dragTrim(h, kind, o, side, d); d.appendChild(h); }
    if (kind !== 'clip') dragTrim(d, kind, o, 'move', d);
  }
  tli.appendChild(d); return d;
}
function dragTrim(handle, kind, o, side, el) {
  handle.style.touchAction = 'none';
  handle.addEventListener('pointerdown', e => {
    if (e.target !== handle && side === 'move' && e.target.classList.contains('h')) return;
    e.stopPropagation(); e.preventDefault(); handle.setPointerCapture(e.pointerId);
    if (UI.playing) pause();
    const x0 = e.clientX, s = JSON.parse(JSON.stringify(o)), m = M[o.mediaId], left0 = parseFloat(el.style.left), w0 = parseFloat(el.style.width);
    let moved = false;
    const mv = ev => {
      const dt = (ev.clientX - x0) / UI.pps; if (Math.abs(ev.clientX - x0) > 3) moved = true;
      let nl = left0, nw = w0;
      if (kind === 'clip') {
        if (m.kind === 'video') {
          if (side === 'l') o.in = clamp(s.in + dt * o.speed, 0, o.out - .2 * o.speed); else o.out = clamp(s.out + dt * o.speed, o.in + .2 * o.speed, m.dur);
          nw = (o.out - o.in) / o.speed * UI.pps; UI.T = (o._s || 0) + (side === 'l' ? 0 : (o.out - o.in) / o.speed - .01);
        } else { o.dur = Math.max(.3, s.dur + (side === 'l' ? -dt : dt)); nw = o.dur * UI.pps; }
      } else if (kind === 'layer') {
        if (side === 'l') o.start = clamp(s.start + dt, 0, o.end - .1);
        else if (side === 'r') o.end = Math.max(o.start + .1, s.end + dt);
        else { const len = s.end - s.start; o.start = Math.max(0, s.start + dt); o.end = o.start + len; }
        nl = pad() + o.start * UI.pps; nw = (o.end - o.start) * UI.pps; UI.T = side === 'r' ? o.end - .01 : o.start;
      } else {
        if (side === 'l') { const d = clamp(dt, -s.in, s.out - s.in - .1); o.start = Math.max(0, s.start + d); o.in = s.in + (o.start - s.start); }
        else if (side === 'r') o.out = clamp(s.out + dt, o.in + .1, m.dur);
        else o.start = Math.max(0, s.start + dt);
        nl = pad() + o.start * UI.pps; nw = (o.out - o.in) * UI.pps;
      }
      el.style.left = nl + 'px'; el.style.width = Math.max(6, nw) + 'px';
      req();
    };
    const up = () => { handle.removeEventListener('pointermove', mv); handle.removeEventListener('pointerup', up); handle.removeEventListener('pointercancel', up); if (moved) changed(); else if (side === 'move') { /* simple tap */ } renderTimeline(); };
    handle.addEventListener('pointermove', mv); handle.addEventListener('pointerup', up); handle.addEventListener('pointercancel', up);
  });
}
tl.addEventListener('click', e => { if (e.target === tl || e.target === tli || e.target.classList.contains('ruler')) select(null); });

/* ================= Sélection & outils ================= */
function findSel() { const s = UI.sel; if (!s) return null; const arr = s.kind === 'clip' ? P.clips : s.kind === 'layer' ? P.layers : P.audios; return arr.find(x => x.id === s.id) || null; }
function select(kind, id) {
  UI.sel = kind ? { kind, id } : null; UI.drawing = false;
  closeSheet(); renderTools(); renderTimeline(); req();
}
function tb(icon, label, fn, cls = '') { return { icon, label, fn, cls }; }
function renderTools() {
  const box = $('#tools'); box.innerHTML = ''; box.scrollLeft = 0;
  const s = findSel();
  let items;
  if (!s) items = [
    tb('➕', 'Médias', async () => addMediaFiles(await pickFiles('image/*,video/*'))),
    tb('🔤', 'Texte', () => addText()),
    tb('💬', 'Sous-titres', () => openTool('subs')),
    tb('😀', 'Stickers', () => openTool('stickers')),
    tb('🎵', 'Audio', () => openTool('audio')),
    tb('✨', 'Modèles', () => openTool('templates')),
    tb('✏️', 'Dessin', () => addDrawing()),
    tb('🖼️', 'Incruster', () => addOverlayImage()),
    tb('📐', 'Format', () => openTool('format')),
  ];
  else if (UI.sel.kind === 'clip') {
    const img = M[s.mediaId]?.kind === 'image';
    items = [
      tb('✂️', 'Diviser', splitSel),
      img ? tb('⏱️', 'Durée', () => openTool('duration')) : tb('⚡', 'Vitesse', () => openTool('speed')),
      ...(img ? [] : [tb('🔊', 'Volume', () => openTool('volume'))]),
      tb('🎨', 'Filtres', () => openTool('filters')),
      tb('🎚️', 'Ajuster', () => openTool('adjust')),
      tb('✨', 'Effets', () => openTool('effects')),
      tb('🔀', 'Transition', () => openTool('transition')),
      tb('👤', 'Détourer', () => openTool('cut')),
      tb('🙂', 'Visage', () => openTool('face')),
      tb('⤢', 'Cadrage', () => openTool('crop')),
      tb('◀', 'Avant', () => moveClip(-1)), tb('▶', 'Après', () => moveClip(1)),
      tb('🔁', 'Remplacer', replaceClip),
      tb('⧉', 'Dupliquer', duplicateSel), tb('🗑️', 'Supprimer', deleteSel, 'danger'),
    ];
  } else if (UI.sel.kind === 'layer') {
    const t = s.type;
    items = [
      ...(t === 'text' ? [tb('✏️', 'Modifier', () => openTool('editText')), tb('🅰️', 'Police', () => openTool('font')), tb('🎨', 'Style', () => openTool('style'))] : []),
      ...(t === 'sticker' ? [tb('😀', 'Changer', () => openTool('stickers'))] : []),
      ...(t === 'image' ? [tb('✂️', 'Détourer', () => { s.cut = !s.cut; changed(); toast(s.cut ? 'Détourage activé' : 'Détourage retiré'); })] : []),
      ...(t === 'draw' ? [tb('✏️', 'Dessiner', () => openTool('draw'))] : []),
      ...(t !== 'draw' ? [tb('💫', 'Animation', () => openTool('anim'))] : []),
      tb('🔆', 'Opacité', () => openTool('opacity')),
      tb('✂️', 'Diviser', splitSel),
      tb('↔️', 'Toute la vidéo', () => { s.start = 0; s.end = Math.max(UI.clipsEnd, .5); changed(); }),
      tb('⧉', 'Dupliquer', duplicateSel), tb('🗑️', 'Supprimer', deleteSel, 'danger'),
    ];
  } else {
    items = [tb('🔊', 'Volume', () => openTool('audioVol')), tb('🌗', 'Fondus', () => openTool('fades')), tb('✂️', 'Diviser', splitSel), tb('⧉', 'Dupliquer', duplicateSel), tb('🗑️', 'Supprimer', deleteSel, 'danger')];
  }
  if (s) items.unshift(tb('‹', 'Retour', () => select(null), 'back'));
  for (const it of items) { const b = document.createElement('button'); if (it.cls) b.className = it.cls; b.innerHTML = `${it.icon}<span>${it.label}</span>`; b.onclick = it.fn; box.appendChild(b); }
}

/* ---- Actions ---- */
function splitSel() {
  const s = findSel(), T = UI.T; if (!s) return;
  if (UI.sel.kind === 'clip') {
    const lt = T - s._s; if (lt < .1 || lt > s._d - .1) return toast('Place la tête de lecture dans le clip');
    const c2 = JSON.parse(JSON.stringify(s)); c2.id = 'c' + uid(); c2.trans = 'none';
    if (M[s.mediaId].kind === 'video') { s.out = s.in + lt * s.speed; c2.in = s.out; } else { c2.dur = s.dur - lt; s.dur = lt; }
    P.clips.splice(P.clips.indexOf(s) + 1, 0, c2);
  } else if (UI.sel.kind === 'layer') {
    if (T <= s.start + .05 || T >= s.end - .05) return toast('Place la tête de lecture dans l’élément');
    const l2 = JSON.parse(JSON.stringify(s)); l2.id = 'l' + uid(); l2.start = T; s.end = T;
    if (s.type === 'draw') { DRAW.set(l2.id, cloneCanvas(DRAW.get(s.id))); drawDirty.add(l2.id); }
    P.layers.push(l2);
  } else {
    const off = T - s.start; if (off < .05 || off > s.out - s.in - .05) return toast('Place la tête de lecture dans l’audio');
    const a2 = { ...s, id: 'a' + uid(), start: T, in: s.in + off }; s.out = s.in + off; P.audios.push(a2);
  }
  toast('Divisé ✂️'); changed(); renderTools();
}
function cloneCanvas(c) { const n = document.createElement('canvas'); n.width = c.width; n.height = c.height; n.getContext('2d').drawImage(c, 0, 0); return n; }
function duplicateSel() {
  const s = findSel(); if (!s) return;
  const d = JSON.parse(JSON.stringify(s));
  if (UI.sel.kind === 'clip') { d.id = 'c' + uid(); P.clips.splice(P.clips.indexOf(s) + 1, 0, d); }
  else if (UI.sel.kind === 'layer') { d.id = 'l' + uid(); const len = s.end - s.start; d.start = s.end; d.end = s.end + len; if (s.type === 'draw') { DRAW.set(d.id, cloneCanvas(DRAW.get(s.id))); drawDirty.add(d.id); } else { d.start = s.start; d.end = s.end; d.x = Math.min(.9, s.x + .04); d.y = Math.min(.9, s.y + .04); } P.layers.push(d); }
  else { d.id = 'a' + uid(); d.start = s.start + s.out - s.in; P.audios.push(d); }
  UI.sel.id = d.id; toast('Dupliqué'); changed(); renderTools();
}
function deleteSel() {
  const k = UI.sel?.kind; if (!k) return;
  if (k === 'clip') P.clips = P.clips.filter(x => x.id !== UI.sel.id);
  else if (k === 'layer') P.layers = P.layers.filter(x => x.id !== UI.sel.id);
  else P.audios = P.audios.filter(x => x.id !== UI.sel.id);
  UI.sel = null; changed(); layout(); UI.T = Math.min(UI.T, UI.total); select(null);
  if (!P.clips.length && !P.layers.length) showEmpty();
}
function moveClip(d) {
  const s = findSel(), i = P.clips.indexOf(s), j = i + d; if (j < 0 || j >= P.clips.length) return;
  P.clips.splice(i, 1); P.clips.splice(j, 0, s); layout(); UI.T = s._s + .01; changed();
}
async function replaceClip() {
  const s = findSel(); const [f] = await pickFiles('image/*,video/*', false); if (!f) return;
  try { overlay('Import…', -1); const m = await importFile(f); hideOverlay(); const n = newClip(m); Object.assign(s, { mediaId: m.id, in: n.in, out: n.out, dur: m.kind === 'image' ? s._d : 0 }); CEL.delete(s.id); changed(); }
  catch (e) { hideOverlay(); toast(e.message); }
}
function defaultEnd(T, len = 3) { return T + len; }
function addLayer(l) {
  const T = UI.T;
  const L = { id: 'l' + uid(), start: T, end: defaultEnd(T), x: .5, y: .5, s: 1, r: 0, opacity: 1, anim: { in: 'pop', out: 'fade', loop: 'none' }, ...l };
  P.layers.push(L); showEditor(); UI.sel = { kind: 'layer', id: L.id }; changed(); renderTools(); return L;
}
function addText(text = '') {
  const L = addLayer({ type: 'text', text: text || 'Ton texte', size: .065, ...TEXT_PRESETS[0], name: undefined, karaoke: false });
  delete L.name;
  openTool('editText', true);
}
function addDrawing() {
  if (!ensureCanvasReady()) return;
  const L = addLayer({ type: 'draw', anim: { in: 'none', out: 'none', loop: 'none' }, end: Math.max(UI.T + 3, UI.clipsEnd) });
  const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; DRAW.set(L.id, c);
  openTool('draw');
}
async function addOverlayImage() {
  const [f] = await pickFiles('image/*', false); if (!f) return;
  try { overlay('Import…', -1); const m = await importFile(f); hideOverlay(); addLayer({ type: 'image', mediaId: m.id, size: .5, cut: false, anim: { in: 'zoom', out: 'fade', loop: 'none' } }); toast('Astuce : “Détourer” pour en faire un sticker'); }
  catch (e) { hideOverlay(); toast(e.message); }
}
function ensureCanvasReady() { if (!cv.width) setupCanvas(); return true; }

/* ================= Panneaux (feuilles) ================= */
const sheet = $('#sheet'), sb = $('#sheetBody');
function openSheet(title, build) { UI.sheet = { title, build }; $('#sheetTitle').textContent = title; sb.innerHTML = ''; build(sb); sheet.hidden = false; }
function refreshSheet() { if (UI.sheet && !sheet.hidden) { const st = sb.scrollTop; sb.innerHTML = ''; UI.sheet.build(sb); sb.scrollTop = st; } }
function closeSheet() { sheet.hidden = true; UI.sheet = null; if (UI.drawing) { UI.drawing = false; } }
$('#sheetClose').onclick = () => { closeSheet(); commit(); };
const el = (tag, props = {}, kids = []) => { const e = Object.assign(document.createElement(tag), props); for (const k of kids) e.append(k); return e; };
const lab = (p, t) => p.appendChild(el('div', { className: 'lab', textContent: t }));
function chips(p, opts, cur, pick, cls = '') {
  const d = el('div', { className: 'chips ' + cls });
  for (const [v, label, style] of opts) { const b = el('button', { textContent: label }); if (style) b.style.cssText = style; if (v === cur) b.className = 'on'; b.onclick = () => { pick(v); refreshSheet(); }; d.appendChild(b); }
  p.appendChild(d); return d;
}
function slider(p, label, min, max, step, val, onInput, f = v => v) {
  const r = el('div', { className: 'row' }), i = el('input', { type: 'range', min, max, step, value: val }), v = el('span', { className: 'val', textContent: f(val) });
  i.oninput = () => { v.textContent = f(+i.value); onInput(+i.value); changed(false); };
  i.onchange = () => commit();
  r.append(el('label', { textContent: label }), i, v); p.appendChild(r); return i;
}
function swatches(p, cur, pick) {
  const d = el('div', { className: 'chips' });
  for (const c of COLORS) { const b = el('button', { className: 'sw' + (c === cur ? ' on' : '') }); b.style.background = c; b.onclick = () => { pick(c); changed(); refreshSheet(); }; d.appendChild(b); }
  const ci = el('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(cur) ? cur : '#ffffff' }); ci.oninput = () => { pick(ci.value); changed(false); }; ci.onchange = () => commit();
  d.appendChild(ci); p.appendChild(d);
}
function btn(p, label, fn, cls = '') { const b = el('button', { className: 'btn ' + cls, textContent: label }); b.onclick = fn; p.appendChild(b); return b; }
const note = (p, t) => p.appendChild(el('p', { className: 'note', textContent: t }));
const subsAll = (s, fn) => { if (s.auto && UI.subsLinked !== false) P.layers.filter(l => l.auto).forEach(fn); else fn(s); };

const TOOLS = {
  /* ---- clip ---- */
  speed: ['Vitesse', (p, s) => {
    chips(p, [.25, .5, .75, 1, 1.5, 2, 3].map(v => [v, v + '×']), s.speed, v => { s.speed = v; changed(); }, 'big');
    slider(p, 'Précis', .25, 3, .05, s.speed, v => { s.speed = v; }, v => v.toFixed(2) + '×');
    note(p, 'Ralenti ou accéléré : idéal pour montrer un mouvement en détail.');
  }],
  duration: ['Durée', (p, s) => { chips(p, [1, 2, 3, 5, 8, 10].map(v => [v, v + ' s']), s.dur, v => { s.dur = v; changed(); }, 'big'); slider(p, 'Précis', .3, 30, .1, s.dur, v => { s.dur = v; }, v => v.toFixed(1) + ' s'); }],
  volume: ['Volume du clip', (p, s) => { slider(p, 'Volume', 0, 2, .05, s.vol, v => { s.vol = v; }, v => Math.round(v * 100) + '%'); const r = el('div', { className: 'two' }); p.appendChild(r); btn(r, '🔇 Muet', () => { s.vol = 0; changed(); refreshSheet(); }); btn(r, '🔇 Tous les clips muets', () => { P.clips.forEach(c => c.vol = 0); changed(); toast('Son des vidéos coupé'); }); }],
  filters: ['Filtres', (p, s) => {
    chips(p, Object.keys(FILTERS).map(n => [n, n]), s.filter.name, n => { Object.assign(s.filter, { name: n, b: 100, c: 100, s: 100, w: 0, h: 0, g: 0 }, FILTERS[n]); changed(); }, 'wrap');
    btn(p, 'Appliquer à tous les clips', () => { P.clips.forEach(c => c.filter = { ...s.filter }); changed(); toast('Filtre appliqué partout'); }, 'sm').style.marginTop = '10px';
  }],
  adjust: ['Ajuster', (p, s) => {
    const f = s.filter;
    slider(p, 'Luminosité', 40, 170, 1, f.b, v => f.b = v, v => v + '%');
    slider(p, 'Contraste', 40, 170, 1, f.c, v => f.c = v, v => v + '%');
    slider(p, 'Saturation', 0, 220, 1, f.s, v => f.s = v, v => v + '%');
    slider(p, 'Chaleur', 0, 80, 1, f.w, v => f.w = v, v => v);
    slider(p, 'Teinte', -60, 60, 1, f.h, v => f.h = v, v => v + '°');
    btn(p, 'Réinitialiser', () => { Object.assign(f, { name: 'Aucun', b: 100, c: 100, s: 100, w: 0, h: 0, g: 0 }); changed(); refreshSheet(); }, 'sm');
  }],
  effects: ['Effets', (p, s) => { chips(p, EFFECTS, s.fx, v => { s.fx = v; changed(); }, 'wrap'); }],
  transition: ['Transition (entrée du clip)', (p, s) => {
    if (!P.clips.indexOf(s)) { note(p, 'Le premier clip n’a pas de transition d’entrée. Sélectionne le clip suivant.'); return; }
    chips(p, TRANSITIONS, s.trans, v => { s.trans = v; changed(); const pr = P.clips[P.clips.indexOf(s) - 1]; UI.T = Math.max(0, s._s - .4); play(); setTimeout(() => { if (UI.T > s._s + 1) pause(); }, 1200); }, 'wrap');
    btn(p, 'Appliquer à toutes les coupes', () => { P.clips.forEach((c, i) => { if (i) c.trans = s.trans; }); changed(); toast('Transition appliquée partout'); }, 'sm').style.marginTop = '10px';
  }],
  cut: ['Détourer', (p, s) => {
    const m = M[s.mediaId];
    chips(p, [[false, 'Non'], [true, 'Détourer le sujet']], s.cut, async v => {
      s.cut = v;
      try { if (v && m.kind === 'image') await makeCutout(m); if (v && m.kind === 'video') { overlay('Chargement de l’IA…', -1); await loadSeg(); hideOverlay(); } }
      catch (e) { hideOverlay(); s.cut = false; toast('Échec du détourage (connexion ?)'); }
      changed(); refreshSheet();
    }, 'big');
    lab(p, 'Nouveau fond');
    bgControls(p);
    note(p, m.kind === 'image' ? 'Photo : l’IA détoure n’importe quel sujet.' : 'Vidéo : l’IA détoure les personnes image par image.');
  }],
  face: ['Visage', (p, s) => {
    const f = s.face;
    chips(p, [['none', 'Aucun'], ['pixel', 'Flouter'], ['emoji', 'Emoji'], ['image', 'Autre visage']], f.mode, async v => {
      f.mode = v; if (v !== 'none') { try { overlay('Chargement de la détection de visages…', -1); await loadFaceDet(); } catch { f.mode = 'none'; toast('Échec du chargement (connexion ?)'); } hideOverlay(); }
      changed(); refreshSheet();
    }, 'wrap');
    if (f.mode === 'emoji') { lab(p, 'Emoji'); const g = el('div', { className: 'chips' }); for (const e of ['😎', '😂', '🤩', '😜', '🥳', '🤖', '🐶', '🦈', '🏊', '💪', '❤️', '⭐']) { const b = el('button', { textContent: e }); b.style.fontSize = '22px'; if (e === f.emoji) b.className = 'on'; b.onclick = () => { f.emoji = e; changed(); refreshSheet(); }; g.appendChild(b); } p.appendChild(g); }
    if (f.mode === 'image') btn(p, f.mediaId ? '🔁 Changer de visage' : '🖼️ Choisir la photo du visage', async () => {
      const [file] = await pickFiles('image/*', false); if (!file) return;
      try { overlay('Recherche du visage…', -1); const m = await importFile(file); const fc = await faceImage(m.id); hideOverlay(); if (!fc) return toast('Aucun visage trouvé sur cette photo'); f.mediaId = m.id; changed(); refreshSheet(); }
      catch (e) { hideOverlay(); toast('Erreur : ' + e.message); }
    }, 'sm');
    if (f.mode !== 'none') slider(p, 'Taille', .8, 2, .05, f.scale, v => f.scale = v, v => '×' + v.toFixed(2));
    note(p, '⚠️ “Autre visage” : seulement avec l’accord des personnes, et pour du fun.');
  }],
  crop: ['Cadrage', (p, s) => {
    chips(p, [['cover', 'Remplir'], ['contain', 'Adapter']], s.fit, v => { s.fit = v; changed(); }, 'big');
    slider(p, 'Zoom', .5, 3, .01, s.tf.s, v => s.tf.s = v, v => '×' + v.toFixed(2));
    const r = el('div', { className: 'two' }); p.appendChild(r);
    btn(r, '⟳ Pivoter', () => { s.tf.r = (s.tf.r + 90) % 360; changed(); }); btn(r, '⇋ Miroir', () => { s.tf.flip = !s.tf.flip; changed(); }); btn(r, 'Réinitialiser', () => { s.tf = { x: 0, y: 0, s: 1, r: 0, flip: false }; changed(); refreshSheet(); });
    note(p, 'Astuce : sélectionne le clip puis glisse / pince directement sur l’image pour le recadrer.');
  }],
  /* ---- calques ---- */
  editText: ['Texte', (p, s, fresh) => {
    const ta = el('textarea', { value: s.text === 'Ton texte' && fresh ? '' : s.text, placeholder: 'Écris ton texte…' });
    ta.oninput = () => { s.text = ta.value || ' '; changed(false); }; ta.onchange = () => commit(); p.appendChild(ta);
    if (fresh) setTimeout(() => ta.focus(), 0);
    lab(p, 'Styles rapides');
    chips(p, TEXT_PRESETS.map(t => [t.name, t.name, `font-family:${FONTS[t.font][0]};font-weight:${FONTS[t.font][1]};color:${t.style === 'pill' || t.style === 'box' ? t.color : t.color};background:${t.bg || '#18223a'};${t.style === 'outline' ? `-webkit-text-stroke:.6px ${t.stroke}` : ''}`]), null, n => { const t = TEXT_PRESETS.find(x => x.name === n); subsAll(s, l => Object.assign(l, { font: t.font, color: t.color, style: t.style, bg: t.bg, stroke: t.stroke || '#000' })); changed(); });
    slider(p, 'Taille', .025, .2, .005, s.size, v => subsAll(s, l => l.size = v), v => Math.round(v * 1000) / 10);
    if (s.auto) linkToggle(p);
  }],
  font: ['Police', (p, s) => { chips(p, Object.keys(FONTS).map(k => [k, k === 'Classique' ? 'Aa Classique' : 'Aa ' + k, `font-family:${FONTS[k][0]};font-weight:${FONTS[k][1]};font-size:16px`]), s.font, v => { subsAll(s, l => l.font = v); changed(); }, 'wrap'); if (s.auto) linkToggle(p); }],
  style: ['Style', (p, s) => {
    lab(p, 'Couleur du texte'); swatches(p, s.color, c => subsAll(s, l => l.color = c));
    lab(p, 'Effet'); chips(p, STYLES, s.style, v => { subsAll(s, l => { l.style = v; if ((v === 'pill' || v === 'box') && !l.bg) l.bg = '#ffffff'; }); changed(); }, 'wrap');
    if (s.style === 'outline') { lab(p, 'Couleur du contour'); swatches(p, s.stroke, c => subsAll(s, l => l.stroke = c)); }
    if (s.style === 'box' || s.style === 'pill') { lab(p, 'Couleur du fond'); swatches(p, s.bg, c => subsAll(s, l => l.bg = c)); }
    lab(p, 'Mot par mot (karaoké)'); chips(p, [[false, 'Non'], [true, 'Oui']], !!s.karaoke, v => { subsAll(s, l => l.karaoke = v); changed(); });
    if (s.karaoke) { lab(p, 'Couleur du mot actif'); swatches(p, s.hl || '#ffd60a', c => subsAll(s, l => l.hl = c)); }
    if (s.auto) linkToggle(p);
  }],
  anim: ['Animation', (p, s) => {
    lab(p, 'Entrée'); chips(p, ANIM_IN, s.anim.in, v => { subsAll(s, l => l.anim.in = v); changed(); preview(s); });
    lab(p, 'Sortie'); chips(p, ANIM_OUT, s.anim.out, v => { subsAll(s, l => l.anim.out = v); changed(); });
    lab(p, 'En boucle'); chips(p, ANIM_LOOP, s.anim.loop, v => { subsAll(s, l => l.anim.loop = v); changed(); preview(s); });
    if (s.auto) linkToggle(p);
  }],
  opacity: ['Opacité', (p, s) => slider(p, 'Opacité', 0, 1, .01, s.opacity ?? 1, v => s.opacity = v, v => Math.round(v * 100) + '%')],
  draw: ['Dessin', (p, s) => {
    UI.drawing = true;
    const B = UI.brush ??= { color: '#ff4d8d', size: 8, erase: false, neon: false };
    swatches(p, B.color, c => { B.color = c; B.erase = false; });
    slider(p, 'Épaisseur', 2, 40, 1, B.size, v => B.size = v, v => v + ' px');
    chips(p, [['pen', '🖊️ Stylo'], ['neon', '💡 Néon'], ['erase', '🧽 Gomme']], B.erase ? 'erase' : B.neon ? 'neon' : 'pen', v => { B.erase = v === 'erase'; B.neon = v === 'neon'; });
    const r = el('div', { className: 'two' }); r.style.marginTop = '10px'; p.appendChild(r);
    btn(r, '↩️ Annuler le trait', () => { const u = UI.drawUndo?.pop(); if (u) { DRAW.get(s.id).getContext('2d').putImageData(u, 0, 0); drawDirty.add(s.id); req(); scheduleSave(); } });
    btn(r, '🗑️ Tout effacer', () => { const c = DRAW.get(s.id); c.getContext('2d').clearRect(0, 0, c.width, c.height); drawDirty.add(s.id); req(); scheduleSave(); });
    note(p, 'Dessine au doigt sur l’image. Ferme ce panneau (✓) pour arrêter.');
  }],
  /* ---- audio ---- */
  audioVol: ['Volume', (p, s) => slider(p, 'Volume', 0, 2, .05, s.vol, v => s.vol = v, v => Math.round(v * 100) + '%')],
  fades: ['Fondus', (p, s) => { slider(p, 'Fondu entrée', 0, 5, .1, s.fadeIn, v => s.fadeIn = v, v => v.toFixed(1) + ' s'); slider(p, 'Fondu sortie', 0, 5, .1, s.fadeOut, v => s.fadeOut = v, v => v.toFixed(1) + ' s'); }],
  /* ---- racine ---- */
  stickers: ['Stickers', p => {
    const g = el('div', { className: 'grid' });
    for (const e of EMOJIS) { const b = el('button', { textContent: e }); b.onclick = () => { const s = findSel(); if (s?.type === 'sticker') { s.emoji = e; changed(); } else addLayer({ type: 'sticker', emoji: e, size: .12, x: .5, y: .4, anim: { in: 'pop', out: 'fade', loop: 'none' } }); closeSheet(); }; g.appendChild(b); }
    p.appendChild(g);
    note(p, 'Astuce : “Incruster” ajoute une de tes photos (logo, portrait détouré…).');
  }],
  audio: ['Audio', p => {
    const r = el('div', { className: 'two' }); p.appendChild(r);
    btn(r, '🎵 Importer une musique', async () => { const fs = await pickFiles('audio/*,.mp3,.m4a,.wav,.aac'); closeSheet(); addMediaFiles(fs); }, 'primary');
    btn(r, '🎙️ Voix off', () => openTool('voice'));
    btn(p, '🔇 Couper le son de toutes les vidéos', () => { P.clips.forEach(c => c.vol = 0); changed(); toast('Son des vidéos coupé'); }, 'sm full').style.marginTop = '8px';
    note(p, 'Prends tes MP3/M4A dans l’app Fichiers. Les titres Apple Music/Spotify sont protégés. Pour Insta/TikTok, privilégie des sons libres de droits ou ajoute le son tendance directement dans TikTok.');
  }],
  voice: ['Voix off', p => {
    const rec = UI.rec;
    if (!rec) {
      btn(p, '● Enregistrer depuis la tête de lecture', startVoice, 'pink full');
      note(p, 'La vidéo défile pendant que tu parles. Mets des écouteurs pour éviter l’écho.');
    } else btn(p, '■ Arrêter l’enregistrement', stopVoice, 'primary full');
  }],
  subs: ['Sous-titres', p => {
    const subs = P.layers.filter(l => l.auto).sort((a, b) => a.start - b.start);
    UI.subLang ??= 'french'; UI.subStyle ??= 'TikTok';
    if (!subs.length) {
      lab(p, 'Langue'); chips(p, [['french', 'Français'], ['english', 'Anglais'], ['spanish', 'Espagnol']], UI.subLang, v => UI.subLang = v);
      lab(p, 'Style'); chips(p, [['TikTok', 'TikTok'], ['Classique', 'Contour'], ['Jaune', 'Jaune'], ['Impact', 'Impact'], ['Encadré', 'Encadré']], UI.subStyle, v => UI.subStyle = v);
      btn(p, '🪄 Générer les sous-titres', autoSubs, 'primary full').style.marginTop = '12px';
      note(p, '1ère fois : téléchargement de l’IA (~80 Mo, en Wi-Fi c’est mieux). Tout reste sur ton téléphone.');
      btn(p, '＋ Ajouter un sous-titre à la main', () => { closeSheet(); addText(); }, 'sm full').style.marginTop = '8px';
      return;
    }
    const top = el('div', { className: 'two' }); p.appendChild(top);
    btn(top, '🎨 Style de tous', () => { select('layer', subs[0].id); openTool('style'); }, 'sm');
    btn(top, '🗑️ Tout supprimer', () => { P.layers = P.layers.filter(l => !l.auto); changed(); refreshSheet(); }, 'sm danger');
    const list = el('div', { className: 'list' }); p.appendChild(list);
    for (const l of subs) {
      const i = el('input', { type: 'text', value: l.text }); i.oninput = () => { l.text = i.value; changed(false); }; i.onchange = () => commit();
      i.onfocus = () => { UI.T = l.start + .01; req(); };
      const x = el('button', { className: 'ghost', textContent: '✕' }); x.onclick = () => { P.layers = P.layers.filter(y => y !== l); changed(); refreshSheet(); };
      list.appendChild(el('div', { className: 'li' }, [el('span', { className: 't', textContent: fmt(l.start) }), i, x]));
    }
    btn(p, '🔄 Regénérer', autoSubs, 'sm').style.marginTop = '8px';
  }],
  templates: ['Modèles', p => {
    const g = el('div', { className: 'cards' }); p.appendChild(g);
    for (const t of TEMPLATES) { const b = el('button', { textContent: t.name }); b.onclick = () => { applyTemplate(t); closeSheet(); }; g.appendChild(b); }
    note(p, 'Les textes s’ajoutent à la tête de lecture : touche-les pour les modifier.');
  }],
  format: ['Format', p => {
    lab(p, 'Format'); chips(p, Object.keys(RATIOS).map(r => [r, { '9:16': '9:16 TikTok/Reel', '1:1': '1:1 Carré', '4:5': '4:5 Post Insta', '3:4': '3:4', '16:9': '16:9 YouTube', 'Original': 'Original' }[r]]), P.ratio, v => { P.ratio = v; setupCanvas(); changed(); }, 'wrap');
    lab(p, 'Arrière-plan'); bgControls(p);
  }],
};
function bgControls(p) {
  chips(p, [['blur', 'Flou'], ['color', 'Couleur'], ['image', 'Image']], P.bg.mode, async v => {
    if (v === 'image') { const [f] = await pickFiles('image/*', false); if (!f) return; try { const m = await importFile(f); P.bg.mediaId = m.id; } catch (e) { return toast(e.message); } }
    P.bg.mode = v; changed(); refreshSheet();
  });
  if (P.bg.mode === 'color') swatches(p, P.bg.color, c => P.bg.color = c);
}
function linkToggle(p) { lab(p, 'Sous-titres'); chips(p, [[true, 'Modifier tous les sous-titres'], [false, 'Seulement celui-ci']], UI.subsLinked !== false, v => UI.subsLinked = v); }
function preview(l) { UI.T = l.start; play(); setTimeout(() => { if (UI.playing && UI.T > l.start + 1.2) pause(); }, 1300); }
function openTool(name, extra) {
  const [title, build] = TOOLS[name];
  if (UI.playing) pause();
  openSheet(title, p => { const s = findSel(); build(p, s, extra); });
}

/* ---- Modèles ---- */
const TPL_T = (text, preset, o = {}) => { const t = TEXT_PRESETS.find(x => x.name === preset); return { type: 'text', text, font: t.font, color: t.color, style: t.style, bg: t.bg, stroke: t.stroke || '#000', size: .065, ...o }; };
const TEMPLATES = [
  { name: '📣 Annonce de cours', L: [TPL_T('AQUABIKE 🔥', 'Impact', { y: .2, size: .1 }), TPL_T('Mardi 19h · Chartrons', 'TikTok', { y: .3, size: .045, anim: { in: 'slide', out: 'fade', loop: 'none' } }), { type: 'sticker', emoji: '💦', size: .1, x: .82, y: .12, anim: { in: 'zoom', out: 'fade', loop: 'float' } }] },
  { name: '😱 Hook TikTok', L: [TPL_T('ATTENDS LA FIN 😱', 'Jaune', { y: .16, size: .07, anim: { in: 'pop', out: 'fade', loop: 'wiggle' } })], len: 2.5 },
  { name: '🏋️ Tuto exercice', L: [TPL_T('ÉTAPE 1', 'Encadré', { y: .12, size: .05 }), TPL_T('Garde le dos bien droit', 'Classique', { y: .8, size: .055, anim: { in: 'type', out: 'fade', loop: 'none' } })] },
  { name: '🎉 Promo', L: [TPL_T('-20%', 'Fun', { y: .38, size: .2, anim: { in: 'pop', out: 'fade', loop: 'pulse' } }), TPL_T('sur la carte 10 séances', 'TikTok', { y: .53, size: .045 })] },
  { name: '💬 Citation', L: [TPL_T('« Le corps atteint ce que l’esprit croit »', 'Élégant', { y: .5, size: .06, anim: { in: 'fade', out: 'fade', loop: 'none' } })], len: 4 },
  { name: '📍 Infos pratiques', L: [TPL_T('📍 Piscine · Chartrons\n🕖 19h – 20h\n📲 Réserve en DM', 'Machine', { y: .5, size: .045, anim: { in: 'slide', out: 'fade', loop: 'none' } })], len: 4 },
  { name: '⏱️ Compte à rebours', seq: ['3', '2', '1', 'GO ! 💪'] },
  { name: '🔁 Avant / Après', L: [TPL_T('AVANT', 'TikTok', { y: .08, size: .05 })], len: 2, after: TPL_T('APRÈS ✨', 'TikTok', { y: .08, size: .05 }) },
];
function applyTemplate(t) {
  showEditor(); const T = UI.T;
  if (t.seq) { t.seq.forEach((s, i) => addLayer(TPL_T(s, 'Impact', { start: T + i * .8, end: T + i * .8 + .8, size: i === 3 ? .12 : .25, anim: { in: 'zoom', out: 'fade', loop: 'none' } }))); }
  else {
    const len = t.len || 3;
    for (const l of t.L) addLayer({ ...JSON.parse(JSON.stringify(l)), start: T, end: T + len });
    if (t.after) addLayer({ ...JSON.parse(JSON.stringify(t.after)), start: T + len, end: T + len * 2 });
  }
  select(null); toast('Modèle ajouté ✨ Touche un texte pour le modifier');
}

/* ---- Sous-titres auto ---- */
async function autoSubs() {
  if (UI.playing) pause();
  const sources = [];
  layout();
  for (const c of P.clips) { const m = M[c.mediaId]; if (m?.kind === 'video' && c.vol > 0) sources.push({ m, srcIn: c.in, len: c._d, rate: c.speed, at: c._s }); }
  for (const a of P.audios) if (a.kind === 'voice') sources.push({ m: M[a.mediaId], srcIn: a.in, len: a.out - a.in, rate: 1, at: a.start });
  if (!sources.length) return toast('Aucun son à transcrire (clips muets ?)');
  UI.cancel = false; const cancel = [['Annuler', () => { UI.cancel = true; hideOverlay(); }]];
  overlay('Chargement de l’IA de transcription…', -1, cancel);
  try {
    const { pipeline } = await import(HF);
    const prog = {};
    const asr = await pipeline('automatic-speech-recognition', 'Xenova/whisper-base', { progress_callback: e => { if (e.status === 'progress' && e.total) { prog[e.file] = [e.loaded, e.total]; const v = Object.values(prog), a = v.reduce((s, x) => s + x[0], 0), b = v.reduce((s, x) => s + x[1], 0); if (!UI.cancel) overlay(`Téléchargement de l’IA… ${Math.round(a / b * 100)} %`, a / b, cancel); } } });
    const st = TEXT_PRESETS.find(x => x.name === UI.subStyle) || TEXT_PRESETS[1];
    const made = [];
    for (let i = 0; i < sources.length; i++) {
      if (UI.cancel) return;
      const s = sources[i];
      overlay(`Transcription ${i + 1}/${sources.length}… 🎙️`, -1, cancel);
      await (s.m.bufP || decodeAudio(s.m)); if (!s.m.buf) continue;
      const pcm = await pcm16k(s.m.buf, s.srcIn, s.len * s.rate);
      const out = await asr(pcm, { language: UI.subLang, task: 'transcribe', chunk_length_s: 30, stride_length_s: 5, return_timestamps: true });
      for (const sg of splitSubs(out.chunks || [{ text: out.text, timestamp: [0, s.len * s.rate] }], s.len * s.rate)) made.push({ text: sg.text, start: s.at + sg.start / s.rate, end: s.at + sg.end / s.rate });
    }
    if (UI.cancel) return;
    P.layers = P.layers.filter(l => !l.auto);
    for (const m of made) P.layers.push({ id: 'l' + uid(), type: 'text', auto: true, karaoke: true, hl: '#ff4d8d', ...m, x: .5, y: .72, s: 1, r: 0, opacity: 1, size: .055, font: st.font, color: st.color, style: st.style, bg: st.bg, stroke: st.stroke || '#000', anim: { in: 'pop', out: 'none', loop: 'none' } });
    hideOverlay(); changed(); refreshSheet();
    toast(made.length ? `${made.length} sous-titres ajoutés ✅` : 'Aucune parole détectée');
  } catch (e) { console.error(e); overlay('La transcription a échoué 😕\n' + (e.message || '') + '\nTu peux ajouter tes sous-titres à la main.', null, [['OK', hideOverlay]]); }
}
async function pcm16k(buf, from, len) {
  len = Math.min(len, buf.duration - from);
  const off = new OfflineAudioContext(1, Math.ceil(len * 16000), 16000), src = off.createBufferSource();
  src.buffer = buf; src.connect(off.destination); src.start(0, from, len);
  return (await off.startRendering()).getChannelData(0);
}
function splitSubs(chunks, dur) {
  const res = [];
  for (const c of chunks) {
    const txt = (c.text || '').trim(); if (!txt) continue;
    const s = c.timestamp?.[0] ?? 0, e = c.timestamp?.[1] ?? dur, words = txt.split(/\s+/), parts = [];
    for (let i = 0; i < words.length; i += 4) parts.push(words.slice(i, i + 4).join(' '));
    const tot = parts.reduce((a, p) => a + p.length, 0) || 1; let t = s;
    for (const p of parts) { const d = (e - s) * p.length / tot; res.push({ text: p, start: t, end: t + d }); t += d; }
  }
  return res;
}

/* ---- Voix off ---- */
async function startVoice() {
  try {
    ensureAudio();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    const mime = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find(m => MediaRecorder.isTypeSupported(m)) || '';
    const r = new MediaRecorder(stream, mime ? { mimeType: mime } : {}), chunks = [];
    r.ondataavailable = e => e.data.size && chunks.push(e.data);
    UI.rec = { r, stream, chunks, start: UI.T };
    r.start(); play(); refreshSheet(); toast('🎙️ Enregistrement…');
  } catch (e) { toast('Micro refusé ou indisponible'); }
}
async function stopVoice() {
  const R = UI.rec; if (!R) return; UI.rec = null; pause();
  const done = new Promise(res => R.r.onstop = res); R.r.stop(); await done; R.stream.getTracks().forEach(t => t.stop());
  const blob = new Blob(R.chunks, { type: R.r.mimeType || 'audio/mp4' });
  try {
    const f = new File([blob], 'Voix off.' + (blob.type.includes('webm') ? 'webm' : 'm4a'), { type: blob.type });
    const m = await importFile(f);
    P.audios.push({ id: 'a' + uid(), mediaId: m.id, start: R.start, in: 0, out: m.dur, vol: 1, fadeIn: 0, fadeOut: 0, kind: 'voice', name: 'Voix off' });
    changed(); closeSheet(); toast('Voix off ajoutée ✅');
  } catch (e) { toast('Erreur voix off : ' + e.message); }
}

/* ================= Gestes sur l’aperçu ================= */
const ptrs = new Map(); let G = null, lastTap = 0;
const toCanvas = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height, k: cv.width / r.width }; };
function hitLayer(p) {
  const W = cv.width, H = cv.height;
  for (const l of [...P.layers].reverse()) {
    if (l.type === 'draw' || UI.T < l.start || UI.T >= l.end) continue;
    const [bw, bh] = layerBox(l, W, H), a = -l.r * Math.PI / 180, dx = p.x - l.x * W, dy = p.y - l.y * H;
    const lx = (dx * Math.cos(a) - dy * Math.sin(a)) / l.s, ly = (dx * Math.sin(a) + dy * Math.cos(a)) / l.s;
    const m = 12 * p.k / l.s;
    if (Math.abs(lx) <= bw / 2 + m && Math.abs(ly) <= bh / 2 + m) return l;
  }
  return null;
}
cv.addEventListener('pointerdown', e => {
  cv.setPointerCapture(e.pointerId); const p = toCanvas(e); ptrs.set(e.pointerId, p);
  if (UI.playing) pause();
  const s = findSel();
  if (UI.drawing && s?.type === 'draw') { const dc = DRAW.get(s.id); (UI.drawUndo ??= []).push(dc.getContext('2d').getImageData(0, 0, dc.width, dc.height)); if (UI.drawUndo.length > 15) UI.drawUndo.shift(); G = { type: 'draw', last: p, l: s }; stroke(s, p, p); return; }
  if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()], tgt = G?.target || (UI.sel?.kind === 'layer' && s) || (UI.sel?.kind === 'clip' && s);
    if (!tgt) return;
    const isClip = UI.sel.kind === 'clip', o = isClip ? tgt.tf : tgt;
    G = { type: 'pinch', o, isClip, d0: Math.hypot(b.x - a.x, b.y - a.y), a0: Math.atan2(b.y - a.y, b.x - a.x), s0: o.s, r0: o.r, c0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, x0: o.x, y0: o.y };
    return;
  }
  // poignée de redimensionnement
  if (UI.sel?.kind === 'layer' && s && s.type !== 'draw' && UI.T >= s.start && UI.T < s.end) {
    const cn = selCorner(s, cv.width, cv.height);
    if (Math.hypot(p.x - cn.x, p.y - cn.y) < 26 * p.k) { const cx = s.x * cv.width, cy = s.y * cv.height; G = { type: 'handle', l: s, cx, cy, d0: Math.hypot(p.x - cx, p.y - cy), a0: Math.atan2(p.y - cy, p.x - cx), s0: s.s, r0: s.r }; return; }
  }
  const hit = hitLayer(p);
  if (hit) { if (UI.sel?.id !== hit.id) { UI.sel = { kind: 'layer', id: hit.id }; closeSheet(); renderTools(); renderTimeline(); } G = { type: 'move', o: hit, p0: p, x0: hit.x, y0: hit.y, moved: false, hit }; req(); return; }
  const ci = clipIndexAt(UI.T), c = P.clips[ci];
  if (c && UI.sel?.kind === 'clip' && UI.sel.id === c.id) { G = { type: 'move', o: c.tf, p0: p, x0: c.tf.x, y0: c.tf.y, moved: false, clip: true }; return; }
  G = { type: 'tap', p0: p, c };
});
cv.addEventListener('pointermove', e => {
  if (!ptrs.has(e.pointerId)) return;
  const p = toCanvas(e); ptrs.set(e.pointerId, p); if (!G) return;
  const W = cv.width, H = cv.height;
  if (G.type === 'draw') { stroke(G.l, G.last, p); G.last = p; return; }
  if (G.type === 'pinch' && ptrs.size >= 2) {
    const [a, b] = [...ptrs.values()], d = Math.hypot(b.x - a.x, b.y - a.y), ang = Math.atan2(b.y - a.y, b.x - a.x), c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    G.o.s = clamp(G.s0 * d / G.d0, .1, 10);
    let r = G.r0 + (ang - G.a0) * 180 / Math.PI; for (const sn of [0, 90, 180, -90, 270, -180]) if (Math.abs(r - sn) < 4) r = sn; G.o.r = r;
    G.o.x = G.x0 + (c.x - G.c0.x) / W; G.o.y = G.y0 + (c.y - G.c0.y) / H; req(); return;
  }
  if (G.type === 'handle') {
    const d = Math.hypot(p.x - G.cx, p.y - G.cy), a = Math.atan2(p.y - G.cy, p.x - G.cx);
    G.l.s = clamp(G.s0 * d / G.d0, .15, 8); let r = G.r0 + (a - G.a0) * 180 / Math.PI; for (const sn of [0, 90, 180, -90]) if (Math.abs(r - sn) < 4) r = sn; G.l.r = r; req(); return;
  }
  if (G.type === 'move') {
    const dx = (p.x - G.p0.x) / W, dy = (p.y - G.p0.y) / H; if (Math.hypot(p.x - G.p0.x, p.y - G.p0.y) > 4 * p.k) G.moved = true; if (!G.moved) return;
    let x = G.x0 + dx, y = G.y0 + dy; const cx = G.clip ? 0 : .5, sn = .015; UI.guides = { v: Math.abs(x - cx) < sn, h: Math.abs(y - cx) < sn };
    if (UI.guides.v) x = cx; if (UI.guides.h) y = cx; G.o.x = x; G.o.y = y; req();
  }
});
const endPtr = e => {
  ptrs.delete(e.pointerId);
  if (!G) return;
  if (G.type === 'draw') { drawDirty.add(G.l.id); scheduleSave(); G = null; return; }
  if (G.type === 'tap') { const c = G.c; if (c) select('clip', c.id); else select(null); G = null; return; }
  if (G.type === 'move' && !G.moved && G.hit) { const now = Date.now(); if (now - lastTap < 350 && G.hit.type === 'text') openTool('editText'); lastTap = now; }
  if (ptrs.size === 0) { UI.guides = null; const wasMove = G.moved || G.type !== 'move'; G = null; if (wasMove) changed(); else req(); }
};
cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', endPtr);
function stroke(l, a, b) {
  const dc = DRAW.get(l.id); if (!dc) return; const x = dc.getContext('2d'), B = UI.brush, k = dc.width / cv.width, sc = cv.width / cv.getBoundingClientRect().width;
  x.save(); x.lineCap = 'round'; x.lineJoin = 'round'; x.lineWidth = B.size * sc * k;
  x.globalCompositeOperation = B.erase ? 'destination-out' : 'source-over';
  if (B.neon && !B.erase) { x.shadowColor = B.color; x.shadowBlur = B.size * 2 * sc; x.strokeStyle = '#ffffff'; } else x.strokeStyle = B.color;
  x.beginPath(); x.moveTo(a.x * k, a.y * k); x.lineTo(b.x * k + .01, b.y * k); x.stroke(); x.restore(); req();
}

/* ================= Export ================= */
$('#exportBtn').onclick = () => {
  if (!P.clips.length && !P.layers.length) return;
  pause(); select(null);
  UI.q ??= 1080;
  openSheet('Exporter', p => {
    lab(p, 'Qualité vidéo'); chips(p, [[720, '720p (léger)'], [1080, '1080p (HD)']], UI.q, v => UI.q = v, 'big');
    btn(p, `🎬 Exporter la vidéo (${fmt(UI.total).slice(0, -2)})`, exportVideo, 'primary full').style.marginTop = '12px';
    btn(p, '🖼️ Exporter l’image affichée', exportImage, 'full').style.marginTop = '8px';
    note(p, 'La vidéo se calcule en temps réel : garde l’écran allumé et l’app ouverte pendant l’export.');
  });
};
async function exportImage() {
  closeSheet(); UI.exporting = true; setupCanvas(UI.q); syncVideos(); await waitVideos(); render();
  const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  UI.exporting = false; setupCanvas(); req();
  offerSave(blob, `shape-studio-${Date.now()}.png`);
}
function waitVideos() {
  return new Promise(res => { const t0 = performance.now(); const chk = () => { const busy = [...CEL.values()].some(v => v.seeking || v.readyState < 2 && !v.paused); if (!busy || performance.now() - t0 > 2500) res(); else setTimeout(chk, 50); }; setTimeout(chk, 60); });
}
async function exportVideo() {
  closeSheet();
  const mime = window.MediaRecorder ? ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m)) || '' : null;
  if (mime === null || !cv.captureStream) return overlay('Ton navigateur ne permet pas l’export vidéo 😕\nMets à jour iOS.', null, [['OK', hideOverlay]]);
  ensureAudio();
  UI.exporting = true; UI.cancel = false; setupCanvas(UI.q);
  overlay('Préparation…', 0, [['Annuler', () => { UI.cancel = true; pause(); }]]);
  UI.T = 0; syncVideos(); await waitVideos(); render();
  const stream = cv.captureStream(30);
  const rec = new MediaRecorder(new MediaStream([...stream.getVideoTracks(), ...recDest.stream.getAudioTracks()]), { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: UI.q >= 1080 ? 12e6 : 6e6 });
  const chunks = []; rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  const stopped = new Promise(r => rec.onstop = r);
  rec.start(500);
  const ended = new Promise(r => UI.onEnd = r);
  play();
  overlay('Export en cours… garde l’écran allumé 🎬', 0, [['Annuler', () => { UI.cancel = true; pause(); UI.onEnd?.(); }]]);
  const prog = setInterval(() => { $('#ovProg').value = UI.T / UI.total; }, 200);
  await Promise.race([ended, new Promise(r => { const iv = setInterval(() => { if (UI.cancel) { clearInterval(iv); r(); } }, 200); })]);
  clearInterval(prog); UI.onEnd = null;
  rec.stop(); await stopped; stream.getTracks().forEach(t => t.stop());
  UI.exporting = false; setupCanvas(); req();
  if (UI.cancel) { hideOverlay(); return; }
  const type = (rec.mimeType || mime || 'video/mp4').split(';')[0];
  offerSave(new Blob(chunks, { type }), `shape-studio-${Date.now()}.${type.includes('mp4') ? 'mp4' : 'webm'}`);
}
function offerSave(blob, name) {
  const file = new File([blob], name, { type: blob.type });
  overlay(`C’est prêt ✅ (${(blob.size / 1e6).toFixed(1)} Mo)`, null, [
    ['💾 Enregistrer / Partager', async () => {
      if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file] }); hideOverlay(); return; } catch (e) { if (e.name === 'AbortError') return; } }
      const a = el('a', { href: URL.createObjectURL(blob), download: name }); document.body.appendChild(a); a.click(); a.remove(); hideOverlay();
    }, 'primary'],
    ['Fermer', hideOverlay],
  ]);
}

/* ================= Divers UI ================= */
function overlay(text, prog = null, btns = []) {
  $('#overlay').hidden = false; $('#ovText').textContent = text;
  const p = $('#ovProg'); p.hidden = prog === null; if (prog !== null && prog >= 0) p.value = prog; else p.removeAttribute('value');
  const b = $('#ovBtns'); b.innerHTML = '';
  for (const [label, fn, cls] of btns) btn(b, label, fn, cls || '');
}
function hideOverlay() { $('#overlay').hidden = true; }
let toastT; function toast(t) { const e = $('#toast'); e.textContent = t; e.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => e.hidden = true, 2200); }
function showEditor() {
  $('#empty').hidden = true; cv.hidden = false; $('#transport').hidden = false; $('#tlWrap').hidden = false;
  setupCanvas(); renderTimeline(); renderTools();
}
function showEmpty() { $('#empty').hidden = false; cv.hidden = true; $('#transport').hidden = true; $('#tlWrap').hidden = true; renderTools(); }
function refreshAll() { setupCanvas(); renderTimeline(); renderTools(); refreshSheet(); req(); }
$('#undoBtn').onclick = undo; $('#redoBtn').onclick = redo;
$('#ratioBtn').onclick = () => { select(null); openTool('format'); };
$('#startBtn').onclick = async () => addMediaFiles(await pickFiles('image/*,video/*'));
$('#menuBtn').onclick = () => {
  pause();
  overlay('Menu', null, [
    ['🆕 Nouveau projet', async () => { if (!confirm('Effacer le projet en cours et recommencer ?')) return; await idb.clear('media'); await idb.clear('kv'); location.reload(); }, 'pink'],
    ['❓ Astuces', () => overlay('• Fais défiler la timeline pour te déplacer.\n• Touche un élément pour le modifier ; les poignées jaunes ajustent début/fin.\n• Sur l’image : glisse pour déplacer, pince (ou la poignée ⤡) pour agrandir/tourner.\n• Double-tape un texte pour l’éditer.\n• Clip sélectionné : glisse/pince l’image pour recadrer.\n• Ton projet est sauvegardé automatiquement.', null, [['OK', hideOverlay]])],
    ['Fermer', hideOverlay],
  ]);
};
window.addEventListener('resize', () => { renderTimeline(); req(); });

/* ================= Démarrage ================= */
async function boot() {
  renderTools();
  try {
    const saved = await idb.get('kv', 'project');
    if (saved) {
      overlay('Ouverture du projet…', -1);
      const recs = await idb.all('media');
      for (const r of recs) { try { await loadMedia(r); } catch (e) { console.warn('média', e); } }
      P = JSON.parse(saved);
      P.clips = P.clips.filter(c => M[c.mediaId]); P.audios = P.audios.filter(a => M[a.mediaId]); P.layers = P.layers.filter(l => l.type !== 'image' || M[l.mediaId]);
      for (const l of P.layers) if (l.type === 'draw') {
        const b = await idb.get('kv', 'draw:' + l.id); const c = document.createElement('canvas'); [c.width, c.height] = dims();
        if (b) { const bmp = await createImageBitmap(b); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); }
        DRAW.set(l.id, c);
      }
      hideOverlay();
      if (P.clips.length || P.layers.length) showEditor();
    }
  } catch (e) { console.warn('chargement', e); hideOverlay(); }
  hist = [snap()]; hi = 0; updUndo();
  navigator.storage?.persist?.();
  requestAnimationFrame(tick);
}
boot();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
