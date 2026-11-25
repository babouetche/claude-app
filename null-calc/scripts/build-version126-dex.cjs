'use strict';
// Add current ROM data to the embedded dex without rewriting its source tables.
const fs=require('node:fs'),path=require('node:path'),calc=require('../docs/calc');
const root=path.resolve(__dirname,'..'),version=require('./release-config.json');
const verified=require('../docs/js/null_ai/verified-data.js');
const rom=require('../tests/fixtures/'+version.romFixture);
const levelup=require('../tests/fixtures/levelup-1.2.6.json');
const teaching=require('../tests/fixtures/teachable-1.2.6.json');
const encounters=require('../tests/fixtures/encounters-1.2.6.json');
const items=require('../tests/fixtures/items-1.2.6.json').items;
const inheritedDex=require('../docs/js/data/nulldex/species.js').BattlePokedex;
for(const source of [verified,rom,levelup,teaching])if(source.romSHA256!==version.romSHA256)throw Error('Dex source ROM differs.');
const moveNames=Object.fromEntries(Object.entries(rom.moves).map(([name,m])=>[m.id,calc.toID(name)]));
const itemNames=Object.fromEntries(items.map(item=>[item.id,item.nativeName]));
const species={},moves={};
for(const [name,row]of Object.entries(verified.species)){
 const native=levelup.entries[row.romId],taught=teaching.teachingMethods[row.romId],learnset={};
 if(native.speciesID!==row.romId||taught.speciesID!==row.romId)throw Error('Native species order changed.');
 const add=(move,source)=>{if(!move)throw Error('Unknown learnset move');if(!learnset[move])learnset[move]=[];if(!learnset[move].includes(source))learnset[move].push(source);};
 for(const move of native.moves)add(moveNames[move.id],'L'+move.level);
 for(const [id,methods]of Object.entries(taught.methods))for(const method of methods)add(moveNames[id],method);
 species[calc.toID(name)]={name,baseStats:row.baseStats,types:row.types,abilities:row.abilities,
  catchRate:row.catchRate,romId:row.romId,learnset,
  tutorDetails:Object.fromEntries(Object.entries(taught.methodDetails||{}).map(([move,detail])=>[moveNames[move],detail])),
  wildHeldItems:(row.wildHeldItems||[]).filter(Boolean).map(id=>({id,name:itemNames[id]||'Item '+id}))};
 if(row.weightkg!==undefined)species[calc.toID(name)].weightkg=row.weightkg;
}
// Special tutor mode16 checks the untransformed species. A battle-only form
// retains moves taught to its base; do not broaden the native raw-ID gate.
for(const [name,row]of Object.entries(verified.species)){
 const baseName=calc.SPECIES[9][name].baseSpecies,base=species[calc.toID(baseName||'')],target=species[calc.toID(name)];
 if(!base||base===target)continue;
 for(const [move,detail]of Object.entries(base.tutorDetails)){
  if(detail.mode!==16)continue;
  if(!target.learnset[move])target.learnset[move]=[];
  if(!target.learnset[move].includes('T'))target.learnset[move].push('T');
  target.tutorDetails[move]=Object.assign({},detail,{learnedAs:baseName});
 }
}
for(const [name,row]of Object.entries(rom.moves)){
 const flags=Buffer.from(row.bytes,'hex');
 moves[calc.toID(name)]={name,num:row.id,basePower:row.basePower,type:row.type,category:row.category,
  accuracy:row.accuracy===101?true:row.accuracy,pp:row.pp,priority:row.priority,
  flags:{slicing:!!row.slicing,wind:!!(flags[17]&2),powder:!!(flags[16]&128)}};
}
// Explicit UI identities: the inherited dex miskeys Blade as "aegislashshield",
// omits cosmetic forms, and uses different names for two native Mega models.
// These are display templates only. Stats, abilities and learnsets stay native.
const speciesIdentities={
 aegislashshield:{template:'aegislash'},
 aegislashblade:{template:'aegislashshield',baseSpecies:'Aegislash',forme:'Blade'},
 vivillonfancy:{template:'vivillon',baseSpecies:'Vivillon',forme:'Fancy'},
 vivillonpokeball:{template:'vivillon',baseSpecies:'Vivillon',forme:'Pokeball'},
 oricoriopau:{template:'oricoriopau ',baseSpecies:'Oricorio',forme:'Pau'},
 pikachualola:{template:'pikachu',baseSpecies:'Pikachu',forme:'Alola'},
 pikachuhoenn:{template:'pikachu',baseSpecies:'Pikachu',forme:'Hoenn'},
 pikachukalos:{template:'pikachu',baseSpecies:'Pikachu',forme:'Kalos'},
 pikachuoriginal:{template:'pikachu',baseSpecies:'Pikachu',forme:'Original'},
 pikachupartner:{template:'pikachu',baseSpecies:'Pikachu',forme:'Partner'},
 pikachusinnoh:{template:'pikachu',baseSpecies:'Pikachu',forme:'Sinnoh'},
 pikachuunova:{template:'pikachu',baseSpecies:'Pikachu',forme:'Unova'},
 pikachuworld:{template:'pikachu',baseSpecies:'Pikachu',forme:'World'},
 polteageistantique:{template:'polteageist',baseSpecies:'Polteageist',forme:'Antique'},
 sinisteaantique:{template:'sinistea',baseSpecies:'Sinistea',forme:'Antique'},
 poltchageistartisan:{template:'poltchageist',baseSpecies:'Poltchageist',forme:'Artisan'},
 sinistchamasterpiece:{template:'sinistcha',baseSpecies:'Sinistcha',forme:'Masterpiece'},
 squawkabillyblue:{template:'squawkabilly',baseSpecies:'Squawkabilly',forme:'Blue'},
 squawkabillywhite:{template:'squawkabilly',baseSpecies:'Squawkabilly',forme:'White'},
 squawkabillyyellow:{template:'squawkabilly',baseSpecies:'Squawkabilly',forme:'Yellow'},
 meowsticmega:{template:'meowsticmmega',baseSpecies:'Meowstic',forme:'Mega'},
 tatsugirimega:{template:'tatsugiricurlymega',baseSpecies:'Tatsugiri',forme:'Mega'}
};
const speciesAliases={aegislash:'aegislashshield','oricoriopau ':'oricoriopau',meowsticmmega:'meowsticmega',
 tatsugiricurlymega:'tatsugirimega',tatsugiridroopymega:'tatsugirimega',tatsugiristretchymega:'tatsugirimega'};
