# Audit binaire Null 1.2.4 → 1.2.6

Lecture seule des deux ROM fournies. Aucune sauvegarde, aucun état d'émulateur
et aucune copie de ROM dans les sorties. Le Lua 1.2.6 est lu comme table de noms,
sans être exécuté. L'ancien Lua n'est plus présent ; la table numérique épinglée
1.2.4 et la ROM 1.2.4 restaurée constituent les références de comparaison.

| Référence | SHA-256 |
| --- | --- |
| ROM 1.2.4 | `a6f4f3f9d9b68515c70b134d6f0e79b3fd22e00c2f1468dbafa5b7529d98dbf4` |
| ROM 1.2.6 | `78455d8dabf57ab6b90cf2041bdc173c1b825cc035a9f416c5e96903717e9045` |
| Lua 1.2.6 | `984709a7418cafec66e7715b45d6c7771b17c3b7a523c171c394fd8cc36b62ee` |

## Tables relocalisées et différences complètes dans ce périmètre

Offsets ROM, sans le préfixe mémoire `0x08000000` :

| Table | 1.2.4 | 1.2.6 | Taille d'entrée |
| --- | --- | --- | --- |
| Attaques | `0x3d70ac` | `0x3db854` | 24 octets |
| Espèces | `0x3e0448` | `0x3e4bf0` | 36 octets |
| Noms de talents | `0x3d287b` | `0x3d7023` | 17 octets |
| Objets | `0x8858a4` | `0x88ad44` | 44 octets |
| Champ poids du Pokédex national | `0x854a90` | `0x859f40` | pas de 36 octets |

Les ancres sont indépendantes : plusieurs attaques inchangées, Bulbasaur et
Pikachu, noms de talents, les sept baies de soin et cinq poids connus. Le Lua
confirme directement la nouvelle adresse de la table d'espèces.

Comparaison directe des 848 attaques, 1 426 emplacements d'espèces, 1 025 poids
nationaux et 836 emplacements d'objets :

- **5 attaques changent** : Hurricane acquiert le bit Wind (`byte17 & 2`),
  Powder acquiert le bit Powder (`byte16 & 128`), Spirit Shackle, Anchor Shot
  et Alluring Voice passent de 0 à 100 dans le champ de chance de l'effet.
  Aucun changement de puissance, type, précision, PP, priorité ou catégorie.
- **29 fiches d'espèces changent**, sans changement de stats, types ou poids.
  Sept emplacements changent de talents : Slowking, Karrablast, Dudunsparce
  et Three-Segment, Poltchageist, Sinistcha, Deoxys-Attack. Dix changent de taux
  de capture. Treize reçoivent l'objet sauvage 798, Berserk Gene ; Necrozma
  appartient à deux de ces catégories.
- Slowking : Regenerator / Regenerator / Shell Armor. Karrablast :
  No Guard / No Guard / Swarm. Dudunsparce : Rattled ajouté au second slot
  ordinaire. Poltchageist et Sinistcha : Heatproof ajouté au second slot.
  Deoxys-Attack : Scrappy remplacé par Contrary.
- **1 objet change dans ses valeurs stables** : ID690, Oval Charm → Recall
  Charm, prix 20 000 et champs d'utilisation ajustés. Le Lua fourni appelle
  toujours cet ID « Poke Ball » : omission de libellé dans le Lua, pas preuve
  que le nouvel objet est une Poké Ball.
- Les sept paramètres des baies de soin sont inchangés. Les corrections des
  baies de stats sont dans les routines, pas dans ces paramètres numériques.

La comparaison des objets exclut les pointeurs de description et de fonction
d'utilisation : leur déplacement par l'éditeur de liens n'est pas une différence
de règle. Les enregistrements complets sont conservés pour analyse. Les textes
et les implémentations des fonctions peuvent avoir changé malgré des paramètres
identiques. Les learnsets et les équipes sont audités séparément.

La table Lua s'arrête à 1 404, mais la table native contient 1 426 espèces (plus
le slot zéro). Les 22 dernières formes Méga existent déjà dans les deux ROM et
étaient absentes du calculateur. Leur identité n'est pas devinée depuis leurs
stats : la table native de changement de forme `0x449794` lie 19 entrées aux
espèces d'origine et aux Méga-Gemmes. Trois variantes cosmétiques de Magearna et
Tatsugiri sont explicitement marquées comme équivalentes de leur famille. Le
fichier `additional-species-names.json` conserve cette distinction. La fixture
numérique finale représente 1 426 IDs au moyen de 1 330 clés ; les slots
équivalents sont listés et ne sont pas présentés comme des espèces différentes.

## Sheer Force : ne pas déduire l'éligibilité de la chance d'effet

Le helper natif `0x0805a33c` compare le talent à 125 (Sheer Force), puis lit le
bit `0x02` de l'octet16 de la fiche d'attaque (`0x0805a358`–`0x0805a35e`). Il
ne lit pas le champ de chance. Spirit Shackle et Anchor Shot ont l'octet16 égal
à 2 ; Alluring Voice à 18 : les trois sont éligibles. Ce bit existait déjà en
1.2.4. Thunderbolt/Crunch servent d'ancres positives, Aqua Cutter/Earthquake/
Glaive Rush d'ancres négatives. La nouvelle extraction expose explicitement
`sheerForceBoosted`, `wind` et `powder`, indépendamment du champ de chance.

Glaive Rush et Flare Blitz ont des fiches de 24 octets strictement identiques
entre les deux ROM : les correctifs Contact/Reckless des notes concernent donc
le code du jeu, et ne justifient pas d'inventer une nouvelle puissance de fiche.

## Helpers natifs de classement des remplaçants

