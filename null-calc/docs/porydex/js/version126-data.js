(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory;
 else {root.NullDexVersion=factory;factory(root,root.NullDexVersionData);}
})(typeof window!=='undefined'?window:this,function(root,data){
 'use strict';
 var species=root.BattlePokedex,moves=root.BattleMovedex,learnsets=root.BattleLearnsets;
 // Capture templates before rebinding Shield's old key: that key originally
 // stores Blade, while the default Aegislash key stores Shield.
 var templates={},identities=data.speciesIdentities||{};
 Object.keys(identities).forEach(function(id){
  var identity=identities[id],source=species[identity.template];
  if(!source)throw Error('Missing dex display template: '+id);
  templates[id]=Object.assign({},source);
 });
 Object.keys(identities).forEach(function(id){
  var identity=identities[id],target=templates[id];
  target.name=data.species[id].name;
  if(identity.baseSpecies){target.baseSpecies=identity.baseSpecies;target.forme=identity.forme;delete target.otherFormes;}
  species[id]=target;
 });
 Object.keys(data.species).forEach(function(id){
  var patch=data.species[id],old=species[id];if(!old)throw Error('Unmapped native dex species: '+id);
  old.baseStats=patch.baseStats;old.types=patch.types;old.abilities=patch.abilities;
  old.catchRate=patch.catchRate;old.nullWildHeldItems=patch.wildHeldItems;
  if(patch.weightkg!==undefined)old.weightkg=patch.weightkg;
  learnsets[id]={learnset:patch.learnset};
 });
 Object.keys(data.moves).forEach(function(id){
  if(!moves[id])moves[id]={name:data.moves[id].name,num:data.moves[id].num,flags:{},desc:'Deals damage.',shortDesc:'Deals damage.'};
  var patch=data.moves[id],old=moves[id];
  Object.keys(patch).forEach(function(k){if(k!=='flags')old[k]=patch[k];});
  old.flags=Object.assign({},old.flags);
  Object.keys(patch.flags).forEach(function(k){if(patch.flags[k])old.flags[k]=1;else delete old.flags[k];});
 });
 // Current native effects fixed in 1.2.6; the inherited prose omitted these.
 var notes={
  alluringvoice:'Confuses the target if its stats rose during this turn.',
  anchorshot:'Prevents the target from switching out.',
  spiritshackle:'Prevents the target from switching out.',
  terrainpulse:'Its type changes and its power doubles in terrain, even if the user is airborne. Grounding still controls the terrain damage bonus.',
  futuresight:'Gems do not activate on Future Sight.',
  hurricane:'This is a wind move.'
 };
 Object.keys(notes).forEach(function(id){if(moves[id]){moves[id].desc=(moves[id].desc||'')+' Null 1.2.6: '+notes[id];moves[id].nullVersionNote=notes[id];}});
 (data.encounters.locations||[]).forEach(function(location){if(root.BattleLocationdex[location.area])root.BattleLocationdex[location.area].name=location.name;});
 data.encounters.methods.forEach(function(patch){if(root.BattleLocationdex[patch.area])root.BattleLocationdex[patch.area][patch.method]=patch.value;});
 root.NullDexStaticPools=data.encounters.staticPools;
 Object.assign(root.BattleItems,data.items);
 // The legacy index contains numeric references for aliases. Preserve those
 // references when inserting Recall Charm into its sorted search position.
 if(root.BattleSearchIndex){
  var offsets=root.BattleSearchIndexOffset||[],rows=root.BattleSearchIndex.map(function(row,index){return {row:row.slice(),old:index,offset:offsets[index]||''};});
  function addSearch(id,type,offset){if(!rows.some(function(entry){return entry.row[0]===id&&entry.row[1]===type&&entry.row.length===2;}))rows.push({row:[id,type],old:-1,offset:offset||''});}
  addSearch('recallcharm','item','00000011111');
  Object.keys(identities).forEach(function(id){addSearch(id,'pokemon');});
  Object.keys(data.moves).forEach(function(id){addSearch(id,'move');});
  rows.sort(function(a,b){return a.row[0]<b.row[0]?-1:a.row[0]>b.row[0]?1:a.old-b.old;});
  var map={};rows.forEach(function(entry,index){if(entry.old>=0)map[entry.old]=index;});
  rows.forEach(function(entry){if(entry.row.length>2)entry.row[2]=map[entry.row[2]];});
  root.BattleSearchIndex=rows.map(function(entry){return entry.row;});
  root.BattleSearchIndexOffset=rows.map(function(entry){return entry.offset;});
 }
 root.NullDexAppliedVersion=data.gameVersion;
 return {version:data.gameVersion,species:Object.keys(data.species).length,moves:Object.keys(data.moves).length};
});
