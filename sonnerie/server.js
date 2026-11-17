// Sonnerie iPhone depuis un lien YouTube
// Prérequis : node >= 18, ffmpeg, yt-dlp (pip install yt-dlp)
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");

const PORT = process.env.PORT || 3000;
const MAX_SECONDS = 30; // limite iPhone pour une sonnerie
const PUBLIC = path.join(__dirname, "public");

const run = (cmd, args) =>
  new Promise((resolve, reject) =>
    execFile(cmd, args, { timeout: 120000 }, (err, out, errOut) =>
      err ? reject(new Error((errOut || err.message).slice(-400))) : resolve(out)
    )
  );

const isYoutube = (u) => {
  try {
    const h = new URL(u).hostname.replace(/^www\.|^m\./, "");
    return ["youtube.com", "youtu.be", "music.youtube.com"].includes(h);
  } catch {
    return false;
  }
};

const parseTime = (v) => {
  // accepte "42", "1:05", "0:01:05"
  const parts = String(v ?? "0").split(":").map(Number);
  if (parts.some((n) => !Number.isFinite(n) || n < 0)) return NaN;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
};

async function makeRingtone({ url, start, duration }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ring-"));
  try {
    const src = path.join(dir, "src.%(ext)s");
    await run("yt-dlp", ["--no-playlist", "-x", "--audio-format", "m4a", "-o", src, url]);
    const srcFile = fs.readdirSync(dir).find((f) => f.startsWith("src."));
    if (!srcFile) throw new Error("Téléchargement impossible");
    const out = path.join(dir, "sonnerie.m4r");
    await run("ffmpeg", [
      "-y", "-ss", String(start), "-t", String(duration),
      "-i", path.join(dir, srcFile),
      "-af", `afade=t=in:d=0.3,afade=t=out:st=${Math.max(duration - 1, 0)}:d=1`,
      "-vn", "-c:a", "aac", "-b:a", "192k", "-f", "ipod", out,
    ]);
    const data = fs.readFileSync(out);
    return data;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/api/ringtone") {
    let body = "";
    req.on("data", (c) => (body += c) && body.length > 1e5 && req.destroy());
    req.on("end", async () => {
      try {
        const { url, start, duration } = JSON.parse(body);
        if (!isYoutube(url)) throw new Error("Lien YouTube invalide");
        const s = parseTime(start);
        const d = Math.min(parseTime(duration || MAX_SECONDS), MAX_SECONDS);
        if (Number.isNaN(s) || Number.isNaN(d) || d <= 0) throw new Error("Temps invalide");
        const data = await makeRingtone({ url, start: s, duration: d });
        res.writeHead(200, {
          "Content-Type": "audio/x-m4r",
          "Content-Disposition": 'attachment; filename="sonnerie.m4r"',
          "Content-Length": data.length,
        });
        res.end(data);
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }
  const file = req.url === "/" ? "index.html" : req.url.replace(/\.\./g, "");
  const p = path.join(PUBLIC, file);
  if (fs.existsSync(p) && fs.statSync(p).isFile()) {
    res.writeHead(200, { "Content-Type": file.endsWith(".html") ? "text/html; charset=utf-8" : "text/plain" });
    fs.createReadStream(p).pipe(res);
  } else {
    res.writeHead(404).end("Not found");
  }
});

server.listen(PORT, () => console.log(`Sonnerie prête sur http://localhost:${PORT}`));
