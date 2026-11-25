'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const calc=require('../docs/calc'),util=require('../docs/calc/mechanics/util');
const data=require('../docs/js/null_ai/verified-data'),adapter=require('../docs/js/null_ai/verified-data-adapter');
adapter.apply(calc,data);
const pokemon=(name,options={})=>new calc.Pokemon(9,name,{level:50,...options});
const damage=(a,b,m,f)=>calc.calculate(9,a.clone(),b.clone(),m,f.clone());

test('1.2.6 ability changes beyond the short patch notes reach native species',()=>{
    for(const [name,slot,ability] of [['Slowking','0','Regenerator'],['Slowking','H','Shell Armor'],
        ['Karrablast','0','No Guard'],['Dudunsparce','1','Rattled'],['Dudunsparce-Three-Segment','1','Rattled'],
        ['Poltchageist','1','Heatproof'],['Sinistcha','1','Heatproof'],['Deoxys-Attack','0','Contrary']])
        assert.equal(calc.SPECIES[9][name].abilities[slot],ability,name);
});

test('Hurricane is wind, Glaive Rush is contact and the three restored effects use the native Sheer Force flag',()=>{
    assert.equal(new calc.Move(9,'Hurricane').flags.wind,1);
    assert.equal(new calc.Move(9,'Glaive Rush').flags.contact,1);
    for(const name of ['Alluring Voice','Anchor Shot','Spirit Shackle']){
        const attacker=pokemon('Mew',{ability:'Sheer Force'}),defender=pokemon('Blastoise');
        const boosted=damage(attacker,defender,new calc.Move(9,name),new calc.Field());
        attacker.ability='(other)';
        const ordinary=damage(attacker,defender,new calc.Move(9,name),new calc.Field());
        assert.ok(Math.max(...boosted.damage)>Math.max(...ordinary.damage),name);
    }
    assert.equal(new calc.Move(9,'Aqua Cutter').secondaries,false);
});

test('airborne Terrain Pulse changes type and power without granting the grounded terrain boost',()=>{
    const target=pokemon('Blastoise'),types={Electric:'Electric',Grassy:'Grass',Psychic:'Psychic',Misty:'Fairy'};
    for(const [terrain,type] of Object.entries(types)) for(const options of [{ability:'Levitate'},{item:'Air Balloon'}]){
        const a=pokemon('Mew',options),field=new calc.Field({terrain}),before=JSON.stringify(a);
        assert.equal(util.isGrounded(a,field),false);
        const actual=damage(a,target,new calc.Move(9,'Terrain Pulse'),field);
        const expected=damage(a,target,new calc.Move(9,'Tri Attack',{overrides:{type,basePower:100,secondaries:false}}),field);
        assert.deepEqual(actual.damage,expected.damage,terrain+' '+JSON.stringify(options));
        assert.equal(actual.move.type,type);
        assert.equal(JSON.stringify(a),before);
    }
    const flying=pokemon('Pidgeot'),field=new calc.Field({terrain:'Electric'});
    assert.deepEqual(damage(flying,target,new calc.Move(9,'Terrain Pulse'),field).damage,
        damage(flying,target,new calc.Move(9,'Tri Attack',{overrides:{type:'Electric',basePower:100,secondaries:false}}),field).damage);
    const grounded=pokemon('Mew'),f=new calc.Field({terrain:'Electric'});
    assert.ok(Math.max(...damage(grounded,target,new calc.Move(9,'Terrain Pulse'),f).damage)>
        Math.max(...damage(pokemon('Mew',{ability:'Levitate'}),target,new calc.Move(9,'Terrain Pulse'),f).damage));
});

test('Future Sight ignores Psychic Gem while ordinary Psychic still receives it and the held item stays intact',()=>{
    const a=pokemon('Mew',{item:'Psychic Gem'}),b=pokemon('Blastoise'),field=new calc.Field(),before=JSON.stringify(a);
    const noGem=a.clone();noGem.item='';
    assert.deepEqual(damage(a,b,new calc.Move(9,'Future Sight'),field).damage,
        damage(noGem,b,new calc.Move(9,'Future Sight'),field).damage);
    assert.ok(Math.max(...damage(a,b,new calc.Move(9,'Psychic'),field).damage)>
        Math.max(...damage(noGem,b,new calc.Move(9,'Psychic'),field).damage));
    assert.equal(JSON.stringify(a),before);
    assert.equal(damage(a,b,new calc.Move(9,'Future Sight'),field).attacker.item,'Psychic Gem');
});

test('the existing engine already handles the corrected Flare Blitz/Reckless interaction',()=>{
    const a=pokemon('Emboar',{ability:'Reckless'}),b=pokemon('Blastoise'),field=new calc.Field();
    const boosted=damage(a,b,new calc.Move(9,'Flare Blitz'),field);
    a.ability='(other)';
    assert.ok(Math.max(...boosted.damage)>Math.max(...damage(a,b,new calc.Move(9,'Flare Blitz'),field).damage));
});

test('Normalize cannot re-enable a Normal Gem boost on Future Sight',()=>{
    const a=pokemon('Delcatty',{ability:'Normalize',item:'Normal Gem'}),b=pokemon('Blastoise'),field=new calc.Field(),ordinary=a.clone();
    ordinary.item='';
    const actual=damage(a,b,new calc.Move(9,'Future Sight'),field);
    assert.deepEqual(actual.damage,damage(ordinary,b,new calc.Move(9,'Future Sight'),field).damage);
    assert.equal(a.item,'Normal Gem');
    assert.equal(actual.attacker.item,'Normal Gem');
    assert.ok(Math.max(...damage(a,b,new calc.Move(9,'Psychic'),field).damage)>
        Math.max(...damage(ordinary,b,new calc.Move(9,'Psychic'),field).damage));
});
