# Google Sheets automatique — installation (une seule fois, environ 5 min)

Ta feuille : **[Pokémon Null — Suivi de run (auto)](https://docs.google.com/spreadsheets/d/1FHTM-H3T4Yx9E5s_VXVgNOH2kOkKku1OWgDUkLG6sR8/edit)**

## 1. Coller le script dans la feuille
1. Ouvre la feuille, puis va dans **Extensions > Apps Script**.
2. Efface tout le contenu de `Code.gs`, colle le contenu de [`Code.gs`](Code.gs) (ce dossier) et enregistre (💾).

## 2. Le publier en « Application Web »
1. Clique sur **Déployer > Nouveau déploiement**, puis sur la roue ⚙ et choisis **Application Web**.
2. Règle **Exécuter en tant que : Moi** et **Qui a accès : Tout le monde**.
3. Clique sur **Déployer** et autorise l'accès. Si Google affiche « Application non validée », clique sur **Paramètres avancés > Accéder au projet (non sécurisé)** : c'est ton propre script.
4. Copie l'**URL de l'application Web**. Elle finit par `/exec`.

## 3. La relier au calculateur
1. Dans CALCULATEUR.html, ouvre l'onglet **Suivi de run** puis le bloc **Google Sheets**.
2. Colle l'URL et clique sur **Enregistrer**.
3. Le message « ✔ Feuille à jour » confirme que tout marche.

## Ce qui se remplit tout seul
- **Pokémon** : une ligne par Pokémon capturé. On y trouve la zone, l'espèce, le surnom, le niveau, le statut (Équipe / K.O. / Boîte / Mort / Absent), le talent, la nature, les IV et leur moyenne, le type de Puissance Cachée, l'objet, les attaques et le niveau de capture.
- **Run** : la dernière synchro, le nombre de Pokémon en équipe, en boîte et morts, le niveau max, le level cap et le prochain boss (d'après les cases cochées dans le calculateur). On y trouve aussi l'équipe actuelle avec ses PV, le top frags, le cimetière et les frags par split.

## Ce que tu remplis à la main
- **Combats** : une ligne par combat, avec le dresseur, le split (menu déroulant), le lead, puis chaque Pokémon utilisé avec ses frags.
  Les **frags, leads et combats joués** de chaque Pokémon se recalculent alors tout seuls, au total et par split.
- **Pokémon > Mort contre** (colonne orange) : le dresseur qui a tué ce Pokémon.

Le script ne touche jamais ces colonnes manuelles.

## À savoir
- La feuille se met à jour au plus toutes les 8 secondes, et seulement quand ta partie change.
- Garde l'URL pour toi : quiconque l'a peut envoyer des données dans ta feuille.
- Si tu modifies le script plus tard, va dans **Déployer > Gérer les déploiements > ✏ > Nouvelle version**. L'URL ne change pas.
- Le menu **Null Run > Créer / réparer la mise en page** remet les en-têtes en place si besoin.
