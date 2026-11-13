# PLAN.md — PartiMac : architecture et jalons

## 0. Contrainte d'environnement (important)

Ce dépôt est développé depuis un conteneur **Linux** : ni Xcode, ni `sw_vers`, ni `lipo` ici.
**Décision :** chaque jalon est compilé, testé et empaqueté sur un **runner macOS GitHub Actions** (Xcode récent, SDK de la dernière version de macOS). Le workflow :
1. vérifie `sw_vers` + version du SDK et l'écrit dans le journal ;
2. compile en universel (`ARCHS="arm64 x86_64"`), contrôle `lipo -info` ;
3. lance les tests unitaires ;
4. produit `PartiMac.dmg` téléchargeable (artefact / Release GitHub).

Le cœur (modèle, MusicXML, MIDI) est en Swift pur, donc aussi testable ici sous Linux.

## 1. Choix techniques (une ligne chacun)

| Sujet | Choix | Pourquoi |
|---|---|---|
| Langage / UI | Swift 6 + SwiftUI (fenêtres, panneaux) + AppKit (`NSView` du canvas) | Natif, universel, rapide ; AppKit pour le contrôle fin souris/clavier qu'exige l'édition. |
| App à documents | `DocumentGroup` / `NSDocument`, extension `.partimac` (paquet JSON versionné) | Autosave, versions, récupération après plantage fournis par macOS. |
| Rendu | **Moteur de gravure maison** en Core Graphics + police **Bravura** (SMuFL, OFL) | Verovio rend du SVG statique : mal adapté à l'édition directe WYSIWYG façon Encore (hit-test, drag) ; et LGPL en statique complique la distribution. |
| Audio | `AVAudioEngine` + `AVAudioUnitSampler` (un par portée) | Lit les SoundFont .sf2 nativement, zéro dépendance. |
| SoundFont | **GeneralUser GS** (licence libre de redistribution) — repli FluidR3_GM (MIT) | Bon son GM, taille raisonnable (~30 Mo). |
| MIDI | CoreMIDI (entrées/sorties) + lecteur/écrivain SMF maison | Simple, testable. |
| MusicXML | Parseur/écrivain maison (XMLParser Foundation) + `.mxl` via unzip maison | Pas de dépendance, contrôle total. |
| Projet | XcodeGen (`project.yml`) + Swift Packages locaux | Projet reproductible et lisible ; pas de `.xcodeproj` à fusionner. |
| Cible | macOS 13+, universel arm64 + x86_64 | Exigence. |
| Signature | Hardened runtime + entitlements prêts ; signature ad hoc par défaut, Developer ID + notarisation si compte | Voir §6. |

## 2. Architecture (modules)

```
PartiMac.app
├── PartiCore      (Swift pur)  modèle, commandes undo/redo, transposition, quantification
├── PartiIO        (Swift pur)  .partimac, MIDI SMF, MusicXML, .enc (best effort)
├── PartiEngrave   (Swift pur)  mise en page : espacement, systèmes, pages → liste de glyphes positionnés
├── PartiRender    (CoreGraphics) dessin des glyphes Bravura, PDF, PNG/SVG, impression
├── PartiAudio     AVAudioEngine/CoreMIDI : lecture, métronome, saisie MIDI, curseur
├── PartiOMR       (jalon 7) pré-traitement image + moteur de reconnaissance
└── App            SwiftUI/AppKit : fenêtres, palettes, inspecteur, ⌘K, raccourcis
```

## 3. Modèle de données

```
Score
 ├─ metadata (titre, compositeur, copyright, …)
 ├─ layout (format papier, marges, taille portée, pages types, sauts forcés)
 ├─ measures[]            ← données globales par mesure :
 │     métrique, armure, barre, reprises, volta, tempo, repères (D.C., Coda…)
 ├─ parts[]               (instrument, transposition, canal/programme, volume, pan)
 │    └─ staves[]         (clé(s), type : standard / TAB / percussion)
 │         └─ measures[i].voices[1…8]
 │              └─ events[] : Note/Accord | Silence | (groupes : n-olet, ornements)
 │                   offset & durée en fractions rationnelles exactes
 │                   notes : hauteur (pas + altération), liaison, articulations, vélocité
 ├─ spanners[]            liaisons, soufflets, ottava, pédale… (ancrés sur IDs d'événements)
 └─ texts[]               paroles (couplet n), accords, textes libres, en-têtes/pieds
```
Principes : identifiants stables (UUID) ; temps en `Fraction` (pas de flottants) ; toute modification passe par une **commande** réversible → annuler/refaire illimité gratuit ; les parties extraites sont des **vues** de la partition (pas des copies).

## 4. Jalons

