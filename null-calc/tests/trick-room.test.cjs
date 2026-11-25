'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const api=require('../docs/js/trick_room');
const core=require('../docs/js/null_ai/core');
const root=path.resolve(__dirname,'..');
// Use the shipped browser loader: mechanics functions are global in this app.
function engine(patched=true){
 const env={};vm.createContext(env);vm.runInContext('this.__createBinding=function(o,m,k){o[k]=m[k];};var calc=exports={};function require(){return exports;}',env);
 const html=fs.readFileSync(path.join(root,'docs/index.html'),'utf8');
 for(const match of html.matchAll(/src="\.\/(calc\/[^"?]+)(?:\?)?"/g))vm.runInContext(fs.readFileSync(path.join(root,'docs',match[1]),'utf8'),env,{filename:match[1]});
 if(patched)api.installEngine(env);return env;
}
const env=engine(),calc=env.calc;
function battle(name,active,options={}){
 const a=new calc.Pokemon(9,options.fast?'Mew':'Machamp',{level:50,ability:options.ability||'No Ability',item:options.item||'',status:options.status||'',boosts:options.boosts||{}});
 const d=new calc.Pokemon(9,options.fast?'Machamp':'Mew',{level:50,ability:'No Ability'}),move=new calc.Move(9,name),field=new calc.Field();
 field.isTrickRoom=active;field.attackerSide.isTailwind=!!options.tailwind;field.defenderSide.isSwitching=options.switching?'out':undefined;
 return calc.calculate(9,a,d,move,field);
}
const damage=r=>JSON.parse(JSON.stringify(r.damage));

