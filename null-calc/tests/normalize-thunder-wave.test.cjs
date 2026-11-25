'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const calc=require('../docs/calc');
const mechanics=require('../docs/calc/mechanics/util');
const root=path.resolve(__dirname,'..'),sandbox={window:{},calc:Object.assign({},calc,{isGrounded:mechanics.isGrounded})};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(root,'docs/js/null_ai/metadata.js'),'utf8'),sandbox);
sandbox.window.NullAIMoveMetadata=sandbox.NullAIMoveMetadata;
vm.runInContext(fs.readFileSync(path.join(root,'docs/js/null_ai/state.js'),'utf8'),sandbox);
const state=sandbox.window.NullMoveAIState;
function blocked(target,ability='Normalize',extras={}) {
 const user=new calc.Pokemon(9,'Delcatty',{ability}),move=new calc.Move(9,'Thunder Wave');move.category='Status';
 const foe=new calc.Pokemon(9,target,extras),field=new calc.Field();
 return state.isStatusBlocked(move,foe,field,user);
}
test('Normalize Thunder Wave becomes Normal and can paralyze Ground Golem',()=>{
 assert.equal(blocked('Golem'),false);
 const m=new calc.Move(9,'Thunder Wave');m.category='Status';
 assert.equal(state.effectiveStatusMoveType(m,new calc.Pokemon(9,'Delcatty',{ability:'Normalize'})),'Normal');
 assert.equal(m.type,'Electric','display/source move data is not rewritten');
});
test('ordinary Electric Thunder Wave remains blocked by Ground and Electric absorption abilities',()=>{
 assert.equal(blocked('Golem','Cute Charm'),true);
 assert.equal(blocked('Blastoise','Cute Charm',{ability:'Volt Absorb'}),true);
 assert.equal(blocked('Blastoise','Cute Charm',{ability:'Motor Drive'}),true);
 assert.equal(blocked('Blastoise','Cute Charm',{ability:'Lightning Rod'}),true);
});
test('normalized Thunder Wave respects Ghost type immunity while Electric-specific abilities do not absorb Normal',()=>{
 assert.equal(blocked('Gengar'),true);assert.equal(blocked('Gengar','Cute Charm'),false);
 for(const ability of ['Volt Absorb','Motor Drive','Lightning Rod'])assert.equal(blocked('Blastoise','Normalize',{ability}),false);
});
test('Electric paralysis immunity, Limber and Misty Terrain still protect against normalized Thunder Wave',()=>{
 assert.equal(blocked('Pikachu'),true);assert.equal(blocked('Blastoise','Normalize',{ability:'Limber'}),true);
 const move=new calc.Move(9,'Thunder Wave');move.category='Status';
 const user=new calc.Pokemon(9,'Delcatty',{ability:'Normalize'}),foe=new calc.Pokemon(9,'Golem'),field=new calc.Field({terrain:'Misty'});
 assert.equal(state.isStatusBlocked(move,foe,field,user),true);
});
test('Foresight can remove Normal type immunity without changing the independent paralysis protections',()=>{
 const move=new calc.Move(9,'Thunder Wave');move.category='Status';
 const user=new calc.Pokemon(9,'Delcatty',{ability:'Normalize'}),foe=new calc.Pokemon(9,'Gengar'),field=new calc.Field();field.defenderSide.isForesight=true;
 assert.equal(state.isStatusBlocked(move,foe,field,user),false);
 foe.ability='Limber';assert.equal(state.isStatusBlocked(move,foe,field,user),true);
});
