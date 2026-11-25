'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const core=require('../docs/js/null_ai/core.js'),doubles=require('../docs/js/null_ai/doubles.js');
const fixtures=require('./fixtures/rules-family-cases.cjs'),reference=require('./fixtures/rules-family-reference.json');
const migration=require('./fixtures/rules-family-1.2.6-overrides.json');
const root=path.resolve(__dirname,'..'),families=['setup','status','field','survival','damage'];
const digest=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const cases=fixtures.cases(),historical=new Map(reference.cases.map(c=>[c.id,c])),overrides=new Map(migration.cases.map(c=>[c.id,c]));
const expected=new Map(reference.cases.map(c=>[c.id,overrides.get(c.id)||c]));
test('1.2.6 migration preserves the historical fixture and limits reviewed overrides to45 native-rule cases',()=>{
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'fixtures/rules-family-reference.json'))).digest('hex'),migration.baselineSHA256);
    assert.equal(cases.length,1263);assert.equal(overrides.size,45);assert.equal(cases.length-overrides.size,1218);
    const changed=[],counts={};
    for(const c of cases){const result=core[c.method](c.state);if(digest(result)!==historical.get(c.id).digest)changed.push(c.id);}
    assert.deepEqual(changed.sort(),Array.from(overrides.keys()).sort());
    for(const item of migration.cases){assert.equal(historical.get(item.id).digest,item.baselineDigest);counts[item.move]=(counts[item.move]||0)+1;}
    assert.deepEqual(counts,migration.byMove);
});
for(const method of ['getNullAIMoveProbabilities','getTargetScoreDistributions']) test(`scoring families preserve ${method} outputs with explicit reviewed1.2.6 overrides`,()=>{
    const inputs=cases.filter(c=>c.method===method);
    assert.equal(cases.length,reference.cases.length);assert.ok(inputs.length>=600);
    for(const c of inputs){const before=JSON.stringify(c.state),result=core[method](c.state);assert.equal(digest(result),expected.get(c.id).digest,`Full-output parity failed for ${c.id}: ${JSON.stringify(result)}`);assert.equal(JSON.stringify(c.state),before,`Input mutation for ${c.id}`);}
});
test('scoring families preserve full two-slot doubles decisions and target distributions',()=>{
    const inputs=fixtures.doubleCases();assert.equal(inputs.length,reference.doubleCases.length);
    for(const c of inputs){const before=JSON.stringify(c.state);assert.equal(digest(doubles.predict(c.state)),reference.doubleCases.find(r=>r.id===c.id).digest,c.id);assert.equal(JSON.stringify(c.state),before,c.id);}
});
test('browser UMD family loader produces the same outputs as Node without generated code',()=>{
    const env={};env.window=env;vm.createContext(env);
    for(const file of families.map(name=>`rules_${name}.js`).concat('core.js','doubles.js')) vm.runInContext(fs.readFileSync(path.join(root,'docs/js/null_ai',file),'utf8'),env,{filename:file});
    for(const c of cases.filter((c,i)=>i%17===0))assert.equal(digest(env.NullMoveAI[c.method](c.state)),expected.get(c.id).digest,c.id);
    for(const c of fixtures.doubleCases())assert.equal(digest(env.NullDoubleAI.predict(c.state)),digest(doubles.predict(c.state)),c.id);
});
test('family dispatch has unique stable order and each family contains actual scoring routines',()=>{
    const helper=new Proxy({names:text=>new Set(text.split('|'))},{get:(target,key)=>target[key]||function(){}}),rules=[];
    for(const name of families){const list=require(`../docs/js/null_ai/rules_${name}.js`).createRules(helper);assert.ok(list.length>=8,name);assert.ok(list.every(r=>typeof r.run==='function'),name);rules.push(...list);}
    assert.equal(rules.length,77);assert.equal(new Set(rules.map(r=>r.order)).size,77);assert.equal(new Set(rules.map(r=>r.id)).size,77);
    assert.deepEqual(rules.map(r=>r.order).sort((a,b)=>a-b),Array.from({length:77},(_,i)=>i*10));
});
test('missing browser family fails clearly at load instead of publishing partial probabilities',()=>{
    const env={};env.window=env;vm.createContext(env);assert.throws(()=>vm.runInContext(fs.readFileSync(path.join(root,'docs/js/null_ai/core.js'),'utf8'),env),/Load all Null AI scoring families before core\.js/);assert.equal(env.NullMoveAI,undefined);
});
