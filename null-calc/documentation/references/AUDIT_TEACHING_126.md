# Capacités apprenables dans la ROM 1.2.6

La référence finale est `teachable-update-1.2.6.json`, construite par `build-teachable-proof.py`. Elle contient les 1 427 emplacements natifs, les sources de compatibilité, les tables réellement proposées et les empreintes des plages ROM. Les niveaux et les Egg Moves sont extraits séparément par les scripts de l'agent ROM.

## CT, CS et tuteurs ordinaires

La table actuelle à `0x942794` contient 108 identifiants : 50 CT, 50 cases réservées nulles, puis huit CS. Les 58 attaques utilisables sont identiques à la ROM 1.2.4. Le getter natif `0x081ef4a4` la référence ; la table vanilla ressemblante à `0x9422a8` n'a pas été retenue.

La liste de tuteurs ordinaires à `0x1bd62f8` passe de 35 à 44 attaques. Les neuf ajouts sont Air Cutter, Aromatherapy, Heal Bell, Psyshock, Scald, Discharge, Flash Cannon, Tri Attack et Safeguard. Les 44 noms correspondent au classeur officiel actuel. Les pointeurs à `0x1bcbe64` et `0x1bcbe88` les relient à l'énumération native.

La fonction de compatibilité `0x0808da68` accepte une attaque présente dans la table `gTeachableLearnsets` **ou dans les attaques par niveau, à n'importe quel niveau**. Mew possède une branche universelle avec exclusions explicites. Une simple intersection entre la table de compatibilité et les tuteurs aurait manqué certaines possibilités. La fixture finale applique ces conditions puis les intersecte avec les CT/CS et menus effectivement proposés. Elle recense 1 005 emplacements dont l'ensemble des attaques proposées change, contre 428 listes brutes de compatibilité modifiées, sentinelle 0 comprise dans ces deux comptes. Ces chiffres décrivent deux périmètres différents.

## Tuteur des starters et Psystrike

Un menu spécial, distinct des 44 tuteurs ordinaires, propose Spiky Shield, Body Press, Mystical Fire, Psystrike, Water Shuriken et Mat Block. L'option Psystrike pointe vers le script `0x318a21`, qui écrit `0x021c` (identifiant 540) dans `VAR_0x8005`, puis appelle le script commun `0x316a9f`.

Spiky Shield, Body Press, Mystical Fire et Psystrike utilisent le spécial `0x202`, entrée `0x215d74` de la table à `0x21556c`. Sa fonction `0x081f1a38` ouvre le mode 16. Le prédicat `0x081ea06c` limite alors les espèces brutes à Chesnaught 652, Delphox 655 et Greninja 658, puis applique la compatibilité normale. Il ne faut donc pas proposer Body Press à toutes les espèces compatibles à partir de ce seul menu. Water Shuriken et Mat Block utilisent le spécial ordinaire `0x201` / mode 12, sans cette restriction supplémentaire.

Dans la ROM 1.2.6, Delphox apprend Power Gem au niveau 68, et Psystrike figure maintenant dans sa table de compatibilité avec ce tuteur. Psystrike doit être classé **T, tuteur des starters** ; l'ancien niveau 68 n'est plus exact. La ROM 1.2.4 contenait encore Psystrike au niveau 68 ; l'absence de la version intermédiaire 1.2.5 empêche de reconstituer toutes les étapes du défaut corrigé en 1.2.6. La fixture décrit les deux ROM fournies.

Les formes Méga ne sont pas des espèces brutes pouvant se présenter hors combat devant ce tuteur. Une interface affichant leurs possibilités doit reprendre la provenance de leur forme de base explicitement, sans prétendre que le mode 16 accepte directement l'identifiant Méga.

## Heart Scale et divergence Counter

Le Move Reminder natif `0x0808db60` énumère les attaques par niveau dont le seuil est déjà atteint, en retirant celles connues et les doublons. Il n'ajoute ni la liste CT/tuteur ni les Egg Moves. L'interface native l'appelle à `0x0819eae0` ; le PNJ consommant une Heart Scale ouvre cette interface via le spécial `0x107`, fonction `0x0819de84`.

Archaludon 1018 possède **Metal Burst et Mirror Coat au niveau 1**. Ce sont donc des candidats au rappel via Heart Scale ; cela explique l'accès de bas niveau indiqué dans les notes de patch, sans inventer une CT ou un nouveau tuteur.

En revanche, **Counter (68) n'apparaît dans aucune de ses listes natives par niveau, de compatibilité CT/tuteur ou Egg Moves**. Duraludon ne fournit pas non plus cette attaque par évolution. Les notes de patch disent « Metal Burst and Counter » ; la ROM fournie contient Metal Burst et Mirror Coat. Aucun chemin spécial offrant Counter à Archaludon n'a été identifié. La fixture n'ajoute pas Counter ; cette divergence est conservée au lieu d'écraser la ROM avec le texte des notes. Une affirmation plus forte sur tous les scripts du monde nécessiterait une analyse supplémentaire.

Les données de reproduction natives sont inchangées entre les deux ROM fournies. La présence d'un Egg Move dans la ROM ne prouve pas, à elle seule, qu'un service de reproduction est accessible dans cette version du jeu.
