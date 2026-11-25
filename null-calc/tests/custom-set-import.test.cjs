'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const calc=require('../docs/calc'),api=require('../docs/js/custom_set_import.js');
const root=path.resolve(__dirname,'..'),fixture=fs.readFileSync(path.join(__dirname,'fixtures/import-duplicate-species.txt'),'utf8');
const clone=x=>JSON.parse(JSON.stringify(x));
function environment() {
    const chain={click(){return this;},on(){return this;},ready(){return this;},css(){return this;},prop(){return false;}};
    const env={calc:Object.assign({},calc,{SPECIES:{9:clone(calc.SPECIES[9])}}),document:{},localStorage:{},
        $:()=>chain,allPokemon:x=>x,alert:message=>{throw new Error(message);},
        boxed:[]};
    env.addBoxed=poke=>env.boxed.push(poke.name+' ('+poke.nameProp+')');
    for(const table of ['SETDEX_SV','SETDEX_SS','SETDEX_SM','SETDEX_XY','SETDEX_BW','SETDEX_DPP','SETDEX_ADV','SETDEX_GSC','SETDEX_RBY'])env[table]={};
    vm.createContext(env);vm.runInContext(fs.readFileSync(path.join(root,'docs/js/moveset_import.js'),'utf8'),env);
    env.appendMegaSavesForSpecies=()=>{};
    env.updateDex=sets=>{for(const [species,entries]of Object.entries(sets))env.SETDEX_SV[species]=Object.assign(env.SETDEX_SV[species]||{},entries);env.localStorage.customsets=JSON.stringify(sets);};
    return env;
}
function saved(env){return JSON.parse(env.localStorage.customsets);}

test('legacy importer reproduces the reported overwrite; new importer keeps all eight individuals',()=>{
    const old=environment();old.addSets(fixture,'Custom Set');
    assert.equal(Object.values(saved(old)).reduce((n,row)=>n+Object.keys(row).length,0),7);
    assert.equal(saved(old).Stantler['Custom Set'].level,13);
    const env=environment(),before=JSON.stringify(env.calc.SPECIES);
    assert.equal(api.importSets(fixture,'Custom Set',env).length,8);
    const rows=saved(env),a=rows.Stantler['Custom Set'],b=rows.Stantler['Custom Set 2'];
    assert.deepEqual([a.level,a.nature,a.ivs,a.moves],[25,'Lonely',{hp:14,at:23,df:29,sa:4,sd:21,sp:31},['Me First','Stomp','Confuse Ray','Take Down']]);
    assert.deepEqual([b.level,b.nature,b.ivs,b.moves],[13,'Relaxed',{hp:15,at:18,df:28,sa:2,sd:26,sp:24},['Me First','Stomp','Leer','Astonish']]);
    assert.equal(new Set(env.boxed).size,8);
    assert.equal(JSON.stringify(env.calc.SPECIES),before,'species data is not used as mutable import scratch storage');
});

test('three identical same-species individuals and later imports each retain their own ID',()=>{
    const env=environment(),block='Stantler\nLevel: 25\n- Stomp';
    assert.deepEqual(api.importSets([block,block,block].join('\n\n'),'Custom Set',env),
        ['Stantler (Custom Set)','Stantler (Custom Set 2)','Stantler (Custom Set 3)']);
    assert.deepEqual(api.importSets(block,'Custom Set',env),['Stantler (Custom Set 4)']);
    assert.equal(Object.keys(saved(env).Stantler).length,4);
});

test('existing saved data and trainer names are preserved while suffixes skip occupied names',()=>{
    const env=environment(),existing={level:13,moves:['Astonish'],isCustomSet:true};
    env.localStorage.customsets=JSON.stringify({Stantler:{'Custom Set':existing,'Custom Set 2':existing}});
    env.SETDEX_SV.Stantler={'Custom Set 3':{level:40,index:99,moves:['Stomp']}};
    const trainer=JSON.stringify(env.SETDEX_SV.Stantler['Custom Set 3']);
    assert.deepEqual(api.importSets('Stantler\nLevel: 25\n- Take Down','Custom Set',env),['Stantler (Custom Set 4)']);
    assert.deepEqual(saved(env).Stantler['Custom Set'],existing);
    assert.equal(JSON.stringify(env.SETDEX_SV.Stantler['Custom Set 3']),trainer);
});

