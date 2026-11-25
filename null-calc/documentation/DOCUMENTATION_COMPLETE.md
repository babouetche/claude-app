# Référence courante — calculateur Null 1.2.6

Révision null-1.2.6-public-release, 2 novembre 2026.
Lire [GUIDE_AGENTS.md](GUIDE_AGENTS.md) pour les commandes,
[MISE_A_JOUR_1.2.6.md](MISE_A_JOUR_1.2.6.md) pour l’audit point par point
et [HISTORIQUE.md](HISTORIQUE.md) pour les rapports précédents.

## Références et périmètre

La ROM fournie prime, puis la documentation officielle. L’ancien code C partagé
et l’ancien Pokédex servent de références historiques. SHA256 de la ROM courante :
78455d8dabf57ab6b90cf2041bdc173c1b825cc035a9f416c5e96903717e9045.
Aucune ROM, sauvegarde ou installation d’émulateur n’est distribuée.

Calculateur local en simples et doubles : dégâts, choix d’attaques, switch et
remplaçant après KO. Il ne rejoue pas tous les événements d’un tour. Historiques,
PP, PV, partenaires, effets temporaires et marques KO restent à renseigner.
Indéterminé signifie qu’une donnée ou règle manque ; ce n’est pas zéro.

Les 147 fichiers de tests/fixtures/input-archive.json restent identiques, dont
les 2 280 lignes brutes de sets. La couche 1.2.6 corrige 28 lignes, remplace
deux identités de forme et ajoute huit lignes : 2 288 lignes en mémoire.
Les anciens indices restent stables pour les sauvegardes et imports.

## Carte du code

| Chemin | Responsabilité |
| --- | --- |
| CALCULATEUR.html | Entrée locale générée ; garder docs à côté. |
| docs/index.html et index.template.html | Ordre des modules source. |
| docs/calc et docs/js/data | Moteur et tables hérités, fichiers protégés à vérifier avant modification. |
| verified-data.js / verified-data-adapter.js | Tables ROM et adaptations de dégâts sans modifier le moteur protégé. |
| metadata.js | Métadonnées générées : cibles, effets et bits natifs. |
| version126-trainers.js | Correctifs de sets, emplacements natifs, ordre et propriétaires doubles vérifiés. |
| version126-ui.js | Navigation et intégration du nouveau combat doubles. |
| rules_setup/status/field/survival/damage.js | Familles de règles IA ; ordre et tirages font partie du comportement. |
| core.js | Assemblage et résolution probabiliste des scores. |
| battle_store.js | État partagé, références mémorisées et cache LRU. |
| state.js | Lecture du calculateur, profils et réserves. |
| native_helpers.js | Dégâts sans variance, comptes de coups et protection à PV pleins retrouvés dans la ROM. |
| switch.js / post_ko.js / faint_context.js | Réserves, KO simulé, Retaliate, Last Respects et Supreme Overlord. |
| doubles.js / doubles_ui.js | Quatre actifs, partenaires et cibles. |
| ui.js / post_ko_ui.js / i18n.js | Contrôles, couleurs, marques KO et langue EN/FR. |
| docs/js/trick_room.js | Ordre à priorité égale, flèches et bordures. |
| docs/js/custom_set_import.js | Individus multiples et nettoyage complet des customs. |
| docs/porydex/data/null-1.2.6.js | Données ROM additionnelles du Pokédex intégré. |
| docs/porydex/js/version126-*.js | Application des données et informations courantes dans le Pokédex. |
| tests/fixtures et verification | Références épinglées et preuves ; ne pas les régénérer pour masquer un échec. |
| scripts/release.cjs | Construction, vérification et fabrication du ZIP par une commande. |

Les générateurs sont build-verified-data.cjs, build-ai-metadata.cjs,
build-version126-trainers.cjs et build-version126-dex.cjs. Modifier leur source
ou les fixtures justifiées, puis régénérer. La livraison regroupe les modules
selon l’ordre HTML et conserve les sources lisibles. Le Pokédex charge réellement
docs/js/data/nulldex ; les tables homonymes de docs/porydex/data sont héritées.

