'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const data=require('../docs/porydex/data/null-1.2.6'),apply=require('../docs/porydex/js/version126-data');
function legacy(){
 const context={exports:{}};
 for(const name of ['species','moves','learnsets','encounters','items'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../docs/js/data/nulldex/'+name+'.js'),'utf8'),context);
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../docs/porydex/data/search-index.js'),'utf8'),context);
 return context.exports;
}
test('embedded dex uses current native abilities, catch rates and wild item slots',()=>{
 const tables=legacy();apply(tables,data);
 assert.equal(tables.BattlePokedex.slowking.abilities[0],'Regenerator');
 assert.equal(tables.BattlePokedex.slowking.abilities.H,'Shell Armor');
 assert.equal(tables.BattlePokedex.golisopod.catchRate,1);
 assert.equal(tables.BattlePokedex.nihilego.nullWildHeldItems[0].name,'Berserk Gene');
 assert.equal(tables.BattleMovedex.hurricane.flags.wind,1);
 assert.equal(tables.BattleMovedex.powder.flags.powder,1);
 assert.equal(tables.BattleMovedex.nihillight.basePower,200);
 assert.equal(tables.BattleMovedex.nihillight.type,'Dragon');
});
test('level-up corrections replace obsolete levels and preserve evolution and reminder entries',()=>{
 const tables=legacy();apply(tables,data);
 const learn=name=>tables.BattleLearnsets[name].learnset;
 assert.ok(learn('delphox').powergem.includes('L68'));
 assert.ok(!learn('delphox').psystrike?.includes('L68'));
 assert.ok(learn('armaldo').rockblast.includes('L88'));
 assert.ok(learn('seadra').icywind.includes('L47'));
 assert.ok(learn('archaludon').metalburst.includes('L1'));
 assert.ok(!learn('archaludon').metalburst.includes('L60'));
 assert.ok(learn('archaludon').mirrorcoat.includes('L1'));
});
test('current regular tutors are offered only to species with native compatibility',()=>{
 const tables=legacy();apply(tables,data);
 assert.ok(tables.BattleLearnsets.mew.learnset.aircutter.includes('T'));
 assert.ok(tables.BattleLearnsets.mew.learnset.discharge.includes('T'));
 assert.ok(!tables.BattleLearnsets.magikarp.learnset.discharge);
 assert.ok(tables.BattleLearnsets.delphox.learnset.psystrike.includes('T'));
 assert.ok(tables.BattleLearnsets.delphoxmega.learnset.psystrike.includes('T'));
 assert.ok(tables.BattleLearnsets.chesnaughtmega.learnset.bodypress.includes('T'));
 assert.ok(!tables.BattleLearnsets.mew.learnset.psystrike?.includes('T'));
 assert.equal(data.species.delphoxmega.tutorDetails.psystrike.learnedAs,'Delphox');
});
test('native encounter overlays preserve grass/fishing separation and separate static pools',()=>{
 const tables=legacy();apply(tables,data);
 assert.deepEqual(tables.BattleLocationdex.route119.land.encs.slice(-3).map(x=>x.species),['tapukoko','tapubulu','tapubulu']);
 assert.ok(tables.BattleLocationdex.route119.fish.encs.some(x=>x.species==='quaquaval'&&x.minLvl===50&&x.maxLvl===50));
 assert.ok(tables.BattleLocationdex.magmahideout1f.land.encs.some(x=>x.species==='heatran'));
 assert.ok(tables.BattleLocationdex.magmahideout1f.land.encs.some(x=>x.species==='runerigus'));
 assert.ok(tables.NullDexStaticPools[0].encs.some(x=>x.species==='orthworm'));
 assert.equal(tables.NullDexStaticPools[0].probabilities,null);
});

test('Rustboro Grove includes the current land, surf and fishing tables without replacing historical files',()=>{
 const tables=legacy();assert.equal(tables.BattleLocationdex.rustborogrove.surf.encs,undefined);
 apply(tables,data);const area=tables.BattleLocationdex.rustborogrove;
 assert.deepEqual(area.land.encs.slice(9).map(x=>x.species),['purrloin','luxio','pichu']);
 assert.deepEqual(area.surf.encs.map(x=>x.species),['kangaskhan','hariyama','avalugghisui','eiscue','raichu','raichualola']);
 assert.deepEqual(area.fish.encs.map(x=>x.species),['totodile','inkay','clauncher','buizel','lotad','seel']);
 assert.ok(area.surf.encs.every(x=>x.minLvl===45&&x.maxLvl===45));
 assert.ok(area.fish.encs.every(x=>x.minLvl===15&&x.maxLvl===15));
});

test('all 245 official encounter profiles match the independently retained native slot bytes',()=>{
 const evidence=require('../verification/dex-interface-encounters-native.json'),native=require('./fixtures/rom-1.2.6-data.json');
 const tables=legacy();apply(tables,data);
 const norm=name=>name.toLowerCase().replace(/[^a-z0-9]/g,''),names={};
 for(const [name,row]of Object.entries(native.species)){
  let id=name.startsWith('Minior')?'minior':norm(name);
  if(id==='aegislashboth')id='aegislash';
  for(const sp of [row.id,...row.equivalentSlots||[]])names[sp]=id;
 }
 let profiles=0,slots=0;
 for(const area of evidence.areas){
  const header=area.nativeHeaders[0];
  for(const table of header.tables){
   const bytes=Buffer.from(table.bytes,'hex'),records=[];
   for(let i=0;i<bytes.length;i+=4)records.push({species:names[bytes.readUInt16LE(i+2)],minLvl:bytes[i],maxLvl:bytes[i+1]});
   assert.deepEqual(JSON.parse(JSON.stringify(tables.BattleLocationdex[area.area][table.method].encs)),records,area.area+'/'+table.method);
   assert.equal(tables.BattleLocationdex[area.area][table.method].baseRate,Buffer.from(table.infoBytes,'hex').readUInt32LE());
   profiles++;slots+=records.length;
  }
 }
 assert.equal(profiles,245);assert.equal(slots,2226);
 assert.equal(data.encounters.methods.length,71);
});
test('adding Recall Charm preserves every legacy search alias target and character offset',()=>{
 const tables=legacy(),before=tables.BattleSearchIndex.map((row,i)=>({target:row.length>2?tables.BattleSearchIndex[row[2]][0]:null,offset:tables.BattleSearchIndexOffset[i],row:Array.from(row)}));
 const canonical=new Set(before.filter(x=>x.row.length===2).map(x=>x.row[0]+'|'+x.row[1]));
 apply(tables,data);
 assert.equal(tables.BattleItems.recallcharm.name,'Recall Charm');
 assert.match(tables.BattleItems.recallcharm.desc,/relearn/);
 assert.equal(tables.BattleSearchIndex.filter(x=>x[0]==='recallcharm'&&x.length===2).length,1);
 const rows=tables.BattleSearchIndex.map((row,index)=>({row,offset:tables.BattleSearchIndexOffset[index]}))
  .filter(x=>x.row.length>2||canonical.has(x.row[0]+'|'+x.row[1]));
 assert.equal(rows.length,before.length);
 rows.forEach(({row,offset},i)=>{assert.equal(row[0],before[i].row[0]);assert.equal(offset,before[i].offset||'');if(row.length>2)assert.equal(tables.BattleSearchIndex[row[2]][0],before[i].target);});
 for(let i=1;i<tables.BattleSearchIndex.length;i++)assert.ok(tables.BattleSearchIndex[i-1][0]<=tables.BattleSearchIndex[i][0]);
});
