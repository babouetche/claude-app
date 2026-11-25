-- ============================================================================
--  NullCalcSync.lua — Synchronisation automatique Pokémon Null -> calculateur
-- ============================================================================
--  Émulateur : mGBA 0.10 ou plus récent (Outils > Scripting).
--
--  Installation (une seule fois) :
--    1. Copie le Lua officiel du jeu (ex. "Null_1.2.6.lua") dans CE dossier
--       (null-calc/lua/), à côté de ce fichier.
--    2. Dans mGBA : Outils > Scripting > Fichier > Charger un script,
--       puis choisis NullCalcSync.lua (pas le Lua officiel).
--    3. Ouvre CALCULATEUR.html : l'onglet « Suivi de run » se met à jour seul.
--
--  Ce script NE MODIFIE JAMAIS la mémoire du jeu : il lit seulement l'équipe
--  et les boîtes, puis écrit docs/run-data.js à chaque changement.
--  Toutes les adresses et le décodage viennent du Lua officiel du jeu.
-- ============================================================================

local SYNC_VERSION = 1

-- Noms possibles du Lua officiel (le premier trouvé est utilisé).
local OFFICIAL_LUA_NAMES = { "Null_1.2.6.lua", "NullLuaV1.2.6.lua", "Null.lua" }

-- Adresses Null 1.2.6 (identiques au Lua officiel, où elles sont "local").
local PARTY_ADDR       = 0x2005370 -- gPlayerParty
local PARTY_MON_SIZE   = 104
local PARTY_COUNT_ADDR = 0x200536d -- gPlayerPartyCount
-- Équipe adverse : dans pokeemerald, gEnemyParty suit gPlayerParty (6 × 104 octets ici).
-- Adresse déduite de l'agencement mémoire, pas du Lua officiel : chaque Pokémon lu
-- doit passer le checksum du jeu, sinon rien n'est exporté.
local ENEMY_PARTY_ADDR = 0x2005370 + 6 * 104
local STORAGE_ADDR     = 0x200a154 -- gPokemonStorage
local BOX_MON_SIZE     = 84
local BOX_SIZE         = 30
local ALIVE_BOXES      = 11        -- boîtes 1 à 11
local DEAD_FIRST_BOX   = 12        -- boîtes 12 à 14 : "dead boxes" du Lua officiel
local DEAD_BOXES       = 3

local CHECK_EVERY_FRAMES = 30      -- ~0,5 s
local HEARTBEAT_SECONDS  = 5

-- ---------------------------------------------------------------------------
-- Dossier du script
-- ---------------------------------------------------------------------------
local function scriptDir()
	if NULL_CALC_LUA_DIR then return NULL_CALC_LUA_DIR end
	local ok, info = pcall(function() return debug.getinfo(1, "S") end)
	local src = ok and info and info.source or ""
	src = src:gsub("^[@=]", "")
	local dir = src:match("^(.*[/\\])")
	return dir or ""
end

local LUA_DIR = scriptDir()
if LUA_DIR == "" then
	error("Dossier du script introuvable. Dans la console mGBA, tape par exemple :\n" ..
		"NULL_CALC_LUA_DIR = [[C:\\Jeux\\null-calc\\lua\\]] puis recharge NullCalcSync.lua.")
end
local SEP = LUA_DIR:find("\\", 1, true) and "\\" or "/"
local OUTPUT = LUA_DIR .. ".." .. SEP .. "docs" .. SEP .. "run-data.js"

local function log(msg)
	if console and console.log then console:log("[NullCalcSync] " .. msg) else print("[NullCalcSync] " .. msg) end
end

local function fileExists(path)
	local f = io.open(path, "rb")
	if f then f:close() return true end
	return false
end

-- ---------------------------------------------------------------------------
-- Chargement du Lua officiel (tables de noms + décodage)
-- ---------------------------------------------------------------------------
local officialPath
if NULL_OFFICIAL_LUA and fileExists(NULL_OFFICIAL_LUA) then officialPath = NULL_OFFICIAL_LUA end
if not officialPath then
	for _, name in ipairs(OFFICIAL_LUA_NAMES) do
		-- ".lua.lua" : Windows masque souvent l'extension, le fichier peut avoir été renommé deux fois.
		for _, candidate in ipairs({ name, name .. ".lua" }) do
			if not officialPath and fileExists(LUA_DIR .. candidate) then officialPath = LUA_DIR .. candidate end
		end
	end
