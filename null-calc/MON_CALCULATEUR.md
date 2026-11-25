# Mon calculateur Pokémon Null — notice

Base : [PokemonNullCalculator](https://github.com/Heroless-code/PokemonNullCalculator) (AGPL-3.0), avec trois ajouts personnels.

## Démarrer
1. Télécharge ce dossier `null-calc` sur ton PC (sans rien enlever).
2. Double-clique sur **CALCULATEUR.html** (Chrome ou Edge).

## 1. Suivi de run (onglet « Suivi de run »)
Il affiche l'équipe (PV, statut, PP), les boîtes, le cimetière (boîtes 12 à 14), les captures par zone, ainsi que le level cap et le prochain boss. Pour les boss, coche-les au fur et à mesure.

### Synchro automatique avec mGBA
1. Utilise **mGBA 0.10 ou plus récent**.
2. Copie le Lua officiel du jeu **`Null_1.2.6.lua`** dans le dossier `null-calc/lua/`, à côté de `NullCalcSync.lua`.
3. Dans mGBA : **Outils > Scripting…**, puis **Fichier > Charger un script** et choisis `lua/NullCalcSync.lua`.
4. Laisse CALCULATEUR.html ouvert : tout se met à jour seul, environ toutes les 1,5 s.

Ce que fait la synchro :
- Elle crée tes sets **« Surnom [Run] »** dans le calculateur : l'équipe va dans *Team* et le reste dans la boîte. Les Pokémon morts sont retirés.
- Quand le Pokémon affiché à gauche est l'un des tiens, ses **PV et son statut** suivent ceux du jeu.
- Les évolutions, changements d'attaques, d'objets et de niveaux sont suivis automatiquement.
- Le script **ne modifie jamais ta partie** : il lit seulement la mémoire du jeu.

Quand tu recommences une run, tout se remet à zéro tout seul : anciens sets retirés, boss décochés, ancienne run archivée dans Google Sheets.

Si le Lua ne trouve pas son dossier, tape dans la console de mGBA :
`NULL_CALC_LUA_DIR = [[C:\chemin\vers\null-calc\lua\]]`, puis recharge le script.

## Overlay OBS (PokemonNullDisplay de Sykless)
`NullCalcSync.lua` écrit aussi le fichier `pokemonData.txt` que lit PokemonNullDisplay. Tu n'as donc plus besoin de charger `PokemonNullDisplay.lua` dans mGBA :
1. Lance **PokemonNullDisplay.exe** comme d'habitude : c'est lui qui dessine les images pour OBS.
2. Dans mGBA, charge **seulement** `NullCalcSync.lua`.
3. Le message `Overlay OBS (PokemonNullDisplay) : …` confirme que c'est actif. S'il n'apparaît pas, lance l'exe une fois puis redémarre mGBA.

Le fichier est identique à celui de leur script, avec une correction : les Pokémon en boîte affichent leur vrai niveau. Leur script lit l'ancien format de données et affiche souvent niveau 1.

## Google Sheets automatique
Ta feuille de suivi se remplit toute seule à partir de ta partie. Installation : voir [google-sheets/INSTALLATION.md](google-sheets/INSTALLATION.md).

## 2. « Pourquoi ces % ? » (panneau IA, à droite)
Pour chaque attaque adverse, le panneau affiche :
- son score possible (par exemple +6 à 75 % / +8 à 25 %) ;
- les règles de l'IA appliquées, en français (survole une règle pour voir le texte d'origine) ;
- une phrase qui explique le % obtenu.

En bas du panneau, un rappel explique comment l'IA de Null choisit son attaque.

## Vérifications
- `npm test` : tests unitaires.
- `npm run test:run-sheets-browser` : envoi vers Google Sheets, de bout en bout.
- `npm run test:run-tracker-browser` et `npm run test:ai-explain-browser` : tests dans le navigateur.
- `NULL_OFFICIAL_LUA=…/Null_1.2.6.lua npm run test:lua` : test du script Lua sur une mémoire simulée.

## Correctifs par rapport au Lua officiel
- Le statut (brûlure, paralysie…) est lu au bon emplacement (+84). Le Lua officiel le lit à +80, dans les données chiffrées.
- Self-Destruct, Explosion, Final Gambit et Misty Explosion gardent leur vrai nom. Le Lua officiel les remplace par « None ».
