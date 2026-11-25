'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.NULL_AI_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const baseline=process.argv.includes('--baseline');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.NULL_AI_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const checks=[],errors=[];
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1080}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route(/^https?:\/\//,route=>route.abort());
  await page.goto(pathToFileURL(process.env.NULL_CALC_ENTRY||path.join(root,'CALCULATEUR.html')).href,{waitUntil:'load'});
  await page.waitForFunction(()=>window.NullMoveAIUI&&NullMoveAIUI.getLastResult());
  const originalSets=await page.evaluate(()=>JSON.stringify(SETDEX_SV));
  await page.evaluate(()=>{
   $('#p1 .set-selector').val('Electivire (Blank Set)').trigger('change');
   $('#p1 .level').val(45).trigger('change');
   $('#p1 .nature').val('Impish').trigger('change');
   $('#p1 .ability').val('Motor Drive').trigger('change');
   const ivs={hp:25,at:12,df:9,sa:7,sd:7,sp:18};
   Object.keys(ivs).forEach(s=>$('#p1 .'+s+' .ivs').val(ivs[s]).trigger('change'));
   ['Thunderbolt','Thunder Punch','Low Kick','Light Screen'].forEach((m,i)=>$('#p1 .move'+(i+1)+' .move-selector').val(m).trigger('change'));
   $('#p1 .current-hp').val(69).trigger('change');
   $('#p2 .set-selector').val('Linoone (Youngster Schmo)').trigger('change');
   $('#null-ai-context').prop('open',true);performCalculations();
  });
  // UI exports differ between historical releases; inspect the public result and
  // use the standalone state adapter with the documented context for the fixture.
  const observed=await page.evaluate(()=>({state:NullMoveAIState.readBattleState(null,{context:{calculationMode:'estimate',playerIncapacitated:false}}),result:NullMoveAIUI.getLastResult()}));
  const outputName=baseline?'setup-berries-before':'setup-berries-browser';
  if(baseline){
   fs.writeFileSync(path.join(root,'verification/'+outputName+'.json'),JSON.stringify(observed,null,2)+'\n');
   console.log(JSON.stringify({before:observed.result.moves,player:observed.state.player,opponent:observed.state.opponent},null,2));return;
  }
  assert.equal(observed.state.player.maxHP,133);
  assert.equal(observed.state.opponent.maxHP,124);
  assert.equal(observed.state.opponent.item,'Iapapa Berry');
  assert.deepEqual(observed.result.moves.map(m=>m.probability),[0,0,.125,.875]);
  checks.push('Screenshot: Electivire 69/133 HP versus Linoone 124/124 HP, Gluttony/Iapapa: Belly Drum 87.5%, Stomping Tantrum 12.5% in the estimated model.');
  await page.evaluate(()=>$('#p2 .item').val('(none)').trigger('change'));
  assert.deepEqual((await page.evaluate(()=>NullMoveAIUI.getLastResult())).moves.map(m=>m.probability),[0,0,1,0]);
  await page.evaluate(()=>{$('#p2 .item').val('Iapapa Berry').trigger('change');$('#p2 .ability').val('Pickup').trigger('change');});
  assert.deepEqual((await page.evaluate(()=>NullMoveAIUI.getLastResult())).moves.map(m=>m.probability),[0,0,1,0]);
  checks.push('Removing the berry or Gluttony restores Stomping Tantrum; the fix is conditional on the entered item and ability.');
  await page.evaluate(()=>{$('#p2 .ability').val('Gluttony').trigger('change');NullAI18n.setLanguage('fr');});
  await page.locator('#null-ai-context').screenshot({path:path.join(root,'verification/setup-berries-panel-fr.png')});
  const translated=await page.locator('#null-ai-context').textContent();
  assert.match(translated,/PV estimés après/);
  await page.evaluate(()=>NullAI18n.setLanguage('en'));
  assert.match(await page.locator('#null-ai-context').textContent(),/Estimated HP after/);
  assert.equal(await page.evaluate(()=>JSON.stringify(SETDEX_SV)),originalSets);
  assert.deepEqual(errors,[]);
  checks.push('French/English explanation, trainer data preservation and offline loading verified.');
  fs.writeFileSync(path.join(root,'verification/'+outputName+'.json'),JSON.stringify({checkedAt:new Date().toISOString(),checks,errors,scenario:observed},null,2)+'\n');
  console.log(JSON.stringify({checks,errors},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
