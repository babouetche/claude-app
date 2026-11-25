# Audit des équipes et des formes — ROM Null 1.2.6

Sources : ROM fournie `78455d8dabf57ab6b90cf2041bdc173c1b825cc035a9f416c5e96903717e9045`, ROM 1.2.4 `a6f4f3f9d9b68515c70b134d6f0e79b3fd22e00c2f1468dbafa5b7529d98dbf4`, [classeur officiel actuel](https://docs.google.com/spreadsheets/d/1mwHPt0AMzOJ_hfmDrVZpKP-Hf4eTT0ROhY8Wa7bY7r8/edit), et les 2 280 lignes de sets conservées. L'ancien fichier `gen9.js` n'a pas été modifié.

## Couverture et méthode

Le classeur a 11 onglets de combats visibles : 340 blocs, dont 335 équipes non vides, et 1 671 Pokémon. Les onglets cachés Dex/Sprites n'ont pas été interprétés comme des équipes.

2 278 lignes de sets ont une correspondance native par quatre attaques, niveau et espèce (avec correspondances explicites pour les formes). La ligne Tatsugiri-Stretchy de Reli&Ian est reliée manuellement à l'espèce native 1364, ancre ancienne `0x3af070` / nouvelle `0x3b3750`. La dernière ligne est le sentinelle None/Wandering Spirit. Chaque set réel reçoit ainsi un profil natif ; **ce rapprochement n'est pas une certification indépendante de son identifiant de trainer**. Le classeur et les identités historiques donnent les noms ; les en-têtes natifs de propriétaires sont décodés séparément seulement pour les deux groupes documentés plus bas.

37 groupes contenaient des profils présents à plusieurs adresses. Une sélection aveugle du premier candidat pouvait prendre le Pokémon d'un autre combat. Une seule séquence contiguë au pas de 40 octets correspond à l'ordre historique complet de chacun de ces groupes : elle résout 29 ancres précédemment choisies au premier résultat. Seules les familles de transformations connues sont fusionnées ; Rattata/Rattata-Alola et Grimer/Grimer-Alola, présents dans des pools de l'Académie, sont désormais deux emplacements distincts. Les pools de plus de six entrées ne sont pas présentés comme une seule équipe de combat. Les candidats, séquences et corrections figurent dans `bindingAudit` de la fixture. Cette cohérence de groupe est plus forte qu'un rapprochement isolé de profil, mais ne remplace pas une lecture de tous les en-têtes de trainers du jeu.

Les adresses des Pokémon dans cette étude désignent **l'ancre des IV**, huit octets après le début physique de `TrainerMon`. La structure native occupe 40 octets ; sa charge utile depuis l'ancre IV en occupe 32. Les décalages suivants sont relatifs à cette ancre : niveau **octet à +18**, et non entier 16 bits ; +19 contient notamment des valeurs de Ball pour les Ultra-Beasts. Les contrôles antérieurs sur trente formes avaient tous +19 à zéro. IV +0, attaques +4, espèce +12, objet +14, talent +16, nature/flags +21, statut initial +24. Les 32 octets utiles sont comparés ; les huit octets du prochain enregistrement ne sont pas pris pour des changements d'équipe.

Les équipes inchangées se retrouvent à +`0x46e0` jusqu'au point ancien `0x3b284c`. Six Pokémon sont ensuite insérés ; les enregistrements ultérieurs se retrouvent à +`0x47d0`. Sans traiter cette insertion, une comparaison naïve aurait attribué à tort l'équipe du nouveau trainer à Sidney et décalé toute la Ligue.

## Changements natifs réels

25 enregistrements de Pokémon changent. Ils donnent 28 patches de lignes affichées, car certaines attaques sont partagées avec une ligne Méga. Les talents post-Méga restent spécifiques ; l'ancienne ligne Feraligatr-Mega conserve Dragon's Maw alors que sa ligne de base passe de Torrent à Sheer Force.

| Trainer / Pokémon | Différence 1.2.4 → 1.2.6 |
| --- | --- |
| Académie #2 slot 2 / Geodude | Sturdy → Rock Head |
| Académie #2 slot 2 / Geodude-Alola | Sturdy → Magnet Pull |
| Charlie / Floette-Eternal | N.66 → N.65 |
| Lao / Noctowl | Hurricane → Air Slash |
| Courtney 2 / Iron Moth | **N.70 → N.68**, confirmé ROM et classeur ; le « −1 » des notes est imprécis |
| Nob / Conkeldurr | Leftovers → Flame Orb ; brûlure initiale retirée |
| Carolina/Cory / Feraligatr | Torrent → Sheer Force, forme de base |
| Winona 1 / Celesteela | Hurricane → Air Slash |
| Winona 1 / Landorus-Therian | Floaty Fall → Fly |
| Zeldest / Yveltal | Black Glasses → Apicot Berry ; Fiery Wrath → Dark Pulse |
| Magma Grunt #10 / Zarude | Timid → Jolly |
| Reli&Ian / Kricketune | Infestation/Trailblaze/Power-Up Punch → Knock Off/Electroweb/Triple Axel |
| Shelly 2 / Pheromosa | Naive → Jolly |
| Archie 2 / Iron Jugulis | Yache Berry → Assault Vest ; Nasty Plot → Earth Power |
| Reed / Mantine | Aqua Ring → Soak |
| Stephin/Barron / Ogerpon-Hearthflame | Growth → Upper Hand |
| John&Jay / Iron Jugulis | Terrain Pulse → Thunderbolt |
| Bethany / Chi-Yu | Energy Ball → Ruination |
| Juan / Kingdra | Chesto Berry → Kee Berry ; Rest → Laser Focus |
| Rocket Grunt #2 / Weezing | Focus Band → Ability Shield |
| Des / Blaziken | Bolt Strike → Thunder Punch, base et affichage Méga |
| Leaf 2 / Deoxys-Attack | Scrappy → Contrary |
| Trainer Maxie / Groudon | Bulk Up → High Horsepower, base et Primo |
| Trainer Archie / Kyogre | Calm Mind → Whirlpool, base et Primo |
| Noland / Mawile | Play Rough/Sucker Punch → Spirit Break/Knock Off |

## Nouveau trainer et omissions précédentes

Dragon Tamer Regenor est un nouveau combat double. Ses six Pokémon N.100 sont Raichu (affiché Méga-X), Iron Bundle, Zekrom, Toxapex, Naganadel et Hydrapple. Les six nouveaux enregistrements natifs sont `0x3b6f2c` à `0x3b6ff4`. La navigation doit l'insérer avant la Ligue, sans réindexer les anciens sets sauvegardés.

Le dictionnaire historique ne pouvait pas représenter deux individus de même espèce et même trainer. Deux omissions préexistantes sont rétablies :

- Elliot/Ned : le premier Lanturn N.44 (Volt Absorb) reste présent ; le second N.43 (Water Absorb, Wiki Berry, Discharge/Parabolic Charge/Bubble Beam/Ice Beam), natif `0x3a8524`, a un identifiant de set distinct et le même groupe de combat.
- Benjamin/Alyssa : le Raichu-Mega-X physique reste présent ; le second Raichu-Mega-Y spécial (Timid, Raichunite Y, Thunderbolt/Discharge/Grass Knot/Signal Beam), natif `0x3aa214`, est ajouté comme un autre emplacement. Les deux Raichu ne doivent jamais partager leurs marques KO par simple égalité d'espèce de base.

Les deux Brandon possèdent déjà Zygardite dans la ROM 1.2.4 ; le classeur actuel confirme l'affichage Zygarde-Mega. Les deux anciennes lignes Complete sont remplacées dans la couche effective par Mega, en conservant leurs identifiants historiques comme alias. La ROM stocke toutefois Zygarde avant Méga-Évolution ; il faut séparer cette identité de réserve de l'affichage actif.

## Méga-Évolutions en réserve

148 affichages Méga historiques ont été reliés aux enregistrements natifs. 144 stockent une forme de base, **quatre sont déjà des Méga dans l'équipe** : Tyranitar/Steelix/Garchomp du Grunt Steve 3, et Salamence de Zinnia. Une correction générale « toujours revenir à la base » serait donc fausse. Les métadonnées indiquent l'espèce et le talent réellement enregistrés pour chaque emplacement ; une Méga déjà active utilise ses contrôles affichés.

## Livraison technique

`tests/fixtures/trainer-update-1.2.6.json` est la référence versionnée. `scripts/build-version126-trainers.cjs` fabrique `docs/js/null_ai/version126-trainers.js`, couche additive UMD `NullVersion126Trainers`. Le module valide toutes les préconditions avant mutation, applique les 28 patches, ajoute huit sets, remplace deux affichages, garde les anciens index, et expose les identités/groupes/ordres. Après migration : **2 288 sets**, dont un sentinelle None. Les dix tests dédiés passent.

Les **2 122 emplacements logiques** couvrent les 2 287 sets réels effectifs. `order` conserve l'offset ROM 1.2.6 comme preuve et ne sert plus d'ordre d'interface. `partyOrder`, également exposé par `partyOrderForSet`, reprend le minimum des index historiques des alias ; les deux groupes de propriétaires validés utilisent leur ordre compact natif, et Regenor ses six entrées natives claires. Le suffixe du second Lanturn est une correspondance explicite ; aucun regroupement générique par préfixe de trainer n'a été ajouté.

`navigationSetFor` conserve exactement les **348 groupes historiques**, triés par leur minimum d'index sauvegardé, puis insère explicitement Regenor avant Sidney Singles. Une régression compare exhaustivement l'ordre, le premier set sélectionné et les liens Previous/Next des 349 groupes effectifs. Ce choix reste indépendant des adresses de profils identiques. Le tri antérieur par minimum d'adresse inversait les rivaux Fennekin/Froakie de Rustboro et remontait Drake Singles avant Maxie, provoquant douze inversions entre groupes ; cette régression est corrigée.

La fixture de formes actualisée est `references/update126/trainers/reserve-form-rom-1.2.6.json` : 29 ensembles / 30 enregistrements, fiches d'espèce relocalisées, copie native de l'espèce à `0x0808b146`. Les aliases Brandon incluent l'affichage Mega, mais l'identité native attendue reste Zygarde.

## Propriétaires des réserves en double

Deux combats ont une séparation nativement démontrée entre deux trainers : Elliot/Ned et Benjamin/Alyssa. `ownerForSet` et `ownerGroupForSet` identifient le propriétaire depuis l'emplacement natif, y compris ses alias de forme. Les limites calculateur sont exclusives à droite : Elliot `[0,2)`, Ned `[2,4)`, Benjamin `[0,3)`, Alyssa `[3,5)`. Les indices physiques du jeu utilisent deux moitiés de trois emplacements, avec cases vides ; ils ne doivent pas être copiés directement dans la liste compacte du calculateur. Les preuves sont dans `references/update126/owners/trainer-owner-groups-1.2.6.json`. Aucun autre nom contenant « & » n'est automatiquement partagé en deux propriétaires.

## Divergences du classeur non importées aveuglément

Tera Shell affiché pour Terapagos décrit une transformation ; la ROM de réserve garde Tera Shift. Les libellés génériques As One ne remplacent pas les talents spécifiques des cavaliers de Calyrex. « Lax Inscense » est une faute de frappe et ne remplace pas Lax Incense. Les premières comparaisons de colonnes ont été corrigées pour traiter les deux Lanturn et les deux Raichu comme des individus séparés, pas comme des remplacements.