## État du combat et cache

Séparer Pokémon affiché, référence mémorisée « Switch into », partenaires et
réserves. Un changement incompatible invalide la référence par la même voie
en simples et doubles. Modifier PV, PP, disponibilité ou KO d’une réserve dans
« Switch into » reconstruit son profil contre le joueur et terrain mémorisés :
Water Spout, Eruption, Flail, Reversal et Sash/Sturdy doivent être recalculés.
Le callback rebuildFrozenParty capture des clones privés des modèles, pas
l’état mutable retourné. Il ne doit pas reprendre le nouvel entrant affiché.

Le cache partagé garde au plus 32 entrées. Sa clé inclut modèles, terrain,
attaques, PP, contexte, réserves, références, partenaires, marques KO, données
du trainer, hooks du moteur et identité ROM. Préserver Infinity et les propriétés
attachées aux tableaux : une copie JSON n’est pas fidèle. Les compteurs publics
calls/hits/misses/engineCalls/computeMs/keyMs/cloneMs permettent de mesurer les
recalculs. Un benchmark CPU ne garantit pas la fluidité de l’interface.

## Identités, formes et propriétaires

Un emplacement natif possède un identifiant stable et plusieurs alias.
Les deux Lanturn d’Elliot/Ned et les deux Raichu de Benjamin/Alyssa restent des
individus séparés. Les formes d’un même emplacement partagent PV, PP et KO.
Deux individus distincts ne partagent jamais ces informations.

partyOrder conserve l’ordre historique des alias ; order reste l’adresse de
preuve ROM et ne sert pas au tri de l’interface. Les deux propriétaires doubles
et Regenor utilisent leurs séquences natives vérifiées. Les 37 groupes de profils
ambigus ont été résolus par séquence cohérente (29 ancres corrigées). L’ensemble
effectif contient 2 122 emplacements. Les variantes régionales de Rattata et
Grimer ne sont pas fusionnées dans les banques Academy.

La réserve utilise l’espèce et le talent de l’équipe native avant transformation
d’entrée : Minior Noyau, Castform normal et Méga sous leur forme de base.
Quatre Pokémon déjà Méga dans les données natives conservent cette forme.
L’actif et le partenaire gardent leur forme explicitement choisie.

Deux groupes doubles ont des propriétaires vérifiés : Elliot/Ned et
Benjamin/Alyssa. Bornes du roster compacté, fin exclue : [0,2)/[2,4) et
[0,3)/[3,5). Le jeu réserve physiquement [0,3)/[3,6).
Ne pas généraliser par simple lecture d’un nom contenant « & » : d’autres
combats ont une équipe commune ou des correspondances ambiguës.

Les preuves de trainers sont ancrées sur les IV. La structure native complète
fait 40 octets et commence huit octets avant cet offset. Payload épinglé :
32 octets, IV +0, attaques +4, espèce +12, objet +14, talent +16,
niveau sur UN octet +18, statut +24. Lire le niveau en u16 inclurait la Ball.

## Classement et règles

Le score natif des réserves utilise les dégâts sans variance, soit le maximum
de la plage correspondante. Ne pas substituer la moyenne. Compte de coups :
ceil(PV/dégâts), zéro dégât donnant l’infini. Le wrapper Sash/Sturdy à PV pleins
remplace un coup par deux. Ces comptes utilisent les PV avant hazards ; le
test précoce de KO d’un entrant lent utilise les PV après hazards.
En 1.2.6, son exemption Sash/Sturdy exige aussi zéro dégât d’entrée.

Les helpers courants sont épinglés dans native-1.2.6-helpers.json :
coups 0x0816c858, wrapper 0x0816c874, protection 0x081720fc.
Les adresses 1.2.4 des anciens rapports sont historiques.
Les cas Héliolisk/Comfey, Castform/Seadra, Farfetch’d, Watchog et Minior restent
des régressions ; ils ne suffisent pas à démontrer une parité globale.

