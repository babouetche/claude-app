(function(root){
 'use strict';
 var pools=root.NullDexStaticPools||[],data=root.NullDexVersionData;
 if(!data)return;
 var pokemon=root.PokedexPokemonPanel.prototype,initialize=pokemon.initialize;
 pokemon.initialize=function(){
  var result=initialize.apply(this,arguments),patch=data.species[this.id];
  if(patch){
   var names=Array.from(new Set(patch.wildHeldItems.map(function(item){return item.name;})));
   var details=this.$('dl').filter(function(){return root.jQuery(this).children('dt').first().text()==='Catch rate:';}).first();
   details.addClass('null-native-details').append('<dt>Wild held items:</dt><dd>'+
    (names.length?names.map(function(name){return root.BattleLog.escapeHTML(name);}).join(' / '):'None')+'</dd>');
  }
  return result;
 };
 var encounters=pokemon.renderEncounters;
 var learnset=pokemon.renderFullLearnset;
 pokemon.renderFullLearnset=function(){
  var result=learnset.apply(this,arguments),patch=data.species[this.id],notes=[];
  if(patch)Object.keys(patch.tutorDetails||{}).forEach(function(id){
   var detail=patch.tutorDetails[id],move=root.BattleMovedex[id];if(!move)return;
   notes.push(root.BattleLog.escapeHTML(move.name)+' — '+root.BattleLog.escapeHTML(detail.source)+
    (detail.learnedAs?' (learn as '+root.BattleLog.escapeHTML(detail.learnedAs)+')':''));
  });
  if(notes.length)this.$('.utilichart').prepend('<li class="content null-tutor-details">'+notes.join('<br>')+'</li>');
  return result;
 };
 pokemon.renderEncounters=function(){
  var result=encounters.apply(this,arguments),self=this;
  pools.filter(function(pool){return pool.encs.some(function(enc){return enc.species===self.id;});}).forEach(function(pool){
   self.$('.utilichart').append('<li class="resultheader"><h3>Static encounter</h3></li><li class="content">'+
    root.BattleLog.escapeHTML(pool.area==='route111'?'Route 111':pool.area)+' — '+root.BattleLog.escapeHTML(pool.note)+'</li>');
  });
  return result;
 };
 var panel=root.PokedexEncountersPanel.prototype,distribution=panel.renderDistribution;
 panel.renderDistribution=function(){
  var result=distribution.apply(this,arguments),self=this;
  pools.filter(function(pool){return pool.area===self.id;}).forEach(function(pool){
   self.$('.utilichart .null-static-pool').remove();
   self.$('.utilichart').append('<li class="resultheader null-static-pool"><h3>Static encounter</h3></li><li class="content null-static-pool">'+
    root.BattleLog.escapeHTML(pool.note)+'</li>');
  });
  return result;
 };
})(window);