| J | Contenu | Critère de sortie |
|---|---|---|
| **0** | PARITY.md, PLAN.md | Ton OK. |
| **1** | Socle : projet, CI macOS universelle, modèle, `.partimac`, gravure de base (grand-portée piano, clés sol/fa, armure, métrique, notes/silences/points/altérations, ligatures auto, liaisons de prolongation), saisie souris (palette Notes) + clavier (0–8, R, A–G, flèches), insérer/supprimer mesures, annuler illimité, lecture SoundFont + curseur, export PDF, import/export MIDI, autosave, icône, `.dmg` | Ton scénario : double-clic → partition piano → mélodie souris + clavier → écoute → PDF + MIDI → réouverture. Tests modèle + MIDI. |
| **2** | Notation complète : multi-portées, 8 voix, accords, n-olets, ornements, liaisons, ottava, barres/reprises/voltas, nuances, articulations, tempo, copier/coller, glisser-déposer, transposition, saisie MIDI pas à pas, assistant de partition | Partition orchestrale simple saisissable sans manuel. |
| **3** | Texte & mise en page : paroles multi-couplets, accords, textes, en-têtes/pieds, ajustements manuels, sauts, marges, taille portée, pages types, export PNG/SVG, impression | Chanson voix+piano avec paroles imprimable. |
| **4** | MusicXML import/export, transpositeurs, parties extraites, réduction, mixeur, métronome, MIDI temps réel quantifié, sortie MIDI externe, percussions, lecture des reprises | Aller-retour MusicXML avec MuseScore/Finale ; tests MusicXML. |
| **5** | Tablature, diagrammes d'accords, ⌘K, tous les raccourcis Encore, vue défilante, perf 20 pages, export audio | Fluide sur 20 pages ; parité ≥ 95 % hors .enc/OMR. |
| **6** | Import `.enc` best effort | Ouvre les notes/portées des fichiers de test ; limites documentées. |
| **7** | OMR : import, redressement, reconnaissance, écran de vérification côte à côte, correction 1–2 clics | Une page imprimée transcrite et corrigée en < 5 min. |
| **8** | Release : signature, notarisation (si compte), notes de version, LICENSES complet | `.dmg` final. |

## 5. OMR — comparaison

| Moteur | Techno | Licence | Points forts | Limites pour PartiMac |
|---|---|---|---|---|
| Audiveris | Java | AGPL-3.0 | Mature, sortie MusicXML, très bon sur l'imprimé | JRE à embarquer ×2 archis (~+200 Mo), AGPL contamine l'app, faible sur le manuscrit. |
| oemer | Python + ONNX | MIT | Conçu pour les photos, licence permissive | Imprimé seulement ; Python à embarquer. |
| homr | Python + ONNX (transformer) | copyleft (à confirmer) | Meilleur sur photos de téléphone | Imprimé ; licence à vérifier. |

**Recommandation :** oemer (MIT), modèles exécutés via ONNX Runtime (bibliothèque universelle disponible) appelés depuis Swift, prétraitement réimplémenté avec Vision/Core Image (redressement natif macOS). Universel : oui.
**Honnêteté :** aucun moteur libre n'est entraîné sérieusement sur le **manuscrit**. Attends-toi à un taux d'erreur élevé sur une écriture à la main (bon sur une copie propre et régulière, mauvais sur un brouillon). C'est pourquoi l'écran de correction rapide est prioritaire dans ce jalon.

## 6. Distribution et Gatekeeper

- Sans compte Apple Developer (99 €/an), l'app est signée « ad hoc » : elle tourne sur tous les Mac, mais au **premier** lancement d'une app téléchargée, macOS bloque. Il faut alors aller une fois dans **Réglages Système → Confidentialité et sécurité → « Ouvrir quand même »** (sur macOS 15+, le clic droit → Ouvrir ne suffit plus). Ensuite, double-clic normal.
- Avec le compte : signature Developer ID + notarisation → double-clic direct, aucun avertissement. Procédure et script fournis (`scripts/notarize.sh`, `docs/SIGNATURE.md`) dès le jalon 1.

## 7. Risques

| Risque | Impact | Parade |
|---|---|---|
| Qualité de gravure du moteur maison | Élevé | Règles SMuFL/Bravura (métadonnées d'ancrage), tests visuels par captures de référence. |
| `.enc` illisible | Moyen | Repli : exporter depuis Encore (vieux Mac / VM) en MIDI ou MusicXML — attention, MusicXML d'Encore 5 perd paroles et accords. |
| OMR manuscrit peu fiable | Élevé (bonus) | UX de correction, attentes claires. |
| Pas de Mac dans le conteneur de dev | Moyen | CI macOS ; minutes macOS facturées ×10 sur dépôt privé (quota gratuit ≈ 200 min macOS/mois). |
| Gatekeeper sans compte payant | Moyen | §6. |
| Perf sur 20 pages | Moyen | Mise en page incrémentale (seuls les systèmes modifiés sont recalculés), dessin par tuiles. |

## 8. Licences prévues (LICENSES)
Bravura (SIL OFL 1.1) · GeneralUser GS (licence libre) ou FluidR3_GM (MIT) · XcodeGen (MIT, outil de build uniquement) · oemer (MIT) + ONNX Runtime (MIT) au jalon 7.
