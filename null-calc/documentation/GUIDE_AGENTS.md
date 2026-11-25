# Commencer ici — calculateur Null 1.2.6

Révision : `null-1.2.6-public-release`, 2 novembre 2026.

Le même ZIP sert au joueur et aux futurs agents. Ouvrir `CALCULATEUR.html` après
extraction complète. Les sources, tests et outils sont inclus ; aucune ROM,
sauvegarde ou dépendance installée n'est distribuée.

1. Lire [DOCUMENTATION_COMPLETE.md](DOCUMENTATION_COMPLETE.md) pour l'architecture
   et les contrats, puis [MISE_A_JOUR_1.2.6.md](MISE_A_JOUR_1.2.6.md) pour la
   couverture de chaque note de patch, les preuves natives et les limites.
2. Les anciens audits et tutoriels sont conservés intégralement dans
   [HISTORIQUE.md](HISTORIQUE.md). Leurs versions et comptes de tests sont historiques.
3. Les résultats de la livraison effective se trouvent dans
   `verification/unified-validation.json`, les preuves dans `verification/release-proof/`.
   Le nombre de tests y est mesuré ; il ne faut pas recopier un ancien nombre.

## Modifier et livrer

Modifier les modules séparés dans `docs/js/null_ai/`, jamais les fichiers
`*.bundle.js` générés. Garder `docs/index.html` et `docs/index.template.html`
cohérents. L'ordre de ces scripts dans la page détermine l'ordre du bundle.
Les 147 fichiers d'origine protégés, dont les 2 280 anciennes lignes de sets,
doivent rester identiques. La couche `version126-trainers.js` applique les
changements autorisés et expose 2 288 lignes effectives, dont un sentinelle None.
Ne jamais actualiser les empreintes de tests pour masquer un écart. Les modèles
numériques, équipes et learnsets courants ont des fixtures versionnées ; les
builders fabriquent leurs couches additives et ne réécrivent pas les sources
protégées. `scripts/release-config.json` porte la version et le SHA de ROM.

Depuis la racine du projet, la seule commande de livraison est :

```text
node scripts/release.cjs
```

`npm run release` appelle exactement la même commande. Elle reconstruit le HTML
et le tutoriel, exécute les tests et parcours navigateur sur les sources, crée un
dossier neuf, recommence sur la distribution, compare au moins seize instantanés,
vérifie les modules et les fichiers protégés, enregistre des preuves fraîches et
vérifie chaque fichier du ZIP et ses CRC avant de remplacer l'archive finale.
Un échec ou un changement de source pendant l'exécution bloque la livraison.

Prérequis de développement : Node, Python 3.10+, Playwright et Chrome/Chromium
installés. Aucun de ces outils n'est nécessaire pour jouer. La commande n'installe
rien. Si nécessaire, fournir les chemins via `NULL_AI_PYTHON`,
`NULL_AI_PLAYWRIGHT_MODULE` et `NULL_AI_BROWSER`. Python est sinon recherché sur
le PATH (`python`, `py -3`, `python3`). `node scripts/release.cjs --plan` affiche
le déroulement sans écrire de fichier.

Si `NULL_AI_ROM` désigne la ROM fournie, la même commande relit ses blocs natifs
en lecture seule et ajoute une preuve fraîche. Sans cette variable, elle utilise
les preuves intégrées et les tests des helpers ; elle ne prétend pas relire une
ROM absente du ZIP. [MISE_A_JOUR_1.2.6.md](MISE_A_JOUR_1.2.6.md) décrit le profil
courant ; [SEUILS_KO_ROM.md](SEUILS_KO_ROM.md) conserve les adresses historiques
1.2.4 et ne doit pas être utilisé comme carte d'adresses 1.2.6.

Le parcours `check-reserve-forms-browser.cjs` vérifie aussi les identités de
réserve sur 29 ensembles de sets / onze familles. Avec `NULL_AI_ROM`, il relit
30 enregistrements d'équipe, leurs fiches d'espèce et la copie native de l'espèce.
Une copie équivalente de Darmanitan est explicitement attribuée à Tate&Liza,
distincte du vrai slot de Leader Liza. Les tests vérifient aussi la cohérence
des champs décodés avec les octets et leurs empreintes, même sans ROM.
Les ancrages courants sont dans `tests/fixtures/reserve-form-rom-1.2.6.json` ; le rapport frais
se trouve dans les preuves de distribution référencées par `verification/unified-validation.json`. Ne pas régénérer cette fixture
pour faire passer un test : sa méthode et son périmètre sont décrits dans la
référence courante. Les données historiques des trainers restent protégées.

