/**
 * Pokémon Null — Suivi de run automatique (Google Sheets) — v2
 * ============================================================
 * • Reçoit la run envoyée par le calculateur (onglet « Suivi de run »).
 * • Importe et met à jour chaque semaine les données OFFICIELLES de Null
 *   (rencontres + taux, objets, dresseurs) depuis le Drive du jeu.
 * • Calcule tout seul : zones déjà capturées, espèces déjà possédées,
 *   dresseurs battus, prochain dresseur, frags / leads / combats.
 *
 * Installation : google-sheets/INSTALLATION.md
 * Aucune formule n'est utilisée : la feuille marche quelle que soit sa langue.
 */

// ------------------------------------------------------------ Paramètres
var SOURCES = {
  encounters: '1EdJf2JRe5dLPEX1vWmbeRFeCIh-7hgos-t52JQd1Xb8',  // Pokémon Locations (officiel)
  items: '1ForxCI9BczgfLYHEOTd-3Cg4tEa3Nn_VNk5nx-OLedo',       // Item Locations (officiel)
  trainers: '1ack17Gkn_sRG94HD9CP2UE0NcJ0RZz8FvBf6OgRxDMI',    // Colour Coded Trainer Battles - Null V1.2
  trainersFallback: '1mwHPt0AMzOJ_hfmDrVZpKP-Hf4eTT0ROhY8Wa7bY7r8' // Trainer Battles (officiel), si le premier est inaccessible
};
var TRAINER_SHEETS = [['Roxanne Split', 'Roxanne'], ['Brawly Split', 'Brawly'], ['Wattson Split', 'Wattson'], ['Norman Split', 'Norman'],
  ['Flannery Split', 'Flannery'], ['Winona Split', 'Winona'], ['Tate&Liza Split', 'Tate & Liza'], ['Steven Split', 'Steven'],
  ['Victory Road Split', 'Victory Road'], ['Pokémon League', 'Ligue'], ['Other', 'Autres']];
var SPLITS = TRAINER_SHEETS.map(function(t) { return t[1]; });
var SHEETS = { run: '🏠 Run', pokemon: '🐾 Pokémon', fights: '⚔️ Combats', encounters: '🌿 Rencontres', trainers: '🎯 Dresseurs', items: '🎒 Objets', archive: '📦 Archives',
  encData: '⚙️ Données rencontres', trainerData: '⚙️ Données dresseurs', trainerPics: '⚙️ Images dresseurs', itemData: '⚙️ Données objets' };
var LEGACY_NAMES = { 'Run': 'run', 'Pokémon': 'pokemon', 'Combats': 'fights' };

var AUTO_HEADERS = ['UID', '#', 'Zone', 'Sprite', 'Pokémon', 'Nom', 'Niveau', 'Statut', 'Talent', 'Nature',
  'IV PV', 'IV Atq', 'IV Déf', 'IV AtS', 'IV DéS', 'IV Vit', 'Moy. IV', 'Type PC', 'Objet', 'Attaques', 'Nv capture'];
var MANUAL_HEADERS = ['Mort contre'];
var STAT_HEADERS = ['Frags', 'Leads', 'Combats'];
var SYNC_HEADER = 'Dernière synchro';
var COL = { uid: 1, order: 2, zone: 3, sprite: 4, species: 5, name: 6, level: 7, status: 8, iv: 11, deathCause: 22, frags: 23, leads: 24, fights: 25, splits: 26 };
COL.sync = COL.splits + SPLITS.length;
var FIGHT_ROWS = 1000;
var FIGHT_HEADERS = ['Dresseur', 'Split', 'Lead', 'Frags', 'Pokémon 2', 'Frags', 'Pokémon 3', 'Frags', 'Pokémon 4', 'Frags', 'Pokémon 5', 'Frags', 'Pokémon 6', 'Frags', 'Notes'];
// Données brutes (onglets cachés) ; les onglets visibles 🎯 Dresseurs et 🌿 Rencontres sont des tableaux dessinés à partir d'elles.
var ENC_HEADERS = ['Zone', 'Zone Nuzlocke', 'Méthode', 'Pokémon', 'Niveau', 'Taux'];
var TRAINER_HEADERS = ['Split', 'Lieu', 'Dresseur', '#', 'Pokémon', 'Niv.', 'Objet', 'Talent', 'Nature', 'Attaques', 'Niv. max', 'Conditions', 'Couleurs', 'Image dresseur'];
var TCOL = { name: 3, species: 5, level: 6, item: 7, ability: 8, nature: 9, moves: 10, maxLevel: 11, conditions: 12, colors: 13, pic: 14 };
// Mises en évidence du doc « Colour Coded » (ses règles de mise en forme conditionnelle) : « *x » = se termine par x.
var DOC_HIGHLIGHTS = {"#ea9999": ["*of Ruin", "Sniper", "Unnerve", "Armor Tail", "Dazzling", "Queenly Majesty", "Quick Draw", "Shadow Tag", "Moody", "Serene Grace", "Stench", "Snow Cloak", "Sand Veil", "Innards Out", "of Ruin", "Stakeout", "Dancer", "Friend Guard"], "#d5a6bd": ["Belly Drum", "Explosion", "Misty Explosion", "Destiny Bond", "Pursuit", "Shell Smash", "Minimize", "Perish Song", "Revival Blessing", "Double Team", "Self-Destruct"], "#f9cb9c": ["Bright Powder", "Focus Band", "Quick Claw", "Scope Lens", "Weakness Policy", "Custap Berry", "King's Rock", "Berserk Gene", "Grip Claw", "Blunder Policy", "Binding Band"]};
var HIGHLIGHT_LEGEND = [['#ea9999', 'Talent à surveiller'], ['#f9cb9c', 'Objet à surveiller'], ['#d5a6bd', 'Attaque à surveiller'], ['#ffe599', 'Lead en double'], ['#4285f4', 'Pokémon de soutien']];
// Catégories d'objets dans l'ordre d'affichage ; dans chaque catégorie, l'ordre du doc officiel (ordre d'obtention).
var ITEM_CATEGORIES = ['Objet tenu', 'Baie', 'Méga-gemme', 'Objet spécial', 'Mémoire', 'Objet d\'évolution', 'CT / CS', 'CT rachetable', 'Tuteur', 'Menthe', 'Ressource', 'Écaille Cœur', 'Boutique de la Ligue', 'Objet sauvage'];
var ITEM_DATA_HEADERS = ['Catégorie', 'Objet', 'Lieu / info', 'Ligne', 'Colonne'];
// Icônes d'objets : celles du jeu (numéro d'objet Null, dossier docs/img/items du dépôt), sinon PokeAPI.
var ITEM_ICON_BASE = 'https://raw.githubusercontent.com/babouetche/claude-app/claude/busy-shannon-0cne71/null-calc/docs/img/items/';
var ITEM_ICON_FALLBACK = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/';
var ITEM_ICON_IDS = {"pokeball":1,"greatball":2,"ultraball":3,"masterball":4,"premierball":5,"healball":6,"netball":7,"nestball":8,"diveball":9,"duskball":10,"timerball":11,"quickball":12,"repeatball":13,"luxuryball":14,"levelball":15,"lureball":16,"moonball":17,"friendball":18,"loveball":19,"fastball":20,"heavyball":21,"dreamball":22,"safariball":23,"sportball":24,"parkball":25,"beastball":26,"cherishball":27,"berryjuice":53,"bottlecap":133,"rarebone":154,"helixfossil":165,"domefossil":166,"oldamber":167,"rootfossil":168,"clawfossil":169,"armorfossil":170,"skullfossil":171,"coverfossil":172,"plumefossil":173,"jawfossil":174,"sailfossil":175,"fossilizedbird":176,"fossilizedfish":177,"fossilizeddrake":178,"fossilizeddino":179,"mail":199,"firestone":211,"waterstone":212,"thunderstone":213,"leafstone":214,"icestone":215,"sunstone":216,"moonstone":217,"shinystone":218,"duskstone":219,"dawnstone":220,"sweetapple":221,"tartapple":222,"crackedpot":223,"chippedpot":224,"dragonscale":227,"upgrade":228,"protector":229,"electirizer":230,"magmarizer":231,"dubiousdisc":232,"reapercloth":233,"prismscale":234,"whippeddream":235,"sachet":236,"ovalstone":237,"strawberrysweet":238,"lovesweet":239,"berrysweet":240,"cloversweet":241,"flowersweet":242,"starsweet":243,"ribbonsweet":244,"flameplate":250,"splashplate":251,"zapplate":252,"meadowplate":253,"icicleplate":254,"fistplate":255,"toxicplate":256,"earthplate":257,"skyplate":258,"mindplate":259,"insectplate":260,"stoneplate":261,"spookyplate":262,"dracoplate":263,"dreadplate":264,"ironplate":265,"pixieplate":266,"dousedrive":267,"shockdrive":268,"burndrive":269,"chilldrive":270,"firememory":271,"watermemory":272,"electricmemory":273,"grassmemory":274,"icememory":275,"fightingmemory":276,"poisonmemory":277,"groundmemory":278,"flyingmemory":279,"psychicmemory":280,"bugmemory":281,"rockmemory":282,"ghostmemory":283,"dragonmemory":284,"darkmemory":285,"steelmemory":286,"fairymemory":287,"rustedsword":288,"rustedshield":289,"redorb":290,"blueorb":291,"venusaurite":292,"charizarditex":293,"charizarditey":294,"blastoisinite":295,"beedrillite":296,"pidgeotite":297,"alakazite":298,"slowbronite":299,"gengarite":300,"kangaskhanite":301,"pinsirite":302,"gyaradosite":303,"aerodactylite":304,"mewtwonitex":305,"mewtwonitey":306,"ampharosite":307,"steelixite":308,"scizorite":309,"heracronite":310,"houndoominite":311,"tyranitarite":312,"sceptilite":313,"blazikenite":314,"swampertite":315,"gardevoirite":316,"sablenite":317,"mawilite":318,"aggronite":319,"medichamite":320,"manectite":321,"sharpedonite":322,"cameruptite":323,"altarianite":324,"banettite":325,"absolite":326,"glalitite":327,"salamencite":328,"metagrossite":329,"latiasite":330,"latiosite":331,"lopunnite":332,"garchompite":333,"lucarionite":334,"abomasite":335,"galladite":336,"audinite":337,"diancite":338,"normalgem":339,"firegem":340,"watergem":341,"electricgem":342,"grassgem":343,"icegem":344,"fightinggem":345,"poisongem":346,"groundgem":347,"flyinggem":348,"psychicgem":349,"buggem":350,"rockgem":351,"ghostgem":352,"dragongem":353,"darkgem":354,"steelgem":355,"fairygem":356,"normaliumz":357,"firiumz":358,"wateriumz":359,"electriumz":360,"grassiumz":361,"iciumz":362,"fightiniumz":363,"poisoniumz":364,"groundiumz":365,"flyiniumz":366,"psychiumz":367,"buginiumz":368,"rockiumz":369,"ghostiumz":370,"dragoniumz":371,"darkiniumz":372,"steeliumz":373,"fairiumz":374,"pikaniumz":375,"eeviumz":376,"snorliumz":377,"mewniumz":378,"decidiumz":379,"inciniumz":380,"primariumz":381,"lycaniumz":382,"mimikiumz":383,"kommoniumz":384,"tapuniumz":385,"solganiumz":386,"lunaliumz":387,"marshadiumz":388,"aloraichiumz":389,"pikashuniumz":390,"ultranecroziumz":391,"lightball":392,"leek":393,"thickclub":394,"luckypunch":395,"metalpowder":396,"quickpowder":397,"deepseascale":398,"deepseatooth":399,"souldew":400,"adamantorb":401,"lustrousorb":402,"griseousorb":403,"seaincense":404,"laxincense":405,"oddincense":406,"rockincense":407,"fullincense":408,"waveincense":409,"roseincense":410,"machobrace":418,"powerweight":419,"powerbracer":420,"powerbelt":421,"powerlens":422,"powerband":423,"poweranklet":424,"silkscarf":425,"charcoal":426,"mysticwater":427,"magnet":428,"miracleseed":429,"nevermeltice":430,"blackbelt":431,"poisonbarb":432,"softsand":433,"sharpbeak":434,"twistedspoon":435,"silverpowder":436,"hardstone":437,"spelltag":438,"dragonfang":439,"blackglasses":440,"metalcoat":441,"choiceband":442,"choicespecs":443,"choicescarf":444,"flameorb":445,"toxicorb":446,"damprock":447,"heatrock":448,"smoothrock":449,"icyrock":450,"electricseed":451,"psychicseed":452,"mistyseed":453,"grassyseed":454,"absorbbulb":455,"cellbattery":456,"luminousmoss":457,"snowball":458,"brightpowder":459,"whiteherb":460,"quickclaw":462,"mentalherb":464,"kingsrock":465,"focusband":469,"scopelens":471,"leftovers":472,"shellbell":473,"widelens":474,"muscleband":475,"wiseglasses":476,"expertbelt":477,"lightclay":478,"lifeorb":479,"powerherb":480,"focussash":481,"zoomlens":482,"metronome":483,"ironball":484,"laggingtail":485,"destinyknot":486,"blacksludge":487,"gripclaw":488,"stickybarb":489,"shedshell":490,"bigroot":491,"razorclaw":492,"razorfang":493,"eviolite":494,"floatstone":495,"rockyhelmet":496,"airballoon":497,"redcard":498,"ringtarget":499,"bindingband":500,"ejectbutton":501,"weaknesspolicy":502,"assaultvest":503,"safetygoggles":504,"adrenalineorb":505,"terrainextender":506,"protectivepads":507,"throatspray":508,"ejectpack":509,"heavydutyboots":510,"blunderpolicy":511,"roomservice":512,"utilityumbrella":513,"cheriberry":514,"chestoberry":515,"pechaberry":516,"rawstberry":517,"aspearberry":518,"leppaberry":519,"oranberry":520,"persimberry":521,"lumberry":522,"sitrusberry":523,"figyberry":524,"wikiberry":525,"magoberry":526,"aguavberry":527,"iapapaberry":528,"razzberry":529,"blukberry":530,"nanabberry":531,"wepearberry":532,"pinapberry":533,"pomegberry":534,"kelpsyberry":535,"qualotberry":536,"hondewberry":537,"grepaberry":538,"tamatoberry":539,"cornnberry":540,"magostberry":541,"rabutaberry":542,"nomelberry":543,"spelonberry":544,"pamtreberry":545,"watmelberry":546,"durinberry":547,"belueberry":548,"chilanberry":549,"occaberry":550,"passhoberry":551,"wacanberry":552,"rindoberry":553,"yacheberry":554,"chopleberry":555,"kebiaberry":556,"shucaberry":557,"cobaberry":558,"payapaberry":559,"tangaberry":560,"chartiberry":561,"kasibberry":562,"habanberry":563,"colburberry":564,"babiriberry":565,"roseliberry":566,"liechiberry":567,"ganlonberry":568,"salacberry":569,"petayaberry":570,"apicotberry":571,"lansatberry":572,"starfberry":573,"enigmaberry":574,"micleberry":575,"custapberry":576,"jabocaberry":577,"rowapberry":578,"keeberry":579,"marangaberry":580,"abilityshield":758,"clearamulet":759,"punchingglove":760,"covertcloak":761,"loadeddice":762,"auspiciousarmor":763,"boosterenergy":764,"maliciousarmor":768,"mirrorherb":769,"clefablite":774,"victreebelite":775,"starminite":776,"dragoninite":777,"meganiumite":778,"feraligite":779,"skarmorite":780,"froslassite":781,"emboarite":782,"excadrite":783,"scolipite":784,"scraftinite":785,"eelektrossite":786,"chandelurite":787,"chesnaughtite":788,"delphoxite":789,"greninjite":790,"pyroarite":791,"adamantcrystal":792,"griseouscore":793,"lustrousglobe":794,"berserkgene":798,"fairyfeather":799,"syrupyapple":800,"cornerstonemask":803,"wellspringmask":804,"hearthflamemask":805,"floettite":806,"malamarite":807,"barbaracite":808,"dragalgite":809,"hawluchanite":810,"zygardite":811,"drampanite":812,"falinksite":813,"raichunitex":818,"raichunitey":819,"chimechite":820};
var REF_VERSION = '6';
var ITEM_HEADERS = ['Catégorie', 'Objet', 'Lieu / info', 'Récupéré'];
var ARCHIVE_HEADERS = ['Run', 'Fin de la run', 'Nom', 'Pokémon', 'Zone', 'Niveau', 'Statut', 'Frags', 'Leads', 'Combats', 'Mort contre'];
var STATUS_FR = { slp: 'Endormi', psn: 'Empoisonné', tox: 'Gravement empoisonné', brn: 'Brûlé', par: 'Paralysé', frz: 'Gelé', frb: 'Gelure' };
var STATUS = { team: 'Équipe', ko: 'K.O. (équipe)', box: 'Boîte', dead: 'Mort', gone: 'Absent' };
var METHODS_FR = { 'Land': 'Herbes', 'Fishing': 'Pêche', 'Surf': 'Surf', 'Rock Smash': 'Éclate-Roc', 'Other': 'Spécial' };
// Noms de zones du jeu (MAPSEC, d'après le Lua officiel) : une rencontre par zone en Nuzlocke.
var MAPSECS = ['Littleroot Town', 'Oldale Town', 'Dewford Town', 'Lavaridge Town', 'Fallarbor Town', 'Verdanturf Town', 'Pacifidlog Town',
  'Petalburg City', 'Slateport City', 'Mauville City', 'Rustboro City', 'Fortree City', 'Lilycove City', 'Mossdeep City', 'Sootopolis City',
  'Ever Grande City', 'Granite Cave', 'Mt. Chimney', 'Safari Zone', 'Battle Frontier', 'Petalburg Woods', 'Rusturf Tunnel', 'Abandoned Ship',
  'New Mauville', 'Meteor Falls', 'Mt. Pyre', 'Shoal Cave', 'Seafloor Cavern', 'Victory Road', 'Mirage Island', 'Cave of Origin',
  'Southern Island', 'Fiery Path', 'Jagged Pass', 'Sealed Chamber', 'Scorched Slab', 'Island Cave', 'Icicle Cave', 'Desert Ruins',
  'Ancient Tomb', 'Sky Pillar', 'Aqua Hideout', 'Magma Hideout', 'Mirage Tower', 'Birth Island', 'Faraway Island', 'Artisan Cave',
  'Marine Cave', 'Land Cave', 'Desert Underpass', 'Altering Cave', 'Navel Rock', 'Trainer Hill', 'Littleroot Grove', 'Oldale Grove',
  'Petalburg Grove', 'Verdanturf Tunnel', 'Verdanturf Grotto', 'Altering Grove', 'Route 102 Grove', 'Rustboro Grove'];
