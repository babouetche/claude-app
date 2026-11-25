# Téléchargeur Aquatic Shape — à placer dans a-Shell : ~/Documents/dl/dl.py
# Usage : python3 dl.py mp4|mp3|sonnerie "LIEN" [debut_en_secondes]
import os, sys, time, glob, re, subprocess

DOSSIER = os.path.expanduser("~/Documents/dl")
MAJ_FICHIER = os.path.join(DOSSIER, ".derniere_maj")
COOKIES = os.path.join(DOSSIER, "cookies.txt")  # optionnel, si YouTube demande "confirm you're not a bot"


def mettre_a_jour(forcer=False):
    """Met yt-dlp à jour (1 fois par jour, ou de force après un échec)."""
    try:
        if not forcer and time.time() - os.path.getmtime(MAJ_FICHIER) < 86400:
            return
    except OSError:
        pass
    print("🔄 Mise à jour de yt-dlp…")
    try:
        from pip._internal.cli.main import main as pip_main
        pip_main(["install", "-U", "-q", "--pre", "yt-dlp[default]"])
        open(MAJ_FICHIER, "w").close()
    except Exception as e:
        print("Mise à jour impossible (pas de réseau ?) :", e)
    for m in [m for m in sys.modules if m.startswith("yt_dlp")]:
        del sys.modules[m]


def nettoyer_lien(lien):
    m = re.search(r"https?://\S+", lien)
    lien = m.group(0) if m else lien
    # youtube.com/shorts/ID, youtu.be/ID, music.youtube.com → lien standard
    m = re.search(r"(?:youtu\.be/|shorts/|live/|[?&]v=)([\w-]{11})", lien)
    if m and "youtu" in lien:
        lien = "https://www.youtube.com/watch?v=" + m.group(1)
    return lien


def options(mode, clients):
    o = {
        "outtmpl": os.path.join(DOSSIER, "dl.%(ext)s"),
        "noplaylist": True,
        "quiet": False,
        "no_warnings": True,
        "retries": 5,
        "fragment_retries": 10,
        "overwrites": True,
        "updatetime": False,  # date du fichier = maintenant (sinon Photos le range à la date de publication)
    }
    if clients:
        o["extractor_args"] = {"youtube": {"player_client": clients}}
    if os.path.exists(COOKIES):
        o["cookiefile"] = COOKIES
    if mode == "mp4":
        # H.264 + AAC en priorité : lisible direct dans Photos
        o["format"] = "bv*+ba/b"
        o["format_sort"] = ["vcodec:h264", "res:1080", "acodec:m4a"]
        o["merge_output_format"] = "mp4"
    else:
        o["format"] = "ba/b"
        o["postprocessors"] = [{"key": "FFmpegExtractAudio", "preferredcodec": "mp3", "preferredquality": "0"}]
    return o


# Différentes "identités" YouTube : si l'une est bloquée, on essaie la suivante
ESSAIS = [None, ["tv", "web_safari"], ["mweb"], ["android_vr"], ["web_embedded"], ["ios"]]


def telecharger(mode, lien):
    import yt_dlp
    derniere_erreur = None
    essais = ESSAIS if "youtube.com" in lien else [None]
    for clients in essais:
        try:
            with yt_dlp.YoutubeDL(options(mode, clients)) as ydl:
                ydl.download([lien])
            attendu = os.path.join(DOSSIER, "dl." + ("mp4" if mode == "mp4" else "mp3"))
            if os.path.exists(attendu) and os.path.getsize(attendu) > 0:
                return True
        except Exception as e:
            derniere_erreur = e
            print("⚠️ Essai raté (%s), on tente autre chose…" % (clients or "par défaut"))
    print("Dernière erreur :", derniere_erreur)
    return False


def main():
    mode = sys.argv[1].lower()
    lien = nettoyer_lien(sys.argv[2])
    debut = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3].strip() else "0"
    os.makedirs(DOSSIER, exist_ok=True)
    for f in glob.glob(os.path.join(DOSSIER, "dl.*")) + glob.glob(os.path.join(DOSSIER, "sonnerie.*")):
        if not f.endswith(".py"):  # ne jamais effacer le script lui-même
            os.remove(f)

    mettre_a_jour()
    ok = telecharger(mode, lien)
    if not ok:
        mettre_a_jour(forcer=True)  # YouTube a sûrement changé : on récupère le correctif et on retente
        ok = telecharger(mode, lien)
    if not ok:
        print("❌ ÉCHEC — vérifie le lien / ta connexion, ou ajoute un cookies.txt (voir guide).")
        sys.exit(1)

    if mode == "sonnerie":
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", str(debut),
                        "-i", os.path.join(DOSSIER, "dl.mp3"), "-t", "29",
                        "-af", "afade=t=in:d=0.5,afade=t=out:st=27.5:d=1.5",
                        "-c:a", "aac", "-b:a", "192k", os.path.join(DOSSIER, "sonnerie.m4a")])
    print("✅ OK")


if __name__ == "__main__":
    main()