test('explicit nicknames retain their names and duplicate nicknames receive a suffix',()=>{
    const env=environment();
    assert.deepEqual(api.importSets('Deer (Stantler)\nLevel: 25\n- Stomp\n\nDeer (Stantler)\nLevel: 13\n- Astonish','Group',env),
        ['Stantler (Deer)','Stantler (Deer 2)']);
    assert.deepEqual(Object.values(saved(env).Stantler).map(s=>s.level),[25,13]);
});

test('a following individual does not inherit omitted stats, ability or moves from its predecessor',()=>{
    const env=environment();
    api.importSets('Stantler\nAbility: Intimidate\nLevel: 25\nLonely Nature\nIVs: 3 HP\n- Stomp\n\nStantler\n- Astonish','Custom Set',env);
    const second=saved(env).Stantler['Custom Set 2'];
    assert.equal(second.level,100);assert.equal(second.nature,'Serious');
    assert.deepEqual(second.ivs,{});assert.equal(second.ability,undefined);assert.deepEqual(second.moves,['Astonish']);
});

test('Aegislash aliases reserve one shared set name and cannot overwrite an existing Shield record',()=>{
    const env=environment();env.localStorage.customsets=JSON.stringify({'Aegislash-Shield':{'Custom Set':{level:13}}});
    assert.deepEqual(api.importSets('Aegislash\nLevel: 25\n- Shadow Sneak','Custom Set',env),['Aegislash-Blade (Custom Set 2)']);
    const rows=saved(env);assert.equal(rows['Aegislash-Shield']['Custom Set'].level,13);
    assert.equal(rows['Aegislash-Blade']['Custom Set 2'].level,25);
    assert.deepEqual(rows['Aegislash-Blade']['Custom Set 2'],rows['Aegislash-Shield']['Custom Set 2']);
});

test('full reset removes duplicate and stale custom sets from every generation, restores shipped collisions and restarts naming',()=>{
    const env=environment();env.localStorage.removeItem=function(key){delete this[key];};
    const trainer={level:40,index:99,moves:['Stomp']};
    env.SETDEX_SV.Stantler={'Named Trainer':trainer,'Custom Set Coach':{index:101,moves:['Stomp']}};
    const original=api.captureOriginalSets(env);
    api.importSets(fixture,'Custom Set',env);
    const rows=saved(env);rows.Stantler['Named Trainer']={level:5,moves:['Leer'],isCustomSet:true};
    env.SETDEX_SV.Stantler['Named Trainer']=rows.Stantler['Named Trainer'];env.localStorage.customsets=JSON.stringify(rows);
    for(const [table,dex]of Object.entries(env).filter(([name])=>name.startsWith('SETDEX_')))
        dex.Pikachu={'Ghost Custom':{level:5,isCustomSet:true}};
    env.localStorage.nullcalc_box2SetIds='["StantlerCustom Set 2"]';env.localStorage.preference='keep';
    const removed=api.clearSavedSets(env,original);
    assert.ok(removed.includes('Stantler (Custom Set 2)'));assert.ok(removed.includes('Pikachu (Ghost Custom)'));
    assert.equal(env.localStorage.customsets,undefined);assert.equal(env.localStorage.nullcalc_box2SetIds,undefined);assert.equal(env.localStorage.preference,'keep');
    assert.deepEqual(env.SETDEX_SV.Stantler,{'Named Trainer':trainer,'Custom Set Coach':{index:101,moves:['Stomp']}});
    for(const [,dex]of Object.entries(env).filter(([name])=>name.startsWith('SETDEX_')))
        assert.ok(Object.values(dex).every(sets=>Object.values(sets).every(s=>!s.isCustomSet)));
    assert.deepEqual(api.importSets('Stantler\nLevel: 25\n- Stomp','Custom Set',env),['Stantler (Custom Set)']);
});

test('full reset handles corrupt or already absent storage and preserves unrelated saved settings',()=>{
    const env=environment();env.localStorage.removeItem=function(key){delete this[key];};
    env.localStorage.customsets='{bad json';env.localStorage.lasttimetrainer='42';
    env.SETDEX_SV.Pikachu={'Stale Custom':{isCustomSet:true},'Named Trainer':{index:42,level:30}};
    assert.deepEqual(api.clearSavedSets(env),['Pikachu (Stale Custom)']);
    assert.deepEqual(env.SETDEX_SV.Pikachu,{'Named Trainer':{index:42,level:30}});
    assert.equal(env.localStorage.lasttimetrainer,'42');assert.deepEqual(api.clearSavedSets(env),[]);
});
