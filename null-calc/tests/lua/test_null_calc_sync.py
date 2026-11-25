"""Test du script lua/NullCalcSync.lua avec une mémoire GBA simulée.

Prérequis : `pip install lupa` (Lua 5.4, comme mGBA) et le Lua officiel du jeu.
Lancement :
    NULL_OFFICIAL_LUA=/chemin/Null_1.2.6.lua python3 tests/lua/test_null_calc_sync.py

Le test encode des Pokémon exactement comme les lit le Lua officiel
(chiffrement XOR, ordre des sous-structures, checksum), exécute le script de
synchro, puis vérifie le contenu de docs/run-data.js.
"""
import json
import os
import pathlib
import shutil
import struct
import sys
import tempfile

import lupa.lua54 as lua54

ROOT = pathlib.Path(__file__).resolve().parents[2]
SYNC = ROOT / "lua" / "NullCalcSync.lua"
OFFICIAL = pathlib.Path(os.environ.get("NULL_OFFICIAL_LUA", ""))

PARTY_COUNT = 0x200536D
PARTY = 0x2005370
STORAGE = 0x200A154
ORDERS = [
    [0, 1, 2, 3], [0, 1, 3, 2], [0, 2, 1, 3], [0, 3, 1, 2], [0, 2, 3, 1], [0, 3, 2, 1],
    [1, 0, 2, 3], [1, 0, 3, 2], [2, 0, 1, 3], [3, 0, 1, 2], [2, 0, 3, 1], [3, 0, 2, 1],
    [1, 2, 0, 3], [1, 3, 0, 2], [2, 1, 0, 3], [3, 1, 0, 2], [2, 3, 0, 1], [3, 2, 0, 1],
    [1, 2, 3, 0], [1, 3, 2, 0], [2, 1, 3, 0], [3, 1, 2, 0], [2, 3, 1, 0], [3, 2, 1, 0],
]
# Encodage texte GBA (sous-ensemble utile : A-Z a-z)
def gba_text(s, length):
    out = []
    for ch in s:
        if "A" <= ch <= "Z":
            out.append(0xBB + ord(ch) - 65)
        elif "a" <= ch <= "z":
            out.append(0xD5 + ord(ch) - 97)
        else:
            raise ValueError(ch)
    out.append(0xFF)
    return bytes(out + [0xFF] * (length - len(out)))[:length]


class Memory:
    def __init__(self):
        self.bytes = {}

    def write(self, addr, data):
        for i, b in enumerate(data):
            self.bytes[addr + i] = b

    def read8(self, addr):
        return self.bytes.get(addr, 0)

    def read16(self, addr):
        return self.read8(addr) | self.read8(addr + 1) << 8

    def read32(self, addr):
        return self.read16(addr) | self.read16(addr + 2) << 16


def box_mon(personality, ot_id, nickname, species, item, exp, moves, pps, ivs, met_location, alt_ability=0):
    """Retourne 84 octets lisibles par readBoxMon du Lua officiel."""
    hp, atk, de, spe, spa, spd = ivs
    ss = [
        [species | item << 16, exp, 0 | 70 << 8 | 26 << 21],
        [moves[0] | moves[1] << 16, moves[2] | moves[3] << 16, pps[0] | pps[1] << 8 | pps[2] << 16 | pps[3] << 24],
        [0, 0, 0],
        [0 | met_location << 8 | (5 & 0x7F) << 16,
         hp | atk << 5 | de << 10 | spe << 15 | spa << 20 | spd << 25,
         alt_ability << 29],
    ]
    checksum = 0
    for block in ss:
        for word in block:
            checksum += (word & 0xFFFF) + (word >> 16)
    checksum &= 0xFFFF
    data = bytearray(84)
    struct.pack_into("<II", data, 0, personality, ot_id)
    data[8] = 0xFF  # Le Lua officiel lit le surnom à +9 si +8 vaut 'ヲ', sinon à +8.
    data[8:8 + 12] = gba_text(nickname, 12)
    data[0x15] = 0b010  # hasSpecies
    struct.pack_into("<H", data, 0x1E, checksum)
    key = ot_id ^ personality
    order = ORDERS[personality % 24]
    for logical, slot in enumerate(order):
        for i, word in enumerate(ss[logical]):
            struct.pack_into("<I", data, 36 + slot * 12 + i * 4, word ^ key)
    return bytes(data)


