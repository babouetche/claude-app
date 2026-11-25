"""Read verified numeric tables from the supplied ROM; never write to the ROM.

Offsets belong ONLY to the SHA256 below. Lua supplies enum names and the
species table address/stride; independent binary anchors validate the layouts.
No save file, emulator, Lua execution or native AI disassembly is involved.
"""
import hashlib
import argparse
import json
import pathlib
import re
import struct
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
CONFIG = json.loads((ROOT / 'scripts/release-config.json').read_text(encoding='utf8'))
PINNED = json.loads((ROOT / 'tests/fixtures' / CONFIG['romFixture']).read_text(encoding='utf8'))
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('rom', type=pathlib.Path)
parser.add_argument('--lua', type=pathlib.Path)
parser.add_argument('--output', type=pathlib.Path, default=ROOT / 'verification/rom-data-current.json')
args = parser.parse_args()
ROM = args.rom
LUA = args.lua or ROM.parent / ('NullLuaV' + CONFIG['gameVersion'] + '.lua')
EXPECTED = PINNED['romSHA256']
data = ROM.read_bytes()
assert hashlib.sha256(data).hexdigest() == EXPECTED, 'Unsupported ROM; do not reuse these offsets.'
lua = LUA.read_text(encoding='utf8')
assert hashlib.sha256(LUA.read_bytes()).hexdigest() == CONFIG['luaSHA256'], 'Unsupported Lua enum reference.'

def enum(name):
    block = re.search(r'^' + name + r'\s*=\s*\{(.*?)^\}', lua, re.M | re.S)
    assert block, name
    return re.findall(r'"([^"\n]*)"', block.group(1))

move_names, species_names, ability_names = enum('move'), enum('mons'), enum('abilities')
assert (len(move_names), len(species_names), len(ability_names)) == (849, 1404, 306)
# The Lua enum stops before the 22 additional Mega records. Their identities
# are separately pinned through native form-change records, not guessed.
for index, name in sorted(PINNED.get('additionalSpeciesNames', {}).items(), key=lambda pair: int(pair[0])):
    assert int(index) == len(species_names) + 1
    species_names.append(name)
assert len(species_names) == PINNED.get('nativeSpeciesCount', 1404)
# The supplied Lua omits the last four abilities. Read their names from the
# native 17-byte name slots, independently anchored by Stench and Drizzle.
def encoded_name(text):
    return bytes(0 if c == ' ' else 0xBB+ord(c)-65 if 'A' <= c <= 'Z'
                 else 0xD5+ord(c)-97 for c in text) + b'\xff'
ability_name_base = int(PINNED['tableAddresses']['abilityNames'], 16)
for index, name in [(1,'Stench'), (2,'Drizzle'), (307,'Tera Shift'),
                    (308,'Tera Shell'), (309,'Teraform Zero'), (310,'Poison Puppeteer')]:
    assert data[ability_name_base+17*index:].startswith(encoded_name(name)), name
ability_names.extend(['Tera Shift','Tera Shell','Teraform Zero','Poison Puppeteer'])
types = ['Normal', 'Fighting', 'Flying', 'Poison', 'Ground', 'Rock', 'Bug',
         'Ghost', 'Steel', '???', 'Fire', 'Water', 'Grass', 'Electric',
         'Psychic', 'Ice', 'Dragon', 'Dark', 'Fairy', 'Stellar']
move_base, species_base, dex_weight_base = (int(PINNED['tableAddresses'][name],16) for name in ['moves','species','nationalDexWeightField'])
categories = ['Physical', 'Special', 'Status']

def move_row(index, name):
    offset = move_base + 24 * index
    raw = data[offset:offset + 24]
    assert raw[4] < len(types) and raw[11] < 3 and raw[5] <= 100
    assert -7 <= struct.unpack_from('<b', raw, 10)[0] <= 5
    return dict(id=index, offset=hex(offset), bytes=raw.hex(),
                effect=struct.unpack_from('<H', raw)[0],
                basePower=struct.unpack_from('<H', raw, 2)[0], type=types[raw[4]],
                accuracy=raw[5] or 101, pp=raw[6], secondaryChance=raw[7],
                targetBits=struct.unpack_from('<H', raw, 8)[0],
                priority=struct.unpack_from('<b', raw, 10)[0], category=categories[raw[11]],
                slicing=bool(raw[17] & 4), sheerForceBoosted=bool(raw[16] & 2),
                wind=bool(raw[17] & 2), powder=bool(raw[16] & 128))

