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
for _, name in ipairs(OFFICIAL_LUA_NAMES) do
	if fileExists(LUA_DIR .. name) then officialPath = LUA_DIR .. name break end
end
if not officialPath then
	error("Lua officiel introuvable. Copie 'Null_1.2.6.lua' dans " .. (LUA_DIR ~= "" and LUA_DIR or "le dossier de ce script") .. " puis relance NullCalcSync.lua.")
end
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

local function snapshot()
	local party = readParty()
	if not party then return nil end
	local box = readBoxes(1, ALIVE_BOXES)
	if not box then return nil end
	local dead = readBoxes(DEAD_FIRST_BOX, DEAD_BOXES)
	if not dead then return nil end
	return { party = party, box = box, dead = dead }
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

NULL_CALC_SYNC_TEST = { snapshot = snapshot, toJson = toJson, tick = tick, output = OUTPUT, writeOutput = writeOutput }

if callbacks and callbacks.add then
	callbacks:add("frame", tick)
end
log("Actif. Fichier synchronisé : " .. OUTPUT)
log("Tape NullCalcSyncNow() pour forcer une mise à jour.")