test('Trick Room reverses only equal-priority speed order; priority and speed ties remain intact',()=>{
 assert.equal(api.order(36,44,false),1);assert.equal(api.order(36,44,true),-1);
 assert.equal(api.order(36,44,true,0,1),1);assert.equal(api.order(100,20,true,1,0),-1);
 assert.equal(api.order(44,44,true),0);assert.equal(api.order(44,44,false),0);
});
test('the field retains Trick Room through clone and side swap without mutating the original',()=>{
 const field=new calc.Field({weather:'Rain',gameType:'Doubles'});field.isTrickRoom=true;field.attackerSide.isTailwind=true;
 const copy=field.clone().swap();assert.equal(copy.isTrickRoom,true);assert.equal(copy.weather,'Rain');assert.equal(copy.defenderSide.isTailwind,true);
 copy.isTrickRoom=false;assert.equal(field.isTrickRoom,true);
});
test('Payback uses the reversed order while result speed values remain actual speeds',()=>{
 const off=battle('Payback',false),on=battle('Payback',true);
 assert.equal(off.rawDesc.moveBP,100);assert.equal(on.rawDesc.moveBP,50);assert.ok(on.range()[1]<off.range()[0]);
 assert.equal(off.attacker.stats.spe,on.attacker.stats.spe);assert.equal(off.defender.stats.spe,on.defender.stats.spe);
 assert.equal(battle('Payback',true,{fast:true}).rawDesc.moveBP,100);
});
test('Fishious Rend and Bolt Beak double for the slower user under Trick Room',()=>{
 for(const name of ['Fishious Rend','Bolt Beak']){
  assert.equal(battle(name,false).rawDesc.moveBP,85);assert.equal(battle(name,true).rawDesc.moveBP,170);
  assert.equal(battle(name,false,{fast:true}).rawDesc.moveBP,170);assert.equal(battle(name,true,{fast:true}).rawDesc.moveBP,85);
 }
});
test('Analytic follows reversed order and still activates against a switching target',()=>{
 const off=battle('Surf',false,{ability:'Analytic'}),on=battle('Surf',true,{ability:'Analytic'});
 assert.equal(off.rawDesc.attackerAbility,'Analytic');assert.notEqual(on.rawDesc.attackerAbility,'Analytic');assert.ok(off.range()[0]>on.range()[0]);
 assert.equal(battle('Surf',true,{ability:'Analytic',fast:true}).rawDesc.attackerAbility,'Analytic');
 assert.equal(battle('Surf',true,{ability:'Analytic',switching:true}).rawDesc.attackerAbility,'Analytic');
});
test('Gyro Ball and Electro Ball retain speed-ratio power rather than using reversed artificial stats',()=>{
 for(const name of ['Gyro Ball','Electro Ball'])for(const fast of [false,true]){
  const off=battle(name,false,{fast}),on=battle(name,true,{fast});assert.deepEqual(damage(on),damage(off));assert.equal(on.rawDesc.moveBP,off.rawDesc.moveBP);
 }
});
test('paralysis, Tailwind, Choice Scarf and boosts still determine real final speed before order reverses',()=>{
 for(const options of [{status:'par'},{tailwind:true},{item:'Choice Scarf'},{boosts:{spe:2}}]){
  const off=battle('Tackle',false,options),on=battle('Tackle',true,options);
  assert.equal(off.attacker.stats.spe,on.attacker.stats.spe);assert.deepEqual(damage(on),damage(off));
 }
});
test('Trick Room off reproduces original mechanics, and toggling does not mutate move or Pokémon inputs',()=>{
 const stock=engine(false).calc;
 for(const name of ['Payback','Bolt Beak','Fishious Rend','Gyro Ball','Electro Ball','Surf']){
  const a=new stock.Pokemon(9,'Machamp',{level:50,ability:'Analytic'}),d=new stock.Pokemon(9,'Mew',{level:50}),m=new stock.Move(9,name);
  const expected=stock.calculate(9,a,d,m,new stock.Field());assert.deepEqual(damage(battle(name,false,{ability:'Analytic'})),damage(expected));
 }
 const a=new calc.Pokemon(9,'Machamp'),d=new calc.Pokemon(9,'Mew'),m=new calc.Move(9,'Payback'),f=new calc.Field();f.isTrickRoom=true;
 const before=JSON.stringify([a,d,m,f]);calc.calculate(9,a,d,m,f);assert.equal(JSON.stringify([a,d,m,f]),before);
});
test('Technician tests the corrected power and equal-speed damage keeps the existing tie convention',()=>{
 const plain=battle('Payback',true),tech=battle('Payback',true,{ability:'Technician'});assert.equal(tech.rawDesc.moveBP,50);assert.ok(tech.range()[0]>plain.range()[0]);
 const a=new calc.Pokemon(9,'Mew'),d=new calc.Pokemon(9,'Mew'),m=new calc.Move(9,'Payback'),f=new calc.Field();
 const off=calc.calculate(9,a,d,m,f);f.isTrickRoom=true;assert.deepEqual(damage(calc.calculate(9,a,d,m,f)),damage(off));
});

test('paralysis cannot claim a speed-order reversal by slowing the target under Trick Room',()=>{
 const tackle={name:'Tackle',category:'Physical',type:'Normal',effect:'HIT',damage:[20],bp:40,basePower:40,priority:0};
 const mon={hp:100,maxHP:100,types:['Normal'],ability:'',item:'',boosts:{},status:'',moves:[tackle]};
 const s={player:{...mon,name:'Player',speed:90,paralyzedSpeed:22},opponent:{...mon,name:'AI',speed:120,moves:[{name:'Thunder Wave',category:'Status',type:'Electric',effect:'STATUS',damage:[0],bp:0,priority:0,target:'normal'},tackle]},
  field:{gameType:'Singles',trickRoom:true},context:{calculationMode:'estimate'}};
 const reversed=core.getNullAIMoveProbabilities(s);assert.deepEqual(reversed.moves.map(m=>m.probability),[.75,.25]);
 assert.ok(!reversed.moves[0].rules.some(r=>r.includes('speed order reverses')));
 s.field.trickRoom=false;s.opponent.speed=60;assert.deepEqual(core.getNullAIMoveProbabilities(s).moves.map(m=>m.probability),[.875,.125]);
});
