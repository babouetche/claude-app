'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),env={};
vm.runInNewContext(fs.readFileSync(path.join(root,'docs/js/data/sets/gen9.js'),'utf8'),env);
const rows=Object.entries(env.SETDEX_SV).flatMap(([name,sets])=>Object.entries(sets).map(([trainer,set])=>({name,trainer,set})));
const rom=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/rom-1.2.4-data.json'),'utf8'));
const groups=[
 {names:['Retaliate','Last Respects','Supreme Overlord'],status:'fixed-reserve-faint-context',detail:'Real-engine ordinary and post-KO reserve profiles. Retaliate only in the post-KO profile; cumulative allied faints for Last Respects and Supreme Overlord, no damage-roll scaling.'},
 {names:['Rage Fist','Stomping Tantrum','Fury Cutter','Rollout','Ice Ball','Echoed Voice','Round','Avalanche','Revenge'],status:'manual-history',detail:'These conditions are distinct from an allied KO. The active move power must be supplied manually; old turns, hits, failures, consecutive uses and later actions cannot be inferred from KO marks. No automatic simulation added.'},
 {names:['Lash Out','Assurance'],status:'legacy-proxy-limited',detail:'Lash Out uses net negative stat boosts as a legacy proxy, not proof of a drop this turn. Assurance only has the original Parental Bond child shortcut. These existing limitations are not corrected by the KO-specific change; confirm the relevant turn state and damage separately.'},
 {names:['Spit Up','Trump Card','Beat Up','Present','Magnitude','Fickle Beam'],status:'manual-or-incomplete',detail:'Stockpile/PP/team contributors/random power require separate inputs or distributions. The existing general damage or AI controls do not guarantee full dynamic power support. No guessed history or random outcome added.'},
 {names:['Flail','Reversal','Eruption','Water Spout','Brine','Hex','Venoshock','Facade','Electro Ball','Gyro Ball','Payback','Fishious Rend','Bolt Beak','Weather Ball','Terrain Pulse','Acrobatics','Stored Power'],status:'existing-state-derived',detail:'Existing engine derives these from supplied HP, status, actual speed/order, field, held item or boosts. The current field/speed-order assumptions remain; not a full turn simulator.'}
];
const audit=groups.flatMap(g=>g.names.map(name=>({name,status:g.status,detail:g.detail,
 trainerSetCount:rows.filter(r=>r.set.ability===name||(r.set.moves||[]).includes(name)).length,
 trainers:rows.filter(r=>r.set.ability===name||(r.set.moves||[]).includes(name)).map(r=>r.name+' ('+r.trainer+')'),
 romBasePower:rom.moves&&rom.moves[name]&&rom.moves[name].basePower})));
assert.equal(rom.moves.Retaliate.basePower,70);assert.equal(rom.moves['Last Respects'].basePower,50);assert.equal(rom.moves['Rage Fist'].basePower,50);
const protectedInput=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/input-archive.json'),'utf8'));
for(const [rel,hash]of Object.entries(protectedInput.hashes))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,rel))).digest('hex'),hash,rel);
const report={revision:'post-ko-faint-context',checkedAt:new Date().toISOString(),trainerRows:rows.length,protectedOriginalFilesVerified:Object.keys(protectedInput.hashes).length,
 scope:'Static inventory plus reviewed engine branches and verified ROM move-table fixture. Battle regression evidence is separate. No native helper or emulator execution certified.',
 sources:['https://pokemonnull.com/patch-applier.html','https://github.com/smogon/pokemon-showdown/blob/master/data/moves.ts','https://github.com/smogon/pokemon-showdown/blob/master/data/abilities.ts'],audit};
fs.writeFileSync(path.join(root,'verification/conditional-power-audit.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({reviewed:audit.length,trainerRows:rows.length,faintDependent:audit.filter(x=>x.status==='fixed-reserve-faint-context').map(x=>({name:x.name,sets:x.trainerSetCount})),protectedFilesVerified:report.protectedOriginalFilesVerified}));