for (var r_ = 101; r_ <= 134; r_++) MAPSECS.push('Route ' + r_);

// Palette sombre (même style que le calculateur et l'overlay)
var C_ = { bg: '#0f172a', card: '#1e293b', card2: '#172033', line: '#334155', head: '#0b1220', text: '#e2e8f0', muted: '#94a3b8',
  gold: '#f2c14e', navy: '#0b1220', navy2: '#1e293b', white: '#ffffff', ink: '#e2e8f0',
  band1: '#1e293b', band2: '#172033', green: '#14532d', greenInk: '#86efac', red: '#7f1d1d', redInk: '#fca5a5',
  orange: '#78350f', orangeInk: '#fcd34d', blue: '#1e3a8a', blueInk: '#93c5fd', grey: '#334155', manual: '#3b3014', beaten: '#123524', boss: '#3a2e10' };
var FONT = 'Lexend';

function headers_() { return AUTO_HEADERS.concat(MANUAL_HEADERS, STAT_HEADERS, SPLITS, [SYNC_HEADER]); }

// ---------------------------------------------------------------- Web App
function doPost(e) {
  var payload;
  try { payload = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'JSON invalide' }); }
  var problem = validatePayload(payload);
  if (problem) return json_({ ok: false, error: problem });
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    var result = applyPayload(SpreadsheetApp.getActiveSpreadsheet(), payload, new Date());
    PropertiesService.getScriptProperties().setProperty('lastSync', JSON.stringify({ at: new Date().toISOString(), rows: result.rows }));
    return json_({ ok: true, rows: result.rows });
  } finally { lock.releaseLock(); }
}

// Vérification de connexion depuis le calculateur (JSONP).
function doGet(e) {
  var info = PropertiesService.getScriptProperties().getProperty('lastSync') || '{}';
  var cb = e && e.parameter && e.parameter.callback;
  var body = '{"ok":true,"lastSync":' + info + '}';
  // Conditions de combat par dresseur (doc des dresseurs), pour le calculateur.
  if (e && e.parameter && e.parameter.conditions) body = JSON.stringify({ ok: true, conditions: conditionsMap(SpreadsheetApp.getActiveSpreadsheet()) });
  if (cb && /^[A-Za-z_$][\w$.]{0,60}$/.test(cb))
    return ContentService.createTextOutput(cb + '(' + body + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}
function conditionsMap(ss) {
  var sh = ss.getSheetByName(SHEETS.trainerData), out = {};
  if (!sh || sh.getLastRow() < 2) return out;
  trainersFromRows(sh.getRange(2, 1, sh.getLastRow() - 1, TRAINER_HEADERS.length).getValues()).forEach(function(t) { if (t.conditions) out[t.name] = t.conditions; });
  return out;
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function onOpen() {
  SpreadsheetApp.getUi().createMenu('⚡ Null Run')
    .addItem('Installer / tout mettre à jour', 'setupAll')
    .addItem('Réimporter les données officielles', 'importReferenceMenu')
    .addItem('Recalculer les stats', 'refreshAllMenu')
    .addToUi();
}
function setupAll() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), s = ensureStructure(ss), log = importReference(ss, s);
  refreshAll(ss, s);
  installWeeklyTrigger_();
  ss.toast('Feuille prête (' + log.join(', ') + '). Mise à jour des données officielles chaque lundi.', 'Null Run', 10);
}
function importReferenceMenu() { var ss = SpreadsheetApp.getActiveSpreadsheet(), s = ensureStructure(ss), log = importReference(ss, s); refreshAll(ss, s); ss.toast(log.join(', '), 'Null Run', 6); }
function refreshAllMenu() { refreshAll(SpreadsheetApp.getActiveSpreadsheet(), null, null, true); }
function weeklyRefresh() { var ss = SpreadsheetApp.getActiveSpreadsheet(), s = ensureStructure(ss); importReference(ss, s); refreshAll(ss, s); }
function installWeeklyTrigger_() {
  var exists = ScriptApp.getProjectTriggers().some(function(t) { return t.getHandlerFunction() === 'weeklyRefresh'; });
  if (!exists) ScriptApp.newTrigger('weeklyRefresh').timeBased().everyWeeks(1).onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(6).create();
}

// Recalcul automatique quand tu modifies Combats ou « Mort contre ».
function onEdit(e) {
  var sh = e && e.range && e.range.getSheet();
  if (!sh) return;
  var name = sh.getName(), ss = e.source;
  if (name === SHEETS.fights) {
    var s = sheets_(ss);
    refreshAll(ss, s, null, false);
  } else if (name === SHEETS.pokemon && e.range.getColumn() <= COL.deathCause && e.range.getLastColumn() >= COL.deathCause) refreshAll(ss, null, null, false);
}

// =================================================================== LOGIQUE PURE
function validatePayload(p) {
  if (!p || p.kind !== 'null-run' || !p.data) return 'Données non reconnues';
  var d = p.data;
  if (!Array.isArray(d.party) || !Array.isArray(d.box) || !Array.isArray(d.dead)) return 'Équipe/boîtes manquantes';
  if (d.party.length > 6) return 'Équipe invalide';
  return '';
}
// Une image dans une cellule (sprite) n'a pas de texte : on l'ignore.
function str_(v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'object' && Object.prototype.toString.call(v) !== '[object Date]') return '';
  return String(v).trim();
}

