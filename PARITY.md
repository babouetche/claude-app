# PARITY.md — Matrice de parité « Partitions de Titi » (PartiMac) ↔ Encore 5

**État : jalon 1 terminé (13/11/2026).**

Statuts : `à faire` · `en cours` · `fait` · `hors périmètre` (avec raison).
Colonne **J** = jalon prévu (voir PLAN.md).

> Sources : descriptions produit Encore 5 (Passport/GVOX), Quick Start Encore 5.0.x, feuilles de raccourcis Encore publiées par des utilisateurs, notes de version 5.0.x, Wikipedia.
> Le manuel officiel n'est plus en ligne côté éditeur ; les copies tierces n'étaient pas accessibles depuis l'environnement de build. Les points marqués *(à confirmer)* seront vérifiés sur un manuel Encore 5 si tu peux m'en fournir un PDF.
> Rien n'est copié d'Encore : seules les **fonctions** et la **logique de travail** sont reproduites.

## 1. Saisie

| # | Fonction Encore 5 | J | Statut |
|---|---|---|---|
| S1 | Palette Notes : choix durée (ronde double → 128e) puis clic sur la portée (outil crayon) | 1 | fait |
| S2 | Hauteur choisie par position verticale du clic, altération par la palette | 1 | fait |
| S3 | Clavier d'ordinateur : touches 0–8 = durées (0 = carrée, 1 = ronde … 8 = 128e) | 1 | fait |
| S4 | Touche R : bascule note ↔ silence pour la durée choisie | 1 | fait |
| S5 | Saisie des hauteurs au clavier (lettres A–G / Do–Si), ↑↓ demi-ton, ⌥↑↓ octave | 1 | fait |
| S6 | Point (.), double point, liaison de prolongation, altérations au clavier (+ / - / =) | 1 | fait |
| S7 | Changer la durée d'une sélection (Ctrl/⌘+D dans Encore) | 2 | fait |
| S8 | Clavier MIDI — saisie pas à pas (durée sur l'ordi, hauteur au clavier MIDI, accords) | 2 | à faire |
| S9 | Clavier MIDI — enregistrement temps réel avec métronome et quantification | 4 | à faire |
| S10 | « Guess Durations » / requantification après enregistrement temps réel | 4 | à faire |
| S11 | Palettes d'outils flottantes (Notes, Clés/armures, Nuances, Articulations, Liaisons, Symboles, Texte, Accords, Graphismes) | 1–3 | en cours |
| S12 | Outil sélection (flèche), sélection rectangle, sélection de mesures entières | 1 | en cours |
| S13 | Édition vélocité MIDI d'une note (raccourci vélocité) | 4 | à faire |
| S14 | Accord : saisir plusieurs notes à la même position (clic superposé / « Make Chord ») | 2 | fait |

## 2. Notation

| # | Fonction | J | Statut |
|---|---|---|---|
| N1 | Plusieurs portées (jusqu'à 64 dans Encore), accolades et crochets | 2 | à faire |
| N2 | Voix multiples par portée (jusqu'à 8 dans Encore), hampes auto haut/bas | 2 | à faire |
| N3 | Grand-portée piano (2 portées + accolade) | 1 | fait |
| N4 | Clés : sol, fa, ut 3e/4e, sol octaviée, percussion, TAB ; changement de clé en cours de partition | 1 (sol/fa) · 2 | en cours |
| N5 | Armures (toutes), changement d'armure, annulation par bécarres | 1 · 2 | en cours |
| N6 | Métriques (simples, composées, C, C barré, irrégulières), changement en cours | 1 · 2 | en cours |
| N7 | Altérations, altérations de courtoisie, enharmonie (raccourci Encore) | 1 · 2 | en cours |
| N8 | Points simples/doubles | 1 | fait |
| N9 | Silences, silences de mesure entière, silences multi-mesures (parties) | 1 · 4 | en cours |
| N10 | Ligatures automatiques selon la métrique, ligature/déligature manuelle | 1 · 2 | en cours |
| N11 | Liaisons de prolongation | 1 | fait |
| N12 | Liaisons d'expression (phrasé), forme ajustable à la souris | 2 | à faire |
| N13 | Triolets et n-olets (n:m quelconque) | 2 | à faire |
| N14 | Notes d'ornement / appoggiatures / acciaccatures (« Make Grace/Cue ») | 2 | à faire |
| N15 | Notes réduites (cue notes) | 2 | à faire |
| N16 | Ottava 8va/8vb/15ma (affichage + lecture) | 2 | à faire |
| N17 | Barres : simple, double, finale, pointillée, reprise début/fin | 2 | à faire |
| N18 | Voltas (1re/2e fois), D.C., D.S., Coda, Segno, Fine (affichage + lecture) | 2 · 4 | à faire |
| N19 | Nuances (ppp → fff, sfz, fp…) + soufflets cresc./dim. (affichage + effet lecture) | 2 | à faire |
| N20 | Articulations : staccato, tenuto, accent, marcato, point d'orgue, staccatissimo | 2 | à faire |
| N21 | Ornements : trille, mordant, gruppetto, trémolo, glissando, arpège | 2 | à faire |
| N22 | Tablature guitare/basse (« Make Tablature » à partir d'une portée standard, accordages) | 5 | à faire |
| N23 | Diagrammes d'accords guitare (grilles) | 5 | à faire |
| N24 | Portée de percussion (mapping MIDI → têtes de notes/positions, kit GM) | 4 | à faire |
| N25 | Têtes de notes alternatives (x, losange, slash) | 4 | à faire |
| N26 | Symboles graphiques libres (pédale piano Ped/*, respiration, césure) | 3 | à faire |

## 3. Texte

| # | Fonction | J | Statut |
|---|---|---|---|
| T1 | Titre, sous-titre, compositeur, arrangeur, copyright | 1 (titre/compositeur) · 3 | en cours |
| T2 | Paroles syllabe par syllabe (Tab/espace pour avancer, tiret, mélisme) | 3 | à faire |
| T3 | Paroles multi-couplets (plusieurs lignes) | 3 | à faire |
| T4 | Symboles d'accords (C, Am7, F/A…) avec transposition automatique | 3 | à faire |
| T5 | Texte libre attaché à une note/mesure ou à la page | 3 | à faire |
| T6 | Indications de tempo et de caractère (Allegro, ♩ = 120) liées à la lecture | 2 | à faire |
| T7 | En-têtes et pieds de page (numéros de page, nom de partie, date) | 3 | à faire |
| T8 | Choix de polices texte (TrueType/OpenType système) | 3 | à faire |

## 4. Mise en page

| # | Fonction | J | Statut |
|---|---|---|---|
| L1 | Vue page (WYSIWYG) éditable directement | 1 | fait |
| L2 | Espacement automatique des notes (proportionnel) | 1 | fait |
| L3 | Ajustement manuel : déplacer notes/symboles, largeur de mesure à la souris | 3 | à faire |
| L4 | Mesures par système, systèmes par page (« Fit » / redistribuer) | 3 | à faire |
| L5 | Sauts de système et de page forcés | 3 | à faire |
| L6 | Marges, format papier (A4, Letter…), orientation | 1 (format) · 3 | en cours |
| L7 | Taille de portée globale et par portée | 3 | à faire |
| L8 | Pages types (master pages) : première page / suivantes | 3 | à faire |
| L9 | Masquer une portée vide, nommer les portées (nom long / abrégé) | 3 | à faire |
| L10 | Numéros de mesure (tous / chaque système / tous les N) | 2 | en cours |
| L11 | Vue défilante continue (en plus de la vue page) | 5 | à faire |

## 5. Instruments

| # | Fonction | J | Statut |
|---|---|---|---|
| I1 | Assistant nouvelle partition (piano, voix+piano, quatuor, big band, vierge…) | 1 (piano) · 2 | en cours |
| I2 | Instrument par portée (programme GM), ajout/suppression/réordonnancement de portées | 2 | à faire |
| I3 | Instruments transpositeurs (Si♭, Mi♭, Fa…) — affichage concert / transposé | 4 | à faire |
| I4 | Transposition de la partition ou d'une sélection (intervalle, armure) | 2 | à faire |
| I5 | Extraction des parties individuelles (liées à la partition) | 4 | à faire |
| I6 | Partition complète et réduction (conducteur condensé) | 4 | à faire |

## 5 bis. Accordéon (prioritaire : l'utilisateur final est accordéoniste)

Encore 5 n'avait rien de spécifique pour l'accordéon : ces points vont **au-delà** de la parité.

| # | Fonction | J | Statut |
|---|---|---|---|
| A1 | Modèle « Accordéon » dans l'assistant : main droite (sol) + main gauche (fa), accolade, son GM accordéon | 1 | fait |
| A2 | Choix du son : accordéon, accordéon tango (bandonéon), effet musette (voix doublées légèrement désaccordées) | 1 (accordéon) · 4 | en cours |
| A3 | Symboles de soufflet : tirer / pousser, changement de soufflet (glyphes SMuFL de Bravura) | 2 | à faire |
| A4 | Symboles de registres (cercles à points, glyphes SMuFL) + nom du registre (Musette, Bandonéon, Clarinette…) | 2 | à faire |
| A5 | Basses Stradella : notation basse fondamentale / contrebasse et accords M, m, 7, d (dim) | 3 | à faire |
| A6 | Lecture des basses Stradella : un accord « M » sur Do joue réellement l'accord de Do majeur dans le bon registre | 4 | à faire |
| A7 | Doigtés (1–5) au-dessus/dessous des notes | 2 | à faire |
| A8 | Grilles d'accords pour la main gauche (symboles au-dessus de la portée, transposables) | 3 | à faire |
| A9 | Basses libres (free bass) : notation standard en clé de fa | 2 | à faire |

## 6. Lecture

| # | Fonction | J | Statut |
|---|---|---|---|
| P1 | Lecture audio intégrée avec SoundFont General MIDI embarqué | 1 | fait |
| P2 | Lecture depuis la sélection / depuis le début, barre espace = play/stop | 1 | fait |
| P3 | Curseur de lecture qui suit la partition (défilement auto) | 1 | fait |
| P4 | Tempo global et changements de tempo | 1 · 2 | en cours |
| P5 | Métronome (clic) pendant lecture et enregistrement | 4 | à faire |
| P6 | Mixeur par portée : volume, pan, instrument, muet/solo | 4 | à faire |
| P7 | Canal MIDI par voix, sortie vers synthé MIDI externe (CoreMIDI) | 4 | à faire |
| P8 | Interprétation des reprises, voltas, D.C./D.S. à la lecture | 4 | à faire |
| P9 | Swing / lecture « humanisée » | 5 | à faire |

## 7. Fichiers

| # | Fonction | J | Statut |
|---|---|---|---|
| F1 | Format natif (.partimac), enregistrement, ouverture, documents récents | 1 | fait |
| F2 | Import MIDI (type 0/1) avec quantification et séparation des mains | 1 (base) · 4 | en cours |
| F3 | Export MIDI (type 1, une piste par portée) | 1 | fait |
| F4 | Import MusicXML (partwise/timewise, .xml/.musicxml/.mxl) | 4 | à faire |
| F5 | Export MusicXML 4.0 (y compris paroles et accords, absents d'Encore) | 4 | à faire |
| F6 | Import .enc Encore | 1 | fait — notes, accords, silences, points, triolets, liaisons, clés, armures, métriques, tempo, reprises, levée, textes (accords/basses/doigtés). Voix secondaires et notes d'ornement : pas encore affichées |
| F7 | Export PDF | 1 | fait |
| F8 | Export images PNG/SVG (page ou sélection) | 3 | à faire |
| F9 | Impression (dialogue macOS) | 3 | fait |
| F10 | Enregistrement automatique + récupération après plantage | 1 | fait |
| F11 | Export audio (WAV/AIFF/M4A) | 5 | à faire (bonus, pas dans Encore 5) |

## 8. Édition

| # | Fonction | J | Statut |
|---|---|---|---|
| E1 | Annuler / refaire illimité | 1 | fait |
| E2 | Copier / couper / coller / supprimer (notes, mesures, portées) | 2 | à faire |
| E3 | Glisser-déposer de notes (hauteur) et de sélections | 2 | à faire |
| E4 | Insérer / supprimer des mesures | 1 | fait |
| E5 | Raccourcis clavier proches d'Encore (tableau dans l'app, menu Aide) | 1 · 5 | en cours |
| E6 | Rechercher / sélectionner par critère (toutes les notes de la voix 2…) | 5 | à faire |
| E7 | Palette de commandes ⌘K (en plus d'Encore) | 5 | à faire |

## 9. Bonus : transcription de manuscrits (OMR)

| # | Fonction | J | Statut |
|---|---|---|---|
| O1 | Import photo / scan / PDF | 7 | à faire |
| O2 | Redressement, recadrage, nettoyage automatiques | 7 | à faire |
| O3 | Reconnaissance → MusicXML → ouverture dans l'éditeur | 7 | à faire |
| O4 | Vue côte à côte image / partition, mesures incertaines surlignées | 7 | à faire |
| O5 | Correction en 1–2 clics (hauteur, durée, mesure à refaire) | 7 | à faire |

## 10. Hors périmètre

| Fonction Encore | Raison |
|---|---|
| Lecture via QuickTime Musical Instruments / OMS / FreeMIDI | Technologies Apple/tiers supprimées ; remplacées par SoundFont + CoreMIDI. |
| Envoi/partage « Internet publishing » (Passport) | Services disparus ; remplacé par export PDF/MusicXML. |
| Compatibilité Mac OS 9 / PowerPC | Matériel non supporté par macOS 13+. |
| Plug-ins tiers Encore | Pas d'API publique à reproduire. |
