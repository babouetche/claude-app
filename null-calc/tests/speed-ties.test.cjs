'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const ai = require('../docs/js/null_ai/switch.js');
const {predict} = require('../docs/js/null_ai/post_ko.js');
const fixture = require('./fixtures/speed-tie-rusturf.json');
const clone = x => JSON.parse(JSON.stringify(x));
function reserve(id, speed, outgoing, incoming, extra = {}) {
    return Object.assign({id, name:id, partyIndex:1, alive:true, active:false,
        hp:100, maxHP:100, speed, incomingDamage:[incoming],
        moves:[{name:'Surf',category:'Special',bp:90,damage:[outgoing]}]},extra);
}
function state(candidates) {
    return {player:{name:'Player',hp:100,maxHP:100,speed:100,moves:[]},
        opponent:{name:'Active',hp:100,maxHP:100,speed:80,moves:[]},
        field:{gameType:'Singles'},context:{calculationMode:'strict'},
        party:{complete:true,trainerName:'Fixture',candidates}};
}

test('Rusturf screenshot: Phione ties Masquerain at 90 and wins 3 against Slowbro-Galar 2', () => {
    const s = clone(fixture.state), before = JSON.stringify(s);
    assert.equal(s.player.speed,90);
    assert.equal(s.party.candidates.find(c=>c.name==='Phione').speed,90);
    const r = predict(s), phione = r.candidates.find(c=>c.name==='Phione');
    assert.deepEqual(r.switch.candidates.map(c=>[c.name,c.score,c.probability]),
        [['Slowbro-Galar',2,0],['Wormadam',-1,0],['Phione',3,1]]);
    assert.deepEqual(phione.scoreRange,[3,3]);
    assert.equal(phione.probabilityStatus,'determined');
    assert.equal(JSON.stringify(s),before,'preview leaves current HP, moves and team unchanged');
});

test('Rusturf prediction changes at the correct speed boundary, rather than rolling 50/50', () => {
    const s = clone(fixture.state);
    for (const [speed,expected] of [[89,'Phione'],[90,'Phione'],[91,'Slowbro-Galar']]) {
        s.player.speed=speed;
        assert.equal(predict(s).switch.candidates.find(c=>c.probability===1).name,expected);
    }
});

test('equal speed uses every faster score branch, including a lost damage exchange', () => {
    const s = state([]);
    for (const reversed of [false,true]) {
        s.field.trickRoom=reversed;
        for (const [outgoing,incoming,score] of [[100,100,5],[50,50,3],[20,50,1],[20,100,1]]) {
            const r=ai.scoreCandidate(reserve('Tie',100,outgoing,incoming),s,false);
            assert.equal(r.score,score,JSON.stringify({reversed,outgoing,incoming}));
            assert.deepEqual(r.assumptions,[],'a documented speed tie is not missing context');
        }
    }
});

test('strictly slower and faster checks still reverse under Trick Room', () => {
    const s=state([]);
    for (const [reversed,expected] of [[false,[-1,5,5]],[true,[5,5,-1]]]) {
        s.field.trickRoom=reversed;
        assert.deepEqual([99,100,101].map(speed=>ai.scoreCandidate(reserve('Reserve',speed,100,100),s,false).score),expected);
    }
});

test('strict mode accepts a deterministic tied-speed replacement without an uncertainty flag', () => {
    const r=predict(state([reserve('Tie',100,50,20)]));
    assert.equal(r.switch.status,'determined');
    assert.equal(r.candidates[0].score,3);
    assert.equal(r.candidates[0].probability,1);
    assert.deepEqual(r.assumptions,[]);
});

test('hard-switch entry penalties remain separate from the favorable tie convention', () => {
    const s=state([]);
    assert.equal(ai.scoreCandidate(reserve('Tie',100,100,50),s,true).score,5);
    assert.equal(ai.scoreCandidate(reserve('Tie',100,100,100),s,true).score,-2);
    assert.equal(ai.scoreCandidate(reserve('Slow',99,100,50),s,true).score,-1);
});

test('equal post-KO scores keep party order; speed ties do not add random selection', () => {
    const s=state([reserve('First',100,100,20),reserve('Second',150,100,20,{partyIndex:2})]);
    assert.deepEqual(predict(s).switch.candidates.map(c=>[c.score,c.probability]),[[5,1],[5,0]]);
});

test('doubles tied-speed replacement excludes the active partner and KO reserves', () => {
    const s=state([reserve('Partner',200,100,20,{active:true,partnerActive:true}),
        reserve('KO',200,100,20,{partyIndex:2,hp:0,alive:false}),
        reserve('Tie',100,100,20,{partyIndex:3}),reserve('Slow',99,100,20,{partyIndex:4})]);
    s.field.gameType='Doubles';s.context.doublesComplete=true;
    const r=predict(s);
    assert.equal(r.candidates[0].eligibility,'partner');
    assert.equal(r.candidates[1].eligibility,'fainted');
    assert.deepEqual(r.switch.candidates.map(c=>[c.name,c.score,c.probability]),[['Tie',5,1],['Slow',4,0]]);
});
