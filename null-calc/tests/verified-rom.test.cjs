'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const calc=require('../docs/calc'),rom=require('./fixtures/'+require('../scripts/release-config.json').romFixture),verified=require('../docs/js/null_ai/verified-data');
const adapter=require('../docs/js/null_ai/verified-data-adapter');
const gen8Before=JSON.stringify(calc.SPECIES[8]);
adapter.apply(calc,verified);
const meta={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../docs/js/null_ai/metadata.js'),'utf8'),meta);

test('ROM power and signed priority anchors reach the damage constructors',()=>{
 assert.equal(new calc.Move(9,'Glaciate').bp,80);
 assert.equal(new calc.Move(9,'Infernal Parade').bp,70);
 assert.equal(new calc.Move(9,'Water Shuriken').priority,2);
 assert.equal(new calc.Move(9,'Trick Room').priority,-7);
 assert.equal(new calc.Move(9,'Roar').priority,-6);
 assert.equal(new calc.Move(9,'Shadow Claw').flags.slicing,1);
 assert.equal(new calc.Move(9,'Tackle').flags.slicing,undefined);
 assert.equal(JSON.stringify(calc.SPECIES[8]),gen8Before,'Only generation 9 is patched');
});
test('every mapped species uses valid native base statistics in raw and cached tables',()=>{
 for(const [name,p]of Object.entries(verified.species)){
  const cached=calc.Generations.get(9).species.get(calc.toID(name));
  assert.deepEqual(cached.baseStats,p.baseStats,name);
  const mon=new calc.Pokemon(9,name,{level:50,ivs:{hp:31,atk:31,def:31,spa:31,spd:31,spe:31}});
  assert.ok(Object.values(mon.rawStats).every(n=>Number.isFinite(n)&&n>0),name);
 }
 const tea=new calc.Pokemon(9,'Poltchageist',{level:50});assert.equal(tea.rawStats.spa,94);
 assert.equal(calc.Generations.get(9).species.get('kleavor').baseStats.spd,70);
 assert.equal(calc.Generations.get(9).species.get('palafinhero').baseStats.spd,100);
 assert.equal(calc.Generations.get(9).species.get('chandeluremega').baseStats.spd,100);
 assert.equal(calc.Generations.get(9).species.get('excadrillmega').baseStats.spa,50);
});
test('battle-form identities are retained: Minior core/meteor and virtual Aegislash',()=>{
 assert.equal(calc.Generations.get(9).species.get('minior').baseStats.spe,120);
 assert.equal(calc.Generations.get(9).species.get('miniormeteor').baseStats.spe,60);
 assert.equal(calc.Generations.get(9).species.get('aegislashboth').baseStats.atk,140);
 assert.equal(calc.Generations.get(9).species.get('aegislashshield').baseStats.atk,50);
 assert.equal(calc.Generations.get(9).species.get('zygarde10').baseStats.hp,54);
});
test('all native move numbers override stale Pokédex metadata, including ROM/doc conflicts',()=>{
 for(const [name,row]of Object.entries(rom.moves)){
  const entry=meta.NullAIMoveMetadata[name];assert.ok(entry,name);
  for(const k of ['accuracy','basePower','pp','priority','category'])assert.equal(entry[k],row[k],name+' '+k);
 }
 assert.equal(meta.NullAIMoveMetadata['V-create'].accuracy,95);
 assert.equal(meta.NullAIMoveMetadata['Zap Cannon'].accuracy,60);
 assert.equal(meta.NullAIMoveMetadata['Follow Me'].pp,5);
 assert.equal(meta.NullAIMoveMetadata['Burn Up'].pp,1);
 assert.equal(meta.NullAIMoveMetadata['Tera Starstorm'].secondaryChance,50);
 assert.equal(meta.NullAIMoveMetadata['Nihil Light'].doublesTarget,'allAdjacentFoes');
});
test('native weight fixes change Low Kick at the correct power threshold',()=>{
 const a=new calc.Pokemon(9,'Pikachu',{level:50}),b=new calc.Pokemon(9,'Overqwil',{level:50});
 const result=calc.calculate(9,a,b,new calc.Move(9,'Low Kick'),new calc.Field());
 assert.equal(b.weightkg,60.5);assert.equal(result.rawDesc.moveBP,80);
 assert.ok(result.damage.every(n=>Number.isFinite(n)&&n>0));
});
test('Null Starstorm remains Normal and selected-target with Stellar Terapagos in doubles',()=>{
 const a=new calc.Pokemon(9,'Terapagos-Stellar',{level:80,ability:'Teraform Zero'}),b=new calc.Pokemon(9,'Blastoise',{level:80});
 const m=new calc.Move(9,'Tera Starstorm'),before=JSON.stringify(m);
 const single=calc.calculate(9,a.clone(),b.clone(),m,new calc.Field());
 const double=calc.calculate(9,a.clone(),b.clone(),m,new calc.Field({gameType:'Doubles'}));
 assert.deepEqual(double.damage,single.damage);
 assert.equal(double.move.type,'Normal');assert.equal(double.move.target,'normal');
 assert.equal(double.move.name,'Tera Starstorm');assert.equal(JSON.stringify(m),before);
 assert.equal(double.move.secondaries,true,'Native secondary effect enables Sheer Force damage bonus');
});
test('adapter is idempotent and preserves formula-driven move power',()=>{
 const before=calc.calculate;adapter.apply(calc,verified);assert.equal(calc.calculate,before);
 assert.equal(new calc.Move(9,'Low Kick').bp,0);
 assert.equal(new calc.Move(9,'Counter').bp,0);
});
