# Partitions de Titi

(nom de code du projet : PartiMac)

Logiciel de notation musicale pour macOS (13 et plus), Apple Silicon et Intel.
Remplaçant moderne d'Encore 5 : mêmes fonctions, même logique de travail.

- **Télécharger** : onglet *Actions* du dépôt → dernière compilation réussie → artefact **Partitions-de-Titi-dmg**.
- **Installer** : voir [docs/PREMIER-LANCEMENT.md](docs/PREMIER-LANCEMENT.md).
- **Avancement** : [PARITY.md](PARITY.md) (fonctions) et [PLAN.md](PLAN.md) (jalons).

## Développement
```
scripts/fetch-soundfont.sh   # banque de sons
swift test                   # tests du cœur (modèle, MIDI, mise en page)
scripts/build-app.sh         # PartiMac.app universelle + PartiMac.dmg
```
Le module `PartiCore` est en Swift pur ; `PartiMac` est l'application AppKit.
