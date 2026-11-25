(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory(require('../../calc/mechanics/util'));
 else {root.NullVerifiedDataAdapter=factory(root.calc);root.NullVerifiedDataAdapter.apply(root.calc,root.NullVerifiedData);}
})(typeof window!=='undefined'?window:globalThis,function(mechanics){
 'use strict';
 var stats={hp:'hp',atk:'at',def:'df',spa:'sa',spd:'sd',spe:'sp'};
 function apply(calc,data){
  if(!calc||!data)throw new Error('Verified Null data must load after the calculator.');
  if(calc.nullVerifiedROM===data.romSHA256)return;
  var gen=calc.Generations.get(9);
  Object.keys(data.species).forEach(function(name){
   var patch=data.species[name],raw=calc.SPECIES[9][name],cached=gen.species.get(calc.toID(name));
   if(!raw||!cached)throw new Error('Unknown verified species: '+name);
   Object.keys(stats).forEach(function(k){raw.bs[stats[k]]=patch.baseStats[k];cached.baseStats[k]=patch.baseStats[k];});
   raw.types=patch.types.slice();cached.types=patch.types.slice();
   raw.abilities=Object.assign({},patch.abilities);cached.abilities=Object.assign({},patch.abilities);
   if(patch.weightkg!==undefined){raw.weightkg=patch.weightkg;cached.weightkg=patch.weightkg;}
  });
  Object.keys(data.moves).forEach(function(name){
   var patch=data.moves[name],raw=calc.MOVES[9][name],cached=gen.moves.get(calc.toID(name));
   if(!raw||!cached)throw new Error('Unknown verified move: '+name);
   ['bp','type','category','priority','pp','isSlicing','isWind','isPowder','makesContact','secondaries','target'].forEach(function(k){if(patch[k]!==undefined)raw[k]=patch[k];});
   cached.basePower=patch.bp;cached.type=patch.type;cached.category=patch.category;cached.priority=patch.priority;cached.pp=patch.pp;
   if(patch.secondaries!==undefined)cached.secondaries=patch.secondaries;
   if(patch.target!==undefined)cached.target=patch.target;
   if(patch.isSlicing)cached.flags.slicing=1;else delete cached.flags.slicing;
   if(patch.isWind!==undefined){if(patch.isWind)cached.flags.wind=1;else delete cached.flags.wind;}
   if(patch.isPowder!==undefined){if(patch.isPowder)cached.flags.powder=1;else delete cached.flags.powder;}
   if(patch.makesContact!==undefined){if(patch.makesContact)cached.flags.contact=1;else delete cached.flags.contact;}
  });
  var originalCalculate=calc.calculate;
  calc.calculate=function(g,attacker,defender,move,field){
   var number=typeof g==='number'?g:g.num;
   var name=move.originalName||move.name;
   if(number===9&&!move.useZ&&!move.useMax&&name==='Terrain Pulse'&&field&&field.terrain&&!mechanics.isGrounded(attacker,field)){
    // 1.2.5 fixed Terrain Pulse even for airborne users. Keep the real
    // grounding state so terrain damage boosts and other effects stay correct.
    // The inherited engine only transforms/doubles it when grounded; prefill
    // those two properties on the disposable airborne move instead.
    var pulse=move.clone(),terrainType={Electric:'Electric',Grassy:'Grass',Misty:'Fairy',Psychic:'Psychic'}[field.terrain];
    pulse.type=terrainType;pulse.bp=move.bp*2;
    pulse.overrides=Object.assign({},pulse.overrides,{type:terrainType,basePower:pulse.bp});
    return originalCalculate.call(this,g,attacker,defender,pulse,field);
   }
   if(number===9&&!move.useZ&&!move.useMax&&name==='Future Sight'&&/ Gem$/.test(attacker.item)){
    // Future Sight never consumes or receives a Gem boost. Clone only the
    // calculation input: the user's held item and battle state remain intact.
    var seer=attacker.clone();seer.item='';
    var delayed=originalCalculate.call(this,g,seer,defender,move,field);
    delayed.attacker.item=attacker.item;
    return delayed;
   }
   if(number!==9||move.useZ||move.useMax||(move.originalName||move.name)!=='Tera Starstorm')return originalCalculate.apply(this,arguments);
   // The ROM uses Tri Attack's effect, not the stock Terapagos-only Stellar
   // branch. Keep caller-owned objects intact and restore the displayed label.
   var copy=move.clone();copy.name='Tri Attack';
   copy.overrides=Object.assign({},copy.overrides,{name:'Tri Attack',target:'normal',basePower:move.bp,type:move.type,secondaries:true});
   var result=originalCalculate.call(this,g,attacker,defender,copy,field);
   result.move.name=move.name;result.move.originalName=move.originalName;
   if(result.rawDesc&&result.rawDesc.moveName==='Tri Attack')result.rawDesc.moveName=move.name;
   return result;
  };
  calc.nullVerifiedROM=data.romSHA256;
 }
 return {apply:apply};
});