Les règles 1.2.6 modifient notamment les attaques à deux tours, Upper Hand,
Feint, Shell Smash, King's Shield, Syrup Bomb, Stone Axe et Ceaseless Edge.
La référence courante révise 45 des 1 263 anciens cas ; 1 218 restent identiques.
Les exceptions natives aux formulations abrégées des notes sont dans l’audit.

Les dégâts comprennent Terrain Pulse en l’air, Future Sight sans Gemme,
Hurricane vent, Glaive Rush contact, Powder et les bits Sheer Force natifs.
engineAbility normalise les orthographes du Lua vers les noms du moteur avant
de construire les réserves, notamment Dragon's Maw, Good as Gold et Well-Baked
Body. Sans cela, un talent peut être affiché mais ne pas agir dans les dégâts.
Cela ne signifie pas que tous les événements, activations ou animations
corrigés par le jeu sont intégralement rejoués par le calculateur.

## Historiques et interface

Retaliate est renforcée pour la réserve après le KO simulé ; sa puissance sur
l’actif reste à saisir selon le tour. Last Resort dépend des attaques tentées
depuis l’entrée, même un Sucker Punch échoué. Rage Fist et les échecs précédents
demandent leur historique propre.

Trick Room inverse l’ordre à priorité égale, pas les valeurs de Vitesse, les
priorités ou Gyro Ball/Electro Ball. Aucun compteur de tours automatique.
Les speed ties du tour sont aléatoires ; ne pas en déduire une autre règle
de comparaison pour le score natif des réserves.

Volet IA en anglais par défaut, français dans la roue des paramètres.
Le lien Pokédex de l'en-tête conserve l'affichage intégré au clic gauche.
Le clic molette et Ctrl/Cmd+clic utilisent la navigation native du navigateur
pour ouvrir le Pokédex autonome dans un nouvel onglet. Garder un vrai href ;
intercepter uniquement le clic principal sans touche modificatrice.
Bleu : résultat établi dans le contexte ; doré/orange : estimation/incertitude.
Après KO : vert meilleur entrant du modèle, bleu autre entrant possible,
croix rouge exclu par KO. ≈ signifie estimation, même sur une ligne verte.
Les légendes intégrées aux deux panneaux restent la référence utilisateur.

## Pokédex : interface officielle et tables de rencontres

La présentation reprend les sources de https://nulldex.pokemon0null.workers.dev/
consultées le 24 octobre 2026 : en-tête Trainer Sheet / Pokédex / Calculator /
Download, thèmes Light/Dark, panneaux indépendants, onglets et filtres. Le retour
contextuel reprend la zone d'origine, y compris après Pokémon → talent. L'ancienne
intégration supprimait l'en-tête et remplaçait des navigations push par replace,
ce qui perdait une partie du contexte. Elle omettait aussi nulldex-encounters.js :
le renderer, l'ordre des zones, les filtres et les taux de pêche divergeaient.

La couche visuelle officielle ne remplace aucune table de combat par des données
en ligne : ROM 1.2.6, puis documentation, restent prioritaires. Les 245 méthodes
ordinaires non vides du site (2 226 emplacements) ont été recoupées avec les octets
de la ROM : espèce/forme cosmétique, niveaux min/max, taux, pointeur de table et
en-tête natif de carte. Cela corrige 71 méthodes de la table héritée, dont six
auparavant vides. Rustboro Grove retrouve Purrloin/Luxio/Pichu et les listes Surf
et Super Rod. Les profils identiques peuvent désigner plusieurs cartes : les
libellés viennent de l'extraction officielle ; on ne prétend pas que leur nom est
encodé dans ces en-têtes. Underwater Route 124 reste un emplacement officiel vide.
Cet audit ne couvre pas tous les dons ou événements scriptés du jeu.

