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
w.addSpacer(6);

const p = w.addText(d.pct + "% utilisé");
p.font = Font.boldSystemFont(22);
p.textColor = d.pct >= 90 ? new Color("#ff453a") : d.pct >= 70 ? new Color("#ff9f0a") : new Color("#30d158");
w.addSpacer(8);

// Barre de progression
const W = 130, H = 10;
const ctx = new DrawContext();
ctx.size = new Size(W, H);
ctx.opaque = false;
ctx.setFillColor(new Color("#3a3a3c"));
ctx.fillPath((() => { const r = new Path(); r.addRoundedRect(new Rect(0, 0, W, H), 5, 5); return r; })());
ctx.setFillColor(p.textColor);
ctx.fillPath((() => { const r = new Path(); r.addRoundedRect(new Rect(0, 0, Math.max(H, W * d.pct / 100), H), 5, 5); return r; })());
const img = w.addImage(ctx.getImage());
img.imageSize = new Size(W, H);

w.addSpacer(6);
const r = w.addText("Reset : " + d.reset);
r.font = Font.systemFont(11);
r.textColor = new Color("#8e8e93");

if (config.runsInWidget) Script.setWidget(w);
else await w.presentSmall();
Script.complete();
