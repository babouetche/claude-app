'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.NULL_AI_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),entry=path.resolve(process.env.NULL_CALC_ENTRY||path.join(root,'CALCULATEUR.html'));
const fixtures=require('../tests/fixtures/observed-native-thresholds.json');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const setups=[
 {species:'Chesnaught',nature:'Impish',ability:'Battle Armor',ivs:{hp:31,at:15,df:31,sa:4,sd:14,sp:31},moves:['Brick Break','Grassy Glide','Trailblaze','Spiky Shield'],opponent:'Arboliva (Youngster Joey)'},
 {species:'Boltund',nature:'Lax',ability:'Strong Jaw',ivs:{hp:24,at:21,df:11,sa:22,sd:27,sp:0},moves:['Parabolic Charge','Zing Zap','Nuzzle','Crunch'],opponent:'Pelipper (Fisherman Ivan)',rain:true},
 {species:'Typhlosion',nature:'Quirky',ability:'Blaze',ivs:{hp:14,at:9,df:13,sa:15,sd:12,sp:14},moves:['Swift','Incinerate','Thunder Punch','Lava Plume'],opponent:'Parasect (Bug Catcher James)'}
];
async function setup(page,settings){await page.evaluate(s=>{
 $('#p1 .set-selector').val(s.species+' (Blank Set)').trigger('change');$('#p1 .level').val(38).trigger('change');
 $('#p1 .nature').val(s.nature).trigger('change');$('#p1 .ability').val(s.ability).trigger('change');$('#p1 .item').val('').trigger('change');
 Object.entries(s.ivs).forEach(([k,v])=>{$('#p1 .'+k+' .ivs').val(v).trigger('change');$('#p1 .'+k+' .evs').val(0).trigger('change');});
 s.moves.forEach((name,i)=>$('#p1 .move'+(i+1)+' select.move-selector').val(name).trigger('change'));
 $('#p2 .set-selector').val(s.opponent).trigger('change');$('#p1 .percent-hp,#p2 .percent-hp').val(100).trigger('change');
 $('#'+(s.rain?'rain':'clear')).prop('checked',true).trigger('change');performCalculations();
},settings);}
async function read(page){return page.evaluate(()=>({post:NullPostKOUI.getLastResult(),state:NullMoveAIState.readBattleState(damageResults),
 damage:damageResults.map(s=>s.map(r=>r.damage)),hp:[$('#p1 .current-hp').val(),$('#p2 .current-hp').val()],trainerData:JSON.stringify(SETDEX_SV)}));}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.NULL_AI_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const errors=[],checks=[],battles=[];
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1080}}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.stack));await page.route(/^https?:\/\//,r=>r.abort());
  await page.goto(pathToFileURL(entry).href,{waitUntil:'load'});await page.waitForFunction(()=>window.NullNativeAIHelpers&&window.NullPostKOUI&&NullPostKOUI.getLastResult());
  const originalData=await page.evaluate(()=>JSON.stringify(SETDEX_SV));
  for(let i=0;i<setups.length;i++){
   const fixture=fixtures.battles[i];await setup(page,setups[i]);let r=await read(page);
   const scores=r.post.switch.candidates;
   assert.deepEqual(scores.map(c=>c.score),fixture.expectedScores,fixture.id);
   assert.equal(scores.find(c=>c.probability===1).name,fixture.observedEntrant,fixture.id);
   assert.ok(scores.every(c=>c.damageBasis==='rom-no-variance'));
   assert.equal(r.trainerData,originalData);
   const before={damage:r.damage,hp:r.hp};
   await page.evaluate(()=>{$('#null-ai-mode').val('strict').trigger('change');performCalculations();});r=await read(page);
   assert.equal(r.post.switch.candidates.find(c=>c.probability===1).name,fixture.observedEntrant,'strict '+fixture.id);
   assert.deepEqual({damage:r.damage,hp:r.hp},before,'scoring must not change displayed damage or battle HP');
   await page.evaluate(()=>{$('#null-ai-mode').val('estimate').trigger('change');performCalculations();});
   battles.push({id:fixture.id,observedEntrant:fixture.observedEntrant,playerHP:r.state.player.hp,
    scores:scores.map(c=>({name:c.name,score:c.score,probability:c.probability,scoreDamage:c.scoreDamage})),damageUnchanged:true,strictModeConsistent:true});
  }
  await setup(page,setups[0]);
  for(const [hp,entrant] of [[112,'Comfey'],[113,'Heliolisk'],[126,'Heliolisk']]){
   await page.evaluate(hp=>{$('#p1 .current-hp').val(hp).trigger('change');performCalculations();},hp);
   const r=await read(page);assert.equal(r.state.player.hp,hp);assert.equal(r.post.switch.candidates.find(c=>c.probability===1).name,entrant);
  }
  checks.push('Three reported encounters use unchanged trainer data and reproduce Heliolisk, Castform and Farfetch’d with no-variance reserve scoring. Strict mode agrees and visible damage/HP are unchanged.');
  checks.push('The real browser adapter changes Joey’s replacement from Comfey at112HP to Heliolisk at113HP, and restores the observed full126HP case.');
  // The two entry paths use the same scorer, and their different incoming-hit
  // assumptions remain explicit rather than inheriting the last preview.
  const shared=await page.evaluate(()=>{
   const s=NullMoveAIState.readBattleState(damageResults),p=NullPostKO.predict(s),direct=NullSwitchAI.getSwitchProbabilities({...s,context:{...s.context,switchScenario:'post-ko'}});
   return {preview:p.switch.candidates,direct:direct.candidates};
  });assert.deepEqual(shared.preview,shared.direct);
  checks.push('Direct post-KO scenario and lower-right replacement preview share the exact same scores, hit counts and destination.');
  assert.deepEqual(errors,[]);
  const report={revision:require('./release-config.json').revision,checkedAt:new Date().toISOString(),htmlSHA256:sha(fs.readFileSync(entry)),trainerDataSHA256:sha(originalData),
   romSHA256:require('./release-config.json').romSHA256,originalObservationROM:fixtures.romSHA256,battles,checks,errors};
  fs.writeFileSync(path.join(root,'verification/native-threshold-browser.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
