const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const api=require('../docs/js/null_ai/version126-trainers');
const root=path.resolve(__dirname,'..');
function baseline(){const ctx={};vm.runInNewContext(fs.readFileSync(path.join(root,'docs/js/data/sets/gen9.js'),'utf8'),ctx);return JSON.parse(JSON.stringify(ctx.SETDEX_SV));}
function count(sets){return Object.values(sets).reduce((n,rows)=>n+Object.keys(rows).length,0);}
test('1.2.6 additive trainer migration applies all ROM patches and preserves the original dataset file',()=>{
    const source=fs.readFileSync(path.join(root,'docs/js/data/sets/gen9.js'),'utf8'),sets=baseline();assert.equal(count(sets),2280);
    sets.Pikachu['My Custom Set']={level:25,moves:['Spark']};const custom=JSON.stringify(sets.Pikachu['My Custom Set']);api.apply(sets);
    for(const patch of api.data.patches)for(const [key,value]of Object.entries(patch.changes))assert.deepEqual(sets[patch.species][patch.trainer][key],value);
    assert.equal(sets.Conkeldurr['Blackbelt Nob'].status,'Healthy');assert.equal(sets.Conkeldurr['Blackbelt Nob'].item,'Flame Orb');
    assert.equal(sets['Iron Moth']['Team Magma Admin Courtney 2'].level,68);
    assert.equal(sets['Feraligatr-Mega']['Cooltrainer Carolina & Sailor Cory'].ability,"Dragon's Maw");
    assert.equal(sets.Feraligatr['Cooltrainer Carolina & Sailor Cory'].ability,'Sheer Force');
    assert.equal(count(sets),2289);assert.equal(JSON.stringify(sets.Pikachu['My Custom Set']),custom);
    const after=JSON.stringify(sets);api.apply(sets);assert.equal(JSON.stringify(sets),after);
    assert.equal(fs.readFileSync(path.join(root,'docs/js/data/sets/gen9.js'),'utf8'),source);
});
test('invalid trainer baseline is rejected before any migration mutation',()=>{
    const sets=baseline();sets.Conkeldurr['Blackbelt Nob'].item='Wrong';const before=JSON.stringify(sets);
    assert.throws(()=>api.apply(sets),/baseline differs/);assert.equal(JSON.stringify(sets),before);
});
test('two Lanturn and two Mega Raichu retain separate native slots in the same canonical trainer team',()=>{
    const sets=api.apply(baseline()),trainer='Fisherman Elliot & Fisherman Ned',extra=trainer+' [Slot 2]';
    assert.equal(sets.Lanturn[trainer].level,44);assert.equal(sets.Lanturn[extra].level,43);
    assert.equal(api.trainerForSet('Lanturn ('+extra+')'),trainer);assert.equal(api.matchesTrainer(extra,trainer),true);
    assert.equal(api.matchesTrainer(trainer+' 2',trainer),false);
    assert.notEqual(api.slotForSet('Lanturn ('+trainer+')').id,api.slotForSet('Lanturn ('+extra+')').id);
    const t='Triathlete Benjamin & Triathlete Alyssa',x=api.slotForSet('Raichu-Mega-X ('+t+')'),y=api.slotForSet('Raichu-Mega-Y ('+t+')');
    assert.notEqual(x.id,y.id);assert.equal(x.native.species,'Raichu');assert.equal(y.native.species,'Raichu');
    assert.equal(x.native.item,'Raichunite X');assert.equal(y.native.item,'Raichunite Y');
    assert.equal(sets['Raichu-Mega-X'][t].nature,'Impish');assert.equal(sets['Raichu-Mega-Y'][t].nature,'Timid');
});
test('new Regenor doubles team has six ordered logical members and navigation inserts it before the League',()=>{
    const sets=api.apply(baseline()),t='Dragon Tamer Regenor';
    const rows=Object.entries(sets).flatMap(([name,trainers])=>trainers[t]?[{name,set:trainers[t],slot:api.slotForSet(name+' ('+t+')')}]:[]);
    assert.equal(rows.length,6);assert.equal(new Set(rows.map(r=>r.slot.id)).size,6);assert.ok(rows.every(r=>r.set.level===100));
    assert.equal(api.nativeReserveForSet('Raichu-Mega-X ('+t+')').species,'Raichu');
    const next=api.navigationSetFor('Raichu-Mega-X ('+t+')','next');assert.equal(api.trainerForSet(next),'Elite Four Sidney Singles');
    assert.equal(api.trainerForSet(api.navigationSetFor(next,'previous')),t);
});
test('native reserve metadata preserves four explicit Mega forms and the two actual Zygarde Mega displays',()=>{
    const sets=api.apply(baseline());
    for(const [species,trainer]of [['Tyranitar-Mega','Team Aqua Grunt Steve 3'],['Steelix-Mega','Team Aqua Grunt Steve 3'],['Garchomp-Mega','Team Aqua Grunt Steve 3'],['Salamence-Mega','Lorekeeper Zinnia']])assert.equal(api.nativeReserveForSet(species+' ('+trainer+')').species,species);
    for(const trainer of ['Adventurer Brandon 1','Adventurer Brandon 2']){
        assert.equal(sets['Zygarde-Complete'][trainer],undefined);assert.equal(sets['Zygarde-Mega'][trainer].ability,'Speed Boost');
        const slot=api.slotForSet('Zygarde-Mega ('+trainer+')');assert.equal(slot.native.species,'Zygarde');
        assert.equal(slot.id,api.slotForSet('Zygarde ('+trainer+')').id);assert.equal(slot.id,api.slotForSet('Zygarde-Complete ('+trainer+')').id);
    }
});
test('all real trainer sets have native order metadata, while the None sentinel is explicitly excluded',()=>{
    const sets=api.apply(baseline());let present=0;
    for(const [species,rows]of Object.entries(sets))for(const [key,set]of Object.entries(rows)){
        if(species==='None'){assert.equal(key,'Wandering Spirit');continue;}
        const slot=api.slotForSet(species+' ('+key+')');assert.ok(slot,species+' / '+key);assert.equal(slot.order,Number(slot.native.record.offset));present++;
    }
    assert.equal(present,2287);
});
test('two native double-trainer parties keep their own replacement bounds, including duplicate species and forms',()=>{
    const cases=[
        ['Seaking (Fisherman Elliot & Fisherman Ned)',339,0,2],
        ['Lanturn (Fisherman Elliot & Fisherman Ned)',339,0,2],
        ['Lapras (Fisherman Elliot & Fisherman Ned)',340,2,4],
        ['Lanturn (Fisherman Elliot & Fisherman Ned [Slot 2])',340,2,4],
        ['Raichu-Mega-X (Triathlete Benjamin & Triathlete Alyssa)',353,0,3],
        ['Eiscue-Noice (Triathlete Benjamin & Triathlete Alyssa)',353,0,3],
        ['Raichu-Mega-Y (Triathlete Benjamin & Triathlete Alyssa)',701,3,5]
    ];
    assert.equal(api.data.ownerGroups.length,2);
    for(const [id,trainer,first,last]of cases){const owner=api.ownerForSet(id);assert.equal(owner.nativeTrainerID,trainer);assert.equal(owner.partyFirstIndex,first);assert.equal(owner.partyLastIndex,last);assert.equal(api.ownerGroupForSet(id).kind,'two-separate-trainers');}
    assert.equal(api.ownerForSet('Raichu-Mega-X (Dragon Tamer Regenor)'),null);
    assert.equal(api.ownerForSet('Tatsugiri-Stretchy (Sis And Bro Reli&Ian)'),null);
});
test('all 348 historical trainer groups retain their exact navigation order, with only Regenor inserted',()=>{
    const sets=baseline(),groups=new Map();
    for(const [species,rows]of Object.entries(sets))for(const [key,set]of Object.entries(rows)){
        if(species==='None')continue;
        const id=species+' ('+key+')',trainer=api.trainerForSet(id),previous=groups.get(trainer);
        if(!previous||set.index<previous.index)groups.set(trainer,{trainer,index:set.index,id});
    }
    const expected=[...groups.values()].sort((a,b)=>a.index-b.index);assert.equal(expected.length,348);
    const before=expected.findIndex(group=>group.trainer==='Elite Four Sidney Singles');
    expected.splice(before,0,{trainer:'Dragon Tamer Regenor',id:'Raichu-Mega-X (Dragon Tamer Regenor)'});
    api.apply(sets);const visited=[];let id=expected[0].id;
    while(id){assert.ok(visited.length<350,'Navigation loop');visited.push({trainer:api.trainerForSet(id),id});id=api.navigationSetFor(id,'next');}
    assert.deepEqual(visited.map(group=>group.trainer),expected.map(group=>group.trainer));
    for(let i=0;i<expected.length;i++){
        assert.equal(visited[i].id,expected[i].id,'First set for '+expected[i].trainer);
        assert.equal(api.navigationSetFor(visited[i].id,'previous'),i?visited[i-1].id:null);
    }
    assert.equal(api.trainerForSet(api.navigationSetFor('Electrode-Hisui (Rustboro Rival Fennekin)','next')),'Rustboro Rival Froakie');
    assert.equal(api.trainerForSet(api.navigationSetFor('Aerodactyl (Elite Four Drake Singles)','next')),'Elite Four Drake Doubles');
});
test('party order uses historical indices independently from profile addresses, while two owner groups and Regenor use proven native order',()=>{
    const sets=api.apply(baseline()),owners=new Set(api.data.ownerGroups.map(group=>group.trainer));
    for(const slot of api.data.slots){
        assert.ok(Number.isFinite(slot.partyOrder));assert.equal(api.partyOrderForSet(slot.aliases[0]),slot.partyOrder);
        if(owners.has(slot.trainer)||slot.trainer==='Dragon Tamer Regenor')continue;
        const indices=slot.aliases.map(id=>{const i=id.indexOf(' (');return sets[id.slice(0,i)]?.[id.slice(i+2,-1)]?.index;}).filter(index=>index<dataBaselineRows());
        if(indices.length)assert.equal(slot.partyOrder,Math.min(...indices),slot.id);
    }
    for(const group of api.data.ownerGroups){const ids=group.owners.flatMap(owner=>owner.slots.map(slot=>slot.id));assert.deepEqual(ids.map(id=>api.data.slots.find(slot=>slot.id===id).partyOrder),ids.map((_,i)=>i));}
    assert.equal(api.partyOrderForSet('Lanturn (Fisherman Elliot & Fisherman Ned [Slot 2])'),3);
    assert.equal(api.partyOrderForSet('Raichu-Mega-X (Triathlete Benjamin & Triathlete Alyssa)'),2);
    assert.equal(api.partyOrderForSet('Raichu-Mega-Y (Triathlete Benjamin & Triathlete Alyssa)'),4);
    const team=api.data.slots.filter(slot=>slot.trainer==='Dragon Tamer Regenor').sort((a,b)=>a.partyOrder-b.partyOrder);assert.deepEqual(team.map(slot=>slot.partyOrder),[0,1,2,3,4,5]);
    function dataBaselineRows(){return api.data.baselineRows;}
});
test('repeated native profiles are resolved by full sequence coherence without merging distinct regional pool entries',()=>{
    assert.equal(api.data.bindingAudit.resolvedAmbiguousGroupCount,37);assert.equal(api.data.bindingAudit.reselectedAnchors.length,29);
    assert.equal(api.nativeReserveForSet('Primarina (Elite Four Drake Singles)').record.offset,'0x3b7634');
    assert.equal(api.nativeReserveForSet('Cacturne (Rustboro Rival Fennekin)').record.offset,'0x3a8344');
    assert.equal(api.nativeReserveForSet('Alomomola (Rustboro Rival Froakie)').record.offset,'0x3a8434');
    for(const [base,regional,trainer]of [['Rattata','Rattata-Alola','Root Academy Trainer #1 Slot 3'],['Grimer','Grimer-Alola','Root Academy Trainer #3 Slot 2']]){
        const a=api.slotForSet(base+' ('+trainer+')'),b=api.slotForSet(regional+' ('+trainer+')');assert.notEqual(a.id,b.id);assert.equal(b.native.species,regional);assert.ok(a.partyOrder<b.partyOrder);
    }
    assert.equal(api.data.slots.length,2122);
});