end
-- Sinon : n'importe quel .lua du dossier dont le nom contient « null » (sauf ce script).
local seenLua = {}
if not officialPath and io.popen then
	local isWindows = LUA_DIR:match("^%a:") ~= nil
	local cmd = isWindows and ('dir /b "' .. LUA_DIR:gsub("/", "\\") .. '"') or ('ls -1 "' .. LUA_DIR .. '"')
	local ok, pipe = pcall(io.popen, cmd)
	if ok and pipe then
		for file in pipe:lines() do
			seenLua[#seenLua + 1] = file
			local lower = file:lower()
			if not officialPath and lower:match("%.lua$") and lower:find("null", 1, true) and not lower:find("nullcalcsync", 1, true) then
				officialPath = LUA_DIR .. file
			end
		end
		pipe:close()
	end
end
if not officialPath then
	error("Lua officiel introuvable dans " .. LUA_DIR .. "\n" ..
		"Fichiers vus : " .. (#seenLua > 0 and table.concat(seenLua, ", ") or "(liste indisponible)") .. "\n" ..
		"Renomme le Lua du jeu en Null_1.2.6.lua et mets-le dans ce dossier, ou tape dans la console :\n" ..
		"NULL_OFFICIAL_LUA = [[C:\\chemin\\vers\\le\\fichier.lua]] puis recharge NullCalcSync.lua.")
end
log("Lua officiel : " .. officialPath)
dofile(officialPath)

for _, fn in ipairs({ "readBoxMon", "readPartyMon", "getAbility", "getNature", "getHP", "calcLevel",
		"getPartyPrint", "getPCPrint", "getMetLocationName", "computeBoxChecksum" }) do
	if type(_G[fn]) ~= "function" then error("Lua officiel incompatible : fonction " .. fn .. " absente.") end
end
for _, t in ipairs({ "mons", "move", "item", "nature" }) do
	if type(_G[t]) ~= "table" then error("Lua officiel incompatible : table " .. t .. " absente.") end
end

-- Le Lua officiel remplace 4 attaques par "None" dans son export.
-- On remet leur vrai nom, seulement si les voisines confirment la position.
local RESTORED_MOVES = {
	{ 121, "Mirror Move", "Egg Bomb", "Self-Destruct" },
	{ 154, "Crabhammer", "Fury Swipes", "Explosion" },
	{ 516, "Retaliate", "Bestow", "Final Gambit" },
	{ 731, "Shell Side Arm", "Grassy Glide", "Misty Explosion" },
}
for _, r in ipairs(RESTORED_MOVES) do
	if move[r[1]] == "None" and move[r[1] - 1] == r[2] and move[r[1] + 1] == r[3] then
		move[r[1]] = r[4]
	end
end

-- ---------------------------------------------------------------------------
-- JSON minimal
-- ---------------------------------------------------------------------------
local function jsonString(s)
	s = tostring(s)
	s = s:gsub('[%c"\\]', function(c)
		if c == '"' then return '\\"' end
		if c == "\\" then return "\\\\" end
		if c == "\n" then return "\\n" end
		if c == "\r" then return "\\r" end
		if c == "\t" then return "\\t" end
		return string.format("\\u%04x", c:byte())
	end)
	return '"' .. s .. '"'
end

local function isArray(t)
	local n = 0
	for k in pairs(t) do
		if type(k) ~= "number" then return false end
		n = n + 1
	end
	return n == #t
end

local function toJson(v)
	local tv = type(v)
	if tv == "nil" then return "null" end
	if tv == "boolean" then return v and "true" or "false" end
	if tv == "number" then
		if v ~= v or v == math.huge or v == -math.huge then return "null" end
		if math.type(v) == "integer" then return tostring(v) end
		return string.format("%.6g", v)
	end
	if tv == "string" then return jsonString(v) end
	if tv == "table" then
		local parts = {}
		if next(v) == nil then return "[]" end
		if isArray(v) then
			for i = 1, #v do parts[i] = toJson(v[i]) end
			return "[" .. table.concat(parts, ",") .. "]"
		end
		local keys = {}
		for k in pairs(v) do keys[#keys + 1] = tostring(k) end
		table.sort(keys)
		for _, k in ipairs(keys) do parts[#parts + 1] = jsonString(k) .. ":" .. toJson(v[k]) end
		return "{" .. table.concat(parts, ",") .. "}"
	end
	return "null"
end

-- ---------------------------------------------------------------------------
-- Lecture des Pokémon
-- ---------------------------------------------------------------------------
local function statusName(raw)
	if raw & 7 ~= 0 then return "slp" end
	if raw & (1 << 7) ~= 0 then return "tox" end
	if raw & (1 << 3) ~= 0 then return "psn" end
	if raw & (1 << 4) ~= 0 then return "brn" end
	if raw & (1 << 5) ~= 0 then return "frz" end
	if raw & (1 << 6) ~= 0 then return "par" end
	-- pokeemerald-expansion : STATUS1_FROSTBITE = (1 << 12), après le compteur Toxik (bits 8-11).
	if raw & (1 << 12) ~= 0 then return "frb" end
	return ""
end

local function safe(fn, ...)
	local ok, value = pcall(fn, ...)
	if ok then return value end
	return nil
end

local function describe(mon, address, place)
	if mon.species == 0 or mons[mon.species] == nil then return nil end
	if mon.isEgg == 1 or mon.isBadEgg == 1 then return nil end
	if computeBoxChecksum(address) ~= mon.checksum then return false end

	local entry = {
		uid = string.format("%08x-%08x", mon.personality, mon.otId),
		species = mons[mon.species],
		speciesId = mon.species,
		nickname = mon.nickname or "",
		nature = safe(getNature, mon) or "",
		ability = safe(getAbility, mon) or "",
		item = (mon.heldItem ~= 0 and item[mon.heldItem]) or "",
		itemId = mon.heldItem,
		ivs = { hp = mon.hpIV, atk = mon.attackIV, def = mon.defenseIV, spa = mon.spAttackIV, spd = mon.spDefenseIV, spe = mon.speedIV },
		moves = {},
		metLocation = safe(getMetLocationName, mon.metLocation) or "",
		metLocationId = mon.metLocation,
		metLevel = mon.metLevel,
		hiddenPower = safe(getHP, mon) or "",
	}
	for i = 1, 4 do
		local name = move[mon.moves[i] + 1]
		if name and name ~= "" then
			entry.moves[#entry.moves + 1] = { name = name, pp = mon.pp[i] }
		end
	end
	if place == "party" then
		entry.level = mon.level
		entry.hp = mon.hp
		entry.maxHP = mon.maxHP
		entry.stats = { hp = mon.maxHP, atk = mon.attack, def = mon.defense, spa = mon.spAttack, spd = mon.spDefense, spe = mon.speed }
		-- Le Lua officiel lit le statut à +80, ce qui tombe dans les données
		-- chiffrées (Pokémon de boîte = 84 octets). Le statut suit la partie
		-- boîte : +84, puis niveau +88, PV +90 (même agencement que le jeu).
		entry.status = statusName(emu:read32(address + BOX_MON_SIZE))
		entry.showdown = safe(getPartyPrint, mon, nil, 1) or ""
	else
		entry.level = safe(calcLevel, mon.experience, mon.species) or 0
		entry.showdown = safe(getPCPrint, mon, nil, 1) or ""
	end
	return entry
end

local function readParty()
	local count = emu:read8(PARTY_COUNT_ADDR)
	if count < 1 or count > 6 then return nil end
	local list = {}
	local party = getParty()
	for i, mon in ipairs(party) do
		local address = PARTY_ADDR + PARTY_MON_SIZE * (i - 1)
		local entry = describe(mon, address, "party")
		if entry == false then return nil end -- écriture en cours : on réessaie
		if entry then entry.slot = i list[#list + 1] = entry end
	end
	return list
end

local function readBoxes(firstBox, boxCount)
	local list = {}
	for b = firstBox, firstBox + boxCount - 1 do
		for s = 0, BOX_SIZE - 1 do
			local address = STORAGE_ADDR + 4 + ((b - 1) * BOX_SIZE + s) * BOX_MON_SIZE
			if emu:read32(address) ~= 0 then
				local entry = describe(readBoxMon(address), address, "box")
				if entry == false then return nil end
				if entry then
					entry.box = b
					entry.boxSlot = s + 1
					list[#list + 1] = entry
				end
			end
		end
	end
	return list
end

-- ---------------------------------------------------------------------------
-- Combats de dresseurs : équipe adverse + historique (fichier dans ce dossier)
-- ---------------------------------------------------------------------------
local HISTORY = LUA_DIR .. "historique-combats.txt"
local history = { runs = {}, fights = {} }  -- runs : ordre d'apparition des parties ; fights : par partie
local lastEnemySig = nil

local function loadHistory()
	local f = io.open(HISTORY, "r")
	if not f then return end
	for line in f:lines() do
		local kind, run, t, rest = line:match("^(%a)|([^|]*)|(%d+)|?(.*)$")
		if kind == "R" then history.runs[#history.runs + 1] = run
		elseif kind == "F" then
			local team, sigText, lead, frags = {}, rest, nil, {}
			local p1 = rest:find("|", 1, true)
			if p1 then
				sigText = rest:sub(1, p1 - 1)
				for field in rest:sub(p1 + 1):gmatch("[^|]+") do
					local key, val = field:match("^(%a)=(.*)$")
					if key == "L" and val ~= "" then lead = val
					elseif key == "K" then for uid, n in val:gmatch("([^,:]+):(%d+)") do frags[#frags + 1] = { uid = uid, n = tonumber(n) } end end
				end
			end
			for sp, lv, it in sigText:gmatch("([^;:]+):(%d+):(%d+)") do team[#team + 1] = { species = sp, level = tonumber(lv), itemId = tonumber(it) } end
			history.fights[run] = history.fights[run] or {}
			table.insert(history.fights[run], { t = tonumber(t), team = team, lead = lead, frags = frags })
		end
	end
	f:close()
end
local function appendHistory(line)
	local f = io.open(HISTORY, "a")
	if f then f:write(line .. "\n") f:close() end
end

-- Identifiant de la partie : numéro de dresseur (OT) le plus fréquent de l'équipe.
local function runIdOf(party)
	local counts, best, bestN = {}, nil, 0
	for _, m in ipairs(party) do
		local ot = m.uid:match("%-(%x+)$")
		if ot then counts[ot] = (counts[ot] or 0) + 1 if counts[ot] > bestN then best, bestN = ot, counts[ot] end end
	end
	return best
end

-- Un Pokémon d'équipe valide à cette adresse (checksum du jeu, niveau et PV cohérents) ?
local function validPartyMon(address)
	if emu:read32(address) == 0 then return nil end
	local level = emu:read8(address + BOX_MON_SIZE + 4)
	if level < 1 or level > 100 then return nil end
	local hp, maxHP = emu:read16(address + BOX_MON_SIZE + 6), emu:read16(address + BOX_MON_SIZE + 8)
	if maxHP == 0 or maxHP > 999 or hp > maxHP then return nil end
	local mon = readBoxMon(address)
	if mon.species == 0 or mons[mon.species] == nil then return nil end
	if computeBoxChecksum(address) ~= mon.checksum then return nil end
	return mon, level, hp, maxHP
end

local function readEnemyAt(base)
	local team = {}
	for i = 0, 5 do
		local address = base + PARTY_MON_SIZE * i
		if emu:read32(address) == 0 then break end
		local mon, level, hp, maxHP = validPartyMon(address)
		if not mon then return nil end -- donnée corrompue : rien plutôt qu'une équipe partielle
		team[#team + 1] = { species = mons[mon.species], level = level, itemId = mon.heldItem,
			item = (mon.heldItem ~= 0 and item[mon.heldItem]) or "", hp = hp, maxHP = maxHP, personality = mon.personality }
	end
	if #team == 0 then return nil end
	return team
end

-- L'adresse de gEnemyParty n'est pas dans le Lua officiel. On essaie l'adresse déduite ;
-- si rien n'y est jamais lu, on cherche l'équipe adverse dans toute la mémoire (par morceaux,
-- sans ralentir le jeu) et on retient l'adresse trouvée dans adresse-adversaire.txt.
local ENEMY_ADDR_FILE = LUA_DIR .. "adresse-adversaire.txt"
local enemyAddr, enemyConfirmed = ENEMY_PARTY_ADDR, false
local scanPos, SCAN_START, SCAN_END, SCAN_STEP = nil, 0x2000000, 0x2040000, 0x8000
do
	local f = io.open(ENEMY_ADDR_FILE, "r")
	if f then
		local v = tonumber((f:read("*l") or ""):match("0x%x+") or "")
		f:close()
		if v then enemyAddr, enemyConfirmed = v, true end
	end
end
local function playerPersonalities()
	local set, n = {}, emu:read8(PARTY_COUNT_ADDR)
	for i = 0, math.min(n, 6) - 1 do set[emu:read32(PARTY_ADDR + PARTY_MON_SIZE * i)] = true end
	return set
end
-- Équipe adverse = pas une copie de la mienne (la sauvegarde garde une copie de mon équipe).
local function isEnemyTeam(team, mine)
	for _, m in ipairs(team) do if mine[m.personality] then return false end end
	return true
end
local function excluded(a)
	return (a >= PARTY_ADDR and a < PARTY_ADDR + 6 * PARTY_MON_SIZE)
		or (a >= STORAGE_ADDR and a < STORAGE_ADDR + 4 + 14 * BOX_SIZE * BOX_MON_SIZE)
end
local function scanStep(mine)
	scanPos = scanPos or SCAN_START
	local stop = math.min(scanPos + SCAN_STEP, SCAN_END)
	for a = scanPos, stop - 4, 4 do
		if not excluded(a) and validPartyMon(a) then
			local base = a
			while not excluded(base - PARTY_MON_SIZE) and base - PARTY_MON_SIZE >= SCAN_START and validPartyMon(base - PARTY_MON_SIZE) do base = base - PARTY_MON_SIZE end
			local team = readEnemyAt(base)
			if team and isEnemyTeam(team, mine) then scanPos = nil return base end
		end
	end
	scanPos = (stop >= SCAN_END) and nil or stop
	return nil
end
local function saveEnemyAddr(a)
	local f = io.open(ENEMY_ADDR_FILE, "w")
	if f then f:write(string.format("0x%x\n", a)) f:close() end
end

local function readEnemy()
	local mine = playerPersonalities()
	local team = readEnemyAt(enemyAddr)
	if team and isEnemyTeam(team, mine) then
		if not enemyConfirmed then
			enemyConfirmed = true
			saveEnemyAddr(enemyAddr)
			log(string.format("Équipe adverse trouvée en mémoire (0x%x).", enemyAddr))
		end
		return team
	end
	if enemyConfirmed then return nil end
	local found = scanStep(mine)
	if found then
		enemyAddr, enemyConfirmed = found, true
		saveEnemyAddr(found)
		log(string.format("Équipe adverse trouvée en mémoire (0x%x).", found))
		return readEnemyAt(found)
	end
	return nil
end

-- Combat en cours : lead (premier Pokémon debout au début), dernier attaquant (ses PP ont baissé),
-- et frags (adversaire qui tombe à 0 PV → attribué au dernier Pokémon qui a attaqué).
local battle = nil
local function ppSum(m) local s = 0 for _, mv in ipairs(m.moves or {}) do s = s + (mv.pp or 0) end return s end
local function sigOf(team) local p = {} for _, m in ipairs(team) do p[#p + 1] = m.species .. ":" .. m.level .. ":" .. m.itemId end return table.concat(p, ";") end
local function followBattle(party, enemy)
	if not enemy then return end
	local sig, alive = sigOf(enemy), false
	for _, m in ipairs(enemy) do if m.hp > 0 then alive = true end end
	if alive and (not battle or battle.sig ~= sig) then
		battle = { sig = sig, pp = {}, hp = {}, frags = {}, order = {} }
		for _, m in ipairs(party) do if m.hp > 0 and not battle.lead then battle.lead = m.uid end end
		for _, m in ipairs(party) do battle.pp[m.uid] = ppSum(m) end
		for i, m in ipairs(enemy) do battle.hp[i] = m.hp end
		return
	end
	if not battle or battle.sig ~= sig then return end
	for _, m in ipairs(party) do
		local s = ppSum(m)
		if battle.pp[m.uid] and s < battle.pp[m.uid] then battle.last = m.uid end
		battle.pp[m.uid] = s
	end
	for i, m in ipairs(enemy) do
		if (battle.hp[i] or 0) > 0 and m.hp == 0 then
			local who = battle.last or battle.lead
			if who then
				if not battle.frags[who] then battle.order[#battle.order + 1] = who end
				battle.frags[who] = (battle.frags[who] or 0) + 1
			end
		end
		battle.hp[i] = m.hp
	end
end

local function trackFights(party)
	local run = runIdOf(party)
	if not run then return nil end
	local known = false
	for _, r in ipairs(history.runs) do if r == run then known = true end end
	if not known then
		history.runs[#history.runs + 1] = run
		appendHistory("R|" .. run .. "|" .. os.time())
	end
	local enemy = readEnemy()
	followBattle(party, enemy)
	-- Un combat n'est compté qu'une fois gagné : tous les Pokémon adverses K.O.
	local won = enemy ~= nil
	if enemy then for _, m in ipairs(enemy) do if m.hp > 0 then won = false end end end
	if won then
		local parts = {}
		for _, m in ipairs(enemy) do parts[#parts + 1] = m.species .. ":" .. m.level .. ":" .. m.itemId end
		local sig = table.concat(parts, ";")
		local fights = history.fights[run] or {}
		local last = fights[#fights]
		local lastSig = nil
		if last then
			local lp = {}
			for _, m in ipairs(last.team) do lp[#lp + 1] = m.species .. ":" .. m.level .. ":" .. m.itemId end
			lastSig = table.concat(lp, ";")
		end
		if sig ~= lastSig and sig ~= lastEnemySig then
			local t = os.time()
			history.fights[run] = fights
			local lead, frags, kText = nil, {}, {}
			if battle and battle.sig == sig then
				lead = battle.lead
				for _, uid in ipairs(battle.order) do frags[#frags + 1] = { uid = uid, n = battle.frags[uid] } kText[#kText + 1] = uid .. ":" .. battle.frags[uid] end
			end
			table.insert(fights, { t = t, team = enemy, lead = lead, frags = frags })
			appendHistory("F|" .. run .. "|" .. t .. "|" .. sig .. "|L=" .. (lead or "") .. "|K=" .. table.concat(kText, ","))
			log("Combat gagné : " .. sig .. (#kText > 0 and ("  (frags : " .. table.concat(kText, ", ") .. ")") or ""))
		end
		lastEnemySig = sig
		battle = nil
	end
	local list = {}
	for i, f in ipairs(history.fights[run] or {}) do
		local team = {}
		for _, m in ipairs(f.team) do team[#team + 1] = { species = m.species, level = m.level, itemId = m.itemId } end
		local frags = {}
		for _, k in ipairs(f.frags or {}) do frags[#frags + 1] = { uid = k.uid, n = k.n } end
		list[i] = { t = f.t, team = team, lead = f.lead, frags = frags }
	end
	local runIndex = 1
	for i, r in ipairs(history.runs) do if r == run then runIndex = i end end
	return { runId = run, runIndex = runIndex, runCount = #history.runs, fights = list, enemy = enemy }
end

pcall(loadHistory)

local function snapshot()
	local party = readParty()
	if not party then return nil end
	local box = readBoxes(1, ALIVE_BOXES)
	if not box then return nil end
	local dead = readBoxes(DEAD_FIRST_BOX, DEAD_BOXES)
	if not dead then return nil end
	local ok, battle = pcall(trackFights, party)
	return { party = party, box = box, dead = dead, battle = ok and battle or nil }
end

-- ---------------------------------------------------------------------------
-- Overlay OBS : compatibilité avec PokemonNullDisplay (Sykless, Apache-2.0)
-- ---------------------------------------------------------------------------
-- Si PokemonNullDisplay.exe a été lancé une fois, il définit la variable
-- POKEMONNULLREADER_CONFFILE. On écrit alors pokemonData.txt au même format
-- et avec la même sélection que PokemonNullDisplay.lua :
--   PARTY|espèce¤niveau¤objet|…   BOX|…   DEAD|…
-- Ainsi un seul script Lua suffit ; l'exe continue de dessiner les images.
-- Seule différence voulue : le niveau des Pokémon en boîte utilise la table
-- gSpeciesInfo de la 1.2.6 (via le Lua officiel), là où PokemonNullDisplay
-- lit une adresse d'une version précédente (0x83de378 au lieu de 0x83e4bf0).
local displayPath = nil
pcall(function() displayPath = os.getenv("POKEMONNULLREADER_CONFFILE") end)
local lastDisplay = nil

local function displayText()
	local partyText, boxText, deadText = "PARTY", "BOX", "DEAD"
	for _, mon in ipairs(getParty()) do
		if mon.species ~= 0 then
			partyText = partyText .. "|" .. mon.species .. "¤" .. mon.level .. "¤" .. mon.heldItem
		end
	end
	local address, i, emptyBox, alive = STORAGE_ADDR + 4, 0, false, true
	while i < 420 do
		if alive then boxText = boxText .. "|"
		elseif i >= 360 then deadText = deadText .. "|" end
		if i % 30 == 0 then
			if emptyBox then
				if alive then
					alive = false
					boxText = string.sub(boxText, 1, #boxText - 31) -- retire les 30 cases vides de la boîte vide
				end
			else
				emptyBox = true
			end
		end
		if emu:read32(address) ~= 0 then
			local mon = readBoxMon(address)
			if mon.species ~= 0 then
				emptyBox = false
				if alive then
					local level = mon.isEgg == 1 and 1 or calcLevel(mon.experience, mon.species)
					boxText = boxText .. mon.species .. "¤" .. level .. "¤" .. mon.heldItem
				else
					deadText = deadText .. mon.species .. "¤0¤" .. mon.heldItem
				end
			end
		end
		address = address + BOX_MON_SIZE
		i = i + 1
	end
	return partyText .. "\n" .. boxText .. "\n" .. deadText
end

local function writeDisplay()
	if not displayPath then return end
	local ok, text = pcall(displayText)
	if not ok or text == lastDisplay then return end
	local f = io.open(displayPath, "w")
	if f then f:write(text) f:close() lastDisplay = text end
end

-- ---------------------------------------------------------------------------
-- Écriture du fichier lu par le calculateur
-- ---------------------------------------------------------------------------
local lastBody, lastWrite, frameCount, warned = nil, 0, 0, false

local function writeOutput(body)
	local now = os.time()
	local payload = '{"version":' .. SYNC_VERSION .. ',"game":"Pokemon Null 1.2.6","writtenAt":' .. now ..
		',"data":' .. body .. '}'
	local js = "window.NullRunSync&&window.NullRunSync.receive(" .. payload .. ");\n"
	local tmp = OUTPUT .. ".tmp"
	local f, err = io.open(tmp, "wb")
	if not f then
		if not warned then log("Impossible d'écrire " .. OUTPUT .. " : " .. tostring(err)) warned = true end
		return
	end
	f:write(js)
	f:close()
	os.remove(OUTPUT)
	local ok, renameErr = os.rename(tmp, OUTPUT)
	if not ok then
		if not warned then log("Impossible de renommer le fichier : " .. tostring(renameErr)) warned = true end
		return
	end
	lastWrite = now
end

local function tick()
	frameCount = frameCount + 1
	if frameCount % CHECK_EVERY_FRAMES ~= 0 then return end
	local ok, data = pcall(snapshot)
	if not ok then
		if not warned then log("Lecture impossible : " .. tostring(data)) warned = true end
		return
	end
	if not data then return end
	writeDisplay()
	local body = toJson(data)
	if body ~= lastBody or os.time() - lastWrite >= HEARTBEAT_SECONDS then
		writeOutput(body)
		if body ~= lastBody then
			lastBody = body
			log(string.format("Mis à jour : équipe %d, boîtes %d, morts %d.", #data.party, #data.box, #data.dead))
		end
	end
end

-- Expose des fonctions utiles dans la console mGBA.
function NullCalcSyncNow()
	lastBody = nil
	frameCount = CHECK_EVERY_FRAMES - 1
	tick()
end

NULL_CALC_SYNC_TEST = { history = history, readEnemy = function() return readEnemy() end, readEnemyAt = function(a) return readEnemyAt(a) end, enemyAddr = function() return enemyAddr end, displayText = function() return displayText() end, snapshot = snapshot, toJson = toJson, tick = tick, output = OUTPUT, writeOutput = writeOutput }

if callbacks and callbacks.add then
	callbacks:add("frame", tick)
end
log("Actif. Fichier synchronisé : " .. OUTPUT)
log("Tape NullCalcSyncNow() pour forcer une mise à jour.")
if displayPath then log("Overlay OBS (PokemonNullDisplay) : " .. displayPath)
else log("Overlay OBS : lance PokemonNullDisplay.exe une fois puis redémarre mGBA pour l'activer (facultatif).") end
