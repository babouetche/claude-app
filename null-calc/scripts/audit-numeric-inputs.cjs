'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const original=Object.assign({},require('../docs/calc'),require('../docs/calc/mechanics/util'));
const legacy={hp:'hp',at:'atk',df:'def',sa:'spa',sd:'spd',sp:'spe'};
function audit(){
 const data={};vm.runInNewContext(fs.readFileSync(path.join(root,'docs/js/data/sets/gen9.js'),'utf8'),data);
 const sets=data.SETDEX_SV,sourceBefore=JSON.stringify(sets),entries=[];
 Object.entries(sets).forEach(([pokemon,trainers])=>Object.entries(trainers).forEach(([trainer,set])=>entries.push({pokemon,trainer,set})));
 let captured=[];
 const calc=Object.assign({},original,{Pokemon:new Proxy(original.Pokemon,{construct(target,args){const mon=Reflect.construct(target,args);captured.push({mon,options:args[2]});return mon;}})});
 const ctx={calc,gen:9,SETDEX_SV:sets,pokedex:original.SPECIES[9],NullFaintContext:require('../docs/js/null_ai/faint_context'),LEGACY_STATS:Array.from({length:10},()=>Object.keys(legacy)),legacyStatToStat:s=>legacy[s]};ctx.window=ctx;
 vm.runInNewContext(fs.readFileSync(path.join(root,'docs/js/null_ai/metadata.js'),'utf8'),ctx);
 vm.runInNewContext(fs.readFileSync(path.join(root,'docs/js/null_ai/state.js'),'utf8'),ctx);
 const affected=[],failures=[],excluded=[];let verified=0,stringsVerified=0,numericFields=0;
 for(const {pokemon,trainer,set} of entries){
  const textual=[];
  ['level','index'].forEach(k=>{numericFields++;if(typeof set[k]==='string')textual.push(k);assert.ok(Number.isInteger(Number(set[k])),pokemon+' '+trainer+' '+k);});
  ['ivs','evs'].forEach(k=>Object.entries(set[k]||{}).forEach(([stat,value])=>{numericFields++;assert.ok(Number.isInteger(Number(value)),pokemon+' '+trainer+' '+k+'.'+stat);if(typeof value==='string')textual.push(k+'.'+stat);}));
  if(textual.length)affected.push({pokemon,trainer,index:set.index,fields:textual});
  if(pokemon==='None'||!original.SPECIES[9][pokemon]){excluded.push({pokemon,trainer,index:set.index,reason:pokemon==='None'?'Empty placeholder':'Species absent from supplied dex'});continue;}
  const ivs={},evs={};Object.entries(legacy).forEach(([k,stat])=>{ivs[stat]=Number(set.ivs&&set.ivs[k]!==undefined?set.ivs[k]:31);evs[stat]=Number(set.evs&&set.evs[k]!==undefined?set.evs[k]:0);});
  try{
   captured=[];
   const partner=ctx.NullMoveAIState.createDoublePartner({setID:pokemon+' ('+trainer+')',level:Number(set.level),hp:0,nature:set.nature,ability:set.ability,item:set.item||'',ivs,evs,boosts:{},moves:(set.moves||[]).map(name=>({name}))});
   const reserve=captured[0].mon,expected=new original.Pokemon(9,pokemon,{level:Number(set.level),nature:set.nature,ability:set.ability,item:set.item||'',ivs,evs});
   for(const stat of Object.values(legacy)){
    assert.equal(reserve.rawStats[stat],expected.rawStats[stat],'Reserve stat '+stat);
    assert.equal(partner.rawStats[stat],expected.rawStats[stat],'Doubles partner stat '+stat);
    assert.ok(Number.isFinite(reserve.rawStats[stat])&&reserve.rawStats[stat]>0,'Positive finite '+stat);
   }
   assert.ok(Object.values(captured[0].options.ivs).every(Number.isInteger),'Reserve IV types');
   assert.ok(Object.values(captured[0].options.evs).every(Number.isInteger),'Reserve EV types');
   verified++;if(textual.length)stringsVerified++;
  }catch(error){failures.push({pokemon,trainer,index:set.index,error:error.message});}
 }
 // Classify using the real party reader, which collapses base/Mega aliases.
 // Counting raw display rows would incorrectly call a seven-row team a bank.
 let selected='';
 const dummy=new original.Pokemon(9,'Pikachu',{moves:Array.from({length:4},()=>new original.Move(9,'Tackle'))});
 Object.assign(ctx,{
  $:selector=>({val:()=>selector==='#p2 .set-selector'?selected:selector.endsWith('.current-hp')?dummy.maxHP():'',prop:()=>false}),
  createPokemon:()=>dummy.clone(),createField:()=>new original.Field(),checkStatBoost:()=>{},
  getTrainerNameFromSet:id=>id.slice(id.indexOf(' (')+2,-1),opposingMarkedSetIds:new Set()
 });
 const partyKinds={};
 for(const trainer of new Set(affected.map(e=>e.trainer))){
  const first=entries.find(e=>e.trainer===trainer&&e.pokemon!=='None'&&original.SPECIES[9][e.pokemon]);
  selected=first.pokemon+' ('+trainer+')';
  const party=ctx.NullMoveAIState.readBattleState(null,{}).party;
  partyKinds[trainer]=party.complete?'known-party':party.assumptions.some(s=>s.startsWith('Cette banque contient'))?'bank':'unreadable-party';
 }
 affected.forEach(e=>{e.partyKind=partyKinds[e.trainer];e.bank=e.partyKind==='bank';});
 const dexStrings=[],metadataStrings=[];
 Object.entries(original.SPECIES[9]).forEach(([pokemon,species])=>Object.entries(species.bs||{}).forEach(([stat,value])=>{if(typeof value!=='number'||!Number.isFinite(value))dexStrings.push({pokemon,stat,value});}));
 Object.entries(ctx.NullAIMoveMetadata).forEach(([move,meta])=>['basePower','accuracy','secondaryChance'].forEach(key=>{if(meta[key]!==undefined&&meta[key]!==null&&(typeof meta[key]!=='number'||!Number.isFinite(meta[key])))metadataStrings.push({move,key,value:meta[key]});}));
 assert.equal(JSON.stringify(sets),sourceBefore,'Trainer data mutation during construction audit');
 const protectedManifest=require('../tests/fixtures/input-archive.json');
 for(const [file,expected] of Object.entries(protectedManifest.hashes))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),expected,file);
 return {recordedAt:new Date().toISOString(),totalSets:entries.length,numericFields,affectedSets:affected.length,affectedSpecies:new Set(affected.map(e=>e.pokemon)).size,affectedTrainers:new Set(affected.map(e=>e.trainer)).size,
  affectedKnownPartySets:affected.filter(e=>e.partyKind==='known-party').length,affectedBankSets:affected.filter(e=>e.bank).length,affectedUnreadablePartySets:affected.filter(e=>e.partyKind==='unreadable-party').length,verifiedSets:verified,verifiedStringSets:stringsVerified,excluded,failures,dexStrings,metadataStrings,protectedFiles:Object.keys(protectedManifest.hashes).length,trainerDataUnchanged:true,affected};
}
if(require.main===module){const report=audit();fs.writeFileSync(path.join(root,'verification/numeric-input-audit.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,affected:report.affected.slice(0,8)},null,2));if(report.failures.length||report.dexStrings.length||report.metadataStrings.length)process.exitCode=1;}
module.exports={audit};