def party_mon(base, level, hp, stats, status=0):
    data = bytearray(104)
    data[:84] = base
    struct.pack_into("<I", data, 84, status)
    data[88] = level
    struct.pack_into("<HHHHHHH", data, 90, hp, *stats)
    return bytes(data)


def main():
    if not OFFICIAL.is_file():
        print("SKIP: définir NULL_OFFICIAL_LUA vers le Lua officiel du jeu.")
        return 0
    work = pathlib.Path(tempfile.mkdtemp())
    (work / "lua").mkdir()
    (work / "docs").mkdir()
    shutil.copy(SYNC, work / "lua" / "NullCalcSync.lua")
    shutil.copy(OFFICIAL, work / "lua" / "Null_1.2.6.lua")

    L = lua54.LuaRuntime()
    g = L.globals()
    mem = Memory()
    # IDs selon les tables du Lua officiel (vérifiés plus bas par nom).
    L.execute("callbacks={add=function() end}")
    L.execute(open(OFFICIAL, encoding="utf8").read())
    mons, moves, items = g.mons, g.move, g.item

    def sid(name):
        return next(i for i in range(1, len(mons) + 1) if mons[i] == name)

    def mid(name):
        return next(i for i in range(1, len(moves) + 1) if moves[i] == name) - 1

    def iid(name):
        return next(i for i in range(1, len(items) + 1) if items[i] == name)

    explosion = 153  # ID interne : masqué en "None" par le Lua officiel
    torchic = box_mon(0x12345678, 0xCAFEBABE, "Pyro", sid("Torchic"), iid("Leftovers"), 1000,
                      [mid("Ember"), mid("Scratch"), explosion, 0], [25, 35, 5, 0], (31, 30, 29, 28, 27, 26), 0x10)
    zigzagoon = box_mon(0x0BADF00D, 0xCAFEBABE, "Zig", sid("Zigzagoon"), 0, 500,
                        [mid("Tackle"), 0, 0, 0], [35, 0, 0, 0], (1, 2, 3, 4, 5, 6), 0x11)
    boxed = box_mon(0x01020304, 0xCAFEBABE, "Boxy", sid("Wingull"), 0, 2000,
                    [mid("Water Gun"), mid("Hidden Power"), 0, 0], [25, 15, 0, 0], (10, 10, 10, 10, 10, 10), 0x11)
    dead = box_mon(0x0A0B0C0D, 0xCAFEBABE, "Rip", sid("Poochyena"), 0, 800,
                   [mid("Bite"), 0, 0, 0], [25, 0, 0, 0], (0, 0, 0, 0, 0, 0), 0x12)
    # Talents lus dans la ROM (gSpeciesInfo, 36 octets par espèce, talents à +24).
    abilities = g.abilities
    def aid(name):
        return next(i for i in range(1, len(abilities) + 1) if abilities[i] == name)
    for name, ability in (("Torchic", "Blaze"), ("Zigzagoon", "Pickup"), ("Wingull", "Keen Eye"), ("Poochyena", "Run Away")):
        mem.write(0x83E4BF0 + 36 * sid(name) + 24, struct.pack("<H", aid(ability)))
    mem.write(PARTY_COUNT, bytes([2]))
    mem.write(PARTY, party_mon(torchic, 14, 33, (40, 22, 18, 20, 25, 19), status=1 << 4))
    mem.write(PARTY + 104, party_mon(zigzagoon, 9, 0, (30, 15, 14, 13, 12, 20)))
    mem.write(STORAGE + 4 + 2 * 84, boxed)                       # boîte 1, emplacement 3
    mem.write(STORAGE + 4 + (11 * 30) * 84, dead)                # boîte 12, emplacement 1
    # Un Pokémon corrompu (checksum faux) en boîte 2 doit bloquer l'écriture.
    g.mem = mem
    L.execute("""
        emu = {}
        function emu:read8(a) return mem.read8(a) end
        function emu:read16(a) return mem.read16(a) end
        function emu:read32(a) return mem.read32(a) end
        function emu:readRange(a, n)
            local t = {}
            for i = 0, n - 1 do t[#t + 1] = string.char(mem.read8(a + i)) end
            return table.concat(t)
        end
        local buf = {print=function() end, clear=function() end, setSize=function() end}
        console = {log=function(_, m) print(m) end, createBuffer=function() return buf end}
    """)
    g.NULL_CALC_LUA_DIR = str(work / "lua") + "/"
    L.execute(open(work / "lua" / "NullCalcSync.lua", encoding="utf8").read())
    L.execute("NullCalcSyncNow()")
    if os.environ.get("DEBUG"):
        print("output:", g.NULL_CALC_SYNC_TEST.output)
        print(L.eval("(function() local m=readBoxMon(0x2005370); return m.checksum..' vs '..computeBoxChecksum(0x2005370)..' sp '..m.species..' egg '..m.isEgg..' bad '..m.isBadEgg end)()"))
        print(L.eval("(function() local ok, r = pcall(NULL_CALC_SYNC_TEST.snapshot); return tostring(ok)..' '..tostring(r) end)()"))

    out = work / "docs" / "run-data.js"
    assert out.is_file(), "run-data.js absent"
    text = out.read_text(encoding="utf8")
    prefix = "window.NullRunSync&&window.NullRunSync.receive("
    assert text.startswith(prefix) and text.rstrip().endswith(");"), text[:80]
    payload = json.loads(text[len(prefix):text.rstrip().rindex(")")])
    if os.environ.get("RUN_DATA_OUT"):
        shutil.copy(out, os.environ["RUN_DATA_OUT"])
    data = payload["data"]
    party, box, dead_list = data["party"], data["box"], data["dead"]

    assert [m["species"] for m in party] == ["Torchic", "Zigzagoon"], party
    t = party[0]
    assert t["nickname"] == "Pyro", t["nickname"]
    assert t["item"] == "Leftovers"
    assert t["ability"] == "Blaze", t["ability"]
    assert "Ability: Blaze" in t["showdown"]
    assert t["level"] == 14 and t["hp"] == 33 and t["maxHP"] == 40
    assert t["stats"] == {"hp": 40, "atk": 22, "def": 18, "spe": 20, "spa": 25, "spd": 19}, t["stats"]
    assert t["status"] == "brn"
    assert t["ivs"] == {"hp": 31, "atk": 30, "def": 29, "spe": 28, "spa": 27, "spd": 26}, t["ivs"]
    assert [m["name"] for m in t["moves"]] == ["Ember", "Scratch", "Explosion"], t["moves"]
    assert [m["pp"] for m in t["moves"]] == [25, 35, 5]
    assert "- Explosion" in t["showdown"] and "Torchic @ Leftovers" in t["showdown"], t["showdown"]
    assert t["uid"] == "12345678-cafebabe"
    assert party[1]["hp"] == 0
    assert [(m["species"], m["box"], m["boxSlot"]) for m in box] == [("Wingull", 1, 3)], box
    assert box[0]["level"] >= 1 and box[0]["nickname"] == "Boxy"
    assert [(m["species"], m["box"]) for m in dead_list] == [("Poochyena", 12)], dead_list

    # Un Pokémon dont le checksum est faux (écriture en cours) bloque la mise à jour.
    corrupt = bytearray(boxed)
    corrupt[0x1E] ^= 0xFF
    mem.write(STORAGE + 4 + 30 * 84, bytes(corrupt))
    before = out.read_text(encoding="utf8")
    L.execute("NullCalcSyncNow()")
    assert out.read_text(encoding="utf8") == before, "un Pokémon corrompu ne doit pas produire de données partielles"

    # Aucune partie chargée : rien n'est écrit.
    mem.write(STORAGE + 4 + 30 * 84, bytes(84))
    mem.write(PARTY_COUNT, bytes([0]))
    out.unlink()
    L.execute("NullCalcSyncNow()")
    assert not out.exists(), "aucune écriture sans équipe valide"

    print("OK: NullCalcSync.lua — équipe, boîtes, morts, checksum, attaques restaurées.")
    shutil.rmtree(work)
    return 0


if __name__ == "__main__":
    sys.exit(main())
