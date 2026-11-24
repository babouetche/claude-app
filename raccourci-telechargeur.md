# 📥 Raccourci « Télécharger » — TikTok, Insta, X, YouTube → MP4 / MP3 / Sonnerie

Tout tourne **sur ton iPhone**, gratuit, sans pub, sans site louche.
Moteur : l'app **a-Shell** (gratuite, App Store) + **yt-dlp** (l'outil de référence pour télécharger des vidéos).

---

## 1. Installation (une seule fois, 3 min)

1. Installe **a-Shell** depuis l'App Store (éditeur : Nicolas Holzschuch).
2. Ouvre a-Shell et tape (Entrée après chaque ligne) :
```
pip install -U --pre "yt-dlp[default]"
mkdir -p ~/Documents/dl
```
3. Sur ton iPhone, ouvre le fichier **`dl.py`** de ce dépôt (app GitHub) → copie tout son contenu.
4. Dans a-Shell, tape :
```
pbpaste > ~/Documents/dl/dl.py
```

C'est ce script qui rend YouTube fiable (voir section 6).

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
python3 ~/Documents/dl/dl.py mp4 "LIEN"
```
2. **Get File** (a-Shell) — fichier : `dl/dl.mp4`
3. **Enregistrer dans l'album photo** → Récents

### 🎵 Musique MP3
1. **Execute Command** :
```
python3 ~/Documents/dl/dl.py mp3 "LIEN"
```
2. **Get File** — fichier : `dl/dl.mp3`
3. **Enregistrer le fichier** (Fichiers → dossier de ton choix, ex. « Musiques cours »)

### 🔔 Sonnerie
1. **Demander une saisie** — Nombre, invite : « Début de la sonnerie (en secondes) ? », par défaut `0` → variable `debut`
2. **Execute Command** (remplace `LIEN` et `DEBUT` par les variables) :
```
python3 ~/Documents/dl/dl.py sonnerie "LIEN" DEBUT
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
| Instagram refuse | Seuls les posts publics passent sans connexion |
| YouTube : « Sign in to confirm you're not a bot » | Ajoute un `cookies.txt` (section 6) |
| Rien ne se passe | Ouvre a-Shell une fois, puis relance le raccourci |

---

## 6. Pourquoi YouTube marche (presque) toujours

Le script `dl.py` fait tout seul, à chaque téléchargement :
1. **Mise à jour auto** de yt-dlp 1 fois par jour (version la plus récente, celle qui contient les correctifs YouTube du jour).
2. **6 tentatives** avec des « identités » YouTube différentes (TV, Safari, mobile, VR, intégré, iOS) : si YouTube en bloque une, il passe à la suivante.
3. Si tout échoue : **mise à jour forcée** immédiate puis nouvelle série de tentatives.
4. Nettoie les liens (Shorts, youtu.be, liens avec `?si=`, playlists → seulement la vidéo).
5. Vidéo en **H.264 / 1080p max** : elle se lit directement dans Photos.

**Le seul cas qui peut encore bloquer** : YouTube qui exige d'être connecté. Dans ce cas, exporte tes cookies YouTube en `cookies.txt` (extension « Get cookies.txt LOCALLY » sur un ordi), puis mets le fichier dans a-Shell → `~/Documents/dl/cookies.txt`. Le script l'utilise automatiquement.

⚠️ Usage perso uniquement : pour diffuser une musique en cours (cadre pro), il faut les droits (SACEM / Spré).
