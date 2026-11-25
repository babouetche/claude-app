'use strict';
// Regenerate the additive trainer layer from independently pinned ROM/workbook
// evidence. The original gen9.js and its checksum fixture are never rewritten.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),file=path.join(root,'tests/fixtures/trainer-update-1.2.6.json');
const bytes=fs.readFileSync(file),data=JSON.parse(bytes);
if(data.schemaVersion!==1||data.version!=='1.2.6'||data.baselineRows!==2280)throw Error('Unsupported trainer update fixture');
data.fixtureSHA256=crypto.createHash('sha256').update(bytes).digest('hex');
const implementation=String.raw`
    'use strict';
    var bySet=Object.create(null),keyTrainers=Object.create(null),ownerBySlot=Object.create(null),ownerGroupBySlot=Object.create(null),applied=new WeakSet(),navigation=[];
    function clone(value){return JSON.parse(JSON.stringify(value));}
    function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
    function parse(id){
        var text=String(id||''),i=text.indexOf(' (');
        return i<0||!text.endsWith(')')?null:{species:text.slice(0,i),key:text.slice(i+2,-1)};
    }
    data.slots.forEach(function(slot){slot.aliases.forEach(function(id){
        if(bySet[id]&&bySet[id].id!==slot.id)throw Error('Conflicting native trainer slot: '+id);
        bySet[id]=slot;
    });});
    data.additions.forEach(function(entry){keyTrainers[entry.setKey]=entry.trainer;});
    (data.ownerGroups||[]).forEach(function(group){group.owners.forEach(function(owner){owner.slots.forEach(function(slot){
        if(!data.slots.some(function(s){return s.id===slot.id;}))throw Error('Owner references an unknown native trainer slot: '+slot.id);
        if(ownerBySlot[slot.id])throw Error('Native trainer slot has multiple owners: '+slot.id);
        ownerBySlot[slot.id]=owner;ownerGroupBySlot[slot.id]=group;
    });});});
    function trainerForSet(id){var slot=bySet[id];if(slot)return slot.trainer;var p=parse(id);return p?(keyTrainers[p.key]||p.key):'';}
    function matchesTrainer(key,trainer){return (keyTrainers[key]||String(key||'').trim())===String(trainer||'').trim();}
    function slotForSet(id){return bySet[id]||null;}
    function nativeReserveForSet(id){var slot=slotForSet(id);return slot?slot.native:null;}
    function partyOrderForSet(id){var slot=slotForSet(id);return slot?slot.partyOrder:null;}
    function ownerForSet(id){var slot=slotForSet(id);return slot?ownerBySlot[slot.id]||null:null;}
    function ownerGroupForSet(id){var slot=slotForSet(id);return slot?ownerGroupBySlot[slot.id]||null:null;}
    function navigationOrderForSet(id){var slot=slotForSet(id);return slot?slot.order:null;}
    function rebuildNavigation(sets){
        var groups=Object.create(null);
        Object.keys(sets).forEach(function(species){Object.keys(sets[species]).forEach(function(key){
            var set=sets[species][key];if(!set||set.index===undefined||species==='None')return;
            var id=species+' ('+key+')',slot=slotForSet(id);if(!slot)return;
            var trainer=slot.trainer;
            if(!groups[trainer])groups[trainer]={trainer:trainer,legacyOrder:Infinity,sets:[]};
            var index=Number(set.index);
            if(index<data.baselineRows)groups[trainer].legacyOrder=Math.min(groups[trainer].legacyOrder,index);
            groups[trainer].sets.push({id:id,order:slot.partyOrder,index:index});
        });});
        var allGroups=Object.keys(groups).map(function(key){
            var group=groups[key];group.sets.sort(function(a,b){return a.order-b.order||a.index-b.index||a.id.localeCompare(b.id);});return group;
        });
        // Matching native profiles can recur in different parties. Preserve the
        // historical trainer sequence instead of sorting by a matching address.
        navigation=allGroups.filter(function(group){return Number.isFinite(group.legacyOrder);}).sort(function(a,b){return a.legacyOrder-b.legacyOrder||a.trainer.localeCompare(b.trainer);});
        data.navigationPolicy.newGroups.forEach(function(insertion){
            var group=groups[insertion.trainer];if(!group)return;
            var before=navigation.findIndex(function(entry){return entry.trainer===insertion.insertBefore;});
            if(before<0)throw Error('Missing trainer navigation insertion point: '+insertion.insertBefore);
            navigation.splice(before,0,group);
        });
    }
    function navigationSetFor(id,direction){
        var trainer=trainerForSet(id),i=navigation.findIndex(function(g){return g.trainer===trainer;});
        if(i<0)return null;
        var step=direction===-1||['previous','prev','-1'].includes(String(direction))?-1:1;
        var group=navigation[i+step];return group&&group.sets.length?group.sets[0].id:null;
    }
    function apply(sets){
        if(!sets||typeof sets!=='object')throw Error('A trainer dataset is required.');
        if(applied.has(sets)){rebuildNavigation(sets);return sets;}
        // Validate every precondition before making the first mutation.
        data.patches.forEach(function(entry){
            var original=sets[entry.species]&&sets[entry.species][entry.trainer];
            if(!original||original.index!==entry.index)throw Error('Missing trainer baseline: '+entry.species+' / '+entry.trainer);
            Object.keys(entry.before).forEach(function(key){if(!same(original[key],entry.before[key]))throw Error('Trainer baseline differs: '+entry.species+' / '+entry.trainer+' / '+key);});
        });
        data.replacements.forEach(function(entry){
            var original=sets[entry.oldSpecies]&&sets[entry.oldSpecies][entry.trainer];
            if(!same(original,entry.before)||sets[entry.species]&&sets[entry.species][entry.trainer])throw Error('Trainer form baseline differs: '+entry.trainer);
        });
        data.additions.forEach(function(entry){if(sets[entry.species]&&sets[entry.species][entry.setKey])throw Error('Trainer addition already exists: '+entry.species+' / '+entry.setKey);});
        data.patches.forEach(function(entry){sets[entry.species][entry.trainer]=Object.assign({},sets[entry.species][entry.trainer],clone(entry.changes));});
        data.replacements.forEach(function(entry){
            if(!sets[entry.species])sets[entry.species]={};
            sets[entry.species][entry.trainer]=clone(entry.set);delete sets[entry.oldSpecies][entry.trainer];
        });
        data.additions.forEach(function(entry){if(!sets[entry.species])sets[entry.species]={};sets[entry.species][entry.setKey]=clone(entry.set);});
        applied.add(sets);rebuildNavigation(sets);return sets;
    }
    return {version:data.version,romSHA256:data.romSHA256,data:data,apply:apply,trainerForSet:trainerForSet,matchesTrainer:matchesTrainer,
        slotForSet:slotForSet,nativeReserveForSet:nativeReserveForSet,partyOrderForSet:partyOrderForSet,ownerForSet:ownerForSet,ownerGroupForSet:ownerGroupForSet,navigationOrderForSet:navigationOrderForSet,navigationSetFor:navigationSetFor};
`;
const source='// Generated by scripts/build-version126-trainers.cjs; edit the pinned fixture only after a new ROM audit.\n'+
    '(function(root,factory){\n var data='+JSON.stringify(data)+';\n var api=factory(data);\n'+
    ' if(typeof module==="object"&&module.exports)module.exports=api;else{root.NullVersion126Trainers=api;if(root.SETDEX_SV)api.apply(root.SETDEX_SV);}\n'+
    '})(typeof window!=="undefined"?window:globalThis,function(data){\n'+implementation+'\n});\n';
fs.writeFileSync(path.join(root,'docs/js/null_ai/version126-trainers.js'),source);
console.log(JSON.stringify({patches:data.patches.length,additions:data.additions.length,replacements:data.replacements.length,logicalSlots:data.slots.length,fixtureSHA256:data.fixtureSHA256}));