| Fonction analytique | Adresse 1.2.6 |
| --- | --- |
| Score d'un candidat | `0x080821cc` |
| Dégâts estimés IA | `0x0816c2d8` |
| Wrapper de dégâts | `0x08058238` |
| Noyau des dégâts | `0x08057b38` |
| Plafond PV/dégâts | `0x0816c858` |
| Wrapper du nombre de coups | `0x0816c874` |
| Protection Sash/Sturdy à PV pleins | `0x081720fc` |
| Pourcentage de PV | `0x0816bae0` |

Les deux appels de score `0x080822f6` et `0x08082382` passent toujours zéro aux
arguments optionnels. Le flag est transmis jusqu'à `0x08057d92` ; zéro saute
vers `0x08057db2` et évite la réduction aléatoire. Le calcul sans variance,
l'arrondi au supérieur, le sentinelle `0xffffffff` à dégâts nuls et le wrapper
Sash/Sturdy sont conservés. Le plafond est rejoué sur 108 couples PV/dégâts.

**Différence supplémentaire vérifiée :** l'exemption Sash/Sturdy du premier
test « candidat lent mis KO » exige maintenant des dégâts d'entrée nuls.
`0x080823ac` calcule les hazards, les garde dans `r7`, et `0x080823e0` exige
`r7 == 0` pour éviter le rejet grâce à la protection. Les comparaisons de nombre
de coups suivantes continuent à lire les PV bruts et la protection native ;
il ne faut pas appliquer indistinctement cette nouvelle condition à toutes les branches.

Le score efface aussi un octet de contexte par battler avant l'évaluation des
réserves (`0x0808225a`–`0x0808226a`, BattleStruct+0x2e4+battler). Ce reset est
épinglé ; son lien précis avec les informations d'échec/flinch est traité dans
l'audit IA et ne doit pas être généralisé à une simulation de toute la mémoire.

Vérification complémentaire bornée : les neuf appels directs au helper
`AI_RandLessThan` dans les offsets ROM `0x7f000` à `0x85000` conservent les seuils
`26, 192, 192, 128, 102, 102, 51, 51, 102`. Le helper se déplace de
`0x0816ad6c` à `0x0816b344` et conserve le test `Random16() % 255 < seuil`.
L'appel du bonus de support reste à 26 (`0x08082264` → `0x08082510`). La preuve
lisible est `switch-chance-comparison.json`, reproductible par
`audit-switch-chances.py`. Aucune nouvelle différence de seuil n'est trouvée
dans ce périmètre. Cette comparaison ne prouve ni l'équivalence des conditions
qui appellent ces fonctions, ni l'absence de changement dans d'autres routines,
ni les probabilités de toute l'IA. Les probabilités exactes doivent aussi tenir
compte de la distribution du générateur et de son modulo ; les commentaires
« 10 % / 50 % » du C ne constituent pas une preuve d'uniformité parfaite.

`scripts/audit-native-thresholds.py` accepte désormais les deux empreintes
exactes. La preuve 1.2.6 contient **941 contrôles, onze plages et vingt et un blocs** ;
la 1.2.4 conserve **592 contrôles, huit plages et quatorze blocs**. Le script
reste en bibliothèque standard. Capstone n'est utilisé qu'à la préparation de
la fixture, avec ensuite vérification indépendante des BL, branches et littéraux.
Le rapport 1.2.6 lie également le SHA de la fixture externe. `nativeParityCertified`
reste faux : il s'agit de blocs identifiés, pas d'une émulation complète.

## Observation bornée sur les Méga-Évolutions

Le score copie le Pokémon de l'équipe via `0x0808b10c`, dont le bloc de copie
directe de l'espèce est à `0x0808b146`. L'espèce et les six stats brutes sont
lus depuis le Pokémon de l'équipe. `AI_SetupLogicData` (`0x0815e2f4`) remplit le
cache talent/objet/effet d'objet/PV/limitations ; son corps n'effectue pas de
transformation de l'espèce ou des stats. Le corps de `AI_CalcDamage` observé
n'effectue pas davantage de passage en forme Méga.

Cela soutient l'utilisation de la forme native enregistrée pour une réserve
encore absente du terrain, en distinguant les éventuelles espèces réellement
enregistrées comme Méga. Cela ne certifie pas tous les helpers de dégâts, les
formes persistantes d'un Pokémon déjà entré puis retiré, ou toute l'IA Méga.

La tâche parallèle sur les équipes a lié les 148 affichages Méga existants :
144 sont enregistrés sous leur forme de base, quatre sont réellement Méga dès
l'équipe et doivent rester ainsi. Ces quatre exceptions sont Tyranitar-Mega,
Steelix-Mega et Garchomp-Mega de Team Aqua Grunt Steve3, et Salamence-Mega de
Lorekeeper Zinnia. Les preuves de leurs identités sont dans l'audit des équipes.
La fixture native épingle maintenant les appels de copie/setup, la copie
d'espèce, la copie des six stats, le setup et son cache de talent.

## Fichiers produits et changements livrables

Dans ce dossier : `rom-1.2.6-data.json`, `numeric-differences.json`,
`numeric-summary.json`, `items-1.2.6.json`, `enum-1.2.6.json`, les scripts
de préparation, les disassemblages ciblés et les deux preuves fraîches.

Dans le projet (périmètre attribué à cet agent) :

- `scripts/audit-native-thresholds.py` : audit à deux profils, fail-closed.
- `docs/js/null_ai/native_helpers.js` : empreinte courante 1.2.6, math inchangée.
- `tests/fixtures/native-1.2.6-helpers.json` : preuve épinglée des nouveaux blocs.

Contrôle exécuté : les douze tests `native-thresholds.test.cjs` passent, et les
deux audits relisent les ROM originales en lecture seule. Aucun autre fichier
du projet n'a été modifié par cet agent.
