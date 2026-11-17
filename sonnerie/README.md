# Sonnerie iPhone

Colle un lien YouTube, choisis le début (max 30 s) → fichier `.m4r` prêt pour iPhone.

## Lancer
    pip install yt-dlp   # + ffmpeg installé
    node sonnerie/server.js   # http://localhost:3000

Pour l'utiliser depuis l'iPhone : héberger sur un petit serveur (Render, Railway, VPS) puis ouvrir l'URL dans Safari.

Note : respecte le droit d'auteur, usage personnel uniquement.

## Déployer (Render, gratuit)
1. render.com > New > Web Service > repo `babouetche/claude-app`, Root Directory `sonnerie`, Runtime Docker.
2. Ouvre l'URL dans **Safari** sur l'iPhone > Partager > **Sur l'écran d'accueil**.