for(const [id,identity]of Object.entries(speciesIdentities)){
 if(!species[id]||!inheritedDex[identity.template])throw Error('Unproven dex identity: '+id);
}
for(const [alias,id]of Object.entries(speciesAliases)){
 if(species[alias]||!inheritedDex[alias]||!species[id])throw Error('Dex alias collision: '+alias);
 species[alias]=Object.assign({},species[id],{name:inheritedDex[alias].name,nativeModel:id});
}
for(const id of Object.keys(species))if(!inheritedDex[id]&&!speciesIdentities[id])throw Error('Unmapped native dex species: '+id);
const data={gameVersion:version.gameVersion,romSHA256:version.romSHA256,species,moves,
 speciesIdentities,speciesAliases,encounters,items:{recallcharm:{name:'Recall Charm',num:690,desc:'Allows a Pokémon to relearn a move upon use. Available from the Elite Four Heart Scale Shop.',shortDesc:'Allows a Pokémon to relearn a move upon use.'}}};
const dest=path.join(root,'docs/porydex/data/null-1.2.6.js');
fs.writeFileSync(dest,'// Generated by scripts/build-version126-dex.cjs; ROM tables take priority.\nvar NullDexVersionData = '+JSON.stringify(data)+';\nif(typeof module==="object"&&module.exports)module.exports=NullDexVersionData;\n');
console.log(JSON.stringify({dexSpecies:Object.keys(species).length,dexMoves:Object.keys(moves).length,encounterMethods:encounters.methods.length}));
