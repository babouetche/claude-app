# 📥 Raccourci « Télécharger » — TikTok, Insta, X, YouTube → MP4 / MP3 / Sonnerie

Tout tourne **sur ton iPhone**, gratuit, sans pub, sans site louche.
Moteur : l'app **a-Shell** (gratuite, App Store) + **yt-dlp** (l'outil de référence pour télécharger des vidéos).

---

## 1. Installation (une seule fois, 3 min)

1. Installe **a-Shell** depuis l'App Store (éditeur : Nicolas Holzschuch).
2. Ouvre a-Shell et tape ces 2 lignes (Entrée après chacune) :

```
pip install yt-dlp
mkdir -p ~/Documents/dl
```

3. Pour mettre à jour plus tard (si un site ne marche plus) : `pip install -U yt-dlp`

---

## 2. Créer le raccourci (app Raccourcis)

Nouveau raccourci, nomme-le **Télécharger**. Dans ⓘ (réglages du raccourci) : active **« Afficher dans la feuille de partage »**, types acceptés : **URL** et **Texte**. Si aucune entrée : **« Continuer »**.

Ajoute ces actions dans l'ordre :

| # | Action | Réglage |
|---|--------|---------|
| 1 | **Si** | *Entrée du raccourci* « n'a pas de valeur » |
| 2 | ↳ **Obtenir le presse-papiers** | |
| 3 | ↳ **Définir la variable** | nom : `lien` |
| 4 | **Sinon** | |
| 5 | ↳ **Définir la variable** | *Entrée du raccourci* → `lien` |
| 6 | **Fin si** | |
| 7 | **Choisir dans le menu** | invite : « Format ? » — options : `🎬 Vidéo MP4`, `🎵 Musique MP3`, `🔔 Sonnerie` |

Puis dans **chaque option du menu** :

### 🎬 Vidéo MP4
1. **Execute Command** (a-Shell) — colle le texte ci-dessous, en remplaçant `LIEN` par la variable **lien** (appui long → Sélectionner la variable) :
```
cd ~/Documents/dl
rm -f dl.*
yt-dlp -f "b[ext=mp4]/bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b" --merge-output-format mp4 -o "dl.%(ext)s" "LIEN"
```
2. **Get File** (a-Shell) — fichier : `dl/dl.mp4`
3. **Enregistrer dans l'album photo** → Récents

### 🎵 Musique MP3
1. **Execute Command** :
```
cd ~/Documents/dl
rm -f dl.*
yt-dlp -x --audio-format mp3 --audio-quality 0 -o "dl.%(ext)s" "LIEN"
```
2. **Get File** — fichier : `dl/dl.mp3`
3. **Enregistrer le fichier** (Fichiers → dossier de ton choix, ex. « Musiques cours »)

### 🔔 Sonnerie
1. **Demander une saisie** — Nombre, invite : « Début de la sonnerie (en secondes) ? », par défaut `0` → variable `debut`
2. **Execute Command** (remplace `LIEN` et `DEBUT` par les variables) :
```
cd ~/Documents/dl
rm -f dl.* sonnerie.*
yt-dlp -x --audio-format mp3 -o "dl.%(ext)s" "LIEN"
ffmpeg -y -ss DEBUT -i dl.mp3 -t 29 -af "afade=t=in:d=0.5,afade=t=out:st=27.5:d=1.5" -c:a aac -b:a 192k sonnerie.m4a
```
3. **Get File** — fichier : `dl/sonnerie.m4a`
4. **Enregistrer le fichier** → Fichiers (ex. dossier « Sonneries »)
5. (optionnel) **Afficher une notification** : « Sonnerie prête ✅ Ouvre-la dans Fichiers → Partager → Utiliser comme sonnerie »

> La sonnerie est coupée à 29 s (limite iOS) avec un fondu au début et à la fin.

---

## 3. Utilisation

- **Depuis TikTok / Insta / X / YouTube** : bouton **Partager** → **Télécharger** (ou « Copier le lien » puis lance le raccourci depuis l'écran d'accueil / bouton Action / Siri « Télécharger »).
- Choisis le format → c'est rangé.

## 4. Mettre en sonnerie

**iOS 26 et +** : app **Fichiers** → ouvre `sonnerie.m4a` → bouton **Partager** → **Utiliser comme sonnerie**. Ensuite Réglages → Sons → Sonnerie.

**iOS plus ancien** : partage le fichier vers **GarageBand** → appui long sur le morceau → **Partager** → **Sonnerie** → Exporter → « Utiliser le son comme… ».

---

## 5. Si ça bloque

| Problème | Solution |
|---|---|
| Un site ne marche plus | Dans a-Shell : `pip install -U yt-dlp` |
| Instagram refuse (compte privé / connexion requise) | Seuls les posts publics passent sans connexion |
| YouTube capricieux | Mets à jour yt-dlp ; YouTube change souvent ses protections |
| Rien ne se passe | Ouvre a-Shell une fois, puis relance le raccourci |

⚠️ Usage perso uniquement : pour diffuser une musique en cours (cadre pro), il faut les droits (SACEM / Spré).
