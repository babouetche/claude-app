'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.NULL_AI_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),entry=path.resolve(process.env.NULL_CALC_ENTRY||path.join(root,'CALCULATEUR.html'));
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
async function setup(page,kind){
 await page.evaluate(kind=>{
  $('#singles-format').prop('checked',true).trigger('change');
  const r=kind==='raticate',name=r?'Chesnaught':'Golem';
  $('#p1 .set-selector').val(name+' (Blank Set)').trigger('change');
  $('#p1 .level').val(38).trigger('change');$('#p1 .nature').val(r?'Impish':'Rash').trigger('change');
  $('#p1 .ability').val(r?'Battle Armor':'Sturdy').trigger('change');$('#p1 .item').val('').trigger('change');
  const ivs=r?{hp:31,at:15,df:31,sa:4,sd:14,sp:31}:{hp:11,at:30,df:0,sa:27,sd:24,sp:15};
  Object.entries(ivs).forEach(([k,v])=>{$('#p1 .'+k+' .ivs').val(v).trigger('change');$('#p1 .'+k+' .evs').val(0).trigger('change');});
  (r?['Trailblaze','Grassy Glide','Brick Break','Spiky Shield']:['Bulldoze','Rock Tomb','Rock Blast','Hammer Arm']).forEach((m,i)=>$('#p1 .move'+(i+1)+' select.move-selector').val(m).trigger('change'));
  $('#p2 .set-selector').val(r?'Raticate-Alola (Youngster Swede)':'Delcatty (Lady Cindy)').trigger('change');
  (r?['Sucker Punch','Last Resort','(No Move)','(No Move)']:['Headbutt','Snore','Thunder Wave','(No Move)']).forEach((m,i)=>$('#p2 .move'+(i+1)+' select.move-selector').val(m).trigger('change'));
  $('#p1 .percent-hp,#p2 .percent-hp').val(100).trigger('change');performCalculations();
 },kind);
}
async function read(page){return page.evaluate(()=>({result:NullMoveAIUI.getLastResult(),damage:damageResults.map(s=>s.map(r=>r.damage)),
 hp:[$('#p1 .current-hp').val(),$('#p2 .current-hp').val()],trainers:JSON.stringify(SETDEX_SV),
 state:NullMoveAIState.readBattleState(damageResults),double:NullDoubleUI.getState(),prediction:NullDoubleUI.getPrediction()}));}