La sortie unique est `../livraison/Null-1.2.6-Calculateur-Complet-EN-FR.zip`, avec
son empreinte SHA-256. Chaque lancement utilise un nouveau dossier de préparation.
Les anciens scripts `record-*`, packagers remplacés et générateurs de rapports
figés ne sont plus distribués. Leurs résultats utiles sont résumés dans HISTORIQUE.md.

Pour travailler rapidement sans produire de ZIP : `npm test` ou les commandes
`test:*browser` ciblées de `package.json`. Cela ne remplace pas la commande finale.

## Références et honnêteté des prévisions

Priorité : ROM Null fournie, puis documentation officielle, puis code partagé
pour la partie qu'il décrit effectivement. Ne pas remplacer une fonction native
absente par une hypothèse choisie uniquement parce qu'elle reproduit une capture.
Une probabilité calculée dans le modèle ne certifie pas l'état caché du jeu.
Consigner les nouvelles observations avec PV, disponibilité des réserves, terrain,
historique utile, calculs et niveau de certitude.

Le profil natif courant accepte uniquement la ROM 1.2.6 épinglée ; l'auditeur
conserve aussi le profil historique 1.2.4. Ne pas mélanger des adresses de versions.
Les 22 slots Méga absents du Lua ont des correspondances natives explicites.
Les voies niveau/CT/CS/tuteurs doivent rester distinctes : une liste de capacité
ne prouve pas l'accès à un PNJ. Les deux groupes doubles à propriétaires séparés
ont des bornes vérifiées ; ne pas généraliser à partir du nom d'un trainer.
Les profils natifs identiques peuvent se répéter dans plusieurs combats : une
signature de stats/attaques ne certifie pas leur appartenance ni leur ordre.
Garder l'ordre historique des équipes/navigation, sauf les groupes et ajouts
dont les en-têtes sont vérifiés explicitement.
Les corrections de déroulement du jeu ne sont pas toutes simulées, et
`nativeParityCertified` reste faux.

## Interface du Pokédex

Lire la section « Pokédex : interface officielle et tables de rencontres » dans
DOCUMENTATION_COMPLETE.md avant de modifier docs/porydex. L'ordre officiel des
panneaux et les navigations push maintiennent les boutons de retour contextuels.
Conserver local-navigation.js pour file:// et le chargement de
nulldex-encounters.js avant version126-panels.js. Les données restent celles de
la ROM. Vérification ciblée : npm run test:dex-interface-browser. La livraison
unique exécute aussi ce parcours sur les sources et la distribution.

## Contenu de l'archive

scripts/archive-policy.json sélectionne les preuves d'entrée encore utiles et
exclut douze anciens outils. Le build ne copie aucun ancien rapport, capture,
manifest de livraison ou répertoire verification/history ou release-proof.
La commande unique ajoute ensuite les preuves fraîches du seul lancement courant.
Le contrôle final du ZIP refuse une preuve ancienne qui aurait été réintroduite.
Les 147 fichiers protégés restent présents, y compris les tables historiques
nécessaires aux tests de conservation. Ne pas les supprimer comme de simples
doublons. Les modules séparés restent disponibles à côté des bundles générés
pour que les prochains agents puissent travailler et reproduire la livraison.

## Présentation publique

README.md contient la présentation français/anglais et les liens de téléchargement.
USER_GUIDE_EN.md complète le tutoriel français ; documentation/screenshots contient
les captures pédagogiques courantes. Garder ces liens valides et mettre à jour les
images si l’interface change. Le builder conserve désormais le README à la racine
du ZIP, ainsi que LICENSE et les notices sous licenses. Les autres anciens
Markdown de racine restent exclus. .gitattributes préserve les octets pour que
les hashes protégés restent vérifiables après un clone ou Download ZIP GitHub.
