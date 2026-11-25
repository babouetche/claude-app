'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.NULL_AI_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),entry=path.resolve(process.env.NULL_CALC_ENTRY||path.join(root,'CALCULATEUR.html'));
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.NULL_AI_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe'}),checks=[],errors=[];
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1080}});page.on('pageerror',e=>errors.push(e.message));
  await page.route(/^https?:\/\//,r=>r.abort());await page.goto(pathToFileURL(entry).href,{waitUntil:'load'});
  await page.waitForFunction(()=>window.NullMoveAIUI&&NullMoveAIUI.getLastResult());
  const sets=await page.evaluate(()=>JSON.stringify(SETDEX_SV));
  await page.evaluate(()=>{
   $('#p1 .set-selector').val('Empoleon (Blank Set)').trigger('change');$('#p1 .level').val(38).trigger('change');
   ['Metal Claw','Aqua Jet','Steel Wing','Bubble Beam'].forEach((m,i)=>$('#p1 .move'+(i+1)+' .move-selector').val(m).trigger('change'));
   $('#p2 .set-selector').val('Pidgeot (Youngster Schmo)').trigger('change');
   ['Air Slash','Heat Wave','Steel Wing','Mirror Move'].forEach((m,i)=>$('#p2 .move'+(i+1)+' .move-selector').val(m).trigger('change'));
   $('#null-ai-context').prop('open',true);performCalculations();
  });
  let out=await page.evaluate(()=>NullMoveAIUI.getLastResult());assert.ok(out.moves.every(m=>Number.isFinite(m.probability)));assert.equal(out.scope,'conditional-no-item');
  await page.selectOption('#null-ai-switch-scenario','no-switch');await page.selectOption('#null-ai-mode','strict');
  out=await page.evaluate(()=>NullMoveAIUI.getLastResult());assert.ok(out.moves.some(m=>m.probability===null));
  await page.evaluate(()=>document.getElementById('null-ai-predicted-player-move').closest('details').open=true);
  await page.locator('#null-ai-predicted-player-move').fill('Bubble Beam');await page.selectOption('#null-ai-copy-eligibility','allowed');
  out=await page.evaluate(()=>NullMoveAIUI.getLastResult());assert.ok(out.moves.every(m=>Number.isFinite(m.probability)),JSON.stringify(out));
  assert.ok(out.moves[3].rules.some(x=>x.includes('evaluates predicted Bubble Beam')));
  checks.push('Mirror Move: Auto is estimated; strict withholds the unconfirmed prediction; entering Bubble Beam and confirmed copy eligibility restores quantified choices.');
  await page.selectOption('#null-ai-trainer-item','confirmed');out=await page.evaluate(()=>NullMoveAIUI.getLastResult());assert.deepEqual(out.moves.map(m=>m.probability),[0,0,0,0]);assert.equal(out.itemProbability,1);
  await page.selectOption('#null-ai-trainer-item','unknown');assert.equal((await page.evaluate(()=>NullMoveAIUI.getLastResult())).scope,'conditional-no-item');
  checks.push('Confirmed trainer item uses the turn; unknown inventory explicitly leaves probabilities conditional on no item.');
  await page.selectOption('#null-ai-mode','estimate');await page.evaluate(()=>{
   $('#p1 .set-selector').val('Chesnaught (Blank Set)').trigger('change');$('#p1 .level').val(38).trigger('change');
   $('#p2 .set-selector').val('Poipole (Twins Gina&Mia)').trigger('change');$('#doubles-format').prop('checked',true).trigger('change');
   $('#null-double-player [data-double-field=setID]').val('Blastoise (Blank Set)').trigger('change');
   const other=Object.keys(SETDEX_SV).find(n=>n!=='Poipole'&&SETDEX_SV[n]['Twins Gina&Mia']);
   $('#null-double-opponent [data-double-field=setID]').val(other+' (Twins Gina&Mia)').trigger('change');
  });
  const available=await page.evaluate(()=>NullDoubleUI.getState().party.candidates.find(c=>!c.active).id);
  const hpBefore=await page.evaluate(()=>[$('#p1 .current-hp').val(),$('#p2 .current-hp').val()]);
  await page.selectOption('#null-ai-reserved-party',available);
  const post=await page.evaluate(()=>NullPostKOUI.getLastResult());assert.ok(!post.switch.candidates.some(c=>c.id===available));assert.equal(post.candidates.find(c=>c.id===available).eligibility,'reserved');
  assert.match(await page.locator('#null-post-ko-team').textContent(),/Reserved for the other slot/);
  assert.match(await page.locator('#null-ai-party').textContent(),/Reserved for the other slot/);
  assert.deepEqual(await page.evaluate(()=>[$('#p1 .current-hp').val(),$('#p2 .current-hp').val()]),hpBefore);
  checks.push('A future reserve for the other AI slot is excluded from post-KO prediction and clearly labelled without changing battle HP or KO marks.');
  await page.evaluate(()=>$('#null-double-context [data-double-field=opponentSlot]').val('1').trigger('change'));
  await page.locator('#null-double-player [data-double-field=hp]').fill('0');
  const fallback=await page.evaluate(()=>({state:NullDoubleUI.getState(),post:NullPostKOUI.getLastResult(),text:$('#null-post-ko-reference').text()}));
  assert.equal(fallback.state.switchState.context.doublesPlayerSlot,0);assert.equal(fallback.post.playerName,'Chesnaught');assert.match(fallback.text,/player slot 1 \(Chesnaught\)/);
  checks.push('When the paired player slot has fainted, replacement uses the other living player and labels the actual reference slot.');
  const before=await page.evaluate(()=>JSON.stringify({result:NullMoveAIUI.getLastResult(),post:NullPostKOUI.getLastResult(),reserved:$('#null-ai-reserved-party').val()}));
  await page.evaluate(()=>NullAI18n.setLanguage('fr'));assert.match(await page.locator('label[for=null-ai-predicted-player-move]').textContent(),/prédite/);assert.match(await page.locator('#null-post-ko-team').textContent(),/Réservé pour l’autre créneau/);
  await page.evaluate(()=>NullAI18n.setLanguage('en'));assert.equal(await page.evaluate(()=>JSON.stringify({result:NullMoveAIUI.getLastResult(),post:NullPostKOUI.getLastResult(),reserved:$('#null-ai-reserved-party').val()})),before);
  await page.locator('#null-ai-context').screenshot({path:path.join(root,'verification/native-ai-panel-en.png')});
  assert.equal(await page.evaluate(()=>JSON.stringify(SETDEX_SV)),sets);assert.deepEqual(errors,[]);
  checks.push('English/French controls retain predictions and reservations; trainer data remains byte-for-byte identical in memory.');
  fs.writeFileSync(path.join(root,'verification/native-ai-browser.json'),JSON.stringify({checkedAt:new Date().toISOString(),entry,checks,errors,trainerDataUnchanged:true},null,2)+'\n');console.log(JSON.stringify({checks,errors},null,2));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