const probabilities=r=>r.result.moves.map(m=>m.probability);
async function set(page,selector,value){await page.evaluate(({selector,value})=>$(selector).val(value).trigger('change'),{selector,value});}
async function attempt(page,selector,checked){await page.evaluate(({selector,checked})=>$(selector).prop('checked',checked).trigger('change'),{selector,checked});}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.NULL_AI_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe'}),errors=[],checks=[];
 try{
  async function open(file){const context=await browser.newContext({viewport:{width:1440,height:1080}}),page=await context.newPage();
   page.on('pageerror',e=>errors.push(e.stack));await page.route(/^https?:\/\//,r=>r.abort());await page.goto(pathToFileURL(file).href,{waitUntil:'load'});
   await page.waitForFunction(()=>window.NullMoveAIUI&&NullMoveAIUI.getLastResult());return {context,page};}
  let previous;
  if(process.env.NULL_PREVIOUS_ENTRY){const old=await open(path.resolve(process.env.NULL_PREVIOUS_ENTRY));
   await setup(old.page,'raticate');const a=probabilities(await read(old.page));assert.deepEqual(a,[0,1,0,0]);
   await setup(old.page,'delcatty');const b=probabilities(await read(old.page));assert.deepEqual(b,[1,0,0,0]);
   previous={raticate:a,delcatty:b,htmlSHA256:sha(fs.readFileSync(process.env.NULL_PREVIOUS_ENTRY))};await old.context.close();
   checks.push('Previous release reproduces both incorrect screenshots: locked Last Resort 100%, normalized Thunder Wave 0%.');}
  const {page}=await open(entry);await setup(page,'raticate');const rat=await read(page);
  assert.deepEqual(probabilities(rat),[1,0,0,0]);assert.deepEqual(rat.hp,['126','105']);
  assert.match(rat.result.moves[1].rules.join(' '),/Last Resort is locked/);
  await page.evaluate(()=>{$('#null-ai-context').prop('open',true);$('#null-ai-used-1').closest('details').prop('open',true);});
  assert.ok(await page.locator('#null-ai-used-1').isVisible());assert.ok(await page.locator('#null-ai-used-3').isDisabled());
  await attempt(page,'#null-ai-used-1',true);assert.deepEqual(probabilities(await read(page)),[0,1,0,0]);
  assert.equal(await page.locator('#null-ai-turns-active').inputValue(),'2');
  await set(page,'#null-ai-pp-2','0');assert.deepEqual(probabilities(await read(page)),[1,0,0,0]);await set(page,'#null-ai-pp-2','');
  await page.locator('#null-ai-reset-attempts').click();assert.deepEqual(probabilities(await read(page)),[1,0,0,0]);
  await set(page,'#null-ai-last-opponent-move','Sucker Punch');assert.ok(await page.locator('#null-ai-used-1').isChecked());assert.deepEqual(probabilities(await read(page)),[0,1,0,0]);
  await page.locator('#null-ai-reset-attempts').click();await set(page,'#null-ai-mode','strict');assert.deepEqual(probabilities(await read(page)),[1,0,0,0]);await set(page,'#null-ai-mode','estimate');
  await page.evaluate(()=>NullAI18n.setLanguage('fr'));assert.match(await page.locator('#null-ai-last-resort-help').innerText(),/réellement tentée/);
  await page.evaluate(()=>NullAI18n.setLanguage('en'));assert.match(await page.locator('#null-ai-last-resort-help').innerText(),/actually attempted/);
  assert.deepEqual((await read(page)).damage,rat.damage);assert.deepEqual((await read(page)).hp,rat.hp);
  checks.push('First-turn Raticate chooses Sucker Punch 100%; a failed attempt unlocks Last Resort, PP still applies, Last move infers the attempt, reset/strict/languages preserve HP and damage.');
  await set(page,'#null-ai-player-action','switch-in');await set(page,'#p1 .set-selector','Golem (Blank Set)');
  assert.deepEqual(probabilities(await read(page)),[1,0,0,0]);await attempt(page,'#null-ai-used-1',true);assert.deepEqual(probabilities(await read(page)),[0,1,0,0]);
  await set(page,'#null-ai-player-action','stay');await setup(page,'delcatty');const del=await read(page);
  // Document: paralysis +6 base and +2 flinch synergy (Headbutt); HDM +2
  // with probability 1/4, then uniform tie-breaking against Thunder Wave.
  // Snore still participates in documented damage rolls before its awake penalty.
  const head=del.state.opponent.moves[0].damage,snore=del.state.opponent.moves[1].damage;
  const hdmChance=head.reduce((n,h)=>n+snore.filter(s=>h>=s).length,0)/(head.length*snore.length);
  const expected=[hdmChance*.25*.5,0,1-hdmChance*.25*.5,0];
  assert.deepEqual(probabilities(del),expected);assert.deepEqual(del.hp,['112','102']);
  assert.equal(del.state.opponent.moves[2].type,'Normal');assert.equal(del.state.opponent.moves[2].statusBlocked,false);
  await set(page,'#p2 .ability','Cute Charm');assert.deepEqual(probabilities(await read(page)),[1,0,0,0]);await set(page,'#p2 .ability','Normalize');
  for(const name of ['Gengar','Pikachu']){await set(page,'#p1 .set-selector',name+' (Blank Set)');const protectedTarget=await read(page);
   assert.equal(protectedTarget.state.opponent.moves[2].statusBlocked,true);
   // Against Ghost all three Normalize moves fail; the model may still select
   // the least penalized blocked move. Electric targets have usable Headbutt.
   if(name==='Pikachu')assert.equal(protectedTarget.result.moves[2].probability,0);
  }
  await setup(page,'delcatty');await set(page,'#p1 .ability','Limber');assert.equal((await read(page)).result.moves[2].probability,0);await set(page,'#p1 .ability','Sturdy');
  await page.evaluate(()=>$('#misty').prop('checked',true).trigger('change'));assert.equal((await read(page)).result.moves[2].probability,0);
  await page.evaluate(()=>$('#misty').prop('checked',false).trigger('change'));assert.deepEqual(probabilities(await read(page)),expected);
  assert.deepEqual((await read(page)).damage,del.damage);assert.equal((await read(page)).trainers,rat.trainers);
  checks.push('Delcatty screenshot: Normal Thunder Wave about 91.7%, Headbutt about 8.3%, independently derived from documented paralysis/flinch synergy, damage rolls, HDM bonus and uniform ties. Ground no longer blocks; Ghost, Electric, Limber and Misty Terrain remain protected. Trainers and damage unchanged.');
  fs.mkdirSync(path.join(root,'verification'),{recursive:true});await page.locator('[aria-labelledby=resultHeaderR]').screenshot({path:path.join(root,'verification/normalize-thunder-wave.png')});
  await setup(page,'raticate');await page.evaluate(()=>$('#doubles-format').prop('checked',true).trigger('change'));
  const other=await page.evaluate(()=>Object.entries(SETDEX_SV).flatMap(([n,sets])=>sets['Youngster Swede']&&n!=='Raticate-Alola'?[n+' (Youngster Swede)']:[])[0]);assert.ok(other);
  await set(page,'#null-double-player [data-double-field=setID]','Blastoise (Blank Set)');await set(page,'#null-double-opponent [data-double-field=setID]',other);
  let d=await read(page);assert.ok(d.double.complete);assert.equal(d.prediction.slots[0].moves.find(m=>m.move==='Last Resort').probability,0);
  await attempt(page,'#null-ai-used-1',true);d=await read(page);assert.ok(d.prediction.slots[0].moves.find(m=>m.move==='Last Resort').probability>0);
  await set(page,'#null-ai-player-action','switch-in');await attempt(page,'#null-ai-used-1',false);d=await read(page);assert.equal(d.prediction.slots[0].moves.find(m=>m.move==='Last Resort').probability,0);
  await set(page,'#null-ai-player-action','stay');await set(page,'#p2 .set-selector',other);await set(page,'#null-double-opponent [data-double-field=setID]','Raticate-Alola (Youngster Swede)');
  d=await read(page);assert.ok(d.double.complete);const partner=d.double.opponents[1],index=partner.moves.findIndex(m=>m.name==='Sucker Punch');assert.ok(index>=0);
  assert.equal(d.prediction.slots[1].moves.find(m=>m.move==='Last Resort').probability,0);
  await attempt(page,'#null-double-opponent [data-double-field=used-'+index+']',true);d=await read(page);assert.ok(d.prediction.slots[1].moves.find(m=>m.move==='Last Resort').probability>0);
  await page.evaluate(()=>$('#null-double-opponent [data-double-reset-attempts]').trigger('click'));d=await read(page);assert.equal(d.prediction.slots[1].moves.find(m=>m.move==='Last Resort').probability,0);
  await set(page,'#null-double-opponent [data-double-field=lastMove]','Sucker Punch');d=await read(page);assert.ok(d.prediction.slots[1].moves.find(m=>m.move==='Last Resort').probability>0);
  await set(page,'#null-ai-player-action','switch-in');await page.evaluate(()=>$('#null-double-opponent [data-double-reset-attempts]').trigger('click'));d=await read(page);assert.equal(d.prediction.slots[1].moves.find(m=>m.move==='Last Resort').probability,0);
  await attempt(page,'#null-double-opponent [data-double-field=used-'+index+']',true);d=await read(page);assert.ok(d.prediction.slots[1].moves.find(m=>m.move==='Last Resort').probability>0);
  await set(page,'#null-ai-player-action','stay');
  assert.equal(d.trainers,rat.trainers);checks.push('Doubles main and partner slots share Last Resort eligibility and independent histories; frozen Switch into accepts history edits; partner new-entry reset relocks the move.');
  await setup(page,'raticate');await page.evaluate(()=>{$('#null-ai-context').prop('open',true);$('#null-ai-used-1').closest('details').prop('open',true);});
  await page.locator('[aria-labelledby=resultHeaderR]').screenshot({path:path.join(root,'verification/last-resort-first-turn.png')});
  assert.deepEqual(errors,[]);const result={revision:'last-resort-normalize',checkedAt:new Date().toISOString(),htmlSHA256:sha(fs.readFileSync(entry)),previous,
   screenshotPredictions:{raticate:probabilities(rat),delcatty:probabilities(del)},trainerDataSHA256:sha(rat.trainers),checks,errors};
  fs.writeFileSync(path.join(root,'verification/last-resort-normalize-browser.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