moves = {name: move_row(i, name) for i, name in enumerate(move_names) if name}
anchors = {'Pound': (40, 100, 35, 0, 'Physical'),
           'Thunderbolt': (90, 100, 15, 0, 'Special'),
           'Protect': (0, 101, 5, 4, 'Status'),
           'Trick Room': (0, 101, 5, -7, 'Status'),
           'Water Shuriken': (20, 100, 20, 2, 'Special'),
           'Glaciate': (80, 100, 10, 0, 'Special'),
           'Infernal Parade': (70, 100, 15, 0, 'Special'),
           'Nihil Light': (200, 100, 10, 0, 'Special')}
for name, expected in anchors.items():
    assert tuple(moves[name][k] for k in ['basePower', 'accuracy', 'pp', 'priority', 'category']) == expected, name
assert moves['Shadow Claw']['slicing'] and moves['Cut']['slicing']
assert not moves['Tackle']['slicing'] and not moves['Thunderbolt']['slicing']

species = {}
for index, name in enumerate(species_names, 1):
    offset = species_base + 36 * index
    raw = data[offset:offset + 36]
    # Unused enum slots are kept in the audit but never applied to the engine.
    if not all(raw[:6]):
        continue
    ability_ids = struct.unpack_from('<HHH', raw, 24)
    assert all(a <= len(ability_names) for a in ability_ids), name
    assert all(t < len(types) for t in raw[6:8]), name
    row = dict(id=index, offset=hex(offset), bytes=raw.hex(),
               baseStats=dict(zip(['hp', 'atk', 'def', 'spe', 'spa', 'spd'], raw[:6])),
               types=list(dict.fromkeys(types[t] for t in raw[6:8])),
               abilities={slot: ability_names[a-1] for slot, a in zip(['0','1','H'], ability_ids) if a},
               catchRate=raw[8], wildHeldItems=list(struct.unpack_from('<HH',raw,14)))
    # The national dex is independently anchored through #1025. Form weights
    # require the native lookup/transformation path and are NOT guessed here.
    if index <= 1025:
        weight_offset = dex_weight_base + 36 * index
        row['weightkg'] = struct.unpack_from('<H', data, weight_offset)[0] / 10
        row['weightOffset'] = hex(weight_offset)
    if name in species:
        previous = species[name]
        if all(previous[k] == row[k] for k in ['baseStats','types','abilities']):
            previous.setdefault('equivalentSlots', []).append(index)
        else:
            # A Lua display name can hide a distinct battle form. Keep the
            # record separate for manual identity review, never overwrite base.
            species[name + ' [ROM ' + str(index) + ']'] = row
    else:
        species[name] = row
assert species['Bulbasaur']['baseStats'] == {'hp':45, 'atk':49, 'def':49, 'spe':45, 'spa':65, 'spd':65}
assert species['Kleavor']['baseStats']['spd'] == 70
assert species['Palafin-Hero']['baseStats']['spd'] == 100
for name, weight in {'Bulbasaur': 6.9, 'Pikachu': 6, 'Overqwil': 60.5, 'Fezandipiti': 30.1}.items():
    assert species[name]['weightkg'] == weight, name

result = dict(schemaVersion=1, romSHA256=EXPECTED,
              luaSHA256=hashlib.sha256(LUA.read_bytes()).hexdigest(),
              tableAddresses=dict(moves=hex(move_base), species=hex(species_base),
                                  nationalDexWeightField=hex(dex_weight_base)),
              strides=dict(moves=24, species=36, nationalDex=36),
              scope='Numeric tables only; no native AI routine equivalence claimed.',
              moves=moves, species=species)
for name, row in moves.items():
    assert row == PINNED['moves'][name], 'Pinned move differs from ROM: ' + name
for name, row in species.items():
    assert row == PINNED['species'][name], 'Pinned species differs from ROM: ' + name
target = args.output
assert target.resolve() not in [ROM.resolve(), LUA.resolve(), (ROOT / 'tests/fixtures' / CONFIG['romFixture']).resolve()], 'Audit must not overwrite its inputs.'
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(dict(gameVersion=CONFIG['gameVersion'], romSHA256=EXPECTED,
    luaSHA256=CONFIG['luaSHA256'], moves=len(moves), species=len(species), status='verified', errors=[]), indent=2) + '\n', encoding='utf8')
print(json.dumps(dict(romSHA256=EXPECTED, moves=len(moves), species=len(species), output=str(target))))
