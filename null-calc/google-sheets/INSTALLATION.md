# Google Sheets automatique — installation (une seule fois, environ 5 min)

Ta feuille : **[Pokémon Null — Suivi de run (auto)](https://docs.google.com/spreadsheets/d/1FHTM-H3T4Yx9E5s_VXVgNOH2kOkKku1OWgDUkLG6sR8/edit)**

## 1. Coller le script
1. Dans la feuille, va dans **Extensions > Apps Script**.
2. Efface tout le contenu de `Code.gs`, colle le contenu de [`Code.gs`](Code.gs) et enregistre (💾).

## 2. Tout installer
1. Recharge la feuille : un menu **⚡ Null Run** apparaît.
2. Clique sur **⚡ Null Run > Installer / tout mettre à jour** et autorise l'accès. Si Google affiche « Application non validée », clique sur **Paramètres avancés > Accéder au projet (non sécurisé)** : c'est ton propre script.

Le script crée et met en forme tous les onglets, puis importe les données officielles de Null : rencontres et taux, dresseurs, objets. Il programme aussi leur mise à jour automatique chaque lundi.

## 3. Le relier au calculateur
1. Dans Apps Script, va dans **Déployer > Nouveau déploiement**, puis ⚙ > **Application Web**.
2. Règle **Exécuter en tant que : Moi** et **Qui a accès : Tout le monde**, puis clique sur **Déployer** et copie l'URL (elle finit par `/exec`).
3. Dans CALCULATEUR.html, ouvre l'onglet **Suivi de run** puis le bloc **Google Sheets**, colle l'URL et clique sur **Enregistrer**. Le message « ✔ Feuille à jour » confirme que tout marche.

Si tu avais déjà déployé l'ancienne version, va dans **Déployer > Gérer les déploiements > ✏ > Nouvelle version** au lieu de créer un nouveau déploiement : l'URL reste la même.

## Les onglets

| Onglet | Contenu | Mis à jour |
| --- | --- | --- |
| 🏠 **Run** | Tableau de bord : équipe (PV en couleur), captures, morts, level cap, prochain boss et prochain dresseur, top frags, cimetière, frags par split | Automatiquement |
| 🐾 **Pokémon** | Une ligne par Pokémon capturé : zone, niveau, statut, talent, nature, IV (dégradé de couleur), objet, attaques, frags | Automatiquement. La colonne orange **Mort contre** se remplit à la main |
| ⚔️ **Combats** | Une ligne par combat : choisis le dresseur dans la liste (le split se remplit tout seul), puis le lead et les frags | À la main |
| 🎯 **Dresseurs** | Tous les dresseurs officiels, avec équipe, niveaux, objets, talents, natures et attaques. Les boss sont surlignés, les dresseurs battus apparaissent en vert | Données officielles chaque semaine, « Battu » automatique |
| 🌿 **Rencontres** | Toutes les rencontres avec leur %, par zone et méthode (herbes, pêche, surf, Éclate-Roc, cadeaux, échanges, casino). On y voit ta capture dans la zone (✔ vivant / ✝ mort) et si l'espèce est déjà capturée | Données officielles chaque semaine, captures automatiques |
| 📦 **Archives** | Tes runs précédentes : un résumé par tentative (captures, morts, dernier boss battu, frags, combats), puis chaque Pokémon avec ses frags et « Mort contre » | Automatiquement, quand tu recommences une run |
| 🎒 **Objets** | Objets tenus, baies, CT, tuteurs, méga-gemmes, mémoires, Écailles Cœur, menthes, boutique de la Ligue et objets sauvages, avec une case **Récupéré** | Données officielles chaque semaine. Tes cases cochées sont conservées |

## Ce qui est automatique (ou pas)
- **Automatique** : ton équipe, tes boîtes et tes morts (via mGBA et le calculateur), les zones déjà capturées, les espèces déjà possédées, les dresseurs battus, le prochain dresseur, ainsi que les frags, leads et combats calculés depuis l'onglet Combats.
- **Level cap et prochain boss** : ils se déduisent de l'onglet Combats dès que tu y as noté un boss. Avant ça, la feuille reprend les cases cochées dans le calculateur.
- **À la main** : les frags de chaque combat et « Mort contre ». Le jeu ne garde pas en mémoire qui a mis K.O. qui, donc rien ne permet de le lire.

## Quand tu recommences une run
Rien à faire. Le calculateur reconnaît une nouvelle partie à son numéro de dresseur (il change à chaque nouvelle sauvegarde). Dès que ton premier Pokémon apparaît dans la nouvelle partie :
- **La feuille** archive l'ancienne run dans 📦 Archives, vide 🐾 Pokémon, ⚔️ Combats et l'équipe du tableau de bord, puis passe à la tentative suivante. Les rencontres, dresseurs et objets repartent de zéro (zones, « Battu »), mais tes cases « Récupéré » restent cochées : décoche-les si tu veux.
- **Le calculateur** retire les anciens sets « [Run] », décoche les boss et affiche « 🔄 Nouvelle run détectée ».

## À savoir
- La feuille se met à jour au plus toutes les 8 secondes, et seulement quand ta partie change. Quand seuls les PV changent, seule l'équipe est réécrite, pour que ça reste fluide.
- Garde l'URL pour toi : quiconque l'a peut envoyer des données dans ta feuille.
- **⚡ Null Run > Réimporter les données officielles** force une mise à jour immédiate si le créateur du jeu a corrigé ses documents.
- Aucune formule n'est utilisée : la feuille marche en français comme en anglais.