Les données héritées ne sont pas modifiées. Le builder lit la fixture
`tests/fixtures/encounters-1.2.6.json`, inclut ses correctifs dans
`docs/porydex/data/null-1.2.6.js`, puis `version126-data.js` les applique en mémoire.
Les preuves natives sont dans `verification/dex-interface-encounters-native.json` ;
les empreintes des sources visuelles sont dans `verification/dex-interface-source.json`.
Le module officiel nulldex-encounters.js doit être chargé avant version126-panels.js,
qui conserve les détails natifs, tuteurs spéciaux et le pool statique Route 111.

`local-navigation.js` adapte les liens à index.html#route, sans changer le modèle
de panneaux officiel. Les liens restent utilisables au clic molette/Ctrl+clic,
y compris à l'intérieur du Pokédex. Dans le volet intégré, Calculator retourne
au combat sans le réinitialiser. Le retour passe par postMessage (source contrôlée
par le parent), car file:// peut isoler l'origine de l'iframe. La reconstruction
visuelle de Select2 rétablit ses valeurs sans émettre un changement de set, pour
éviter de remettre les PV ou les boosts à zéro. Le Pokédex possède son propre thème mémorisé.
Les sprites principaux, icônes et données sont locaux. Les animations historiques
et cris de l'onglet Flavor utilisent le fournisseur du site officiel et nécessitent
Internet ; ils ne participent à aucun calcul. Les liens Trainer Sheet et Download
conservent leurs destinations officielles.

Le parcours `scripts/check-dex-interface-browser.cjs` vérifie la navigation
contextuelle, les taux de pêche numériques, les panneaux, le thème persistant,
les écrans étroits, le clic molette et le retour au combat. Avec NULL_AI_ROM, il
relit les preuves des 245 méthodes. Deux tests supplémentaires contrôlent Rustboro
et tous les profils natifs. Ne pas réécrire les preuves pour contourner un écart.

## Livraison et limites

Commande unique : node scripts/release.cjs.
Elle régénère les données/HTML, teste la source, fabrique une distribution
fraîche, reteste celle-ci, compare les comportements, vérifie les fichiers
protégés puis les empreintes et le CRC du ZIP. Aucun test ignoré n’est accepté.
verification/unified-validation.json donne le compte réel et les preuves de
la livraison courante. Un ancien rapport vert ne certifie pas une nouvelle
version. NULL_AI_ROM revérifie la ROM en lecture seule.
Toute modification pendant cette procédure impose une nouvelle exécution.

Nettoyage du 2 novembre 2026 : scripts/archive-policy.json conserve les preuves
natives et sources documentaires courantes, les sources modifiables et leurs tests.
Les anciens rapports, captures, anciens manifests et douze outils remplacés sont
exclus lors de la copie. Les anciennes tentatives de release-proof ne sont pas
recopiées : seules les preuves du lancement courant sont ajoutées après les tests.
Le contrôle final compare la liste des preuves au rapport de cette livraison et
bloque le ZIP si un ancien fichier réapparaît. La preuve native générale est gardée
une seule fois. L'historique fonctionnel reste consolidé dans HISTORIQUE.md ;
les références à ses anciennes captures et fichiers sont des repères historiques,
pas une promesse que ces fichiers bruts sont encore distribués.

Les anciennes tables protégées et les sources lisibles ne sont pas des déchets :
elles permettent de vérifier les données d'origine et de reconstruire les bundles.
La politique de nettoyage n'altère aucun calcul, trainer, set ou ressource utilisée
par l'application. Les deux tests de packaging vérifient la conservation des
sources et preuves nécessaires, ainsi que le rejet des anciennes preuves et outils.

L’audit précise le périmètre des listes d’apprentissage, tuteurs et rencontres.
Les modèles standard sans équivalent natif gardent des données héritées :
voir rom-data-comparison.json. Les poids de formes hors slots nationaux vérifiés
ne sont pas réinventés. Quêtes, musique, loterie et déplacements du monde sont
documentés lorsqu’ils ne concernent pas les calculs. La parité complète avec
toute la ROM et son RNG n’est pas certifiée : nativeParityCertified reste faux.