// ---------------------------------------------------------------- Sprites (Pokémon Showdown, comme le doc des dresseurs)
var SPRITE_BASE = 'https://play.pokemonshowdown.com/sprites/gen5/';
var NO_SPLIT = ['ho-oh', 'porygon-z', 'jangmo-o', 'hakamo-o', 'kommo-o', 'wo-chien', 'chien-pao', 'ting-lu', 'chi-yu', 'nidoran-m', 'nidoran-f'];
var spriteOverrides_ = null;
function plainId_(t) { return String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
/** Nom de fichier Showdown : espèce sans ponctuation, forme après un tiret (Darmanitan-Galar-Zen → darmanitan-galarzen). */
function spriteId(species) {
  var sp = str_(species);
  if (!sp || sp === 'None') return '';
  if (spriteOverrides_ === null) {
    try { spriteOverrides_ = JSON.parse(PropertiesService.getDocumentProperties().getProperty('spriteOverrides') || '{}'); } catch (e) { spriteOverrides_ = {}; }
  }
  if (spriteOverrides_[key_(sp)]) return spriteOverrides_[key_(sp)];
  var low = sp.toLowerCase(), first = sp.indexOf('-');
  var keep = NO_SPLIT.some(function(n) { return low === n || low.indexOf(n + '-') === 0; });
  var cut = keep ? sp.indexOf('-', first + 1) : first;
  var base = cut > 0 ? sp.slice(0, cut) : sp, forme = cut > 0 ? sp.slice(cut + 1) : '';
  return plainId_(base) + (forme ? '-' + plainId_(forme) : '');
}
function spriteUrl(species) { var id = spriteId(species); return id ? SPRITE_BASE + id + '.png' : ''; }
/** Sprite : =IMAGE("url") (un seul argument, donc valable quelle que soit la langue de la feuille). Instantané, contrairement aux images insérées une par une. */
function sprite_(species) {
  var url = spriteUrl(species);
  return url ? '=IMAGE("' + url + '")' : '';
}
function displayName(mon) { return mon.nickname && String(mon.nickname).trim() ? String(mon.nickname).trim() : mon.species; }
function colLetter(n) { var s = ''; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
function key_(s) { return str_(s).toLowerCase().replace(/[^a-z0-9]/g, ''); }
function fill_(n, v) { var a = []; for (var i = 0; i < n; i++) a.push(v); return a; }

function autoValues(mon, state) {
  var iv = mon.ivs || {};
  var list = [iv.hp, iv.atk, iv.def, iv.spa, iv.spd, iv.spe];
  var avg = list.every(function(v) { return typeof v === 'number'; }) ? Math.round(list.reduce(function(a, b) { return a + b; }, 0) / 6 * 10) / 10 : '';
  return [mon.uid, null, mon.metLocation || '', sprite_(mon.species), mon.species, displayName(mon), mon.level || '', STATUS[state],
    mon.ability || '', mon.nature || '', iv.hp, iv.atk, iv.def, iv.spa, iv.spd, iv.spe, avg, mon.hiddenPower || '',
    mon.item || '', (mon.moves || []).map(function(m) { return m.name === 'Hidden Power' && mon.hiddenPower ? 'Hidden Power ' + mon.hiddenPower : m.name; }).join(', '),
    mon.metLevel || ''].map(function(v) { return v === undefined || v === null ? '' : v; });
}

// Comparaison d'une ligne sans la colonne Sprite (une image relue n'est pas comparable).
function cmp_(vals) { return vals.map(function(v, i) { return i === COL.sprite - 1 ? '' : str_(v); }).join('\u0001'); }

/** Lignes de l'onglet Pokémon : mises à jour sur place, ajouts, « Absent ». Colonnes manuelles jamais écrites. */
function planPokemonRows(existing, payload, stamp) {
  var d = payload.data, byUid = {}, seen = {}, updates = [], appends = [], next = 0;
  existing.forEach(function(r, i) {
    if (r[0]) byUid[r[0]] = i;
    var order = Number(r[COL.order - 1]); if (order > next) next = order;
  });
  var mons = [];
  d.party.forEach(function(m) { mons.push([m, m.hp === 0 ? 'ko' : 'team']); });
  d.box.forEach(function(m) { mons.push([m, 'box']); });
  d.dead.forEach(function(m) { mons.push([m, 'dead']); });
  var lastRow = existing.length + 1;
  mons.forEach(function(pair) {
    var mon = pair[0], vals = autoValues(mon, pair[1]);
    if (!mon.uid || seen[mon.uid]) return;
    seen[mon.uid] = true;
    if (byUid.hasOwnProperty(mon.uid)) {
      var i = byUid[mon.uid];
      vals[COL.order - 1] = existing[i][COL.order - 1];
      if (cmp_(vals) === cmp_(existing[i].slice(0, vals.length))) return;
      updates.push({ row: i + 2, values: vals, stamp: stamp });
    } else {
      next += 1; lastRow += 1;
      vals[COL.order - 1] = next;
      appends.push({ row: lastRow, values: vals, stamp: stamp });
    }
  });
  existing.forEach(function(r, i) {
    if (r[0] && !seen[r[0]] && r[COL.status - 1] !== STATUS.gone && r[COL.status - 1] !== STATUS.dead) {
      var vals = r.slice(0, AUTO_HEADERS.length); vals[COL.status - 1] = STATUS.gone; vals[COL.sprite - 1] = sprite_(r[COL.species - 1]);
      updates.push({ row: i + 2, values: vals, stamp: stamp });
    }
  });
  return { updates: updates, appends: appends };
}

/** Frags / leads / combats par nom, à partir des lignes de l'onglet Combats. */
function computeStats(rows) {
  var stats = {};
  function get(name) {
    if (!stats[name]) { stats[name] = { frags: 0, leads: 0, fights: 0, splits: {} }; SPLITS.forEach(function(sp) { stats[name].splits[sp] = 0; }); }
    return stats[name];
  }
  rows.forEach(function(r) {
    var split = str_(r[1]), seen = {};
    for (var c = 2; c <= 12; c += 2) {
      var name = str_(r[c]);
      if (!name) continue;
      var st = get(name), raw = str_(r[c + 1]), n = Number(raw.replace(',', '.'));
      if (!raw || !isFinite(n) || n < 0) n = 0;
      if (!seen[name]) { st.fights += 1; seen[name] = true; }
      if (c === 2) st.leads += 1;
      st.frags += n;
      if (st.splits.hasOwnProperty(split)) st.splits[split] += n;
    }
  });
  return stats;
}

// ---------------------------------------------------------------- Rencontres
/** Zone de la carte → zone Nuzlocke (nom de zone du jeu, comme le lieu de capture). */
function mapsecFor(zone) {
  var z = str_(zone), lower = z.toLowerCase();
  var under = z.match(/^(Route \d+) Underwater$/i);
  if (under) return 'Underwater (' + under[1] + ')';
  var best = '';
  MAPSECS.forEach(function(m) {
    var ml = m.toLowerCase();
    if ((lower === ml || lower.indexOf(ml + ' ') === 0 || lower.indexOf(ml + '(') === 0) && m.length > best.length) best = m;
  });
  return best || z;
}

/** Tableau officiel (zones en colonnes Level/Pokémon, méthodes en lignes) → lignes. */
function parseEncounterGrid(values) {
  if (!values || values.length < 3) return [];
  var head = values[0] || [], sub = values[1] || [], pairs = [];
  for (var c = 0; c < sub.length - 1; c++) {
    if (str_(sub[c]) === 'Level' && str_(sub[c + 1]) === 'Pokémon') {
      var zone = str_(head[c]) || str_(head[c + 1]) || str_(head[c - 1]);
      if (zone) pairs.push({ c: c, zone: zone });
    }
  }
  var method = '', acc = {}, order = [];
  for (var r = 2; r < values.length; r++) {
    var row = values[r] || [], label = str_(row[0]);
    if (label) method = label;
    if (!method) continue;
    var rate = parseFloat(str_(row[1]).replace('%', '').replace(',', '.'));
    pairs.forEach(function(p) {
      var species = str_(row[p.c + 1]), level = str_(row[p.c]);
      if (!species) return;
      var special = method === 'Other' || !isFinite(rate);
      var m = METHODS_FR[method] || method, k = p.zone + '|' + m + '|' + species;
      if (!acc[k]) { acc[k] = { zone: p.zone, method: m, species: species, levels: [], rate: special ? '' : 0 }; order.push(k); }
      if (!special && acc[k].rate !== '') acc[k].rate += rate;
      var lv = Number(level); if (level && isFinite(lv) && lv > 0) acc[k].levels.push(lv);
    });
  }
  return order.map(function(k) {
    var e = acc[k], lv = e.levels, lo = lv.length ? Math.min.apply(null, lv) : 0, hi = lv.length ? Math.max.apply(null, lv) : 0;
    return { zone: e.zone, method: e.method, species: e.species, level: lv.length ? (lo === hi ? String(lo) : lo + '-' + hi) : '',
      rate: e.rate === '' ? '' : Math.round(e.rate * 100) / 100 };
  });
}

/** Onglet « Special Encounters » (échanges, cadeaux, casino). */
function parseSpecialEncounters(values) {
  var out = [], section = '';
  (values || []).forEach(function(row) {
    var a = str_(row[0]), b = str_(row[1]), c = str_(row[2]);
    if (!a && !b) return;
    if (a && !b && !c) { section = a; return; }
    if (/^(Wanted Pokémon|Location|Pool)$/.test(a)) return;
    if (/^Trades/i.test(section)) out.push({ zone: b, method: 'Échange', species: c + (a ? ' (contre ' + a + ')' : ''), level: '', rate: '' });
    else if (/^Game Corner/i.test(section)) out.push({ zone: 'Game Corner — ' + a, method: 'Casino', species: b, level: '', rate: '' });
    else out.push({ zone: a, method: 'Cadeau / fixe', species: b, level: '', rate: '' });
  });
  return out;
}

/** « Ma capture » et « Espèce déjà capturée » pour chaque ligne de rencontre. */
function encounterStatus(encounters, pokemonRows) {
  var byZone = {}, species = {};
  pokemonRows.forEach(function(r) {
    var name = str_(r[COL.name - 1]); if (!name) return;
    var sp = str_(r[COL.species - 1]), status = str_(r[COL.status - 1]);
    species[key_(sp)] = true;
    var z = mapsecFor(r[COL.zone - 1]);
    (byZone[z] = byZone[z] || []).push((status === STATUS.dead ? '✝ ' : '✔ ') + name + (name !== sp ? ' (' + sp + ')' : ''));
  });
  return encounters.map(function(e) {
    var z = e.nuzlocke || mapsecFor(e.zone);
    var base = str_(e.species).replace(/ \(contre .*\)$/, '');
    return [(byZone[z] || []).join(', '), species[key_(base)] ? 'Oui' : ''];
  });
}

// ---------------------------------------------------------------- Dresseurs
var TRAINER_KEYS = ['Name', 'Pokémon', 'Level', 'Held Item', 'Ability', 'Nature', 'Moves'];
/** Onglet « X Split » officiel (blocs verticaux) → dresseurs. */
// Lignes surlignées en vert dans le doc : conditions de combat (gauntlet, B2B, météo/terrain permanents, PV de départ…).
var CONDITION_RE = /^(start|end) of\b|\bB2B\b|\d+\s*HP\b|exact copy|can be fought|format will be|starts as|random (lead|team)/i;
function isConditionRow_(text, background) {
  if (!text) return false;
  if (background && /^#00ff00$/i.test(background)) return true;
  return CONDITION_RE.test(text);
}
function conditionText_(t) { return String(t).replace(/\s*\n\s*/g, ' — ').trim(); }
// « End of Rain + Grassy Terrain » ferme « Start of Perma Rain + Grassy Terrain » : même premier mot hors « Perma ».
function conditionKey_(t) { return String(t).replace(/^(start|end) of\s+/i, '').replace(/^(perma(nent)?)\s+/i, '').split(/[\s(+\-|]/)[0].toLowerCase(); }

/** Onglet « X Split » officiel (blocs verticaux) → dresseurs, avec les conditions de combat. */
var PLAIN_BG = ['', '#ffffff', '#efefef', '#d9d9d9', '#000000', '#666666', '#f3f3f3'];
function parseTrainerSheet(values, split, backgrounds, formulas) {
  var out = [], area = '', cur = null, mode = null, moveRows = 0, slots = [], active = [], pending = [], b2b = 0, b2bText = '';
  var row = 0;
  // Couleur posée à la main dans le doc (lead en double, Pokémon de soutien…) sur la case du Pokémon i.
  function color(i) { var c = backgrounds && Array.isArray(backgrounds[row]) ? String(backgrounds[row][i + 1] || '').toLowerCase() : ''; return PLAIN_BG.indexOf(c) < 0 ? c : ''; }
  function paint(field, i) { var c = color(i); if (c && slots[i]) { slots[i].colors = slots[i].colors || {}; if (field === 'moves') (slots[i].colors.m = slots[i].colors.m || {})[slots[i].moves.length - 1] = c; else slots[i].colors[field] = c; } }
  function set(field, rest) { rest.forEach(function(v, i) { if (slots[i]) { slots[i][field] = v; paint(field[0], i); } }); }
  function setSpecies(rest) {
    if (!cur) return;
    slots = rest.map(function(s) { return s && s !== 'None' ? { species: s, level: '', item: '', ability: '', nature: '', moves: [] } : null; });
    slots.forEach(function(sl, i) { if (sl) paint('s', i); });
    cur.mons = slots.filter(Boolean);
  }
  function addMoves(rest) { rest.forEach(function(v, i) { if (slots[i] && v && v !== 'None') { slots[i].moves.push(v); paint('moves', i); } }); }
  (values || []).forEach(function(rowValues, r) {
    row = r;
    var a = str_(rowValues[0]), rest = [1, 2, 3, 4, 5, 6].map(function(i) { return str_(rowValues[i]); }), any = rest.some(Boolean);
    var bg = backgrounds && Array.isArray(backgrounds[r]) ? backgrounds[r][0] : "";
    if (a === 'Name') {
      var conds = active.map(function(c) { return c.text; }).concat(pending);
      if (b2b > 0) { conds.push(b2bText); b2b--; }
      cur = { split: split, area: area, name: rest[0], mons: [], conditions: conds };
      out.push(cur); slots = []; mode = null; pending = [];
      return;
    }
    if (a === 'Pokémon') {
      // Image du dresseur : formule VLOOKUP("TRAINER_PIC_…", Sprites!…) à droite de l'équipe.
      if (cur && formulas && Array.isArray(formulas[r])) formulas[r].forEach(function(f) { var m = /"(TRAINER_PIC_[A-Za-z0-9_]+)"/.exec(String(f || '')); if (m && !cur.pic) cur.pic = m[1]; });
      mode = 'species'; if (any) { setSpecies(rest); mode = null; } return; }
    if (mode === 'species' && !a) { setSpecies(rest); mode = null; return; }
    if (a === 'Level') { set('level', rest); mode = null; return; }
    if (a === 'Held Item') { set('item', rest); mode = null; return; }
    if (a === 'Ability') { set('ability', rest); mode = null; return; }
    if (a === 'Nature') { set('nature', rest); mode = null; return; }
    if (a === 'Moves') { mode = 'moves'; moveRows = 1; addMoves(rest); return; }
    if (mode === 'moves' && !a && any && moveRows < 4) { addMoves(rest); moveRows++; return; }
    if (a && TRAINER_KEYS.indexOf(a) < 0 && !any) {
      mode = null;
      if (!isConditionRow_(a, bg)) { area = a; return; }
      var text = conditionText_(a);
      if (/^start of/i.test(a)) active.push({ key: conditionKey_(a), text: text.replace(/^start of\s+/i, '') });
      else if (/^end of/i.test(a)) {
        var k = conditionKey_(a);
        for (var i = active.length - 1; i >= 0; i--) if (active[i].key === k) { active.splice(i, 1); break; }
      } else if (/\bB2B\b/i.test(a)) { var n = /^(\d+)\s*Trainer/i.exec(a); b2b = n ? Number(n[1]) : 2; b2bText = text; }
      else pending.push(text);
      return;
    }
    if (!a && !any) mode = null;
  });
  out.forEach(function(t) { t.mons.forEach(function(m) { if (m.item === 'None') m.item = ''; if (m.ability === 'None') m.ability = ''; }); });
  return out.filter(function(t) { return t.name; });
}

// Boss et level caps (« Mechanic Changes », doc officielle). Root Academy : noms des dresseurs du jeu.
var BOSS_CAPS = [['Youngster Ren', 13, 'exact'], ['Youngster Levi', 19, 'exact'], ['Lass Videl', 25, 'exact'], ['Youngster Itachi', 29, 'exact'],
  ['Roxanne', 38], ['Brawly', 45], ['Glacia', 53, 'glacia1'], ['Wattson', 59], ['Norman', 66], ['Flannery', 72], ['Winona', 77],
  ['Maxie', 82], ['Tate', 86], ['Archie', 91], ['Steven', 95], ['Glacia', 99, 'glacia2'], ['Wallace', 100]];

/** Level cap déduit des combats saisis : cap du premier boss pas encore battu. */
function capFromFights(foughtNames) {
  var keys = foughtNames.map(key_), glacia = foughtNames.filter(function(n) { return /glacia/i.test(n); });
  var beaten = BOSS_CAPS.map(function(b) {
    if (b[2] === 'exact') return keys.indexOf(key_(b[0])) >= 0;
    if (b[2] === 'glacia1') return glacia.length >= 1;
    if (b[2] === 'glacia2') return glacia.length >= 2;
    return keys.some(function(k) { return k.indexOf(key_(b[0])) >= 0; });
  });
  var any = beaten.some(Boolean), i = beaten.indexOf(false), lastIdx = beaten.lastIndexOf(true);
  return { any: any, beaten: beaten.filter(Boolean).length, cap: i < 0 ? 100 : BOSS_CAPS[i][1], next: i < 0 ? 'Tous battus' : BOSS_CAPS[i][0],
    reached: lastIdx < 0 ? BOSS_CAPS[0][1] : lastIdx + 1 < BOSS_CAPS.length ? BOSS_CAPS[lastIdx + 1][1] : 100,
    last: lastIdx < 0 ? '' : BOSS_CAPS[lastIdx][0] };
}

function isBoss(name) { return /\b(Leader|Elite Four|Champion|Rival)\b|\[Boss\]/i.test(name); }

/** Données des dresseurs (onglet caché, une ligne par Pokémon adverse). */
function trainerRows(trainers) {
  var rows = [];
  trainers.forEach(function(t) {
    var maxLv = t.mons.reduce(function(m, x) { return Math.max(m, Number(x.level) || 0); }, 0) || '';
    var mons = t.mons.length ? t.mons : [null];
    mons.forEach(function(m, i) {
      rows.push([i ? '' : t.split, i ? '' : t.area, i ? '' : t.name, m ? i + 1 : '', m ? m.species : 'Équipe aléatoire (voir doc officiel)',
        m ? (Number(m.level) || m.level) : '', m ? m.item : '', m ? m.ability : '', m ? m.nature : '', m ? m.moves.join(', ') : '',
        i ? '' : maxLv, i ? '' : (t.conditions || []).join(' · '), m && m.colors ? JSON.stringify(m.colors) : '', i ? '' : (t.pic || '')]);
    });
  });
  return rows;
}

function parseColors_(v) { try { return v ? JSON.parse(v) : {}; } catch (e) { return {}; } }
/** Couleur d'une case comme dans le doc : couleur posée à la main, sinon règle « nom → couleur ». */
function highlight_(text, manual) {
  if (manual) return manual;
  var t = str_(text);
  if (!t) return '';
  for (var c in DOC_HIGHLIGHTS) if (DOC_HIGHLIGHTS[c].some(function(x) { return x.charAt(0) === '*' ? t.slice(-x.length + 1) === x.slice(1) : t === x; })) return c;
  return '';
}

/** Relit les données des dresseurs (liste ordonnée, Pokémon complets). */
function trainersFromRows(rows) {
  var out = [], cur = null;
  rows.forEach(function(r) {
    if (str_(r[2])) { cur = { split: str_(r[0]), area: str_(r[1]), name: str_(r[2]), maxLevel: 0, mons: [], random: false, conditions: str_(r[TCOL.conditions - 1]), pic: str_(r[TCOL.pic - 1]) }; out.push(cur); }
    if (!cur) return;
    if (r[3] === '' || r[3] === null) { if (/aléatoire/.test(str_(r[TCOL.species - 1]))) cur.random = true; return; }
    if (!str_(r[TCOL.species - 1])) return;
    cur.mons.push({ species: str_(r[TCOL.species - 1]), level: r[TCOL.level - 1], item: str_(r[TCOL.item - 1]), ability: str_(r[TCOL.ability - 1]),
      nature: str_(r[TCOL.nature - 1]), moves: str_(r[TCOL.moves - 1]) ? str_(r[TCOL.moves - 1]).split(/,\s*/) : [], colors: parseColors_(r[TCOL.colors - 1]) });
    cur.maxLevel = Math.max(cur.maxLevel, Number(r[TCOL.level - 1]) || 0);
  });
  return out;
}

/** Prochain dresseur : le premier après le dernier dresseur affronté (ordre du doc officiel). */
function nextTrainer(trainers, fought) {
  var last = -1;
  trainers.forEach(function(t, i) { if (fought[key_(t.name)]) last = i; });
  for (var i = last + 1; i < trainers.length; i++) if (!fought[key_(trainers[i].name)]) return trainers[i];
  return null;
}

var CATEGORY_COLORS = { 'Objet tenu': '#f9cb9c', 'Baie': '#ea9999', 'Méga-gemme': '#d5a6bd', 'Objet spécial': '#c27ba0', 'Mémoire': '#d9d2e9', 'Objet d\'évolution': '#b6d7a8',
  'CT / CS': '#9fc5e8', 'CT rachetable': '#cfe2f3', 'Tuteur': '#a4c2f4', 'Menthe': '#b7e1cd', 'Ressource': '#ffe599', 'Écaille Cœur': '#f4cccc',
  'Boutique de la Ligue': '#fce5cd', 'Objet sauvage': '#d9ead3' };
var ITEM_COLS = [['✔', 34], ['', 44], ['Objet', 170], ['Lieu / info', 300]];
var ITEMS_PER_BAND = 3;
/** 🎒 Objets : un tableau par catégorie (case « Récupéré », icône, objet, lieu), 3 tableaux côte à côte par bande.
 *  Renvoie la position de chaque case pour retrouver ce que tu as coché. */
function itemLayout(items) {
  var cats = [], by = {};
  items.forEach(function(i) { if (!by[i[0]]) { by[i[0]] = []; cats.push(i[0]); } by[i[0]].push(i); });
  var tables = [], top = 0;
  for (var b = 0; b < cats.length; b += ITEMS_PER_BAND) {
    var band = cats.slice(b, b + ITEMS_PER_BAND), h = 0;
    band.forEach(function(c, k) { tables.push({ cat: c, items: by[c], row: top, col: k * 5 }); h = Math.max(h, by[c].length); });
    top += 2 + h + 1;
  }
  return { tables: tables, height: Math.max(top, 1), width: ITEMS_PER_BAND * 5 };
}
function itemRows(sorted, checked) {
  var L = itemLayout(sorted), out = [];
  L.tables.forEach(function(t) { t.items.forEach(function(i, j) { out.push([i[0], i[1], i[2], t.row + 3 + j, t.col + 1, !!(checked && checked[i[0] + '|' + i[1] + '|' + i[2]])]); }); });
  return out;
}
function renderItems_(sh, sorted, checked) {
  var L = itemLayout(sorted), W = L.width, grid = [];
  for (var r = 0; r < L.height; r++) { var g = gridRow_(W); g.h = 34; grid.push(g); }
  L.tables.forEach(function(t) {
    var color = CATEGORY_COLORS[t.cat] || '#cccccc', title = grid[t.row], head = grid[t.row + 1];
    title.h = 32; head.h = 22;
    for (var i = 0; i < 4; i++) {
      title.bg[t.col + i] = color; title.fc[t.col + i] = '#000000'; title.fw[t.col + i] = 'bold';
      head.v[t.col + i] = ITEM_COLS[i][0]; head.bg[t.col + i] = '#262626'; head.fc[t.col + i] = color; head.fw[t.col + i] = 'bold'; head.fs[t.col + i] = 9;
    }
    title.v[t.col] = t.cat + ' (' + t.items.length + ')'; title.fs[t.col] = 12;
    t.items.forEach(function(it, j) {
      var row = grid[t.row + 2 + j], dark = j % 2 ? '#172033' : '#1e293b';
      // Tuteurs : ce sont des attaques, pas des objets → pas d'icône.
      var icon = t.cat === 'Tuteur' ? '' : itemIconUrl(it[1]);
      var vals = [!!(checked && checked[it[0] + '|' + it[1] + '|' + it[2]]), icon ? '=IMAGE("' + icon + '")' : '', it[1], it[2]];
      for (var i = 0; i < 4; i++) { row.v[t.col + i] = vals[i]; row.bg[t.col + i] = i === 0 ? color : dark; row.fc[t.col + i] = i === 3 ? '#cbd5e1' : '#ffffff'; row.fw[t.col + i] = i === 2 ? 'bold' : 'normal'; row.fs[t.col + i] = i === 2 ? 11 : 10; }
    });
    grid[t.row + 2 + t.items.length] && (grid[t.row + 2 + t.items.length].h = grid[t.row + 2 + t.items.length].h);
  });
  drawGrid_(sh, grid, W);
  tryFormat_(function() {
    sh.setHiddenGridlines(true); sh.setFrozenRows(0);
    for (var k = 0; k < ITEMS_PER_BAND; k++) { ITEM_COLS.forEach(function(c, i) { sh.setColumnWidth(k * 5 + i + 1, c[1]); }); sh.setColumnWidth(k * 5 + 5, 18); }
    setHeights_(sh, grid);
    L.tables.forEach(function(t) {
      sh.getRange(t.row + 3, t.col + 1, t.items.length, 1).insertCheckboxes();
      sh.getRange(t.row + 1, t.col + 1, 2 + t.items.length, 4).setBorder(true, true, true, true, null, null, CATEGORY_COLORS[t.cat] || '#cccccc', SpreadsheetApp.BorderStyle.SOLID_THICK);
      sh.getRange(t.row + 2, t.col + 1, 1 + t.items.length, 2).setHorizontalAlignment('center');
      sh.getRange(t.row + 3, t.col + 4, t.items.length, 1).setWrap(true);
    });
  });
}
/** Ce que tu as coché : positions mémorisées dans l'onglet caché, sinon ancienne mise en page (liste). */
function readItemChecks_(s) {
  var checked = {}, n = s.itemData.getLastRow(), view = s.items.getLastRow() ? s.items.getRange(1, 1, s.items.getLastRow(), Math.max(s.items.getLastColumn ? s.items.getLastColumn() : 15, 15)).getValues() : [];
  if (n > 1) {
    s.itemData.getRange(2, 1, n - 1, 5).getValues().forEach(function(r) {
      var row = view[Number(r[3]) - 1]; if (row && row[Number(r[4]) - 1] === true) checked[r[0] + '|' + r[1] + '|' + r[2]] = true;
    });
    return checked;
  }
  var cat = '';
  view.slice(1).forEach(function(r) {
    var a = str_(r[0]);
    if (/^▸ /.test(a)) { cat = a.slice(2); return; }
    if (a) cat = a;
    if (r[3] === true) checked[cat + '|' + r[1] + '|' + r[2]] = true;
  });
  // Anciennes catégories renommées
  Object.keys(checked).forEach(function(k) { if (/^Méga-gemme \/ spécial\|/.test(k)) checked[k.replace('Méga-gemme / spécial', /Memory\|/.test(k) ? 'Mémoire' : 'Méga-gemme')] = true; });
  return checked;
}

/** Objets groupés par catégorie, dans l'ordre du doc officiel (ordre d'obtention) à l'intérieur. */
function sortItems(items) {
  return items.map(function(it, i) { return { it: it, i: i, c: ITEM_CATEGORIES.indexOf(it[0]) < 0 ? 99 : ITEM_CATEGORIES.indexOf(it[0]) }; })
    .sort(function(a, b) { return a.c - b.c || a.i - b.i; }).map(function(x) { return x.it; });
}

// ---------------------------------------------------------------- Objets
function parseItemSheet(name, values) {
  var out = [], seen = {};
  function add(cat, item, loc) {
    item = str_(item); loc = str_(loc);
    if (!item || /^(Item|Berry|Move|Location|Pokémon|TRUE|FALSE)$/.test(item)) return;
    var k = cat + '|' + item + '|' + loc;
    if (seen[k]) return;
    seen[k] = true; out.push([cat, item, loc]);
  }
  values = values || [];
  if (name === 'Held Items') values.forEach(function(r) { add('Objet tenu', r[1], r[2]); if (str_(r[4])) add('Baie', r[4], str_(r[5]) + (str_(r[6]) ? ' — quantité : ' + str_(r[6]) : '')); });
  else if (name === 'TM/HMs and Move Tutors') {
    var right = 'Tuteur';
    values.forEach(function(r) {
      add('CT / CS', r[1], r[2]);
      if (/^Rebuyable TMs/i.test(str_(r[4]))) { right = 'CT rachetable'; return; }
      add(right, r[4], r[5]);
    });
  } else if (name === 'Evolution Items') values.forEach(function(r) { if (/^All items/.test(str_(r[0]))) return; add('Objet d\'évolution', r[0], r[1]); });
  else if (name === 'Special') {
    // Colonne de gauche : méga-gemmes. À droite : mémoires, puis objets spéciaux (masques, disques, Miroir Sacré),
    // puis « Ability Changing » (des Pokémon, pas des objets : ignorés).
    var section = 'Mémoire';
    values.forEach(function(r) {
      add('Méga-gemme', r[1], r[2]);
      var b = str_(r[3]);
      if (b === 'Item') { section = 'Objet spécial'; return; }
      if (/^Ability Changing/i.test(b)) { section = ''; return; }
      if (!section) return;
      add(/Memory$/.test(b) ? 'Mémoire' : section, r[3], r[4]);
    });
  } else if (name === 'Resources') {
    var res = 'Menthe';
    values.forEach(function(r) {
      if (/Heart Scale Locations/i.test(str_(r[0]))) return;
      if (str_(r[1]) && !/^(TRUE|FALSE)$/.test(str_(r[1]))) add('Écaille Cœur', 'Heart Scale', str_(r[1]) + (str_(r[2]) ? ' — ' + str_(r[2]) : ''));
      if (str_(r[3]) === 'Other') { res = 'Ressource'; return; }
      if (str_(r[4])) add(res, r[4], r[5]);
    });
  } else if (name === 'Other') {
    values.forEach(function(r) {
      if (!/^(League Shop|Item)$/.test(str_(r[0])) && str_(r[0])) add('Boutique de la Ligue', r[0], str_(r[1]) ? str_(r[1]) + ' Écailles Cœur' : '');
      if (str_(r[2]) && !/^(Wild Held Items|Item)$/.test(str_(r[2]))) add('Objet sauvage', r[2], str_(r[3]) + (str_(r[4]) ? ' — ' + str_(r[4]) : ''));
    });
  }
  return out;
}

/** Icône d'un objet (TM06 Rock Tomb → icône de CT). */
function itemIconUrl(name) {
  var n = str_(name), tm = /^(TM|HM)\s*(\d+)/i.exec(n), k = tm ? (tm[1] + tm[2]).toLowerCase() : n.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (/^gems?$/.test(k)) k = 'normalgem';
  if (tm) return ITEM_ICON_FALLBACK + tm[1].toLowerCase() + '-normal.png';
  if (ITEM_ICON_IDS[k]) return ITEM_ICON_BASE + ITEM_ICON_IDS[k] + '.png';
  var slug = n.toLowerCase().replace(/['’.]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug ? ITEM_ICON_FALLBACK + slug + '.png' : '';
}

// ---------------------------------------------------------------- Tableau de bord
function runSummary(payload) {
  var d = payload.data, b = payload.bosses || {};
  return {
    party: d.party.length, ko: d.party.filter(function(m) { return m.hp === 0; }).length, box: d.box.length, dead: d.dead.length,
    captures: d.party.length + d.box.length + d.dead.length,
    maxLevel: d.party.reduce(function(m, p) { return Math.max(m, p.level || 0); }, 0),
    cap: b.cap || '', nextBoss: b.next || 'Tous battus', beaten: (b.beaten || []).length
  };
}

function teamRows(payload) {
  var rows = payload.data.party.map(function(m) {
    var pct = m.maxHP ? Math.round(m.hp * 100 / m.maxHP) / 100 : 0;
    return [sprite_(m.species), displayName(m), m.species, m.level, m.hp + ' / ' + m.maxHP, pct, m.hp === 0 ? 'K.O.' : (STATUS_FR[m.status] || 'OK'),
      m.item || '', m.ability || '', (m.moves || []).map(function(x) { return x.name === 'Hidden Power' && m.hiddenPower ? 'Hidden Power ' + m.hiddenPower : x.name; }).join(', ')];
  });
  while (rows.length < 6) rows.push(fill_(10, ''));
  return rows;
}

function block_(rows, width, height, empty) {
  var out = rows.slice(0, height).map(function(r) { return r.slice(0, width); });
  if (!rows.length && empty) out.push([empty].concat(fill_(width - 1, '')));
  while (out.length < height) out.push(fill_(width, ''));
  return out;
}
function bar_(value, max) { if (!(value > 0)) return ''; var n = Math.max(1, Math.round(value / max * 12)); return new Array(n + 1).join('█'); }

function runTables(pokemonRows, stats) {
  var top = [], dead = [], perSplit = SPLITS.map(function(sp) { return [sp, 0]; });
  pokemonRows.forEach(function(r) {
    var name = str_(r[COL.name - 1]), st = stats[name];
    if (!name) return;
    if (st && st.frags > 0) top.push([name, r[COL.species - 1], st.frags, st.leads, st.fights]);
    if (r[COL.status - 1] === STATUS.dead) dead.push([name, r[COL.species - 1], r[COL.level - 1], r[COL.zone - 1], r[COL.deathCause - 1]]);
  });
  Object.keys(stats).forEach(function(name) { SPLITS.forEach(function(sp, i) { perSplit[i][1] += stats[name].splits[sp]; }); });
  var max = Math.max.apply(null, perSplit.map(function(p) { return p[1]; }).concat([0]));
  top.sort(function(a, b) { return b[2] - a[2] || b[3] - a[3]; });
  top = top.map(function(r, i) { return [i < 3 ? ['🥇', '🥈', '🥉'][i] : '#' + (i + 1)].concat(r); });
  return {
    top: block_(top, 6, 15, 'Aucun frag pour l\'instant'),
    dead: block_(dead, 5, 15, 'Aucun mort 🎉'),
    splits: perSplit.map(function(p) { return [p[0], p[1], bar_(p[1], max)]; })
  };
}

// =================================================================== ÉCRITURE
var RUN = { title: 1, info: 2, kpiLabel: 4, kpiValue: 5, kpiSub: 6, teamTitle: 8, teamHead: 9, teamFirst: 10, tablesTitle: 17, tablesHead: 18, tablesFirst: 19 };
var KPIS = ['Équipe', 'Captures', 'Morts', 'Level cap', 'Prochain boss', 'Prochain dresseur'];

function sheets_(ss) {
  function get(key) {
    var name = SHEETS[key], sh = ss.getSheetByName(name);
    if (sh) return sh;
    for (var old in LEGACY_NAMES) if (LEGACY_NAMES[old] === key && ss.getSheetByName(old)) { sh = ss.getSheetByName(old); sh.setName(name); return sh; }
    return ss.insertSheet(name);
  }
  var out = { run: get('run'), pokemon: get('pokemon'), fights: get('fights'), encounters: get('encounters'), trainers: get('trainers'), items: get('items'), archive: get('archive'),
    encData: get('encData'), trainerData: get('trainerData'), trainerPics: get('trainerPics'), itemData: get('itemData') };
  tryFormat_(function() { [out.encData, out.trainerData, out.trainerPics, out.itemData].forEach(function(sh) { if (!sh.isSheetHidden()) sh.hideSheet(); }); });
  return out;
}
function tryFormat_(fn) { try { fn(); } catch (e) { if (typeof Logger !== 'undefined') Logger.log('Mise en forme ignorée : ' + e); } }

function ensureStructure(ss) {
  var s = sheets_(ss), created = false;
  // Ancienne mise en page sans colonne Sprite : on l'insère avant « Pokémon » (les données suivent).
  var ph = s.pokemon.getRange(1, 1, 1, 6).getValues()[0];
  if (str_(ph[3]) === 'Pokémon' && str_(ph[4]) === 'Nom') s.pokemon.insertColumnBefore(4);
  [[s.pokemon, headers_()], [s.fights, FIGHT_HEADERS], [s.encData, ENC_HEADERS], [s.trainerData, TRAINER_HEADERS], [s.itemData, ITEM_DATA_HEADERS], [s.archive, ARCHIVE_HEADERS]].forEach(function(p) {
    var range = p[0].getRange(1, 1, 1, p[1].length);
    if (range.getValues()[0].join('|') !== p[1].join('|')) { range.setValues([p[1]]); created = true; }
  });
  var run = s.run;
  if (run.getRange(RUN.title, 1).getValue() !== 'POKÉMON NULL — SUIVI DE RUN') {
    created = true;
    var attempt = /^(Tentative|Run) n°$/.test(str_(run.getRange(RUN.info, 1).getValue())) ? run.getRange(RUN.info, 2).getValue() || 1 : 1;
    tryFormat_(function() { run.clear(); run.getRange(1, 1, run.getMaxRows(), run.getMaxColumns()).breakApart(); });
    run.getRange(RUN.title, 1).setValue('POKÉMON NULL — SUIVI DE RUN');
    run.getRange(RUN.info, 1, 1, 4).setValues([['Run n°', attempt, 'Dernière synchro', 'En attente du calculateur']]);
    KPIS.forEach(function(k, i) { run.getRange(RUN.kpiLabel, 1 + i * 2).setValue(k); });
    run.getRange(RUN.teamTitle, 1).setValue('⚔  Équipe actuelle');
    run.getRange(RUN.teamHead, 1, 1, 10).setValues([['Sprite', 'Nom', 'Pokémon', 'Niv.', 'PV', 'PV %', 'Statut', 'Objet', 'Talent', 'Attaques']]);
    run.getRange(RUN.tablesTitle, 1, 1, 16).setValues([['🏆  Top frags', '', '', '', '', '', '', '✝  Morts', '', '', '', '', '', '📊  Frags par split', '', '']]);
    run.getRange(RUN.tablesHead, 1, 1, 16).setValues([['Rang', 'Nom', 'Pokémon', 'Frags', 'Leads', 'Combats', '', 'Nom', 'Pokémon', 'Niv.', 'Zone', 'Mort contre', '', 'Split', 'Frags', '']]);
  }
  // La mise en forme complète est appliquée à l'installation (ou si la page vient d'être créée).
  // Run n° : une run compte dès que le level cap 45 est atteint ; « Runs avant le suivi » se règle à la main.
  if (str_(run.getRange(RUN.info, 1).getValue()) !== 'Run n°') run.getRange(RUN.info, 1).setValue('Run n°');
  if (str_(run.getRange(RUN.info, 8).getValue()) !== 'Runs avant le suivi') {
    run.getRange(RUN.info, 8).setValue('Runs avant le suivi');
    if (run.getRange(RUN.info, 9).getValue() === '') run.getRange(RUN.info, 9).setValue(0);
    tryFormat_(function() { run.getRange(RUN.info, 9).setBackground(C_.manual).setFontColor(C_.gold).setFontWeight('bold').setHorizontalAlignment('center'); });
  }
  if (str_(run.getRange(RUN.teamHead, 1).getValue()) === 'Slot') run.getRange(RUN.teamHead, 1).setValue('Sprite');
  if (created || PropertiesService.getDocumentProperties().getProperty('styleVersion') !== '5') {
    tryFormat_(function() { styleAll_(ss, s); });
    PropertiesService.getDocumentProperties().setProperty('styleVersion', '5');
  }
  return s;
}


// Fond sombre, police et alignement communs à un onglet entier.
function paintSheet_(sh, cols, rows) {
  rows = rows || sh.getMaxRows();
  sh.getRange(1, 1, rows, Math.max(cols, sh.getMaxColumns())).setBackground(C_.bg).setFontColor(C_.text).setFontFamily(FONT).setFontSize(10).setVerticalAlignment('middle');
}
function tableHeader_(range) {
  range.setFontWeight('bold').setBackground(C_.head).setFontColor(C_.gold).setFontSize(10).setVerticalAlignment('middle').setHorizontalAlignment('center').setWrap(true)
    .setBorder(null, null, true, null, null, null, C_.gold, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
}
function header_(range) { tableHeader_(range); }
function rule_() { return SpreadsheetApp.newConditionalFormatRule(); }
function card_(range, accent) {
  range.setBackground(C_.card).setBorder(true, true, true, true, null, null, accent || C_.line, SpreadsheetApp.BorderStyle.SOLID);
}
function gridLines_(range) { range.setBorder(null, null, null, null, null, true, C_.line, SpreadsheetApp.BorderStyle.SOLID); }

function styleAll_(ss, s) {
  var tabs = { run: C_.gold, pokemon: '#22c55e', fights: '#ef4444', trainers: '#3b82f6', encounters: '#10b981', items: '#a855f7', archive: '#64748b' };
  ['run', 'pokemon', 'fights', 'trainers', 'encounters', 'items', 'archive'].forEach(function(k, i) {
    s[k].setTabColor(tabs[k]); ss.setActiveSheet(s[k]); ss.moveActiveSheet(i + 1);
    s[k].setHiddenGridlines(true);
  });
  ss.getSheets().forEach(function(sh) { if (sh.getName() === 'Feuille 1' || sh.getName() === 'Sheet1') { if (sh.getLastRow() === 0) ss.deleteSheet(sh); } });
  ss.setActiveSheet(s.run);

  // --- 🏠 Run : tableau de bord
  var run = s.run;
  paintSheet_(run, 16, 60);
  [86, 130, 120, 52, 84, 64, 96, 120, 120, 300, 120, 150, 16, 120, 56, 160].forEach(function(w, i) { run.setColumnWidth(i + 1, w); });
  run.getRange(RUN.title, 1, 1, 16).merge().setBackground(C_.head).setFontColor(C_.gold).setFontSize(22).setFontWeight('bold').setHorizontalAlignment('center')
    .setBorder(null, null, true, null, null, null, C_.gold, SpreadsheetApp.BorderStyle.SOLID_THICK);
  run.setRowHeight(RUN.title, 58);
  run.getRange(RUN.info, 1, 1, 16).setBackground(C_.head).setFontColor(C_.muted).setFontSize(10);
  run.getRange(RUN.info, 2).setFontColor(C_.gold).setFontWeight('bold').setHorizontalAlignment('center').setFontSize(12);
  run.getRange(RUN.info, 4, 1, 3).merge().setFontColor(C_.text).setFontWeight('bold');
  run.setRowHeight(RUN.info, 26); run.setRowHeight(3, 14); run.setRowHeight(7, 18); run.setRowHeight(16, 18);
  var kpiColors = [C_.blueInk, C_.greenInk, C_.redInk, C_.gold, C_.orangeInk, '#c4b5fd'];
  KPIS.forEach(function(k, i) {
    var c = 1 + i * 2;
    [RUN.kpiLabel, RUN.kpiValue, RUN.kpiSub].forEach(function(r) { run.getRange(r, c, 1, 2).merge(); });
    run.getRange(RUN.kpiLabel, c).setFontSize(9).setFontColor(C_.muted).setFontWeight('bold').setHorizontalAlignment('center');
    run.getRange(RUN.kpiValue, c).setFontSize(i >= 4 ? 12 : 24).setFontWeight('bold').setHorizontalAlignment('center').setWrap(true).setFontColor(kpiColors[i]);
    run.getRange(RUN.kpiSub, c).setFontSize(9).setFontColor(C_.muted).setHorizontalAlignment('center').setWrap(true);
    card_(run.getRange(RUN.kpiLabel, c, 3, 2), kpiColors[i]);
  });
  run.setRowHeight(RUN.kpiLabel, 22); run.setRowHeight(RUN.kpiValue, 46); run.setRowHeight(RUN.kpiSub, 22);
  [[RUN.teamTitle, 1], [RUN.tablesTitle, 1], [RUN.tablesTitle, 8], [RUN.tablesTitle, 14]].forEach(function(p) {
    run.getRange(p[0], p[1]).setFontSize(14).setFontWeight('bold').setFontColor(C_.gold);
  });
  run.setRowHeight(RUN.teamTitle, 30); run.setRowHeight(RUN.tablesTitle, 30);
  tableHeader_(run.getRange(RUN.teamHead, 1, 1, 10));
  tableHeader_(run.getRange(RUN.tablesHead, 1, 1, 6)); tableHeader_(run.getRange(RUN.tablesHead, 8, 1, 5)); tableHeader_(run.getRange(RUN.tablesHead, 14, 1, 3));
  run.getRange(RUN.tablesHead, 15, 1, 2).merge();
  card_(run.getRange(RUN.teamFirst, 1, 6, 10)); gridLines_(run.getRange(RUN.teamFirst, 1, 6, 10));
  run.setRowHeights(RUN.teamFirst, 6, 44);
  run.getRange(RUN.teamFirst, 2, 6, 1).setFontWeight('bold').setFontSize(11);
  run.getRange(RUN.teamFirst, 3, 6, 1).setFontColor(C_.muted);
  run.getRange(RUN.teamFirst, 4, 6, 4).setHorizontalAlignment('center');
  run.getRange(RUN.teamFirst, 6, 6, 1).setNumberFormat('0%').setFontWeight('bold');
  run.getRange(RUN.teamFirst, 10, 6, 1).setWrap(true).setFontSize(9);
  [[1, 6], [8, 5]].forEach(function(t) { var r = run.getRange(RUN.tablesFirst, t[0], 15, t[1]); card_(r); gridLines_(r); });
  var sp = run.getRange(RUN.tablesFirst, 14, SPLITS.length, 3); card_(sp); gridLines_(sp);
  run.setRowHeights(RUN.tablesFirst, 15, 24);
  run.getRange(RUN.tablesFirst, 16, SPLITS.length, 1).setFontColor(C_.gold);
  run.getRange(RUN.tablesFirst, 1, 15, 1).setHorizontalAlignment('center');
  run.getRange(RUN.tablesFirst, 2, 15, 1).setFontWeight('bold');
  run.getRange(RUN.tablesFirst, 4, 15, 3).setHorizontalAlignment('center');
  run.getRange(RUN.tablesFirst, 4, 15, 1).setFontColor(C_.gold).setFontWeight('bold');
  run.getRange(RUN.tablesFirst, 8, 15, 1).setFontWeight('bold').setFontColor(C_.redInk);
  run.getRange(RUN.tablesFirst, 15, SPLITS.length, 1).setHorizontalAlignment('center').setFontWeight('bold');
  var hp = run.getRange(RUN.teamFirst, 6, 6, 1), st = run.getRange(RUN.teamFirst, 7, 6, 1);
  run.setConditionalFormatRules([
    rule_().whenCellEmpty().setBackground(C_.card).setRanges([hp]).build(),
    rule_().whenNumberLessThanOrEqualTo(0.25).setBackground(C_.red).setFontColor(C_.redInk).setRanges([hp]).build(),
    rule_().whenNumberLessThanOrEqualTo(0.5).setBackground(C_.orange).setFontColor(C_.orangeInk).setRanges([hp]).build(),
    rule_().whenNumberGreaterThan(0.5).setBackground(C_.green).setFontColor(C_.greenInk).setRanges([hp]).build(),
    rule_().whenTextEqualTo('K.O.').setBackground(C_.red).setFontColor(C_.redInk).setBold(true).setRanges([st]).build(),
    rule_().whenTextEqualTo('OK').setFontColor(C_.greenInk).setRanges([st]).build(),
    rule_().whenCellNotEmpty().setBackground(C_.orange).setFontColor(C_.orangeInk).setRanges([st]).build()
  ]);

  // --- 🐾 Pokémon
  var pk = s.pokemon, h = headers_(), rows = Math.max(pk.getMaxRows() - 1, 1);
  paintSheet_(pk, h.length);
  pk.setFrozenRows(1); pk.setFrozenColumns(COL.name);
  tableHeader_(pk.getRange(1, 1, 1, h.length));
  pk.getRange(1, COL.deathCause).setBackground(C_.manual);
  pk.setRowHeight(1, 40);
  pk.hideColumns(COL.uid);
  pk.getRange(2, 1, rows, h.length).setHorizontalAlignment('center');
  pk.getRange(2, COL.zone, rows, 1).setHorizontalAlignment('left').setFontColor(C_.muted);
  pk.getRange(2, COL.name, rows, 1).setFontWeight('bold').setFontSize(11).setHorizontalAlignment('left');
  pk.getRange(2, COL.species, rows, 1).setHorizontalAlignment('left');
  pk.getRange(2, h.indexOf('Attaques') + 1, rows, 1).setHorizontalAlignment('left').setWrap(true).setFontSize(9);
  pk.getRange(2, COL.deathCause, rows, 1).setBackground(C_.manual).setFontColor(C_.orangeInk);
  pk.getRange(2, COL.frags, rows, 3).setFontWeight('bold').setFontColor(C_.gold);
  var W = { 'UID': 80, '#': 40, 'Zone': 150, 'Sprite': 56, 'Pokémon': 120, 'Nom': 120, 'Niveau': 56, 'Statut': 110, 'Talent': 115, 'Nature': 80,
    'Moy. IV': 62, 'Type PC': 80, 'Objet': 115, 'Attaques': 280, 'Nv capture': 74, 'Mort contre': 170 };
  W[SYNC_HEADER] = 140;
  h.forEach(function(name, i) { pk.setColumnWidth(i + 1, W[name] || (/^IV /.test(name) ? 46 : 70)); });
  pk.setRowHeights(2, rows, 42);
  try { pk.getBandings().forEach(function(b) { b.remove(); }); pk.getRange(1, 1, rows + 1, h.length).applyRowBanding().setHeaderRowColor(C_.head).setFirstRowColor(C_.card).setSecondRowColor(C_.card2); } catch (e) {}
  var statusRange = pk.getRange(2, COL.status, rows, 1), ivRange = pk.getRange(2, COL.iv, rows, 6);
  var statusRules = [[STATUS.team, C_.green, C_.greenInk], [STATUS.ko, C_.orange, C_.orangeInk], [STATUS.box, C_.blue, C_.blueInk],
    [STATUS.dead, C_.red, C_.redInk], [STATUS.gone, C_.grey, C_.muted]].map(function(x) {
    return rule_().whenTextEqualTo(x[0]).setBackground(x[1]).setFontColor(x[2]).setBold(true).setRanges([statusRange]).build();
  });
  pk.setConditionalFormatRules(statusRules.concat([
    rule_().setGradientMinpointWithValue('#7f1d1d', SpreadsheetApp.InterpolationType.NUMBER, '0')
      .setGradientMidpointWithValue('#713f12', SpreadsheetApp.InterpolationType.NUMBER, '15')
      .setGradientMaxpointWithValue('#14532d', SpreadsheetApp.InterpolationType.NUMBER, '31').setRanges([ivRange]).build()
  ]));

  // --- ⚔️ Combats
  var f = s.fights;
  paintSheet_(f, FIGHT_HEADERS.length);
  f.setFrozenRows(1); tableHeader_(f.getRange(1, 1, 1, FIGHT_HEADERS.length)); f.setRowHeight(1, 36);
  [220, 110, 120, 54, 120, 54, 120, 54, 120, 54, 120, 54, 120, 54, 200].forEach(function(w, i) { f.setColumnWidth(i + 1, w); });
  f.setRowHeights(2, FIGHT_ROWS, 28);
  f.getRange(2, 1, FIGHT_ROWS, 1).setFontWeight('bold').setFontColor(C_.gold);
  f.getRange(2, 2, FIGHT_ROWS, 1).setFontColor(C_.muted).setHorizontalAlignment('center');
  f.getRange(2, 3, FIGHT_ROWS, 1).setFontWeight('bold');
  [4, 6, 8, 10, 12, 14].forEach(function(c) { f.getRange(2, c, FIGHT_ROWS, 1).setHorizontalAlignment('center').setBackground(C_.card).setFontWeight('bold').setFontColor(C_.gold); });
  f.getRange(2, 15, FIGHT_ROWS, 1).setFontColor(C_.muted).setFontSize(9);
  gridLines_(f.getRange(2, 1, FIGHT_ROWS, FIGHT_HEADERS.length));
  f.getRange(2, 1, FIGHT_ROWS, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInRange(s.trainerData.getRange('C2:C'), true).setAllowInvalid(true).build());
  f.getRange(2, 2, FIGHT_ROWS, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(SPLITS, true).setAllowInvalid(true).build());
  var names = SpreadsheetApp.newDataValidation().requireValueInRange(pk.getRange(colLetter(COL.name) + '2:' + colLetter(COL.name)), true).setAllowInvalid(true).build();
  [3, 5, 7, 9, 11, 13].forEach(function(c) { f.getRange(2, c, FIGHT_ROWS, 1).setDataValidation(names); });
  f.getRange(1, 1).setNote('Rempli automatiquement à chaque combat gagné (lead et frags compris). Tu peux corriger à la main : tes valeurs ne sont jamais écrasées.');

  // --- 🌿 Rencontres / 🎯 Dresseurs / 🎒 Objets / 📦 Archives
  [[s.archive, ARCHIVE_HEADERS, [80, 130, 120, 120, 150, 55, 110, 55, 55, 65, 180]]].forEach(function(p) {
    paintSheet_(p[0], p[1].length);
    p[0].setFrozenRows(1); tableHeader_(p[0].getRange(1, 1, 1, p[1].length)); p[0].setRowHeight(1, 36);
    p[2].forEach(function(w, i) { p[0].setColumnWidth(i + 1, w); });
  });
}

// ---------------------------------------------------------------- Tableaux dessinés
// Écrit une grille complète (valeurs + couleurs + gras + tailles) en quelques appels.
function drawGrid_(sh, grid, width) {
  tryFormat_(function() { sh.clearConditionalFormatRules(); sh.getBandings().forEach(function(b) { b.remove(); }); });
  sh.clear();
  var n = grid.length;
  if (sh.getMaxRows() < n + 1) sh.insertRowsAfter(sh.getMaxRows(), n + 1 - sh.getMaxRows());
  if (sh.getMaxColumns() < width) sh.insertColumnsAfter(sh.getMaxColumns(), width - sh.getMaxColumns());
  var range = sh.getRange(1, 1, n, width);
  range.setValues(grid.map(function(r) { return r.v; }));
  tryFormat_(function() {
    range.setBackgrounds(grid.map(function(r) { return r.bg; })).setFontColors(grid.map(function(r) { return r.fc; }))
      .setFontWeights(grid.map(function(r) { return r.fw; })).setFontSizes(grid.map(function(r) { return r.fs; }))
      .setFontFamily(FONT).setVerticalAlignment('middle').setWrap(false);
    sh.getRange(n + 1, 1, sh.getMaxRows() - n, Math.max(width, sh.getMaxColumns())).setBackground('#000000');
  });
}
// Hauteurs de lignes par séries identiques (peu d'appels).
function setHeights_(sh, grid) {
  var start = 0;
  for (var i = 1; i <= grid.length; i++) {
    if (i === grid.length || grid[i].h !== grid[start].h) { sh.setRowHeights(start + 1, i - start, grid[start].h); start = i; }
  }
}
function gridRow_(width, fill) {
  return { v: fill_(width, ''), bg: fill_(width, fill || '#000000'), fc: fill_(width, '#ffffff'), fw: fill_(width, 'normal'), fs: fill_(width, 10), h: 21 };
}

/** 🎯 Dresseurs : blocs comme le doc « Colour Coded Trainer Battles » (étiquettes à gauche, un Pokémon par colonne). */
var T_COLORS = { label: '#666666', labelInk: '#ffd966', light: '#efefef', dark: '#d9d9d9', area: '#00ffff', cond: '#00ff00', beaten: '#b6d7a8', boss: '#ffe599' };
function renderTrainers_(sh, trainers, fought, pics) {
  pics = pics || {};
  var W = 8, grid = [], sprites = [], split = null, area = null;
  var title = gridRow_(W, '#000000');
  title.v[0] = '🎯 DRESSEURS — d\'après « Colour Coded Trainer Battles » (PureGift)'; title.fc[0] = C_.gold; title.fw[0] = 'bold'; title.fs[0] = 14; title.h = 36;
  grid.push(title);
  var legend = gridRow_(W, '#000000');
  HIGHLIGHT_LEGEND.forEach(function(l, i) { legend.v[i + 1] = l[1]; legend.bg[i + 1] = l[0]; legend.fc[i + 1] = l[0] === '#4285f4' ? '#ffffff' : '#000000'; legend.fw[i + 1] = 'bold'; legend.fs[i + 1] = 9; });
  legend.v[0] = 'Légende'; legend.fc[0] = C_.muted; legend.h = 24;
  grid.push(legend);
  trainers.forEach(function(t) {
    if (t.split !== split) {
      split = t.split; area = null;
      var sr = gridRow_(W, '#000000'); sr.v[0] = '— SPLIT ' + String(split).toUpperCase() + ' —'; sr.fc[0] = C_.gold; sr.fw[0] = 'bold'; sr.fs[0] = 13; sr.h = 34;
      grid.push(sr);
    }
    if (t.area !== area) {
      area = t.area;
      var ar = gridRow_(W, '#000000'); ar.v[0] = area; ar.fc[0] = T_COLORS.area; ar.fw[0] = 'bold'; ar.fs[0] = 11; ar.h = 26;
      grid.push(ar);
    }
    if (t.conditions) {
      var cr = gridRow_(W, T_COLORS.cond); cr.v[0] = '⚠ ' + t.conditions; cr.fc = fill_(W, '#000000'); cr.fw[0] = 'bold';
      grid.push(cr);
    }
    var beaten = !!fought[key_(t.name)], boss = isBoss(t.name);
    function line(label, values, bg, bold, colors) {
      var r = gridRow_(W, '#000000');
      r.v[0] = label; r.bg[0] = T_COLORS.label; r.fc[0] = T_COLORS.labelInk; r.fw[0] = 'bold';
      for (var i = 0; i < 6; i++) {
        r.v[i + 1] = values[i] === undefined ? '' : values[i];
        var c = colors && colors[i];
        r.bg[i + 1] = c || bg; r.fc[i + 1] = c === '#4285f4' ? '#ffffff' : '#000000'; r.fw[i + 1] = bold || c ? 'bold' : 'normal';
      }
      return r;
    }
    var nameRow = line('Dresseur', [t.name], beaten ? T_COLORS.beaten : boss ? T_COLORS.boss : T_COLORS.light, true);
    if (beaten) { nameRow.v[7] = '✔ Battu'; nameRow.fc[7] = C_.greenInk; nameRow.fw[7] = 'bold'; }
    grid.push(nameRow);
    if (t.random || !t.mons.length) { grid.push(line('Pokémon', ['Équipe aléatoire (voir doc officiel)'], T_COLORS.dark, true)); grid.push(gridRow_(W)); return; }
    var spr = line('Pokémon', t.mons.map(function(m) { return sprite_(m.species); }), '#ffffff'); spr.h = 72; sprites.push(grid.length);
    var pic = t.pic && pics[t.pic.toUpperCase()];
    if (pic) { spr.v[7] = pic; spr.bg[7] = '#000000'; }
    grid.push(spr);
    var col = function(m) { return m.colors || {}; };
    grid.push(line('', t.mons.map(function(m) { return m.species; }), T_COLORS.dark, true, t.mons.map(function(m) { return col(m).s; })));
    grid.push(line('Niveau', t.mons.map(function(m) { return m.level; }), T_COLORS.light));
    grid.push(line('Objet', t.mons.map(function(m) { return m.item; }), T_COLORS.dark, false, t.mons.map(function(m) { return highlight_(m.item, col(m).i); })));
    grid.push(line('Talent', t.mons.map(function(m) { return m.ability; }), T_COLORS.light, false, t.mons.map(function(m) { return highlight_(m.ability, col(m).a); })));
    grid.push(line('Nature', t.mons.map(function(m) { return m.nature; }), T_COLORS.dark));
    for (var k = 0; k < 4; k++) grid.push(line(k ? '' : 'Attaques', t.mons.map(function(m) { return m.moves[k] || ''; }), k % 2 ? T_COLORS.dark : T_COLORS.light, false,
      t.mons.map(function(m) { return highlight_(m.moves[k], (col(m).m || {})[k]); })));
    grid.push(gridRow_(W));
  });
  drawGrid_(sh, grid, W);
  tryFormat_(function() {
    sh.setHiddenGridlines(true); sh.setFrozenRows(1);
    [110, 150, 150, 150, 150, 150, 150, 110].forEach(function(w, i) { sh.setColumnWidth(i + 1, w); });
    sh.getRange(1, 2, grid.length, 6).setHorizontalAlignment('center');
    sh.getRange(1, 1, grid.length, 1).setHorizontalAlignment('center');
    setHeights_(sh, grid);
  });
}

/** 🌿 Rencontres : zones les unes à côté des autres ; dans chaque zone, un tableau par méthode (Herbes, Pêche, Surf…) côte à côte.
 *  Sprites, % recalculés avec la clause des doublons (espèce déjà capturée = grisée, 0 %). */
var METHOD_COLORS = { 'Herbes': ['#93c47d', '#000000'], 'Pêche': ['#9fc5e8', '#000000'], 'Surf': ['#3d85c6', '#ffffff'], 'Éclate-Roc': ['#e6b8af', '#000000'],
  'Spécial': ['#b4a7d6', '#000000'], 'Échange': ['#ffe599', '#000000'], 'Casino': ['#f9cb9c', '#000000'], 'Cadeau / fixe': ['#d5a6bd', '#000000'] };
var ENC_COLS = [['%', 54], ['Niv.', 48], ['', 54], ['Pokémon', 130]];
function encounterLayout_(enc, pokemonRows) {
  var owned = {}, byZone = {};
  pokemonRows.forEach(function(r) {
    var name = str_(r[COL.name - 1]); if (!name) return;
    var sp = str_(r[COL.species - 1]), status = str_(r[COL.status - 1]);
    owned[key_(sp)] = true;
    var z = mapsecFor(r[COL.zone - 1]);
    (byZone[z] = byZone[z] || []).push((status === STATUS.dead ? '✝ ' : '✔ ') + name + (name !== sp ? ' (' + sp + ')' : ''));
  });
  var zones = [], groups = {};
  enc.forEach(function(e) {
    if (!groups[e.zone]) { groups[e.zone] = { name: e.zone, nuzlocke: e.nuzlocke || mapsecFor(e.zone), methods: [], byMethod: {} }; zones.push(groups[e.zone]); }
    var z = groups[e.zone];
    if (!z.byMethod[e.method]) { z.byMethod[e.method] = []; z.methods.push(e.method); }
    z.byMethod[e.method].push(e);
  });
  zones.forEach(function(z) { z.caught = byZone[z.nuzlocke] || []; });
  return { zones: zones, owned: owned };
}
function renderEncounters_(sh, enc, pokemonRows) {
  var L = encounterLayout_(enc, pokemonRows), zones = L.zones, owned = L.owned;
  // Zones les unes sous les autres ; dans une zone, les méthodes côte à côte (4 colonnes chacune + 1 colonne de séparation).
  var slots = zones.reduce(function(m, z) { return Math.max(m, z.methods.length); }, 1), W = slots * 5, grid = [], tables = [], zoneTops = [];
  var colWidths = [];
  for (var k = 0; k < slots; k++) { ENC_COLS.forEach(function(c) { colWidths.push(c[1]); }); colWidths.push(18); }
  zones.forEach(function(z) {
    var top = grid.length, rowsCount = z.methods.reduce(function(m, me) { return Math.max(m, z.byMethod[me].length); }, 0), w = z.methods.length * 5 - 1;
    zoneTops.push({ zone: z, top: top, width: w });
    var h1 = gridRow_(W), h2 = gridRow_(W);
    for (var i = 0; i < w; i++) { h1.bg[i] = '#262626'; h2.bg[i] = '#262626'; }
    h1.v[0] = z.name; h1.fc[0] = C_.gold; h1.fw[0] = 'bold'; h1.fs[0] = 13; h1.h = 30;
    var caught = z.caught;
    h2.v[0] = caught.length ? caught.join(', ') : 'Pas encore de capture';
    h2.fc[0] = caught.length ? (/^✝/.test(caught[0]) ? C_.redInk : C_.greenInk) : C_.muted; h2.fw[0] = 'bold'; h2.fs[0] = 11; h2.h = 24;
    grid.push(h1, h2);
    var mh = gridRow_(W), lab = gridRow_(W); mh.h = 26; lab.h = 20;
    var body = []; for (var r = 0; r < rowsCount; r++) { var br = gridRow_(W); br.h = 40; body.push(br); }
    z.methods.forEach(function(m, k) {
      var x = k * 5, list = z.byMethod[m], col = METHOD_COLORS[m] || ['#cccccc', '#000000'], all = 0, free = 0;
      tables.push({ row: grid.length, x: x, n: list.length });
      list.forEach(function(e) { if (e.rate === '' || isNaN(e.rate)) return; all += e.rate; if (!owned[key_(baseSpecies_(e.species))]) free += e.rate; });
      for (var i = 0; i < 4; i++) {
        mh.bg[x + i] = col[0]; mh.fc[x + i] = col[1]; mh.fw[x + i] = 'bold';
        lab.v[x + i] = ENC_COLS[i][0]; lab.bg[x + i] = '#1f1f1f'; lab.fc[x + i] = col[0]; lab.fw[x + i] = 'bold'; lab.fs[x + i] = 9;
      }
      mh.v[x] = m; mh.fs[x] = 11;
      list.forEach(function(e, j) {
        var row = body[j], dupe = !!owned[key_(baseSpecies_(e.species))];
        var pct = e.rate === '' || isNaN(e.rate) ? '' : dupe ? 0 : free > 0 ? Math.round(e.rate * all / free * 10) / 10 : e.rate;
        var vals = [pct === '' ? '' : pct + '%', e.level, sprite_(baseSpecies_(e.species)), e.species];
        for (var i = 0; i < 4; i++) {
          row.v[x + i] = vals[i]; row.bg[x + i] = dupe ? '#595959' : col[0]; row.fc[x + i] = dupe ? '#bfbfbf' : col[1];
          row.fw[x + i] = i === 3 || i === 0 ? 'bold' : 'normal'; row.fs[x + i] = i === 3 ? 11 : 10;
        }
      });
    });
    grid.push(mh, lab);
    body.forEach(function(b) { grid.push(b); });
    var gap = gridRow_(W); gap.h = 16; grid.push(gap);
  });
  if (!grid.length) grid.push(gridRow_(W));
  drawGrid_(sh, grid, W);
  tryFormat_(function() {
    sh.setHiddenGridlines(true); sh.setFrozenRows(0);
    colWidths.forEach(function(w, i) { sh.setColumnWidth(i + 1, w); });
    setHeights_(sh, grid);
    tables.forEach(function(t) {
      sh.getRange(t.row + 1, t.x + 1, 2 + t.n, 4).setBorder(true, true, true, true, null, null, '#000000', SpreadsheetApp.BorderStyle.SOLID_THICK);
      sh.getRange(t.row + 1, t.x + 1, 2 + t.n, 3).setHorizontalAlignment('center');
    });
    zoneTops.forEach(function(z) { sh.getRange(z.top + 1, 1, 2, z.width).setBorder(true, true, true, true, null, null, C_.gold, SpreadsheetApp.BorderStyle.SOLID_MEDIUM); });
  });
}
function baseSpecies_(s) { return str_(s).replace(/ \(contre .*\)$/, ''); }

// ---------------------------------------------------------------- Import officiel
function readSheet_(id, name) {
  var sh = SpreadsheetApp.openById(id).getSheetByName(name);
  return sh ? sh.getDataRange().getValues() : [];
}

function writeTable_(sh, width, rows) {
  var last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, width).clearContent();
  if (rows.length) {
    if (sh.getMaxRows() < rows.length + 1) sh.insertRowsAfter(sh.getMaxRows(), rows.length + 1 - sh.getMaxRows());
    sh.getRange(2, 1, rows.length, width).setValues(rows);
  }
}

// Bandes alternées par groupe (zone, catégorie, dresseur), une seule écriture.
function bandColors_(groups, width, special) {
  var out = [], g = -1, prev = null;
  groups.forEach(function(k, i) {
    if (k !== '' && k !== prev) { g++; prev = k; }
    var color = (special && special(i)) || (g % 2 ? C_.band2 : C_.band1);
    out.push(fill_(width, color));
  });
  return out;
}

// Onglet « Sprites » du doc : images des dresseurs (TRAINER_PIC_…), recopiées telles quelles dans un onglet caché.
function copyTrainerPics_(src, dest) {
  try {
    var sh = src.getSheetByName('Sprites'); if (!sh) return;
    var vals = sh.getRange(1, 1, sh.getLastRow(), 2).getValues().filter(function(r) { return /^TRAINER_PIC_/.test(str_(r[0])); });
    if (!vals.length) return;
    dest.clear();
    dest.getRange(1, 1, vals.length, 2).setValues(vals);
  } catch (e) { if (typeof Logger !== 'undefined') Logger.log('Images des dresseurs non copiées : ' + e); }
}
function trainerPicMap_(sh) {
  var out = {};
  try { var n = sh.getLastRow(); if (n) sh.getRange(1, 1, n, 2).getValues().forEach(function(r) { if (str_(r[0])) out[str_(r[0]).toUpperCase()] = r[1]; }); } catch (e) {}
  return out;
}

// Onglet « Dex » du doc des dresseurs : nom de fichier du sprite quand il diffère de la règle automatique.
function loadSpriteOverrides_(src) {
  try {
    var dex = src.getSheetByName('Dex'); if (!dex) return;
    var over = {};
    spriteOverrides_ = {};
    dex.getDataRange().getValues().forEach(function(r, i) {
      var name = str_(r[0]), file = str_(r[1]);
      if (!i || !name || !file || name === 'None') return;
      if (spriteId(name) !== file) over[key_(name)] = file;
    });
    spriteOverrides_ = over;
    PropertiesService.getDocumentProperties().setProperty('spriteOverrides', JSON.stringify(over));
  } catch (e) { spriteOverrides_ = null; }
}

function importReference(ss, s) {
  s = s || ensureStructure(ss);
  var log = [];
  try {
    var enc = parseEncounterGrid(readSheet_(SOURCES.encounters, 'Encounter Tables'))
      .concat(parseEncounterGrid(readSheet_(SOURCES.encounters, 'Other Tables')))
      .concat(parseSpecialEncounters(readSheet_(SOURCES.encounters, 'Special Encounters')));
    if (!enc.length) throw new Error('aucune rencontre lue');
    writeTable_(s.encData, ENC_HEADERS.length, enc.map(function(e) { return [e.zone, mapsecFor(e.zone), e.method, e.species, e.level, e.rate]; }));
    log.push(enc.length + ' rencontres');
  } catch (e) { log.push('Rencontres non importées (' + e.message + ')'); }
  try {
    var trainers = [];
    [SOURCES.trainers, SOURCES.trainersFallback].forEach(function(id) {
      if (trainers.length) return;
      var src; try { src = SpreadsheetApp.openById(id); } catch (err) { return; }
      loadSpriteOverrides_(src);
      copyTrainerPics_(src, s.trainerPics);
      TRAINER_SHEETS.forEach(function(t) {
        var sh = src.getSheetByName(t[0]); if (!sh) return;
        var range = sh.getDataRange(), bgs = null, fx = null;
        try { bgs = range.getBackgrounds(); } catch (err) { bgs = null; }
        try { fx = range.getFormulas(); } catch (err) { fx = null; }
        trainers = trainers.concat(parseTrainerSheet(range.getValues(), t[1], bgs, fx));
      });
    });
    if (!trainers.length) throw new Error('aucun dresseur lu');
    writeTable_(s.trainerData, TRAINER_HEADERS.length, trainerRows(trainers));
    log.push(trainers.length + ' dresseurs');
  } catch (e) { log.push('Dresseurs non importés (' + e.message + ')'); }
  try {
    var checked = readItemChecks_(s), items = [];
    ['Held Items', 'TM/HMs and Move Tutors', 'Evolution Items', 'Special', 'Resources', 'Other'].forEach(function(n) { items = items.concat(parseItemSheet(n, readSheet_(SOURCES.items, n))); });
    if (!items.length) throw new Error('aucun objet lu');
    var sorted = sortItems(items);
    renderItems_(s.items, sorted, checked);
    writeTable_(s.itemData, ITEM_DATA_HEADERS.length, itemRows(sorted, checked).map(function(r) { return r.slice(0, 5); }));
    log.push(items.length + ' objets');
  } catch (e) { log.push('Objets non importés (' + e.message + ')'); }
  PropertiesService.getDocumentProperties().setProperty('referenceImport', new Date().toISOString() + ' — ' + log.join(', '));
  PropertiesService.getDocumentProperties().setProperty('refVersion', REF_VERSION);
  ['hashFought', 'hashCaptures'].forEach(function(k) { PropertiesService.getDocumentProperties().setProperty(k, ''); });
  return log;
}

// ---------------------------------------------------------------- Mise à jour dynamique
function fightRows_(s) { var n = s.fights.getLastRow(); return n > 1 ? s.fights.getRange(2, 1, n - 1, FIGHT_HEADERS.length).getValues() : []; }
function pokemonRows_(s) { var n = s.pokemon.getLastRow(); return n > 1 ? s.pokemon.getRange(2, 1, n - 1, COL.deathCause).getValues() : []; }
function trainerSheetRows_(s) { var n = s.trainerData.getLastRow(); return n > 1 ? s.trainerData.getRange(2, 1, n - 1, TRAINER_HEADERS.length).getValues() : []; }
function encounterRows_(s) {
  var n = s.encData.getLastRow();
  return n > 1 ? s.encData.getRange(2, 1, n - 1, ENC_HEADERS.length).getValues().map(function(r) {
    return { zone: str_(r[0]), nuzlocke: str_(r[1]), method: str_(r[2]), species: str_(r[3]), level: str_(r[4]), rate: r[5] === '' ? '' : Number(r[5]) };
  }) : [];
}

// Remplit le split d'un combat à partir du nom du dresseur.
function fillFightSplits_(s) {
  var splitOf = {};
  trainersFromRows(trainerSheetRows_(s)).forEach(function(t) { splitOf[key_(t.name)] = t.split; });
  fightRows_(s).forEach(function(r, i) {
    var split = splitOf[key_(r[0])] || (/^Root Academy/.test(str_(r[0])) ? 'Roxanne' : '');
    if (str_(r[0]) && !str_(r[1]) && split) s.fights.getRange(i + 2, 2).setValue(split);
  });
}

// Empreinte d'un contenu, pour ne réécrire un gros onglet que s'il a changé.
function changed_(key, value) {
  var props = PropertiesService.getDocumentProperties(), text = JSON.stringify(value), h = text.length + ':' + hash_(text);
  if (props.getProperty(key) === h) return false;
  props.setProperty(key, h); return true;
}
function hash_(t) { var h = 0; for (var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return h; }

function refreshAll(ss, s, summary, force) {
  s = s || ensureStructure(ss);
  fillFightSplits_(s);
  var fights = fightRows_(s), stats = computeStats(fights), rows = pokemonRows_(s);
  if (force === undefined) force = !summary;
  if (rows.length) {
    var statValues = rows.map(function(r) {
      var name = str_(r[COL.name - 1]);
      if (!name) return fill_(3 + SPLITS.length, '');
      var st = stats[name];
      return st ? [st.frags, st.leads, st.fights].concat(SPLITS.map(function(sp) { return st.splits[sp]; })) : fill_(3 + SPLITS.length, 0);
    });
    s.pokemon.getRange(2, COL.frags, statValues.length, statValues[0].length).setValues(statValues);
  }
  // Sprites de l'onglet Pokémon (lignes créées avant la colonne Sprite, évolutions)
  var speciesList = rows.map(function(r) { return str_(r[COL.species - 1]); });
  if (rows.length && (changed_('hashSprites', speciesList) || force)) {
    s.pokemon.getRange(2, COL.sprite, rows.length, 1).setValues(speciesList.map(function(sp) { return [sprite_(sp)]; }));
  }
  var t = runTables(rows, stats);
  s.run.getRange(RUN.tablesFirst, 1, 15, 6).setValues(t.top);
  s.run.getRange(RUN.tablesFirst, 8, 15, 5).setValues(t.dead);
  s.run.getRange(RUN.tablesFirst, 14, t.splits.length, 3).setValues(t.splits);

  // Dresseurs battus + prochain dresseur
  var fought = {}, foughtNames = {};
  fights.forEach(function(r) { if (str_(r[0])) { fought[key_(r[0])] = true; foughtNames[str_(r[0])] = true; } });
  var trows = trainerSheetRows_(s), trainers = trainersFromRows(trows);
  if (trows.length && (changed_('hashFought', [Object.keys(fought).sort(), trows.length]) || force)) renderTrainers_(s.trainers, trainers, fought, trainerPicMap_(s.trainerPics));
  var next = nextTrainer(trainers, fought);
  s.run.getRange(RUN.kpiValue, 11).setValue(next ? next.name : (trainers.length ? 'Tous battus' : 'Liste à importer'));
  s.run.getRange(RUN.kpiSub, 11).setValue(next ? next.split + ' · ' + next.area + (next.maxLevel ? ' · Niv. max ' + next.maxLevel : '') : '');

  // Rencontres : tableaux par zone (captures, clause des doublons)
  var encRows = encounterRows_(s);
  var captures = rows.map(function(r) { return [r[COL.zone - 1], r[COL.species - 1], r[COL.name - 1], r[COL.status - 1]].join('|'); });
  if (encRows.length && (changed_('hashCaptures', [captures, encRows.length]) || force)) renderEncounters_(s.encounters, encRows, rows);
  // Level cap / prochain boss : déduits de l'onglet Combats s'il contient un boss, sinon cases du calculateur.
  var caps = capFromFights(Object.keys(foughtNames));
  if (summary) PropertiesService.getDocumentProperties().setProperty('lastSummary', JSON.stringify(summary));
  else { try { summary = JSON.parse(PropertiesService.getDocumentProperties().getProperty('lastSummary') || 'null'); } catch (e) { summary = null; } }
  if (summary) {
    var cap = caps.any ? caps.cap : summary.cap, nextBoss = caps.any ? caps.next : summary.nextBoss, beaten = caps.any ? caps.beaten : summary.beaten;
    s.run.getRange(RUN.info, 2).setValue(runNumber_(s, Math.max(Number(cap) || 0, caps.any ? caps.reached : 0)));
    s.run.getRange(RUN.kpiValue, 1, 1, 10).setValues([[summary.party + ' / 6', '', summary.captures, '', summary.dead, '', cap ? 'Niv. ' + cap : '—', '', nextBoss, '']]);
    s.run.getRange(RUN.kpiSub, 1, 1, 10).setValues([[summary.ko ? summary.ko + ' K.O.' : 'Tous debout', '', summary.box + ' en boîte', '', summary.dead ? 'Repose en paix' : 'Aucun mort', '',
      'Niv. max équipe : ' + summary.maxLevel, '', beaten + ' boss battu' + (beaten > 1 ? 's' : '') + (caps.any ? ' (Combats)' : ''), '']]);
  }
}

// ---------------------------------------------------------------- Nouvelle run
/**
 * Nouvelle partie détectée (le numéro de dresseur de la sauvegarde a changé) :
 * la run précédente est archivée dans 📦 Archives, puis Pokémon, Combats et le
 * tableau de bord repartent de zéro et la tentative augmente de 1.
 */
var RUN_CAP = 45;
/** Run n° = runs avant le suivi (case à régler) + runs terminées ayant atteint le cap 45 + la run en cours si elle l'a atteint. */
function runNumber_(s, currentCap) {
  var base = Number(s.run.getRange(RUN.info, 9).getValue()) || 0, done = Number(PropertiesService.getDocumentProperties().getProperty('runsDone')) || 0;
  return base + done + (Number(currentCap) >= RUN_CAP ? 1 : 0);
}
function archiveRun_(ss, s, stamp) {
  var props = PropertiesService.getDocumentProperties();
  var last = s.pokemon.getLastRow(), rows = last > 1 ? s.pokemon.getRange(2, 1, last - 1, COL.sync).getValues().filter(function(r) { return str_(r[COL.name - 1]); }) : [];
  var fights = fightRows_(s).filter(function(r) { return r.some(function(c) { return str_(c); }); });
  var attempt = Number(s.run.getRange(RUN.info, 2).getValue()) || 1;
  // La partie terminée compte comme une run seulement si elle a atteint le level cap 45.
  var endCaps = capFromFights(fights.map(function(r) { return str_(r[0]); }).filter(Boolean)), lastSum = null;
  try { lastSum = JSON.parse(props.getProperty('lastSummary') || 'null'); } catch (e) {}
  var counted = Math.max(endCaps.any ? endCaps.reached : 0, (lastSum && Number(lastSum.cap)) || 0) >= RUN_CAP;
  if (counted) props.setProperty('runsDone', String((Number(props.getProperty('runsDone')) || 0) + 1));
  if (rows.length || fights.length) {
    var stats = computeStats(fights), dead = rows.filter(function(r) { return r[COL.status - 1] === STATUS.dead; }).length;
    var frags = rows.reduce(function(t, r) { var st = stats[str_(r[COL.name - 1])]; return t + (st ? st.frags : 0); }, 0);
    var foughtNames = fights.map(function(r) { return str_(r[0]); }).filter(Boolean), caps = capFromFights(foughtNames);
    var summary = [counted ? attempt : 'Non comptée', stamp, '▶ RÉSUMÉ', rows.length + ' captures · ' + dead + ' morts', caps.last ? 'Dernier boss battu : ' + caps.last : '',
      rows.reduce(function(m, r) { return Math.max(m, Number(r[COL.level - 1]) || 0); }, 0), '', frags, '', fights.length, ''];
    var out = [summary].concat(rows.map(function(r) {
      var st = stats[str_(r[COL.name - 1])] || { frags: 0, leads: 0, fights: 0 };
      return [counted ? attempt : 'Non comptée', stamp, r[COL.name - 1], r[COL.species - 1], r[COL.zone - 1], r[COL.level - 1], r[COL.status - 1], st.frags, st.leads, st.fights, r[COL.deathCause - 1]];
    }));
    var start = Math.max(s.archive.getLastRow(), 1) + 1;
    if (s.archive.getMaxRows() < start + out.length) s.archive.insertRowsAfter(s.archive.getMaxRows(), start + out.length - s.archive.getMaxRows());
    s.archive.getRange(start, 1, out.length, ARCHIVE_HEADERS.length).setValues(out);
    tryFormat_(function() { s.archive.getRange(start, 1, 1, ARCHIVE_HEADERS.length).setFontWeight('bold').setBackground(C_.blue).setFontColor(C_.blueInk); });
  }
  if (last > 1) s.pokemon.getRange(2, 1, last - 1, COL.sync).clearContent();
  var fl = s.fights.getLastRow();
  if (fl > 1) s.fights.getRange(2, 1, fl - 1, FIGHT_HEADERS.length).clearContent();
  s.run.getRange(RUN.info, 2).setValue(runNumber_(s, 0));
  s.run.getRange(RUN.teamFirst, 1, 6, 10).clearContent();
  ['hashFought', 'hashCaptures', 'lastSummary'].forEach(function(k) { props.setProperty(k, ''); });
  return { attempt: runNumber_(s, 0), archived: rows.length, counted: counted };
}

// Combats détectés par le Lua : une ligne par dresseur battu, avec lead et frags (dernier Pokémon qui a
// attaqué quand l'adversaire tombe K.O.). Une ligne existante n'est complétée que si le lead est vide.
// Le calculateur nomme les dresseurs aléatoires « Root Academy Trainer #N » ; le doc leur donne leur vrai nom.
var ROOT_ACADEMY_NAMES = { 1: 'Youngster Ren', 2: 'Youngster Levi', 3: 'Lass Videl', 4: 'Youngster Itachi' };
function docTrainerName_(name) { var m = /^Root Academy Trainer #(\d)$/.exec(str_(name)); return m && ROOT_ACADEMY_NAMES[m[1]] ? ROOT_ACADEMY_NAMES[m[1]] : str_(name); }
function fightCells_(f) {
  var cells = fill_(FIGHT_HEADERS.length - 1, ''), frags = {}, order = [];
  (f.frags || []).forEach(function(k) { var n = str_(k && k.name); if (!n) return; if (!(n in frags)) order.push(n); frags[n] = (frags[n] || 0) + (Number(k.n) || 0); });
  var lead = str_(f.lead);
  cells[0] = docTrainerName_(f.name);
  if (lead) { cells[2] = lead; cells[3] = frags[lead] || 0; }
  var col = 4;
  order.filter(function(n) { return n !== lead; }).slice(0, 5).forEach(function(n) { cells[col] = n; cells[col + 1] = frags[n]; col += 2; });
  return cells;
}
function addDetectedFights_(s, fights) {
  if (!Array.isArray(fights) || !fights.length) return 0;
  var have = {}, rows = [], existing = fightRows_(s), lastFilled = 0;
  existing.forEach(function(r, i) { if (str_(r[0])) { have[key_(r[0])] = i; lastFilled = i + 1; } });
  fights.forEach(function(f) {
    var name = docTrainerName_(f && f.name);
    if (!name) return;
    var cells = fightCells_(f);
    if (have.hasOwnProperty(key_(name))) {
      var i = have[key_(name)], r = existing[i];
      if (!str_(r[2]) && cells[2]) s.fights.getRange(i + 2, 3, 1, FIGHT_HEADERS.length - 3).setValues([cells.slice(2, FIGHT_HEADERS.length - 1)]);
      return;
    }
    have[key_(name)] = -1;
    rows.push(cells.concat(['Détecté automatiquement']));
  });
  if (rows.length) {
    var start = lastFilled + 2;
    if (s.fights.getMaxRows() < start + rows.length - 1) s.fights.insertRowsAfter(s.fights.getMaxRows(), start + rows.length - 1 - s.fights.getMaxRows());
    s.fights.getRange(start, 1, rows.length, FIGHT_HEADERS.length).setValues(rows);
  }
  return rows.length;
}

function applyPayload(ss, payload, now) {
  var s = ensureStructure(ss), pk = s.pokemon;
  var stamp = Utilities.formatDate(now, ss.getSpreadsheetTimeZone(), 'dd/MM/yyyy HH:mm:ss');
  var props = PropertiesService.getDocumentProperties(), runId = str_(payload.runId), previousRun = props.getProperty('runId');
  if (runId && previousRun && runId !== previousRun) archiveRun_(ss, s, stamp);
  if (runId) props.setProperty('runId', runId);
  var last = pk.getLastRow();
  var existing = last > 1 ? pk.getRange(2, 1, last - 1, AUTO_HEADERS.length).getValues() : [];
  var plan = planPokemonRows(existing, payload, stamp);
  plan.updates.concat(plan.appends).forEach(function(u) {
    pk.getRange(u.row, 1, 1, u.values.length).setValues([u.values]);
    pk.getRange(u.row, COL.sync).setValue(u.stamp);
  });
  addDetectedFights_(s, payload.fights);
  s.run.getRange(RUN.info, 4).setValue(stamp);
  s.run.getRange(RUN.teamFirst, 1, 6, 10).setValues(teamRows(payload));
  // Première synchro sans données officielles : import unique.
  var docProps = PropertiesService.getDocumentProperties();
  if ((s.encData.getLastRow() < 2 && !docProps.getProperty('referenceImport')) || (docProps.getProperty('referenceImport') && docProps.getProperty('refVersion') !== REF_VERSION)) importReference(ss, s);
  refreshAll(ss, s, runSummary(payload), false);
  return { rows: plan.updates.length + plan.appends.length };
}

// Export pour les tests Node (sans effet dans Apps Script).
if (typeof module !== 'undefined') module.exports = { itemIconUrl: itemIconUrl, itemLayout: itemLayout, highlight_: highlight_, itemRows: itemRows, encounterLayout_: encounterLayout_, renderTrainers_: renderTrainers_, renderEncounters_: renderEncounters_, sortItems: sortItems, spriteId: spriteId, conditionsMap: conditionsMap, TCOL: TCOL, addDetectedFights_: addDetectedFights_, planPokemonRows: planPokemonRows, computeStats: computeStats, runTables: runTables, validatePayload: validatePayload,
  runSummary: runSummary, teamRows: teamRows, applyPayload: applyPayload, ensureStructure: ensureStructure, refreshAll: refreshAll,
  parseEncounterGrid: parseEncounterGrid, parseSpecialEncounters: parseSpecialEncounters, parseTrainerSheet: parseTrainerSheet,
  parseItemSheet: parseItemSheet, trainerRows: trainerRows, trainersFromRows: trainersFromRows, nextTrainer: nextTrainer,
  encounterStatus: encounterStatus, mapsecFor: mapsecFor, capFromFights: capFromFights, importReference: importReference, headers_: headers_,
  COL: COL, RUN: RUN, SHEETS: SHEETS, ARCHIVE_HEADERS: ARCHIVE_HEADERS, colLetter: colLetter, SPLITS: SPLITS };
