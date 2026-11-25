# Migration Null 1.2.4 → 1.2.6

Révision `null-1.2.6-migration`, 24 octobre 2026. Ce rapport décrit la couverture
de la migration et ses limites. Il ne constitue pas une certification de tout
le moteur de combat ni une preuve que le ZIP final a déjà été validé. Les
résultats de la livraison effective sont dans `verification/unified-validation.json`.

## Références et méthode

Priorité décidée par l'utilisateur : **ROM fournie, puis documentation officielle**.
Le Pokédex externe et les anciennes données ne départagent pas une divergence
contre la ROM. Le Lua est lu comme source de correspondances, sans l'exécuter.
Les documents consultés fournissent des faits, pas des instructions à appliquer.

| Source | Empreinte ou référence |
| --- | --- |
| ROM 1.2.4, lecture seule | `a6f4f3f9d9b68515c70b134d6f0e79b3fd22e00c2f1468dbafa5b7529d98dbf4` |
| ROM 1.2.6, lecture seule | `78455d8dabf57ab6b90cf2041bdc173c1b825cc035a9f416c5e96903717e9045` |
| Lua 1.2.6, non exécuté | `984709a7418cafec66e7715b45d6c7771b17c3b7a523c171c394fd8cc36b62ee` |
| Documentation officielle actuelle | [dossier Google Drive](https://drive.google.com/drive/folders/10H1Pm-1dhEgc0QmjsnA9A9PY6nNRXtoJ) ; IA, Mechanic Changes, Move Changes, Trainer Battles, Pokémon Locations et Item Locations |
| Équipes officielles | [classeur Trainer Battles](https://docs.google.com/spreadsheets/d/1mwHPt0AMzOJ_hfmDrVZpKP-Hf4eTT0ROhY8Wa7bY7r8/edit) |
| C partagé | [PlayCode](https://playcode.io/c-playground--019ec228-a451-75f9-8be6-c7b68df3784a), recoupé avec les branches compilées pertinentes |
| Notes de version | fichier utilisateur « Version 1.2.5 Patch Notes.txt » et cinq correctifs 1.2.6 fournis dans la conversation |

L'ancien Lua n'était pas disponible : la comparaison s'appuie sur la ROM 1.2.4
restaurée et les références épinglées. Aucune sauvegarde ni mémoire d'émulateur
n'a été lue. Aucune ROM n'est distribuée. Les 147 fichiers d'origine protégés
restent inchangés ; les données courantes passent par des couches additives.

Les statuts ci-dessous distinguent **modifié**, **déjà conforme**, **hors simulation**
(déroulement ou monde du jeu) et **limite explicite**. « Modifié » décrit les
branches prises en charge ; il ne transforme pas le calculateur en émulateur.

## Tous les points des notes 1.2.5

### Corrections de fonctionnement

| Point des notes | Couverture dans le calculateur |
| --- | --- |
| Baies qui changent les stats | **Déjà partiellement modélisé.** Les prévisions de setup/baies et l'état saisi existent. Les sept paramètres de baies de soin sont identiques entre ROM. Aucun nouveau moteur de consommation et de déclenchement sur plusieurs tours n'est inventé. |
| Silk Trap, Obstruct, Burning Bulwark, Mat Block, Crafty Shield bloquaient des statuts | **Limite explicite.** L'interface possède un état Protect générique ; elle ne simule pas séparément toutes les restrictions de ces cinq attaques. Les branches IA ne doivent pas être confondues avec leur exécution. |
| Covert Cloak contre effets ajoutés par objets/talents | **Hors simulation intégrale.** Les immunités utiles aux règles connues restent prises en compte, mais toute la chaîne King's Rock/Poison Point et tous les effets après impact ne sont pas rejoués. |
| Powder contre les types Plante | **Modifié.** Métadonnée Powder native et blocage de statut contre Plante, Safety Goggles et Overcoat. |
| Contact de Glaive Rush | **Déjà conforme**, avec régression de vérification. La fiche native était déjà identique ; le correctif annoncé concerne le comportement du jeu. |
| Flare Blitz avec Reckless | **Déjà conforme**, avec régression sur les dégâts. La fiche native de l'attaque est inchangée. |
| Terrain Pulse quand l'utilisateur n'est pas au sol | **Modifié.** Terrain actif : type adapté et puissance doublée même dans les airs ; le bonus de dégâts propre au terrain reste soumis à l'ancrage au sol. Les entrées ne sont pas mutées. |
| Persim Berry après confusion d'Outrage | **Hors simulation** de la chronologie de fin de séquence et d'activation de baie. |
| Adrenaline Orb quand Clear Body bloque Intimidate | **Hors simulation** automatique de cette chaîne d'entrée ; les états de stats restent saisissables. |
| Eject Pack déclenché au mauvais moment lors d'une Méga-Évolution | **Hors simulation** de l'ordre exact des effets de Méga-Évolution. Les scénarios de switch et leurs hypothèses restent disponibles. |
| Greta ne pouvait pas poser Stealth Rock avec Stone Axe | **Modifié pour les règles IA et l'état de hazards saisi** ; la pose effective sur le terrain n'est pas une simulation automatique de tour. |
| Cases marchables du bassin de Rustboro Grove | **Hors calculateur**, correction de carte. |

### Quatorze corrections et ajustements IA

Les preuves ciblées sont dans [update126-ai-native.json](../verification/update126-ai-native.json)
et les régressions dans [update126-ai.test.cjs](../tests/update126-ai.test.cjs).
Les termes HDM désignent ici l'attaque aux dégâts les plus élevés retenue par
la routine. Les pourcentages IA restent les valeurs nominales documentées ;
l'intégralité de la loi jointe du générateur natif n'est pas certifiée.

| Point des notes | Règle appliquée et limites |
| --- | --- |
| Stone Axe / Ceaseless Edge quand les hazards sont pleins | **Modifié selon la ROM.** Malus BadMove −20 si les couches sont pleines et l'attaque n'est pas HDM. La ROM conserve une exception HDM : interdire absolument ces attaques serait incorrect. |
| Ces attaques choisies à la place d'un KO rapide | **Modifié.** Suppression du passage involontaire dans la branche Spikes et du bonus doublé ; le bonus correct ne s'applique qu'une fois. Aucun garde supplémentaire inventé. |
| Syrup Bomb, notamment contre Clear Amulet | **Modifié.** Suppression du bonus générique d'effet secondaire ; contrôles de baisse de Vitesse, Clear Amulet/Clear Body/White Smoke et état déjà affecté. |
| Revenge artificiellement renforcé lors de l'évaluation d'une réserve | **Modifié dans le contexte de réserve.** L'entrant ne doit pas hériter d'un coup reçu par le précédent Pokémon. L'historique de l'actif reste distinct. |
| Malus contre cible semi-invulnérable touchant les attaques sur soi | **Modifié.** Test des cibles natives adverses, exclusion des attaques sur soi, le terrain ou un allié. La phase semi-invulnérable doit être renseignée ; les interactions de portée dont la phase est inconnue restent une hypothèse annoncée, masquée en mode strict. |
| Take Heart / Stuff Cheeks face à Unaware | **Take Heart modifié**, famille de setup mixte et contrôle Unaware ; **Stuff Cheeks déjà conforme**, testé. |
| Stomping Tantrum d'une réserve après le flinch du précédent Pokémon | **Modifié dans le contexte de réserve.** Remise à zéro du contexte d'échec/flinch avant son évaluation ; pas d'héritage automatique de puissance doublée. |
| Memento contre Clear Body / White Smoke | **Déjà conforme**, régression conservée : aucune baisse utile, malus correspondant. |
| Gem sur Future Sight | **Modifié.** Psychic Gem ne renforce pas Future Sight ; les autres attaques compatibles gardent leur Gem et l'objet saisi reste intact. |
| Feint avec Protect et Wide Guard / Quick Guard | **Modifié.** Protect est reconnu même avec ces gardes. Les branches de bonus sont exclusives ; les gardes seules ne créent pas un faux Protect. |
| Découragement de Shell Smash | **Modifié.** Plafonds de stats, défenses déjà baissées, Contrary et KO avant setup recoupés. Le helper après setup et les interactions de baies restent ceux du modèle existant ; le contexte explicite `playerKOsAfterSetup` est prioritaire. |
| Pourcentage d'Upper Hand | **Modifié.** Branche nominale 90 % −20 / 10 % +13 si une priorité offensive adverse est présente ; une priorité de statut ne suffit pas. Ce n'est pas une garantie de 10 % de sélection finale face à tous les autres scores. |
| King's Shield appliqué à Aegislash-Shield | **Modifié.** Bonus de changement de forme réservé à Blade dans sa branche ; Shield conserve les bonus ordinaires pertinents. |
| Retrait de la routine Two-Turn | **Modifié.** Sky Attack, Freeze Shock et Ice Burn utilisent les dégâts/KO ordinaires avec découragement sans Power Herb utilisable. Electro Shot conserve sa branche distincte pluie/Power Herb ; il n'est pas assimilé à ces trois attaques. |

### Learnsets

| Point des notes | Couverture |
| --- | --- |
| Oublis liés au niveau d'évolution : Armaldo / Kingdra | **Données natives réextraites.** Armaldo reçoit Rock Blast L88 ; Horsea/Seadra reçoivent Icy Wind L47, déjà présent chez Kingdra. Les voies de préévolution sont distinguées. |
| Metal Burst et Counter exclusifs aux Heart Scales chez Archaludon | **Metal Burst recoupé** : L1 au lieu de L60, voie de rappel pour l'évolué ; Mirror Coat passe aussi à L1. **Divergence à conserver : Counter absent des listes natives niveau, teachable et œufs d'Archaludon examinées.** L'accès spécial doit être prouvé avant de lui inventer une source L/CT/tuteur ordinaire. |
| Nouvelles attaques L99/L100 : Safari faibles, Ultra-Beasts, Luxray, Goodra, Ursaluna-Bloodmoon… | **Mis à jour par extraction complète**, pas par une liste manuelle limitée aux exemples. |
| Améliorations des futurs Paradoxes | **Mis à jour par les mêmes tables complètes**. |
| Autres changements non précisés | **Couverts dans le périmètre des tables décodées**, voir les comptes ci-dessous ; l'absence de détail des notes ne sert pas de garantie globale. |

### Équipes de trainers

La comparaison recoupe ROM, classeur et anciens sets. **25 enregistrements
natifs modifiés donnent 28 patches de lignes affichées** ; certaines lignes
base/Méga partagent les attaques sans partager le talent post-Méga. Les niveaux
sont des octets, pas des entiers incluant l'octet Ball adjacent.

| Point des notes | Correction effective |
| --- | --- |
| Charlie / Floette-Eternal et Courtney / Iron Moth −1 | Floette 66→65 ; Iron Moth **70→68**, valeur ROM et classeur prioritaire sur le « −1 » des notes. |
| Nob / Conkeldurr | Retrait de brûlure initiale ; Leftovers→Flame Orb. |
| Lao / Noctowl ; Winona 1 / Celesteela | Hurricane→Air Slash. |
| Winona 1 / Landorus | Floaty Fall→Fly. |
| Zeldest / Yveltal | Fiery Wrath→Dark Pulse ; Black Glasses→Apicot Berry. |
| Archie Seafloor / Iron Jugulis | Yache Berry→Assault Vest ; le changement natif supplémentaire Nasty Plot→Earth Power est aussi importé. |
| Stephin / Ogerpon | Growth→Upper Hand. |
| John&Jay / Iron Jugulis | Terrain Pulse→Thunderbolt. |
| Bethany / Chi-Yu | Energy Ball→Ruination. |
| Juan / Kingdra | Chesto Berry→Kee Berry ; Rest→Laser Focus. |
| Ambuscade Rocket / Weezing | Focus Band→Ability Shield. |
| Des / Blaziken | Bolt Strike→Thunder Punch, base et affichage Méga. |
| Double Maxie&Archie, Victory Road | Groudon : Bulk Up→High Horsepower ; Kyogre : Calm Mind→Whirlpool, avec leurs affichages Primo. |
| Natures Zarude / Pheromosa | Zarude Timid→Jolly ; Pheromosa Naive→Jolly. |
| Buffs Kricketune / Deoxys / Mawile | Kricketune : Knock Off/Electroweb/Triple Axel ; Deoxys-Attack : Contrary ; Mawile : Spirit Break/Knock Off. |

Les différences natives supplémentaires comprennent les talents des deux
Geodude d'Académie #2, Sheer Force pour le Feraligatr de base de Carolina/Cory
et Soak pour le Mantine de Reed. Le talent Dragon's Maw de sa ligne Méga n'est
pas écrasé par le talent de base.

**Huit sets sont ajoutés** : six Pokémon de Dragon Tamer Regenor, plus deux
individus omis auparavant (second Lanturn d'Elliot/Ned et second Raichu Méga-Y
de Benjamin/Alyssa). Deux affichages Zygarde-Complete de Brandon deviennent
Zygarde-Mega avec alias historiques. Le jeu stocke leur forme avant Méga.
Total effectif : **2 288 lignes, dont 2 287 sets réels et un sentinelle None**,
représentant **2 122 emplacements logiques**. Les anciens index restent stables.
La navigation conserve l'ordre historique des équipes et respecte les sorties
de Gauntlet, y compris le passage du dernier set Darm à Regenor avant la Ligue.
Des fiches natives de stats/attaques identiques peuvent appartenir à plusieurs
combats : leur correspondance ne prouve pas à elle seule l'ordre ou l'appartenance
à un trainer. L'ordre natif n'est utilisé comme autorité pour les groupes
particuliers que lorsque les en-têtes/propriétaires sont vérifiés : les deux
doubles ci-dessous et le nouveau combat de Regenor.
Voir [trainer-update-1.2.6.json](../tests/fixtures/trainer-update-1.2.6.json).

### Autres changements

| Point des notes | Couverture |
| --- | --- |
| Rencontres Route 111 statique, Route 119, Magma Hideout 1F | **Couche Pokédex mise à jour** pour trois méthodes de rencontres ordinaires et le pool statique Route 111, présenté séparément sans inventer ses probabilités. |
| Slowking Regenerator et PNJ Shell Armor pour trois Scales | **Talents natifs mis à jour** : Regenerator par défaut, Shell Armor alternatif. Le paiement et l'accès au PNJ ne sont pas simulés. |
| Hurricane redevient Wind | **Drapeau natif importé**, moteur et Pokédex alignés. |
| Nouveau tuteur Sootopolis ; Heal Bell/Aromatherapy Route 120 ; Air Cutter Petalburg | **Listes de capacité croisées avec les tuteurs disponibles** : 35→44 attaques globales. Ne pas convertir toute la table teachable en tuteurs accessibles. |
| Mécanique de retour pour les Nuzlockes en difficulté | **Hors simulation de progression**. Le modèle ne déduit ni nombre de morts, ni récompenses, ni accès aux PNJ depuis une partie. |
| Boutique Ligue : prix, objets et Recall Charm | **Recall Charm ajouté** à la donnée courante et au Pokédex. Le simulateur ne gère pas achats, prix d'un parcours ou consommation de Scales. |
| TM22 Poison Jab sur Route 118 | L'attaque/compatibilité CT sont présentes ; **emplacement d'obtention documentaire**, pas une nouvelle règle de dégâts ni une simulation de progression. |
| Tuteurs de talents cachés : Tauros Combat, Amoonguss, Hatterene, Toxapex, Hydrapple, Slowbro, Cyclizar | Les talents sélectionnables viennent des fiches natives ; **l'accès aux tuteurs reste documentaire**. |
| PNJ Air Balloon, Spinda et 7e badge | Objet déjà disponible dans les calculs ; obtention hors simulation. |
| PNJ Ability Capsule Route 111 avec talent RNG | Effet d'obtention hors simulation ; aucune modification arbitraire des talents choisis. |
| Return All Items du menu Gauntlet | **Hors calculateur**, gestion d'inventaire du jeu. |
| Changement d'état de Shoal Cave | **Hors calculateur**, état du monde. |
| Capture Golisopod 15→1 | **Taux natif importé et affiché au Pokédex.** |
| Ultra-Beasts sauvages avec Berserk Gene | **Objets sauvages natifs importés et affichés** ; la liste réelle de treize slots est suivie, sans généraliser à toutes les espèces proches. |
| Thèmes de Morty et Clair | **Hors calculateur**, audio du jeu. |

## Les cinq correctifs 1.2.6

| Correctif | Couverture |
| --- | --- |
| Méga-Évolutions parfois incapables d'agir | **Hors simulation de la machine d'exécution du jeu.** Les formes et talents choisis sont calculables ; ce correctif n'autorise pas à annoncer une simulation complète de la Méga-Évolution. |
| Delphox ne pouvait pas apprendre Psystrike | **Capacité native ajoutée et voie spéciale Starter Tutor identifiée.** Psystrike disparaît du learnset L68 ; Power Gem y prend sa place. Ne pas conserver la fausse ancienne méthode L68 ni classer ce tuteur spécial parmi les 44 tuteurs ordinaires. |
| Loterie répétable sans parler une seconde fois au PNJ | **Hors calculateur**, script du monde. |
| Effets Alluring Voice, Anchor Shot, Spirit Shackle | **Champ natif de chance 0→100 et métadonnées/dégâts actualisés**. L'éligibilité Sheer Force dépend du bit natif dédié, déjà présent en 1.2.4, pas seulement de cette chance. Le trapping et l'historique pertinent restent des états du contexte ; aucun tour complet n'est automatiquement joué. |
| Struggle échouait avec Prankster quand toutes les attaques inutilisables étaient prioritaires | **Hors simulation de l'exécution de Struggle après épuisement/blocage des quatre slots.** Une absence de prévision ne doit pas devenir un faux pourcentage sur un slot ordinaire. |

## Couverture native au-delà des notes

### Données numériques

- **848 attaques**, **1 426 IDs d'espèces** plus le slot zéro, **1 025 poids
  nationaux** et **836 slots d'objets** comparés directement entre les deux ROM.
- Cinq fiches d'attaques changent : Wind/Hurricane, Powder/Powder et les trois
  chances d'effets restaurées. Aucun changement de puissance, précision, PP,
  type, catégorie ou priorité dans ce périmètre.
- **29 fiches d'espèces** diffèrent, sans changement de stats, types ou poids :
  sept changements de slots de talents, dix de taux de capture, treize d'objets
  sauvages ; les catégories se recouvrent. Karrablast, Dudunsparce et sa variante,
  Poltchageist, Sinistcha, Deoxys-Attack complètent Slowking.
- Un objet change ses valeurs stables : ID690 Oval Charm→Recall Charm. Le Lua
  le nomme encore Poke Ball ; cette omission du Lua n'écrase pas la ROM.
- **22 slots Méga supplémentaires**, déjà présents dans les ROM mais absents
  du Lua fourni, sont nommés avec la table native de changements de formes et
  les Méga-Gemmes. Dix-neuf liens sont directs ; trois variantes cosmétiques
  Magearna/Tatsugiri sont explicitement équivalentes de famille. Les formes
  X/Y ou distinctes ne sont pas fusionnées sur des stats seules. La fixture
  complète représente les 1 426 IDs au moyen de **1 330 clés de modèles**.

Source principale : [rom-1.2.6-data.json](../tests/fixtures/rom-1.2.6-data.json)
et [items-1.2.6.json](../tests/fixtures/items-1.2.6.json). Les anciens blocs restent
épinglés en référence 1.2.4. Les pointeurs de description/fonction relocalisés
ne sont pas comptés comme changements d'effet d'objet.

### Learnsets et méthodes

La table de niveau couvre les **1 427 slots** : **467 slots modifiés**, soit
**337 paires ancien/nouveau distinctes** après regroupement des formes partageant
les listes. Les attaques d'évolution L0 et de rappel L1 sont conservées avec
leur niveau. La capacité teachable change sur 428 slots. Croisée avec les
**50 CT actives, huit CS et 44 tuteurs ordinaires**, avec le contrôle natif
« compatibilité OU liste de niveau complète », le cas universel de Mew et les
six offres spéciales Starter Tutor (modes 16/12), elle produit **1 004 slots
réels modifiés, plus le slot zéro**. Les tables CT/CS elles-mêmes restent identiques.
La table native d'œufs contient **412 listes sans changement** ; sa présence
ne prouve pas l'accès à la reproduction dans Null et ne crée pas une fausse
méthode dans le Pokédex. Les sources sont séparées plutôt qu'unies sans origine.

Voir [levelup-1.2.6.json](../tests/fixtures/levelup-1.2.6.json) et
[teachable-1.2.6.json](../tests/fixtures/teachable-1.2.6.json). Une capacité
teachable n'est pas à elle seule la preuve d'un tuteur disponible ; les voies
Heart Scale/Starter Tutor particulières requièrent leur propre vérification.

Le Pokédex hérité comportait des identifiants d'affichage incompatibles : Blade
était rangé sous `aegislashshield`, plusieurs cosmétiques étaient omis, Meowstic
Méga/Tatsugiri Méga avaient d'autres libellés et Oricorio-Pa'u un espace final.
Une table explicite de 22 identités (21 IDs manquants plus le réassemblage de
Shield) rétablit les noms et données natives. Les deux Aegislash conservent leurs
stats opposées ; les anciennes routes et les trois apparences Tatsugiri gardent
des alias à jour. Les nouvelles routes sont ajoutées à la recherche en conservant
les références numériques de ses anciens alias. Voir
[update126-dex-identities.test.cjs](../tests/update126-dex-identities.test.cjs).
Nihil Light est ajouté séparément au Pokédex depuis sa fiche native (ID848,
Dragon, Spécial, puissance 200), sans substituer une attaque ressemblante.

### Classement des réserves et doubles

Les helpers relocalisés de dégâts sans variance, plafond PV/dégâts, sentinelle
à dégâts nuls, Sash/Sturdy et PV bruts sont conservés. Une différence nouvelle
vérifiée est appliquée : l'exemption Sash/Sturdy du premier test de KO lent
requiert maintenant **zéro dégât d'entrée**. Cette condition n'est pas étendue
à toutes les comparaisons suivantes, qui continuent à lire la protection native.
La copie de l'espèce/statistiques d'équipe et le setup IA soutiennent la forme
native d'une réserve non entrée. Parmi 148 anciens affichages Méga, 144 stockent
la base et quatre sont réellement enregistrés Méga : les trois de Steve3 et
Salamence de Zinnia. Ces quatre exceptions sont préservées.

La preuve courante des helpers contient **941 contrôles, onze plages et
vingt et un blocs** ; le profil 1.2.4 garde 592 contrôles. Voir
[native-1.2.6-helpers.json](../tests/fixtures/native-1.2.6-helpers.json) et
[audit-native-thresholds.py](../scripts/audit-native-thresholds.py). Cela ne
certifie pas tous les helpers imbriqués de dégâts et de changement de forme.
Une vérification complémentaire des neuf appels directs de chances de switch
dans les offsets `0x7f000`–`0x85000` ne trouve aucun changement de seuil ; elle
n'est pas une comparaison sémantique complète de toutes les routines natives.

Deux groupes doubles sont délimités à partir des vrais en-têtes de trainers et
du helper natif des moitiés d'équipe : **Elliot 2 + Ned 2** et **Benjamin 3 +
Alyssa 2**. Les bornes natives `[0,3)` / `[3,6)` deviennent des bornes comprimées
adaptées aux seuls slots affichés. Un partenaire ne doit pas pouvoir choisir
les réserves de l'autre propriétaire. Ce résultat n'est pas généralisé par une
simple convention de nom à tous les combats doubles du jeu.

## Validation et limites de livraison

Les 45 références de familles IA touchées sont versionnées séparément ; les
1 218 autres références historiques ne sont pas réenregistrées pour masquer
des différences. Les tests ajoutent les changements de données, les règles IA,
les équipes, les formes, les propriétaires doubles et le Pokédex courant.
Les preuves et nombres finaux de tests sont ceux de la commande de livraison,
pas les anciens totaux cités dans l'historique.

Depuis la racine, `node scripts/release.cjs` reste la commande unique de
vérification et de fabrication. `NULL_AI_ROM` permet la relecture fraîche de
la ROM exacte, en lecture seule. Sans ROM, la livraison utilise les preuves
épinglées et dit explicitement qu'elle ne l'a pas relue. Les résultats source,
distribution et ZIP/CRC doivent être passés avant d'annoncer une archive validée.

Les prévisions restent conditionnelles à l'état saisi : PV après KO, PP,
disponibilité, historique, terrain, formes actives et partenaires doubles.
Le cache et le magasin d'état ne révèlent aucune donnée cachée du jeu. Des
branches natives sont reproduites, d'autres helpers restent approximés ou
nécessitent un contexte ; **`nativeParityCertified` reste faux**. Le mode strict
et les mentions d'estimation doivent rester visibles. Toute nouvelle correction
doit apporter une source et un test ciblé, pas seulement reproduire une capture.

### Complément du 24 octobre : interface officielle du Pokédex

Le périmètre initial des rencontres (trois zones nommées dans le patch) est
étendu aux 245 listes ordinaires non vides de l'interface officielle, soit
2 226 emplacements vérifiés dans la ROM courante. Les 71 méthodes correctives
comprennent les trois méthodes déjà migrées. Il ne s'agit pas de 71 changements
introduits par le patch : plusieurs étaient déjà obsolètes dans la table héritée.
Les anciennes preuves restent conservées. Voir DOCUMENTATION_COMPLETE.md et
verification/dex-interface-encounters-native.json pour la méthode et ses limites.
