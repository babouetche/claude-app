// Widget "Limite Claude" pour Scriptable (iPhone)
// Usage : ajoute ce script dans Scriptable, puis ajoute un widget Scriptable
// sur l'écran d'accueil et choisis ce script.
// Pour mettre à jour : ouvre le script dans Scriptable (ou tape sur le widget).

const fm = FileManager.local();
const path = fm.joinPath(fm.documentsDirectory(), "limite-claude.json");

function load() {
  if (fm.fileExists(path)) return JSON.parse(fm.readString(path));
  return { pct: 0, reset: "--:--", label: "Session" };
}

// Mise à jour manuelle quand on lance le script dans l'app
if (!config.runsInWidget) {
  const d = load();
  const a = new Alert();
  a.title = "Limite Claude";
  a.addTextField("% utilisé (0-100)", String(d.pct));
  a.addTextField("Reset à (ex: 18:30)", d.reset);
  a.addAction("Enregistrer");
  a.addCancelAction("Annuler");
  if ((await a.present()) === 0) {
    d.pct = Math.max(0, Math.min(100, parseInt(a.textFieldValue(0)) || 0));
    d.reset = a.textFieldValue(1) || "--:--";
    fm.writeString(path, JSON.stringify(d));
  }
}

const d = load();
const w = new ListWidget();
w.backgroundColor = new Color("#1c1c1e");
w.setPadding(14, 14, 14, 14);

const t = w.addText("Claude · " + d.label);
t.font = Font.semiboldSystemFont(13);
t.textColor = Color.white();
w.addSpacer(4);

// Pourcentage précis, couleur unique
const p = w.addText(d.pct + "%");
p.font = Font.boldSystemFont(34);
p.textColor = Color.white();
const sub = w.addText((100 - d.pct) + "% restant");
sub.font = Font.systemFont(12);
sub.textColor = new Color("#8e8e93");
w.addSpacer(8);

// Barre avec graduations tous les 10 %
const W = 130, H = 12;
const ctx = new DrawContext();
ctx.size = new Size(W, H);
ctx.opaque = false;
const rr = (wd) => { const r = new Path(); r.addRoundedRect(new Rect(0, 0, wd, H), 4, 4); return r; };
ctx.setFillColor(new Color("#3a3a3c"));
ctx.fillPath(rr(W));
ctx.setFillColor(new Color("#0a84ff"));
ctx.fillPath(rr(Math.max(0, W * d.pct / 100)));
ctx.setFillColor(new Color("#1c1c1e"));
for (let k = 1; k < 10; k++) ctx.fillRect(new Rect(W * k / 10 - 0.5, 0, 1, H));
const img = w.addImage(ctx.getImage());
img.imageSize = new Size(W, H);

// Temps restant avant reset
let txt = "Reset " + d.reset;
const m = /^(\d{1,2}):(\d{2})$/.exec(d.reset);
if (m) {
  const now = new Date();
  const e = new Date(now);
  e.setHours(+m[1], +m[2], 0, 0);
  if (e <= now) e.setDate(e.getDate() + 1);
  const mins = Math.round((e - now) / 60000);
  txt += " · dans " + Math.floor(mins / 60) + "h" + String(mins % 60).padStart(2, "0");
}
w.addSpacer(6);
const r = w.addText(txt);
r.font = Font.systemFont(11);
r.textColor = new Color("#8e8e93");

if (config.runsInWidget) Script.setWidget(w);
else await w.presentSmall();
Script.complete();
