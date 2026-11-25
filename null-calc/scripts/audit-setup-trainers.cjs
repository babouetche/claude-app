'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),ctx={};
vm.runInNewContext(fs.readFileSync(path.join(root,'docs/js/data/sets/gen9.js'),'utf8'),ctx);
const names=['Belly Drum','Fillet Away','Filet Away','Clangorous Soul','Shell Smash'];
const entries=[];
for(const [species,sets]of Object.entries(ctx.SETDEX_SV))for(const [trainer,s]of Object.entries(sets)){
 const moves=(s.moves||[]).filter(m=>names.includes(m));if(!moves.length)continue;
 entries.push({species,trainer,index:s.index,moves,ability:s.ability,item:s.item||'',healingBerry:/^(Oran|Sitrus|Figy|Wiki|Mago|Aguav|Iapapa) Berry$/.test(s.item||''),whiteHerb:s.item==='White Herb'});
}
const out={readOnly:true,totalTrainerSets:2280,affectedRoutineSets:entries.length,byMove:Object.fromEntries(names.map(m=>[m,entries.filter(e=>e.moves.includes(m)).length])),healingBerrySets:entries.filter(e=>e.healingBerry).length,whiteHerbSets:entries.filter(e=>e.whiteHerb).length,entries,
 qualification:'Potential impact from shared scoring code, not a claim that every encounter changes choice. Actual probabilities depend on player moves, HP, field, speed and battle context.'};
fs.writeFileSync(path.join(root,'verification/setup-trainer-impact.json'),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({byMove:out.byMove,total:out.affectedRoutineSets,berrySets:out.healingBerrySets,whiteHerbSets:out.whiteHerbSets}));
