# Seuils de KO des remplaçants : preuve dans la ROM

Audit du 19 octobre 2026. Référence prioritaire : la ROM Null fournie, SHA-256 `a6f4f3f9d9b68515c70b134d6f0e79b3fd22e00c2f1468dbafa5b7529d98dbf4`. Aucun fichier ROM ni sauvegarde n'est distribué avec le calculateur.

## Ce qui est établi

Le classement des remplaçants appelle un calcul de dégâts **sans la réduction aléatoire de 85 à 100 %**, dans le chemin ordinaire identifié. Employer les dégâts moyens pour ces seuils ne reproduit donc pas ce chemin natif. Utiliser le maximum des dégâts du calculateur est une adaptation fondée sur cette preuve ; cela ne certifie pas toutes les formules de dégâts du calculateur.

Les noms de fonctions ci-dessous sont des étiquettes reconstituées par comparaison avec le C fourni et le contrôle de flux. La ROM ne contient pas leurs symboles de débogage.

| Élément | Adresse | Observation vérifiée |
| --- | --- | --- |
| Score du candidat | `0x08081f70` | Appels sortant/entrant à `0x08082060` et `0x080820e2`, deux paramètres de pile à zéro |
| Calcul de dégâts IA | `0x0816bd00` | Le dernier paramètre est transmis par `0x0816bf6a` à `0x08058128`, puis à `0x08057a28` |
| Porte du jet aléatoire | `0x08057c82` | Paramètre nul : branche vers `0x08057ca2`, en sautant l'appel RNG et le facteur en pourcentage |
| Nombre de coups | `0x0816c27c` | Plafond arithmétique entier ; sentinelle `0xffffffff` si dégâts nuls |
| Adaptation aux protections | `0x0816c298` | Un coup devient deux si le helper de protection `0x08171abc` renvoie vrai |

La porte aléatoire non sautée appelle un helper avec les bornes 0 et 15, puis applique `(100 − résultat) / 100` avec troncature entière. Identifier ces paramètres ne suffit pas à certifier l'uniformité ni les corrélations du RNG. Un bloc similaire existe à `0x0805806a` dans un autre chemin spécial ; son accessibilité complète n'est pas certifiée ici.

## Coups nécessaires, protections et hazards

Pour des dégâts strictement positifs, le helper calcule `(PV + dégâts − 1) / dégâts`, avec division entière non signée. Ainsi, 44 dégâts contre 89 PV donnent **trois coups**, et 45 dégâts donnent **deux coups**. La formule d'anciennes versions upstream RHH, qui divisait par `dégâts + 1`, ne correspond pas à cette ROM et ne doit pas être importée.

Le wrapper lit les PV courants dans `gBattleMons` : base `0x02004d58`, taille par combattant `0x60`, champ PV à `+0x2a`. Il remplace un résultat de un coup par deux si le combattant possède Focus Sash ou Sturdy et se trouve à 100 % de PV selon le helper natif. Les identités sont recoupées dans les tables ROM : effet tenu Focus Sash `0x55`, talent Sturdy `5`.

Les branches n'utilisent pas toutes les mêmes PV. Le premier contrôle de KO d'un candidat lent soustrait les hazards à `0x08082110–0x08082114`. Les comparaisons ultérieures passent par le wrapper qui lit les PV courants **avant cette soustraction locale**. Appliquer indistinctement les dégâts des hazards à tous les seuils changerait encore le comportement natif.

## Refaire l'audit

Depuis la racine du projet, avec Python disponible :

```text
python scripts/audit-native-thresholds.py --rom "chemin/vers/Pokemon - Null.gba"
```

On peut aussi définir `NULL_AI_ROM`, puis omettre `--rom`. `--output chemin/rapport.json` change la destination du rapport. Aucun chemin personnel n'est codé dans le script.

Le script n'utilise que la bibliothèque standard Python. Il relit la ROM, vérifie son empreinte, huit plages de code et quatorze blocs critiques, puis décode indépendamment les destinations Thumb des appels, branches et chargements littéraux. Les annotations de désassemblage ont été relevées avec Capstone 5.0.7 pendant le développement et restent liées aux octets exacts ; Capstone n'est pas nécessaire pour refaire ces vérifications. Un rejeu limité des instructions du helper arithmétique couvre 108 couples dégâts/PV.

La preuve est [native-threshold-rom.json](../verification/native-threshold-rom.json). Une ROM différente ou un contrôle divergent fait échouer la commande ; aucun nouveau rapport « verified » n'est produit. Sans ROM locale, les preuves déjà intégrées restent consultables, mais elles ne constituent pas une nouvelle relecture du fichier.

Cet audit ne lance aucun émulateur et ne certifie pas l'ensemble du moteur IA : formes, calculs spéciaux, coups multiples, arrondis, objets et historique peuvent encore créer des écarts. Le rapport conserve explicitement `nativeParityCertified: false`.
