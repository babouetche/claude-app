(function(root){
    "use strict";
    var api=root.NullVersion126Trainers;
    if(!api)return;
    var parseTrainer=root.getTrainerNameFromSet,match=root.trainerSetKeyMatchesTrainer;
    root.getTrainerNameFromSet=function(id){
        return String(id||"").includes(" (")?api.trainerForSet(id):parseTrainer(id);
    };
    root.trainerSetKeyMatchesTrainer=function(key,trainer){
        return api.matchesTrainer(key,trainer)||match(key,trainer);
    };
    function navigate(previous){
        var original=previous?oldPrevious:oldNext;
        var current=typeof root.getOpposingSetStringForTrainerNav==="function"?root.getOpposingSetStringForTrainerNav():$("#p2 .set-selector").val();
        var trainer=root.getTrainerNameFromSet(current);
        // Leave a gauntlet from its endpoint, but use the current native
        // route order. Appended legacy indices would skip the new Regenor.
        var gauntlet=typeof root.getGauntletForTrainerSafe==="function"&&root.getGauntletForTrainerSafe(trainer);
        if(gauntlet&&gauntlet.trainers&&gauntlet.trainers.length){
            var endpoint=gauntlet.trainers[previous?0:gauntlet.trainers.length-1];
            var slot=api.data.slots.find(function(s){return s.trainer===endpoint;});
            if(!slot)return original(); // Wandering Spirit has no native party.
            current=slot.aliases.find(function(id){
                var at=id.indexOf(" ("),name=id.slice(0,at),key=id.slice(at+2,-1);
                return root.SETDEX_SV[name]&&root.SETDEX_SV[name][key];
            });
            if(!current)return original();
        }
        var target=api.navigationSetFor(current,previous?"previous":"next");
        if(!target)return original();
        var boundary=target.indexOf(" ("),species=target.slice(0,boundary),key=target.slice(boundary+2,-1);
        var set=root.SETDEX_SV[species]&&root.SETDEX_SV[species][key];
        if(set&&set.index!==undefined)return root.selectTrainer(set.index);
        return original();
    }
    var oldNext=root.nextTrainer,oldPrevious=root.previousTrainer;
    root.nextTrainer=function(){return navigate(false);};
    root.previousTrainer=function(){return navigate(true);};
    var battleSettings=root.applyBattleSettings;
    if(typeof battleSettings==="function")root.applyBattleSettings=function(trainer){
        var result=battleSettings.apply(this,arguments);
        if(trainer===api.data.newTrainer.name)$("#doubles-format").prop("checked",true).trigger("change");
        return result;
    };
})(window);
