'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const data=require('../docs/porydex/data/null-1.2.6.js');
const apply=require('../docs/porydex/js/version126-data.js');
function original(){
 return structuredClone(Object.assign({},
  require('../docs/js/data/nulldex/species.js'),require('../docs/js/data/nulldex/learnsets.js'),
  require('../docs/js/data/nulldex/moves.js'),require('../docs/js/data/nulldex/items.js'),
  require('../docs/js/data/nulldex/encounters.js'),require('../docs/porydex/data/search-index.js')));
}
test('native Shield and Blade retain their names and opposite defenses in the embedded dex',()=>{
 const root=original();
 assert.equal(root.BattlePokedex.aegislashshield.name,'Aegislash-Blade','Historical bad key is part of this regression');
 apply(root,data);
 assert.equal(root.BattlePokedex.aegislashshield.name,'Aegislash-Shield');
 assert.equal(root.BattlePokedex.aegislashblade.name,'Aegislash-Blade');
 assert.deepEqual([root.BattlePokedex.aegislashshield.baseStats.atk,root.BattlePokedex.aegislashshield.baseStats.def],[50,140]);
 assert.deepEqual([root.BattlePokedex.aegislashblade.baseStats.atk,root.BattlePokedex.aegislashblade.baseStats.def],[140,50]);
 assert.equal(root.BattlePokedex.aegislash.name,'Aegislash-Shield','Default route stays Shield');
 assert.ok(root.BattleLearnsets.aegislashblade.learnset.spiritshackle);
});
test('all native dex models have explicit identities; omitted cosmetic and differently named Mega rows receive current data',()=>{
 const root=original();apply(root,data);
 for(const [id,patch]of Object.entries(data.species)){
  assert.ok(root.BattlePokedex[id],id);
  assert.deepEqual(root.BattlePokedex[id].baseStats,patch.baseStats,id);
  assert.deepEqual(root.BattleLearnsets[id].learnset,patch.learnset,id);
 }
 assert.equal(root.BattlePokedex.meowsticmega.abilities.H,'Psychic Surge');
 assert.equal(root.BattlePokedex.meowsticmmega.abilities.H,'Psychic Surge','Legacy spelling also stays current');
 for(const id of ['tatsugirimega','tatsugiricurlymega','tatsugiridroopymega','tatsugiristretchymega'])
  assert.ok(root.BattleLearnsets[id].learnset.gravity.includes('L100'),id);
 assert.equal(root.BattlePokedex.oricoriopau.name,"Oricorio-Pa'u");
 assert.deepEqual(root.BattlePokedex.oricoriopau.types,['Psychic','Flying']);
 assert.equal(root.BattlePokedex.pikachuworld.name,'Pikachu-World');
 assert.equal(root.BattlePokedex.sinistchamasterpiece.abilities['1'],'Heatproof');
});
test('new canonical forms are searchable and insertion preserves every old numeric search alias target',()=>{
 const root=original(),targets=root.BattleSearchIndex.filter(row=>row.length>2).map(row=>({key:row[0],type:row[1],offset:row[3],target:root.BattleSearchIndex[row[2]][0]}));
 apply(root,data);
 for(const id of ['aegislashblade','aegislashshield','meowsticmega','tatsugirimega','oricoriopau','pikachuworld'])
  assert.ok(root.BattleSearchIndex.some(row=>row.length===2&&row[0]===id&&row[1]==='pokemon'),id);
 for(const old of targets)assert.ok(root.BattleSearchIndex.some(row=>row.length>2&&row[0]===old.key&&row[1]===old.type&&row[3]===old.offset&&root.BattleSearchIndex[row[2]][0]===old.target),JSON.stringify(old));
});
