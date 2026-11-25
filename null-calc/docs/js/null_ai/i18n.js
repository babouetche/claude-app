(function(root) {
    "use strict";
    var STORAGE_KEY = "nullcalc_aiLanguage", language = "en";
    try { if (root.localStorage.getItem(STORAGE_KEY) === "fr") language = "fr"; } catch (_) {}
    // Engine messages remain unchanged. Only their displayed text is translated.
    var pairs = [
        ["Les scores de réserve utilisent la forme enregistrée dans l’équipe du trainer avant les transformations d’entrée, y compris la plupart des Méga-Évolutions. Le Pokémon actif garde sa forme sélectionnée.", "Reserve scores use the form stored in the trainer's party before entry transformations, including most Mega Evolutions. The active Pokémon keeps its selected form."],
        ["Forme de réserve évaluée par l’IA : ", "AI reserve form: "],
        ["Historique des KO modifié : le Pokémon affiché devient la référence active. Choisissez de nouveau Switch into pour mémoriser un nouveau scénario.", "Faint history changed: the displayed Pokémon is now the active reference. Choose Switch into again to capture a new scenario."],
        ["Pour Rage Fist, Stomping Tantrum et les attaques à usages consécutifs, saisissez manuellement la puissance appropriée. Les croix KO ne mémorisent ni les coups reçus, ni les attaques échouées, ni les tours consécutifs. Retaliate du Pokémon actif demande aussi de saisir sa puissance actuelle.", "For Rage Fist, Stomping Tantrum and consecutive-use attacks, enter the appropriate move power manually. KO marks do not record hits taken, failed moves or consecutive turns. Retaliate on the active Pokémon also needs its current power entered manually."],
        ["Total des KO alliés (facultatif, résurrections incluses)", "Total allied faints (optional, includes revivals)"],
        ["Laissez vide pour compter les croix KO et les PV à 0. Après des résurrections, indiquez le total cumulé pour Last Respects et Supreme Overlord. La prévision après KO ajoute une seule fois le KO simulé.", "Leave empty to count KO marks and 0 HP. After revivals, enter the cumulative total for Last Respects and Supreme Overlord. The post-KO preview adds the simulated KO once."],
        ["La prévision inclut le prochain tour après ce KO : Retaliate passe à 140 ; Last Respects et Supreme Overlord comptent ce KO une seule fois, en plus des anciennes croix KO ou du total cumulé renseigné. Un switch ordinaire ne provoque pas ces bonus. Les autres effets du coup final ne sont pas simulés.", "The preview includes the next turn after this KO: Retaliate is boosted to 140; Last Respects and Supreme Overlord include this faint once, plus earlier KO marks or the entered cumulative total. These bonuses do not imply an ordinary switch causes a KO. Other effects of the finishing move are not simulated."],
        ["Distorsion est synchronisée avec le panneau Field. La Vitesse la plus basse agit en premier à priorité égale ; les égalités de vitesse et les priorités des attaques sont inchangées.", "Trick Room is synchronized with the Field panel. Lower Speed moves first at equal priority; speed ties and move priorities are unchanged."],
        ["Tentée depuis l’entrée", "Attempted since entry"],
        ["Réinitialiser les tentatives : nouvelle entrée", "Reset attempts: new entry"],
        ["Last Resort : cochez chaque autre attaque réellement tentée depuis l’entrée en jeu, même si elle a échoué. Un switch réinitialise cet historique. Les dégâts affichés supposent Last Resort débloqué ; les probabilités tiennent compte de cet historique.", "Last Resort: mark each other move actually attempted since entry, even if it failed. Switching resets this history. Damage shown assumes Last Resort is unlocked; probabilities use this history."],
        ["Last Resort est bloqué : chaque autre attaque connue doit avoir été tentée depuis l’entrée. Les tentatives échouées comptent.", "Last Resort is locked: every other known move must have been attempted since entry. Failed attempts count."],
        ["Historique de Last Resort inconnu : renseignez les autres attaques tentées depuis l’entrée en jeu de ce Pokémon.", "Last Resort history is unknown: enter the other moves attempted since this Pokémon entered battle."],
        ["Les tentatives depuis l’entrée doivent être indiquées par vrai ou faux.", "Move attempts since entry must be true or false."],
        ["Prochain Pokémon après KO", "Next Pokémon after KO"],
        ["Afficher les suggestions et colorer l’équipe", "Show suggestions and colour the team"],
        ["Simule le KO de l’adversaire affiché à droite face à votre Pokémon actuellement affiché à gauche. Les PV du combat restent inchangés.", "Previews the displayed opponent fainting against your Pokémon currently shown on the left. Battle HP stays unchanged."],
        ["Vert : probabilité d’entrée la plus élevée dans le modèle (égalité possible). Bleu : autre entrant possible. Doré/orange : probabilité indéterminée. × rouge : Pokémon déjà KO, exclu. ≈ : estimation, même en vert. 0 % : non retenu dans ce scénario.", "Green: highest entry probability in the model (ties possible). Blue: another possible entrant. Gold/orange: unknown probability. Red ×: already fainted and excluded. ≈: an estimate, even in green. 0%: not selected in this scenario."],
        ["Effacer les KO de cette équipe", "Clear this team's KO marks"],
        ["Cliquez sur KO pour marquer un Pokémon, ou faites un clic droit sur son icône. Restaurer retire le marquage ; les PV restent réglables dans les réserves du volet IA.", "Click KO to mark a Pokémon, or right-click its icon. Restore removes the mark; HP can still be edited in the AI panel's reserves."],
        ["Règles et réglages du remplacement", "Replacement rules and settings"],
        ["Le remplaçant subit immédiatement une attaque (pivot rapide / Eject Pack)", "The replacement immediately takes an attack (fast pivot / Eject Pack)"],
        ["Score maximal, puis ordre de l’équipe en cas d’égalité. Bonus Support : +2 avec 10 % de chance. ≈ indique une estimation ; le mode strict du volet IA masque les probabilités non établies.", "Highest score, then party order to break ties. Support bonus: +2 with a 10% chance. ≈ marks an estimate; strict mode in the AI panel hides unestablished probabilities."],
        ["Le terrain, les hazards, les écrans, les vitesses, Distorsion, les attaques et les PV renseignés sont pris en compte dans le modèle. Les effets du coup qui provoquera le KO ne sont pas simulés : actualisez les PV et le terrain avant de lire la suggestion.", "The model uses the field, hazards, screens, speeds, Trick Room, moves and entered HP. Effects of the finishing move are not simulated: update HP and the field before reading the suggestion."],
        ["État du combat incomplet : suggestion indisponible.", "Incomplete battle state: suggestion unavailable."],
        ["Choisissez un set de trainer connu à droite pour suggérer le remplaçant.", "Choose a known trainer set on the right to suggest the replacement."],
        ["Doubles : les deux créneaux adverses et vos deux Pokémon actifs sont nécessaires. Suggestion indisponible.", "Doubles: both opposing slots and your two active Pokémon are required. Suggestion unavailable."],
        ["Aucune réserve vivante : aucun remplaçant dans cette équipe.", "No living reserves: no replacement in this team."],
        ["Toutes les réserves restantes tombent KO sur les hazards : le modèle ne peut pas désigner l’entrant.", "All remaining reserves faint to entry hazards: the model cannot identify the entrant."],
        ["Actif : KO simulé", "Active: simulated KO"],
        ["× Déjà KO : exclu", "× Already fainted: excluded"],
        ["KO sur les hazards", "Faints to entry hazards"],
        ["Probabilité non établie", "Probability not established"],
        ["Restaurer", "Restore"],
        ["Le classement utilise des dégâts ou un état approximatifs ; les chances d’entrée restent des estimations.", "The ranking uses approximated damage or state; entry chances remain estimates."],
        ["IA : probabilités, switch et état du combat", "AI: probabilities, switching and battle state"],
        ["Probabilités IA : bleu = probabilité établie dans le modèle ; doré = estimation (≈) ou probabilité indéterminée, selon le texte affiché. « Indéterminé » signifie que le calculateur ne peut pas chiffrer le choix, pas 0 %. La couleur indique le niveau de certitude du modèle.", "AI probabilities: blue = an established probability in the model; gold = an estimate (≈) or an unknown probability, as labelled. Unknown means the calculator cannot quantify the choice, not 0%. Colour indicates the model's level of certainty."],
        ["≈ indique une estimation avec les hypothèses affichées ci-dessous. Le mode strict affiche uniquement les probabilités établies. Si l’équipe adverse est connue, les probabilités des attaques incluent le risque de switch.", "≈ marks an estimate using the assumptions below. Strict mode only displays established probabilities. If the opposing team is known, move probabilities include the chance of switching."],
        ["Calcul des probabilités", "Probability calculation"],
        ["Estimation documentée (recommandé)", "Documented estimate (recommended)"],
        ["Strict : probabilités établies uniquement", "Strict: established probabilities only"],
        ["Switch : scénario et Pokémon entrant", "Switch: scenario and incoming Pokémon"],
        ["Action de l’IA", "AI action"],
        ["Automatique : règles du trainer", "Automatic: trainer rules"],
        ["No switch : l’IA reste", "No switch: the AI stays in"],
        ["Guaranteed switch-in : switch imposé", "Guaranteed switch-in: forced switch"],
        ["Post-KO : remplacement forcé", "Post-KO: forced replacement"],
        ["Probably switch : probabilité personnalisée", "Probably switch: custom probability"],
        ["Probabilité supposée de switch (%)", "Assumed switch probability (%)"],
        ["Pokémon du joueur affiché à gauche", "Player’s Pokémon shown on the left"],
        ["Pokémon déjà actif", "Currently active Pokémon"],
        ["Switch into : Pokémon que je fais entrer", "Switch into: Pokémon I am sending in"],
        ["Sélectionnez Switch into AVANT de choisir votre Pokémon entrant à gauche. Les dégâts se recalculent sur l’entrant ; les probabilités IA restent basées sur le Pokémon actif mémorisé.", "Select Switch into BEFORE choosing your incoming Pokémon on the left. Damage is recalculated against the incoming Pokémon; AI probabilities remain based on the remembered active Pokémon."],
        ["Tours consécutifs de l’IA en jeu", "Consecutive turns the AI has been active"],
        ["L’IA tombe KO par Requiem ce tour", "The AI faints from Perish Song this turn"],
        ["Le candidat subit immédiatement une attaque en entrant (pivot rapide / Eject Pack)", "The candidate takes an attack immediately on entry (fast pivot / Eject Pack)"],
        ["Toutes les attaques de l’IA sont inutiles", "All AI moves are useless"],
        ["Climat / terrain de l’IA expiré", "The AI’s weather / terrain has expired"],
        ["Routine Immunity AI applicable", "Immunity AI routine applies"],
        ["Non renseignée", "Not specified"], ["Oui : condition confirmée (75 %)", "Yes: condition confirmed (75%)"],
        ["Immunity AI : confirmer le talent d’immunité et le type de la dernière attaque. La source ne précise pas clairement si le talent concerne le Pokémon actif ou le candidat.", "Immunity AI: confirm the immunity ability and the last move’s type. The source does not clearly specify whether the ability belongs to the active Pokémon or the candidate."],
        ["Attaques disponibles et PP", "Available moves and PP"], ["Disponible", "Available"],
        ["Attaque imposée (Choice / Encore)", "Locked move (Choice / Encore)"],
        ["Historique et effets temporaires", "History and temporary effects"],
        ["Distorsion active", "Trick Room active"],
        ["Pics Toxik côté joueur", "Toxic Spikes on the player’s side"],
        ["Pics Toxik côté IA", "Toxic Spikes on the AI’s side"],
        ["1 couche", "1 layer"], ["2 couches", "2 layers"],
        ["Toile Gluante côté joueur", "Sticky Web on the player’s side"],
        ["Toile Gluante côté IA", "Sticky Web on the AI’s side"],
        ["Par défaut : premier tour, aucun effet temporaire coché, aucune protection précédente, attaques disponibles et réserves vivantes à 100 %. Renseignez ce qui a changé ; ces réglages ne modifient pas les données des trainers.", "Defaults: first turn, no temporary effects checked, no previous protection, moves available and living reserves at 100% HP. Enter any changes; these settings do not alter trainer data."],
        ["Joueur confus", "Player is confused"], ["Joueur sous Attraction", "Player is infatuated"],
        ["Joueur incapable d’attaquer ce tour", "Player cannot attack this turn"],
        ["Joueur derrière un Clonage", "Player has a Substitute"], ["IA derrière un Clonage", "AI has a Substitute"],
        ["IA sous Attraction", "AI is infatuated"], ["IA déjà transformée (Zen / Power Construct)", "AI already transformed (Zen Mode / Power Construct)"],
        ["IA peut relayer un effet favorable", "AI can pass a beneficial effect"], ["IA se réveille ce tour", "AI wakes up this turn"],
        ["Prescience / Vœu Destructeur déjà en attente", "Future Sight / Doom Desire already pending"],
        ["Joueur sous Salaison", "Player is affected by Salt Cure"], ["IA a déjà changé de type", "AI has already changed type"],
        ["IA résiste à la dernière attaque du joueur", "AI resists the player’s last move"],
        ["IA sous Vampigraine", "AI is Leech Seeded"], ["Joueur sous Vampigraine", "Player is Leech Seeded"],
        ["IA sous piège à dégâts", "AI is affected by a damaging trap"], ["Joueur sous piège à dégâts", "Player is affected by a damaging trap"],
        ["IA sous Malédiction spectre", "AI is affected by Ghost-type Curse"], ["Joueur sous Malédiction spectre", "Player is affected by Ghost-type Curse"],
        ["IA sous Requiem", "AI is affected by Perish Song"], ["Joueur sous Requiem", "Player is affected by Perish Song"],
        ["IA sous Bâillement", "AI is affected by Yawn"], ["Joueur sous Bâillement", "Player is affected by Yawn"],
        ["Joueur incapable de changer de Pokémon", "Player cannot switch Pokémon"], ["IA condamnée au KO en fin de tour", "AI will faint at the end of the turn"],
        ["IA a utilisé Boul’Armure", "AI has used Defense Curl"], ["IA a réussi une protection au tour précédent", "AI successfully protected last turn"],
        ["IA a verrouillé sa cible", "AI has locked on to its target"], ["L’attaque retardée frappe immédiatement", "The delayed move hits immediately"],
        ["Protections réussies d’affilée", "Consecutive successful protections"], ["Stockpile : charges de l’IA", "AI Stockpile count"],
        ["Dernière attaque du joueur", "Player’s last move"], ["Dernière attaque de l’IA", "AI’s last move"],
        ["ex. Surf", "e.g. Surf"], ["ex. Protect", "e.g. Protect"],
        ["Joueur : dernier Pokémon vivant", "Player: last living Pokémon"], ["IA : dernier Pokémon vivant", "AI: last living Pokémon"],
        ["Règles appliquées et hypothèses", "Applied rules and assumptions"], ["Documentation IA Pokémon Null", "Pokémon Null AI documentation"],
        ["Automatique", "Automatic"], ["Oui", "Yes"], ["Non", "No"], ["Aucune", "None"], ["Aucun", "None"],
        ["PV %", "HP %"], ["Actif", "Active"], ["indéterminé", "unknown"],
        ["Équipe inconnue : sélectionnez un set de trainer à droite pour identifier les réserves et leur ordre.", "Unknown team: select a trainer set on the right to identify the reserves and their order."],
        ["Aucun switch prévu.", "No switch expected."],
        ["Destination inconnue : équipe de trainer à sélectionner.", "Unknown destination: select a trainer team."],
        ["Probabilité de cette action, switch compris.", "Probability of this action, including switching."],
        ["Probabilité parmi les attaques, si l’IA attaque.", "Probability among moves, if the AI attacks."],
        ["Switch : contexte à compléter. Probabilités affichées parmi les attaques.", "Switch: more context needed. Probabilities are shown among moves."],
        ["Les pourcentages de dégâts restent indépendants des probabilités de choix. Les égalités de choix d’attaque sont départagées uniformément.", "Damage percentages are independent of move-choice probabilities. Tied move choices are resolved uniformly."],
        ["État de combat incomplet.", "Incomplete battle state."],
        ["Scénario imposé : l’IA reste en jeu", "Forced scenario: the AI stays in"],
        ["Switch en doubles : les deux créneaux et les quatre Pokémon actifs sont nécessaires.", "Switching in Doubles requires both slots and all four active Pokémon."],
        ["Choisir une équipe de trainer connue pour vérifier les Pokémon de réserve.", "Select a known trainer team to check reserve Pokémon."],
        ["Guaranteed switch-in — scénario imposé", "Guaranteed switch-in — forced scenario"],
        ["Une réserve valide est supposée disponible ; la cible est inconnue.", "A valid reserve is assumed available; the destination is unknown."],
        ["Probably switch — hypothèse personnalisée", "Probably switch — custom assumption"],
        ["Probabilité saisie par l’utilisateur, sans fréquence ajoutée à la documentation.", "User-entered probability; no frequency is added to the documentation."],
        ["Aucun Pokémon de réserve vivant pouvant entrer", "No living reserve Pokémon can enter"],
        ["Post-KO — remplacement forcé", "Post-KO — forced replacement"],
        ["Switch imposé par l’utilisateur pour simuler cette action.", "The user forced a switch to simulate this action."],
        ["Probabilité de switch saisie par l’utilisateur ; elle ne représente pas une fréquence mesurée du jeu.", "User-entered switch probability; it does not represent a measured in-game frequency."],
        ["Avoid Switch : possibilité de KO évaluée avec les dégâts moyens quand les jets se chevauchent.", "Avoid Switch: KO potential is evaluated using mean damage when rolls overlap."],
        ["La validité du switch-in dépend des seuils de score non chiffrés dans la documentation.", "Switch-in validity depends on score thresholds that are not quantified in the documentation."],
        ["Les attaques de statut ne sont pas toutes supposées inutiles ; préciser ce fait si nécessaire.", "Status moves are not all assumed useless; specify this if necessary."],
        ["L’expiration du climat / terrain n’a pas été renseignée.", "Weather / terrain expiration was not specified."],
        ["Palafin lent et OHKO — Guaranteed switch-in", "Slow Palafin facing an OHKO — Guaranteed switch-in"],
        ["Tous les switch-in ont un score négatif", "All switch-ins have a negative score"],
        ["Regenerator AI — 40 % (PV < 2/3)", "Regenerator AI — 40% (HP < 2/3)"],
        ["Immunity AI — 75 % (condition confirmée)", "Immunity AI — 75% (condition confirmed)"],
        ["Aucune condition de switch documentée activée", "No documented switch condition is active"],
        ["Plusieurs routines de switch s’appliquent : seule la première est utilisée. La source ne précise pas si un jet raté poursuit vers les routines suivantes.", "Several switch routines apply: only the first is used. The source does not specify whether a failed roll proceeds to later routines."],
        ["Première routine applicable dans l’ordre de priorité documenté ; égalités départagées par l’ordre de l’équipe sauf Anti-Setup.", "First applicable routine in documented priority order; ties follow team order except for Anti-Setup."],
        ["KO à l’entrée après les hazards.", "Faints on entry after hazards."],
        ["Seuils de nombre de coups absents de la source : course au KO et dégâts moyens utilisés pour estimer le score.", "Hits-to-KO thresholds are absent from the source: a KO race and mean damage are used to estimate the score."],
        ["Égalité de vitesse traitée comme le cas lent pour l’estimation du switch-in.", "Speed ties are treated as the slower case when estimating switch-ins."],
        ["Dégâts du joueur sur ce candidat non disponibles.", "Player damage against this candidate is unavailable."],
        ["Le malus de dégâts immédiats dépend du jet de dégâts.", "The immediate-damage penalty depends on the damage roll."],
        ["Bonus Support de 10 % supposés indépendants entre les candidats.", "The 10% Support bonuses are assumed independent across candidates."],
        ["Cette banque contient des Pokémon possibles, pas une équipe adverse certaine. Le switch automatique nécessite une équipe connue.", "This pool contains possible Pokémon, rather than a confirmed opposing team. Automatic switching requires a known team."],
        ["Les réserves sont supposées à 100 % de PV et disponibles, sauf KO marqué ou PV renseignés.", "Reserves are assumed available at 100% HP unless marked fainted or given remaining HP."],
        ["Les formes Mega du calculateur sont utilisées telles qu'affichées ; transformation à l'entrée non simulée.", "The calculator’s Mega forms are used as displayed; transformation on entry is not simulated."],
        ["La sélection des attaques Z/Max n'est pas documentée pour Null.", "Z/Max move selection is not documented for Null."],
        ["Dégâts multi-coups estimés selon le nombre de coups du calculateur et des rolls alignés.", "Multi-hit damage is estimated using the calculator’s hit count and aligned rolls."],
        ["Égalité de vitesse Analytic/Payback : dégâts du moteur utilisés pour l'estimation.", "Analytic/Payback speed tie: engine damage is used for the estimate."],
        ["Les vérifications aléatoires de score concurrentes sont supposées indépendantes ; le document public donne leurs probabilités sans leur loi aléatoire conjointe.", "Competing random score checks are treated as independent; the public document gives their odds without their joint RNG law."],
        ["Les positions des jets de dégâts sont équiprobables et tirées indépendamment pour chaque attaque ; les valeurs répétées conservent leur multiplicité.", "Damage-roll positions are equiprobable and rolled independently for each move; duplicate damage values retain their multiplicity."],
        ["Les longues distributions de dégâts ont été réduites à 16 quantiles pondérés pour garder le calcul réactif.", "Long damage supports were reduced to 16 weighted quantile points for responsive calculation."],
        ["Les effets de survie utilisent les dégâts du calculateur et Focus Sash/Sturdy à PV pleins pour les attaques à un coup ; la routine de survie interne exacte de l’IA n’est pas documentée.", "Survival effects use calculator damage and full-HP Focus Sash/Sturdy for single-hit moves; the exact internal AI survival routine is undocumented."],
        ["Les effets de survie utilisent les dégâts du calculateur et Focus Sash/Sturdy à PV pleins pour les attaques à un coup ; la vérification de survie interne exacte de l’IA n’est pas documentée.", "Survival effects use calculator damage and full-HP Focus Sash/Sturdy for single-hit moves; the exact internal AI survival check is undocumented."],
        ["Une vérification ambiguë du KO du joueur utilise la moyenne des jets de dégâts du calculateur.", "An ambiguous player KO check uses the mean of the calculator's damage rolls."],
        ["Une vérification ambiguë du nombre de coups pour mettre le joueur KO utilise les dégâts moyens du calculateur.", "An ambiguous player hits-to-KO check uses mean calculator damage."],
        ["Une vérification ambiguë du nombre de coups pour mettre l’IA KO utilise les dégâts moyens les plus élevés du calculateur.", "An ambiguous AI hits-to-KO check uses the strongest mean calculator damage."],
        ["Le boost des deux statistiques offensives utilise la catégorie d’attaque présente dans les attaques de l’IA pour ses vérifications de plafond et de boosts répétés.", "Dual-offense setup uses the attacking category present in the AI moveset to select its stat-cap and repeated-boost checks."],
        ["Doom Desire utilise la routine documentée de Future Sight car leur fonctionnement de dégâts retardés est commun.", "Doom Desire uses Future Sight's documented routine by shared delayed-damage behavior."],
        ["La décision de soin de Pain Split utilise son gain réel de PV partagés ; le document ne précise que son seuil d’éligibilité >30%.", "Pain Split's recovery decision uses its actual shared-HP gain; the document only specifies its >30% eligibility threshold."],
        ["Le seuil de dégâts ambigu du soin utilise les dégâts moyens du joueur.", "Recovery's ambiguous damage threshold uses mean player damage."],
        ["La vérification de survie ambiguë du soin utilise les dégâts moyens du joueur.", "Recovery's ambiguous survival check uses mean player damage."],
        ["Soin lent : les conditions <70% et <50% se chevauchent dans le document ; la condition <50%, plus précise, est appliquée en premier.", "Slow recovery: the document lists overlapping <70% and <50% conditions; the more specific <50% condition is applied first."],
        ["Le seuil ambigu de quatre coups des attaques drainantes utilise les dégâts moyens de l’attaque.", "Drain's ambiguous four-hit threshold uses mean move damage."],
        ["Heal Bell utilise la routine documentée d’Aromatherapy sur les statuts de l’équipe car leur effet de soin est commun.", "Heal Bell uses Aromatherapy's documented party-status routine by shared healing behavior."],
        ["La survie après boost utilise les dégâts entrants moyens, le coût en PV et un malus défensif approximatif de 1,5× pour Shell Smash ; les baies nécessitent une correction manuelle.", "Post-setup survival uses mean incoming damage, setup HP cost and Shell Smash's approximate 1.5× defensive penalty; berries require manual correction."],
        ["Le « +1 inconditionnel pour chaque autre statistique » de Psych Up/Spectral Thief est interprété dans la boucle des statistiques supérieures du joueur ; le document n’en précise pas la portée.", "Psych Up/Spectral Thief's 'unconditional +1 for every other stat' is interpreted inside the higher-player-stat loop; the document does not clarify that scope."],
        ["Les statistiques défensives pour Wonder Room sont absentes ; aucun bonus défensif n’est supposé.", "Wonder Room defensive stats are absent; no defensive-stat bonus is assumed."],
        ["Les scores des attaques utilisées de manière répétée sont traités comme une routine ajoutée à HDM ; leur cumul n’est pas précisé dans le document public.", "Repeated-use move scores are treated as an additional routine alongside HDM; their stacking is not clarified in the public document."],
        ["Données Pokémon manquantes.", "Missing Pokemon data."],
        ["En doubles, les quatre combattants et le score par cible sont nécessaires ; cet état est incomplet.", "Doubles require all four battlers and move-target scoring; this snapshot is incomplete."],
        ["Données de PV ou de vitesse invalides.", "Invalid HP or speed data."], ["Niveaux de statistiques invalides.", "Invalid stat stages."],
        ["Un Pokémon KO n’a pas de distribution de choix d’attaque pour ce duel.", "A fainted Pokemon has no move-choice distribution for this matchup."],
        ["Liste d’attaques adverses invalide.", "Invalid opposing moveset."], ["Données des attaques adverses incomplètes.", "Incomplete opposing move data."],
        ["Données de dégâts du joueur manquantes.", "Missing player damage data."],
        ["Vitesse du joueur après paralysie manquante.", "Missing predicted player speed after paralysis."],
        ["Un boost au plafond de la statistique nécessite la vérification exacte des attaques inutiles.", "Setup at the stat cap requires the exact useless-move check."],
        ["Nombre de Pokémon adverses invalide pour les hazards.", "Invalid opposing party counts for hazards."],
        ["La pénalité exacte d’une attaque de terrain inutile n’est pas précisée.", "The exact useless field-move penalty is not specified."],
        ["La vérification d’utilisation de Taunt est incomplète.", "Taunt usability check is incomplete."],
        ["Le score d’un effet de terrain répété n’est pas entièrement précisé.", "Repeated field-effect scoring is not fully specified."],
        ["Emplacement d’attaque imposée invalide.", "Invalid forced move slot."], ["Les PP restants doivent être un entier entre 0 et 64.", "Remaining PP must be an integer from 0 to 64."],
        ["Tous les dégâts sont inefficaces ; le document ne précise pas entièrement les scores des attaques inutiles.", "All damage is ineffective; the document does not exhaustively specify useless-move scoring."],
        ["Une attaque inefficace pourrait gagner ; sa pénalité exacte d’attaque inutile n’est pas précisée.", "An ineffective move could win; its exact useless-move penalty is not specified."],
        ["Le document ne précise pas la loi conjointe des vérifications aléatoires de score concurrentes.", "The documentation does not specify the joint law of competing random score checks."],
        ["La preuve des branches aléatoires dépasse la limite prise en charge.", "Random branch proof exceeds the supported limit."],
        ["La distribution de dégâts dépasse la limite prise en charge.", "Damage support exceeds the supported limit."],
        ["Masse de probabilité du choix d’attaque invalide.", "Invalid move-choice probability mass."]
    ];
    pairs = pairs.concat([
        ['Afficher uniquement les sets importés','Only show imported sets'],
        ['Uniquement l’équipe de ce trainer','Only this trainer’s team'],
        ['Seuls les sets importés sont proposés. Un partenaire existant hors du filtre reste sélectionné.','Only imported sets are offered. An existing partner outside the filter stays selected.'],
        ['Choisissez un trainer connu en bas pour filtrer son équipe ici.','Choose a known trainer below to filter its team here.'],
        ['Cette liste n’est pas une équipe confirmée ; les prévisions de remplacement restent indisponibles.','This list is not a confirmed party; replacement predictions remain unavailable.'],
        ['Doubles : renseignez les deux camps actifs pour identifier le créneau joueur correspondant au remplacement.','Doubles: complete both active sides to identify the replacement\'s matching player slot.'],
        ['IA doubles : quatre Pokémon actifs','Doubles AI: four active Pokémon'],
        ['Doubles : les types de cibles proviennent des métadonnées standard de Showdown lorsque les données Null les omettent ; puissances, effets et sets des trainers Null sont préservés.','Doubles: target kinds use standard Showdown metadata where the supplied Null move data omits them; Null power, effects and trainer sets are preserved.'],
        ['Doubles : les protections d’équipe et redirections par talent ne sont pas entièrement simulées ; vérifiez ces interactions manuellement.','Doubles: partner-wide protection and ability-based move redirection are not fully simulated; verify those interactions manually.'],
        ['Doubles : un utilisateur de Round plus rapide au créneau 2 peut remplacer le score précédent du créneau 1 ; cet effet rétroactif n’est pas reconstruit.','Doubles: a faster Round user in slot 2 can overwrite slot 1\'s previous score; this retroactive override is not reconstructed.'],
        ['Doubles : les KO incertains du partenaire pour les attaques de redirection utilisent les dégâts entrants maximaux.','Doubles: ambiguous partner KO checks for redirection moves use the maximum incoming damage.'],
        ['Choisissez les deux partenaires et leurs PV actuels. Les probabilités comparent les attaques ET les cibles. ≈ indique les hypothèses listées dans le volet IA ; le mode strict masque les prévisions non établies.','Select both partners and their current HP. Probabilities compare moves AND targets. ≈ indicates assumptions listed in the AI panel; strict mode hides unestablished predictions.'],
        ['Activer les prévisions en doubles','Enable doubles predictions'],['Votre camp','Your side'],['Camp du trainer','Trainer’s side'],
        ['Le joueur affiché à gauche occupe','Player shown on the left occupies'],['L’IA affichée à droite occupe','AI shown on the right occupies'],
        ['Action connue de l’IA affichée','Known action of the displayed AI'],['Votre autre Pokémon actif','Your other active Pokémon'],['L’autre Pokémon actif du trainer','Trainer’s other active Pokémon'],
        ['Partenaire actif','Active partner'],['Choisissez un partenaire…','Choose a partner…'],['Créneau vide / Pokémon KO','Empty / fainted slot'],['Créneau vide','Empty slot'],
        ['PV actuels (0 = KO)','Current HP (0 = fainted)'],['Statistiques, talent et objet','Stats, ability and item'],['Niveau','Level'],['Talent','Ability'],['Talent activé','Ability enabled'],['Objet','Item'],['Statut','Status'],
        ['Oui','Yes'],['Non','No'],['En bonne santé','Healthy'],['Paralysé','Paralyzed'],['Endormi','Asleep'],['Empoisonné','Poisoned'],['Gravement empoisonné','Badly poisoned'],['Brûlé','Burned'],['Gelé','Frozen'],
        ['Attaques, PP et disponibilité','Moves, PP and availability'],['Disponible','Available'],['Attaque imposée (Choice / Encore)','Forced move (Choice / Encore)'],['Aucune','None'],
        ['Action connue ce tour','Known action this turn'],['Prévision automatique','Predict automatically'],['Dernière attaque utilisée','Last move used'],['Premier tour en jeu','First turn on the field'],['Se réveille ce tour','Wakes up this turn'],
        ['Les probabilités attaque + cible ci-dessous supposent que ce Pokémon attaque. Les probabilités en haut incluent aussi son risque de switch lorsqu’il est connu.','Move + target probabilities below are conditional on this Pokémon attacking. The top move probabilities also include its switch risk when known.'],
        ['Attaque','Move'],['Cible(s)','Target(s)'],['Probabilité','Chance'],['Dégâts par cible','Damage by target'],['Soi-même','Self'],['Équipe / terrain','Team / field'],['Aucun choix attaque-cible utilisable.','No usable move-target choice.'],['Défense','Defense'],['Attaque (statistique)','Attack'],['Vitesse','Speed'],['Statistique','Stat'],['Boost','Boost'],
        ['Choisissez les deux partenaires actifs pour renseigner les quatre combattants.','Choose both active partners to provide all four battlers.'],['Le créneau IA sélectionné est KO.','The selected AI slot has fainted.'],['Aucune cible vivante côté joueur.','No living player target is available.'],
        ['PV, vitesse ou PP en doubles invalides.','Invalid doubles HP, speed or remaining PP.'],['Créneau d’attaque imposée ou connue invalide en doubles.','Invalid forced or known doubles move slot.'],
        ['Les deux créneaux adverses actifs ne peuvent pas utiliser la même place dans l’équipe du trainer.','The two opposing active slots cannot use the same trainer party slot.'],
        ['L’autre adversaire ne fait pas partie de l’équipe du trainer sélectionné ; les prévisions de remplacement nécessitent une équipe commune confirmée.','The other opponent is not part of the selected trainer party; replacement predictions require a confirmed shared party.'],
        ['Niveau ou PV du partenaire invalides.','Invalid partner level or HP.'],['IV, EV ou boost du partenaire invalide.','Invalid partner IV, EV or stat stage.'],['Les PV du partenaire dépassent son maximum ; actualisez les PV après avoir changé ses statistiques.','Partner HP exceeds its maximum; update Current HP after changing stats.'],
        ['Doubles : les dégâts multi-coups utilisent les jets alignés approximatifs du calculateur.','Doubles: multi-hit damage uses the calculator\'s approximated aligned rolls.'],
        ['Doubles : l’action inconnue du partenaire est supposée offensive lorsqu’il dispose d’une attaque de dégâts.','Doubles: unknown partner action is assumed damaging when a damaging move is available.'],
        ['Doubles : l’attaque répétée par Instruct est inconnue ; aucun bonus de zone supplémentaire n’est supposé.','Doubles: Instruct\'s instructed move is unknown; no additional spread bonus is assumed.'],
        ['Doubles : une attaque visant le partenaire sans bénéfice documenté reçoit la pénalité habituelle de -20 pour une attaque inutile.','Doubles: a partner-directed move without a documented benefit receives the usual -20 useless-move penalty.'],
        ['Doubles : les scores aléatoires et comparaisons de dégâts entre choix attaque-cible sont traités comme indépendants ; leur loi conjointe n’est pas documentée.','Doubles: random scores and damage comparisons across move-target choices are treated as independent; their joint RNG law is not documented.'],
        ['Doubles : une attaque de zone utilise une seule fois son meilleur score par adversaire ; le document ne précise pas comment agréger les scores de zone.','Doubles: a spread move uses its highest per-foe score once, without duplicating its target choice; the document does not specify spread-score aggregation.'],
        ['Doubles : une attaque de zone pouvant mettre son partenaire KO reçoit une pénalité estimée de -20.','Doubles: a spread move that can KO its ally receives an estimated -20 friendly-fire penalty.'],
        ['Doubles : les attaques visant soi-même ou le terrain prennent pour référence le joueur infligeant le plus de dégâts à l’utilisateur.','Doubles: self/field move scoring uses the player with the strongest damage against the user as its reference.'],
        ['Aucun choix attaque-cible utilisable ; Struggle est hors de ces quatre emplacements.','No usable move-target choice; Struggle is outside these four slots.'],
        ['L’action du créneau 1 est indisponible ; l’enchaînement de Round ne peut pas être établi.','Slot 1\'s selected move is unavailable; Round sequencing cannot be established.'],
        ['Doubles : le score de réserve compare les créneaux correspondants ; Avoid Switch vérifie les deux Pokémon du joueur. Les remplacements simultanés ne sont pas simulés.','Doubles: reserve scoring compares corresponding slots; Avoid Switch checks both player Pokémon. Simultaneous replacements are not simulated.'],
        ['Partenaire déjà actif : exclu','Already active partner: excluded'],
        ['Référence doubles mémorisée : les décisions IA utilisent vos deux Pokémon actifs avant le switch. Les dégâts en haut utilisent le Pokémon actuellement affiché. Revenez à Pokémon déjà actif pour actualiser la référence.','Doubles snapshot: AI decisions use the two player Pokémon active before your switch. Damage above uses the Pokémon currently displayed. Return to Already active to update the reference.']
    ]);
    pairs=pairs.concat([
        ["IA incapable de changer de Pokémon","AI cannot switch out"], ["IA enracinée (Ingrain)","AI rooted (Ingrain)"],
        ["Un talent empêche la fuite de l’IA","An ability prevents the AI from escaping"], ["Commander actif : switch interdit","Commander active: switching forbidden"], ["Cible dans un tour semi-invulnérable","Target on a semi-invulnerable turn"],
        ["Les switchs d’immunité utilisent le talent de la réserve et la dernière attaque du joueur, après les autres tentatives. Si l’actif possède déjà cette immunité, cette routine ne s’applique pas.","Immunity switches use the reserve's ability and the player's last move, after the other switch attempts. The active Pokémon already having that immunity prevents this routine."],
        ["Réserve déjà choisie pour l’autre créneau adverse","Reserve already chosen for the other opposing slot"], ["Aucune","None"],
        ["Attaque du joueur prédite par l’IA (attaques copiées)","Player move predicted by the AI (copy moves)"],
        ["Cette attaque prédite peut-elle être copiée ?","Can this predicted move be copied?"], ["Estimation automatique","Automatic estimate"], ["Autorisation confirmée","Confirmed allowed"], ["Interdiction confirmée","Confirmed banned"],
        ["Mirror Move, Copycat et Me First évaluent l’attaque prédite, pas la dernière attaque utilisée. Auto suppose l’attaque disponible la plus dommageable de la cible ; la prédiction et les restrictions non vérifiées sont indiquées comme estimations.","Mirror Move, Copycat and Me First evaluate the predicted move, not the last move used. Auto assumes the target's strongest available move; unverified prediction and copy restrictions are marked as estimates."],
        ["Objet de trainer pour ce tour","Trainer item for this turn"], ["Inventaire inconnu : probabilités conditionnelles à l’absence d’objet","Inventory unknown: probabilities conditional on no item"], ["Aucun objet de trainer utilisable","No usable trainer item"], ["Utilisation d’objet confirmée ce tour","Confirmed item use this turn"],
        ["Automatique : dernière attaque et talents des réserves","Automatic: last move and reserve abilities"], ["Vérifier le scénario d’immunité renseigné","Verify the entered immunity scenario"],
        ["Réservé pour l’autre créneau : exclu","Reserved for the other slot: excluded"],
        ["Hors des réserves de ce dresseur : exclu","Outside this trainer's reserve slots: excluded"],
        ["Probabilité en supposant qu’aucun objet de trainer n’est utilisé, switch inclus lorsqu’il est connu. ","Probability assuming no trainer item is used, switching included when known. "],
        ["Dégâts multi-coups estimés par le moteur ; le score natif utilise le profil sans variance.","Multihit damage is estimated by the engine; the native score uses damage without variance."],
        ["L’égalité de vitesse du score de réserve dépend du départage natif ; le score sans avantage de vitesse est utilisé.","Reserve speed ties depend on the native tie-break; a score without a speed advantage is used."],
        ["Le score natif ne désigne aucune réserve : le choix de repli après KO reste inconnu.","The native score selects no reserve: the post-KO fallback destination remains unknown."],
        ["Switch interdit par l’état du combat","Switching forbidden by the battle state"],
        ["Anti-Setup : les scores finaux aléatoires sont comparés au seuil natif de 95 ; leur loi conjointe est estimée.","Anti-Setup: random final scores are compared with the native threshold of 95; their joint law is estimated."],
        ["Anti-Setup : scores finaux non disponibles ; renseigner la condition pour ce scénario.","Anti-Setup: final scores unavailable; enter the condition for this scenario."],
        ["Absorption de la dernière attaque","Absorbing the last move"],
        ["La dernière attaque doit être identifiée pour évaluer les switchs d’immunité.","Identify the last move to evaluate immunity switches."],
        ["Confirmation Immunity : renseigner la dernière attaque ; la destination dépend du talent de la réserve.","Immunity confirmation: enter the last move; the destination depends on the reserve's ability."],
        ["Routines C successives : un tirage raté poursuit vers la suite ; les tirages sont estimés avec les probabilités documentaires arrondies.","Successive C routines: a failed roll continues to the next check; rolls use rounded documented probability estimates."],
        ["Doubles : les réserves déjà actives ou déjà choisies pour l’autre créneau sont exclues ; le classement compare le vis-à-vis du créneau.","Doubles: reserves already active or selected for the other slot are excluded; ranking compares the slot's opposing battler."],
        ["Ordre des routines du C ; maximum de score puis ordre d’équipe, avec remplacement séquentiel à 50 % lors des égalités Anti-Setup.","C routine order; highest score then party order, with sequential 50% replacement for Anti-Setup ties."],
        ["Attaque copiée : l’action prédite du joueur est estimée ; renseignez l’attaque prédite pour confirmer le scénario.","Copied move: the predicted player action is an estimate; set the predicted move to confirm the scenario."],
        ["Les drapeaux interdisant la copie ne sont pas décodés dans cette ROM ; l’estimation utilise les restrictions documentées.","Copied move ban flags are not decoded from this ROM; ordinary copy eligibility uses the documented move restrictions."],
        ["L’inventaire du trainer est inconnu : les probabilités d’attaque et de switch supposent qu’aucun objet n’est utilisé.","Trainer inventory is unknown: move and switch probabilities are conditional on no trainer item being used."],
        ["L’utilisation d’un objet de trainer est un scénario confirmé par l’utilisateur ; l’inventaire n’est pas décodé dans la ROM.","Trainer item use is a confirmed scenario supplied by the user; inventory is not decoded from the ROM."],
        ["L’attaque prédite doit appartenir au set actuel de la cible.","The predicted player move must belong to the target's current move set."]
    ]);
    pairs.push(["Aucune réserve admissible : les Pokémon restants sont réservés ou hors des créneaux de ce trainer.","No eligible reserve: remaining Pokémon are reserved or outside this trainer's party slots."]);
    pairs.push(["Cette combinaison de flags IA de trainer n’est pas implémentée ; le profil documentaire ne peut pas certifier son choix natif.","This trainer's AI flag combination is not implemented; the documentary profile cannot certify its native move choice."]);
    pairs.push(["L’autorisation de copie n’est pas vérifiée ; cette estimation suppose l’attaque prédite autorisée. Confirmez la restriction de ce scénario.","Copy eligibility is unverified; this estimate assumes the predicted move is allowed. Confirm the restriction for this scenario."]);
    pairs.push(["Inventaire inconnu (aucun objet supposé)","Unknown inventory (assume no item)"]);
    pairs.push(["La survie après placement estime la fonction native manquante avec les dégâts entrants moyens, le coût entier en PV et une baie de soin immédiatement activable ; l’ordre du tour et les dégâts résiduels suivants ne sont pas simulés.", "Post-setup survival estimates the missing native helper with mean incoming damage, integer HP cost and an immediately eligible healing berry; turn order and later residual damage are not simulated."]);
    pairs.push(["Après Shell Smash, les dégâts utilisent un multiplicateur défensif approximatif tenant compte de White Herb et Contrary.", "Shell Smash's post-setup damage uses an approximate defensive multiplier, with White Herb and Contrary taken into account."]);
    var exact = { en: Object.create(null), fr: Object.create(null) };
    pairs.forEach(function(pair) { exact.en[pair[0]] = pair[1]; exact.fr[pair[1]] = pair[0]; });
    // Patterns preserve dynamic Pokémon/trainer names, move names and numbers.
    var patterns = [
        [/^Placement risqué : PV estimés après (.+) : (\d+)\/(\d+)$/, 'Risky setup: Estimated HP after $1: $2/$3', /^Risky setup: Estimated HP after (.+): (-?\d+)\/(\d+)$/, 'Placement risqué : PV estimés après $1 : $2/$3'],
        [/^Placement risqué : (.+) rend (\d+) PV(.*)$/, 'Risky setup: $1 restores $2 HP$3', /^Risky setup: (.+) restores (\d+) HP(.*)$/, 'Placement risqué : $1 rend $2 PV$3'],
        [/^Donnée numérique de trainer invalide : (.+)\.$/, 'Invalid trainer numeric data: $1.', /^Invalid trainer numeric data: (.+)\.$/, 'Donnée numérique de trainer invalide : $1.'],
        [/^Trainer : (.+)\. Sélectionnez l’autre Pokémon réellement sur le terrain\.$/, 'Trainer: $1. Select the other Pokémon actually on the field.', /^Trainer: (.+)\. Select the other Pokémon actually on the field\.$/, 'Trainer : $1. Sélectionnez l’autre Pokémon réellement sur le terrain.'],
        [/^Remplacement en doubles : le créneau IA (\d+) est évalué face au créneau joueur (\d+) \((.+)\)\. L’autre adversaire actif est exclu\. Les PV du combat restent inchangés\.$/, 'Doubles replacement: AI slot $1 is evaluated against player slot $2 ($3). The other active opponent is excluded. Battle HP stays unchanged.', /^Doubles replacement: AI slot (\d+) is evaluated against player slot (\d+) \((.+)\)\. The other active opponent is excluded\. Battle HP stays unchanged\.$/, 'Remplacement en doubles : le créneau IA $1 est évalué face au créneau joueur $2 ($3). L’autre adversaire actif est exclu. Les PV du combat restent inchangés.'],
        [/^Créneau (\d+)(.*)$/, 'Slot $1$2', /^Slot (\d+)(.*)$/, function(m,n,rest){return 'Créneau '+n+rest.replace('Main calculator','Calculateur principal').replace('Partner','Partenaire');}],
        [/^IA créneau (\d+) — (.+)$/, 'AI slot $1 — $2', /^AI slot (\d+) — (.+)$/, 'IA créneau $1 — $2'],
        [/^PV max : (\d+) · Vitesse : (\d+)$/, 'Max HP: $1 · Speed: $2', /^Max HP: (\d+) · Speed: (\d+)$/, 'PV max : $1 · Vitesse : $2'],
        [/^PV (\d+)\/(\d+) · Vitesse (\d+)$/, 'HP $1/$2 · Speed $3', /^HP (\d+)\/(\d+) · Speed (\d+)$/, 'PV $1/$2 · Vitesse $3'],
        [/^Créneau joueur (\d+) : (.+)$/, 'Player slot $1: $2', /^Player slot (\d+): (.+)$/, 'Créneau joueur $1 : $2'],
        [/^Partenaire : (.+)$/, 'Ally: $1', /^Ally: (.+)$/, 'Partenaire : $1'],
        [/^Tous les Pokémon affectés : (.+)$/, 'All affected Pokémon: $1', /^All affected Pokémon: (.+)$/, 'Tous les Pokémon affectés : $1'],
        [/^Unsupported doubles target kind for (.+): (.+)$/, null, /^Unsupported doubles target kind for (.+): (.+)$/, 'Type de cible en doubles non pris en charge pour $1 : $2'],
        [/^No further opponent-target routine is described for (.+); only the document's general status base score and known usability checks are applied\.$/,null,/^No further opponent-target routine is described for (.+); only the document's general status base score and known usability checks are applied\.$/,'Aucune autre routine visant l’adversaire n’est décrite pour $1 ; seuls le score de base général des attaques de statut et les vérifications d’utilisation connues sont appliqués.'],
        [/^Après le KO de (.+) — face à (.+) — (.+)$/, "After $1 faints — against $2 — $3", /^After (.+) faints — against (.+) — (.+)$/, "Après le KO de $1 — face à $2 — $3"],
        [/^(≈ )?([\d.]+ %) après KO(.*)$/, "$1$2 after KO$3", /^(≈ )?([\d.]+ %) after KO(.*)$/, "$1$2 après KO$3"],
        [/^Restaurer (.+)$/, "Restore $1", /^Restore (.+)$/, "Restaurer $1"],
        [/^Marquer KO : (.+)$/, "Mark KO: $1", /^Mark KO: (.+)$/, "Marquer KO : $1"],
        [/^PV (.+) · Speed (.+) · Hazards (.+)$/, "HP $1 · Speed $2 · Hazards $3", /^HP (.+) · Speed (.+) · Hazards (.+)$/, "PV $1 · Speed $2 · Hazards $3"],
        [/^(Guaranteed switch-in|No switch|Probably switch) : (.+) — (.+)$/, function(m, title, pct, rule) { return title + ": " + pct + " — " + translate(rule); }, /^(Guaranteed switch-in|No switch|Probably switch): (.+) — (.+)$/, function(m, title, pct, rule) { return title + " : " + pct + " — " + translate(rule); }],
        [/^Attaque (\d+)( — PP)?$/, function(m, n, pp) { return "Move " + n + (pp || ""); }, /^Move (\d+)( — PP)?$/, function(m, n, pp) { return "Attaque " + n + (pp || ""); }],
        [/^PP restants de l’attaque (\d+)$/, "Remaining PP for move $1", /^Remaining PP for move (\d+)$/, "PP restants de l’attaque $1"],
        [/^PV restants en pourcentage de (.+)$/, "Remaining HP percentage for $1", /^Remaining HP percentage for (.+)$/, "PV restants en pourcentage de $1"],
        [/^Réserves : (.+)$/, function(m, name) { return "Reserves: " + (name === "équipe sélectionnée" ? "selected team" : name); }, /^Reserves: (.+)$/, function(m, name) { return "Réserves : " + (name === "selected team" ? "équipe sélectionnée" : name); }],
        [/^Réserve (.+) non calculable : (.*)$/, function(m, name, error) { return "Cannot calculate reserve " + name + ": " + translate(error); }, /^(?:Cannot calculate reserve (.+): |Réserve (.+) non calculable : )(.*)$/, function(m, englishName, frenchName, error) { return "Réserve " + (englishName || frenchName) + " non calculable : " + translate(error); }],
        [/^Pokémon actif mémorisé : (.+)\. Dégâts sur l’entrant affiché à gauche ; décisions IA basées sur (.+)\. Revenez à Pokémon déjà actif pour actualiser la référence\.$/, "Remembered active Pokémon: $1. Damage is calculated against the incoming Pokémon shown on the left; AI decisions are based on $2. Return to Currently active Pokémon to update the reference.", /^Remembered active Pokémon: (.+)\. Damage is calculated against the incoming Pokémon shown on the left; AI decisions are based on (.+)\. Return to Currently active Pokémon to update the reference\.$/, "Pokémon actif mémorisé : $1. Dégâts sur l’entrant affiché à gauche ; décisions IA basées sur $2. Revenez à Pokémon déjà actif pour actualiser la référence."],
        [/^Aucune destination disponible(.*)\.$/, "No destination available$1.", /^No destination available(.*)\.$/, "Aucune destination disponible$1."],
        [/^Destinations possibles(.*) : probabilités non établies\.$/, "Possible destinations$1: probabilities not established.", /^Possible destinations(.*): probabilities not established\.$/, "Destinations possibles$1 : probabilités non établies."],
        [/^(Destinations si switch|Destination prévue|Destinations prévues)(.*) :$/, function(m, title, trainer) { return ({"Destinations si switch":"Destinations if switching", "Destination prévue":"Expected destination", "Destinations prévues":"Expected destinations"})[title] + trainer + ":"; }, /^(Destinations if switching|Expected destination|Expected destinations)(.*):$/, function(m, title, trainer) { return ({"Destinations if switching":"Destinations si switch", "Expected destination":"Destination prévue", "Expected destinations":"Destinations prévues"})[title] + trainer + " :"; }],
        [/^(.+) — score possible (.+) à (.+)$/, "$1 — possible score $2 to $3", /^(.+) — possible score (.+) to (.+)$/, "$1 — score possible $2 à $3"],
        [/^(Score .+; switch into : |.+ — )(.+)( si switch)( \(.+ du tour\))?$/, function(m, prefix, pct, ignored, total) { return prefix.replace("; switch into : ", "; switch into: ") + translate(pct) + " if switching" + (total ? total.replace(" du tour)", " of the turn)") : ""); }, /^(Score .+; switch into: |.+ — )(.+)( if switching)( \(.+ of the turn\))?$/, function(m, prefix, pct, ignored, total) { return prefix.replace("; switch into: ", "; switch into : ") + translate(pct) + " si switch" + (total ? total.replace(" of the turn)", " du tour)") : ""); }],
        [/^IA: (.*)$/, function(m, pct) { return "AI: " + translate(pct); }, /^AI: (.*)$/, function(m, pct) { return "IA: " + translate(pct); }],
        [/^Battle context (.+) was not entered; using (.+)\.$/, null, /^Battle context (.+) was not entered; using (.+)\.$/, "Contexte de combat $1 non renseigné ; valeur utilisée : $2."],
        [/^Hazard state for (.+) was not entered; assuming no existing layers\.$/, null, /^Hazard state for (.+) was not entered; assuming no existing layers\.$/, "Hazards de $1 non renseignés ; aucune couche existante supposée."],
        [/^Damage support for (.+) uses the calculator's approximated multi-hit routine\.$/, null, /^Damage support for (.+) uses the calculator's approximated multi-hit routine\.$/, "Les dégâts de $1 utilisent la routine multi-coups approximative du calculateur."],
        [/^Missing AI damage support for (.+)\.$/, null, /^Missing AI damage support for (.+)\.$/, "Distribution de dégâts IA manquante pour $1."],
        [/^Incomplete or unsupported Null routine: (.+)\.$/, null, /^Incomplete or unsupported Null routine: (.+)\.$/, "Routine Null incomplète ou non prise en charge : $1."],
        [/^Copied move must be identified and scored using its own Null routine: (.+)\.$/, "$1: the calculator does not yet evaluate the copied move; probabilities for all usable moves are unavailable.", /^Copied move must be identified and scored using its own Null routine: (.+)\.$/, "$1 : le calculateur n’évalue pas encore l’attaque copiée ; les probabilités de toutes les attaques disponibles sont indéterminées."],
        [/^The guaranteed secondary routine is unknown for (.+)\.$/, null, /^The guaranteed secondary routine is unknown for (.+)\.$/, "La routine secondaire garantie est inconnue pour $1."],
        [/^Unverified Null move effect: (.+)\.$/, null, /^Unverified Null move effect: (.+)\.$/, "Effet d’attaque Null non vérifié : $1."],
        [/^No additional secondary-effect score is described for (.+); the documented \+6 base outside HDM is used\.$/, null, /^No additional secondary-effect score is described for (.+); the documented \+6 base outside HDM is used\.$/, "Aucun score secondaire supplémentaire n’est décrit pour $1 ; la base +6 documentée hors HDM est utilisée."],
        [/^No further Singles routine is described for (.+); only the document's general status base score and known usability checks are applied\.$/, null, /^No further Singles routine is described for (.+); only the document's general status base score and known usability checks are applied\.$/, "Aucune autre routine en simple n’est décrite pour $1 ; seuls le score de base général des attaques de statut et les vérifications d’utilisation connues sont appliqués."],
        [/^A guaranteed secondary effect has no verified mapping for (.+); its ordinary damage score is used\.$/, null, /^A guaranteed secondary effect has no verified mapping for (.+); its ordinary damage score is used\.$/, "Aucune correspondance vérifiée de l’effet secondaire garanti pour $1 ; son score de dégâts ordinaire est utilisé."],
        [/^The document describes a usual -20 useless-move penalty; applying it to (.+)\.$/, null, /^The document describes a usual -20 useless-move penalty; applying it to (.+)\.$/, "Le document décrit une pénalité habituelle de -20 pour une attaque inutile ; elle est appliquée à $1."],
        [/^Réserves appartenant à : (.+)$/, "Reserves belong to: $1", /^Reserves belong to: (.+)$/, "Réserves appartenant à : $1"],
        [/^Strict mode cannot certify approximated state\/damage: (.+)$/, null, /^Strict mode cannot certify approximated state\/damage: (.+)$/, function(m, reason) { return "Le mode strict ne peut pas certifier cet état ou ces dégâts approximatifs : " + translate(reason); }]
    ];
    // Long fragments also translate joined explanations and probability tooltips.
    var fragments = pairs.filter(function(pair) { return pair[0].length > 35 && pair[1].length > 35; }).sort(function(a, b) { return Math.max(b[0].length, b[1].length) - Math.max(a[0].length, a[1].length); });
    function translate(source) {
        var text = String(source), trimmed = text.trim(), leading = text.match(/^\s*/)[0], trailing = text.match(/\s*$/)[0];
        if (Object.prototype.hasOwnProperty.call(exact[language], trimmed)) return leading + exact[language][trimmed] + trailing;
        for (var i = 0; i < patterns.length; i++) {
            var index = language === "en" ? 0 : 2, pattern = patterns[i];
            if (pattern[index + 1] !== null && pattern[index].test(trimmed)) return leading + trimmed.replace(pattern[index], pattern[index + 1]) + trailing;
        }
        fragments.forEach(function(pair) { var from = language === "en" ? pair[0] : pair[1], to = language === "en" ? pair[1] : pair[0]; text = text.split(from).join(to); });
        if (language === "en") text = text.replace(/\bindéterminé\b/g, "unknown");
        return text;
    }
    // Remember each original text node/attribute so changing language is reversible
    // and never rebuilds inputs, reserves, open sections or the Switch into snapshot.
    var textSources = new WeakMap(), attributeSources = new WeakMap();
    function localize(element) {
        var walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT), node;
        while ((node = walker.nextNode())) {
            var record = textSources.get(node);
            if (!record || node.nodeValue !== record.last) record = { source: node.nodeValue };
            node.nodeValue = record.last = translate(record.source); textSources.set(node, record);
        }
        [element].concat(Array.from(element.querySelectorAll("[title], [aria-label], [placeholder]"))).forEach(function(el) {
            var records = attributeSources.get(el) || {};
            ["title", "aria-label", "placeholder"].forEach(function(name) {
                if (!el.hasAttribute(name)) return;
                var value = el.getAttribute(name), record = records[name];
                if (!record || value !== record.last) record = { source: value };
                el.setAttribute(name, record.last = translate(record.source)); records[name] = record;
            });
            attributeSources.set(el, records);
        });
        element.setAttribute("lang", language);
    }
    function refresh() {
        document.querySelectorAll("#null-ai-context, #null-double-context, #null-ai-action-summary, #null-ai-switch-destination, #null-post-ko, .null-ai-probability").forEach(localize);
        var picker = document.getElementById("null-ai-language"); if (picker) picker.value = language;
    }
    function setLanguage(value) {
        language = value === "fr" ? "fr" : "en";
        try { root.localStorage.setItem(STORAGE_KEY, language); } catch (_) {}
        refresh();
    }
    root.NullAI18n = { translate: translate, refresh: refresh, setLanguage: setLanguage, getLanguage: function() { return language; } };
    $(document).on("change.nullAI18n", "#null-ai-language", function() { setLanguage(this.value); });
    $(refresh);
})(window);
