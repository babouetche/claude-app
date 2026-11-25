'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.NULL_AI_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),entry=path.resolve(process.env.NULL_CALC_ENTRY||path.join(root,'CALCULATEUR.html'));
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.NULL_AI_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe'}),errors=[],checks=[];
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1080}});page.on('pageerror',e=>errors.push(e.message));await page.route(/^https?:\/\//,r=>r.abort());
  await page.goto(pathToFileURL(entry).href,{waitUntil:'load'});await page.waitForFunction(()=>window.NullMoveAIUI&&NullMoveAIUI.getLastResult());
  await page.evaluate(()=>{
   $('#p1 .set-selector').val('Electabuzz (Blank Set)').trigger('change');$('#p2 .set-selector').val('Pelipper (Fisherman Ivan)').trigger('change');
   $('#p1 .level').val(38).trigger('change');$('#p1 .nature').val('Impish').trigger('change');$('#p1 .ability').val('Vital Spirit').trigger('change');
   Object.entries({hp:25,at:12,df:9,sa:7,sd:7,sp:18}).forEach(([k,v])=>{$('#p1 .'+k+' .ivs').val(v).trigger('change');$('#p1 .'+k+' .evs').val(0).trigger('change');});
   ['Discharge','Thunder Punch','Low Kick','Light Screen'].forEach((m,i)=>$('#p1 .move'+(i+1)+' .move-selector').val(m).trigger('change'));
   $('#p1 .percent-hp,#p2 .percent-hp').val(100).trigger('change');$('input[name=weather][value=Rain]').prop('checked',true).trigger('change');performCalculations();
  });
  let state=await page.evaluate(()=>({postKO:NullPostKOUI.getLastResult(),move:NullMoveAIUI.getLastResult(),inputType:typeof SETDEX_SV.Seadra['Fisherman Ivan'].ivs.hp}));
  fs.writeFileSync(path.join(root,'verification/ivan-audited-diagnosis.json'),JSON.stringify({recordedAt:new Date().toISOString(),entry,...state},null,2)+'\n');
  let seadra=state.postKO.candidates.find(c=>c.name==='Seadra');assert.equal(seadra.maxHP,94);assert.equal(seadra.speed,75);assert.equal(seadra.score,-1);assert.equal(seadra.probability,0);assert.equal(state.inputType,'string');
  assert.equal(state.postKO.playerName,'Electabuzz');checks.push('Ivan screenshot: Seadra 94 HP / 75 Speed / score -1, original textual IVs retained.');
  await page.evaluate(()=>$('#p2 .set-selector').val('Seadra (Fisherman Ivan)').trigger('change'));
  assert.equal(await page.locator('#p2 .max-hp').innerText(),'94');
  await page.evaluate(()=>{$('#p2 .set-selector').val('Pelipper (Fisherman Ivan)').trigger('change');$('#doubles-format').prop('checked',true).trigger('change');
   $('#null-double-player-setID').val('Pikachu (Blank Set)').trigger('change');$('#null-double-opponent-setID').val('Seadra (Fisherman Ivan)').trigger('change');});
  const double=await page.evaluate(()=>NullDoubleUI.getState());assert.equal(double.complete,true);assert.equal(double.opponents[1].maxHP,94);assert.equal(double.opponents[1].speed,75);
  assert.equal(double.party.candidates.filter(c=>c.active).length,2);
  checks.push('The original opponent panel and doubles partner both read Seadra numeric IVs correctly.');
  await page.evaluate(()=>addSets('Charizard @ Lum Berry\nAbility: Blaze\nLevel: 38\nIVs: 31 HP / 12 Atk / 9 Def / 7 SpA / 0 SpD / 18 Spe\nTimid Nature\n- Flamethrower\n- Air Slash\n- Protect\n- Dragon Pulse','Numeric Audit Import'));
  await page.locator('#s2id_null-double-player-setID .select2-choice').click();await page.keyboard.press('Escape');
  await page.evaluate(()=>$('#null-double-player-setID').val('Charizard (Numeric Audit Import)').trigger('change'));
  const imported=await page.evaluate(()=>({actual:NullDoubleUI.getState().players[1],expected:new calc.Pokemon(9,'Charizard',{level:38,nature:'Timid',ability:'Blaze',ivs:{hp:31,atk:12,def:9,spa:7,spd:0,spe:18}}).rawStats}));
  assert.deepEqual(imported.actual.stats,imported.expected);checks.push('A real imported set has correct doubles-partner level, IVs and statistics.');
  await page.evaluate(()=>{$('#singles-format').prop('checked',true).trigger('change');$('#p2 .set-selector').val('Vivillon (Bug Catcher Kenobi)').trigger('change');window.auditOriginalDipplin=SETDEX_SV.Dipplin['Bug Catcher Kenobi'].ivs;
   SETDEX_SV.Dipplin['Bug Catcher Kenobi'].ivs={hp:'not-a-number'};NullMoveAIUI.refresh();});
  state=await page.evaluate(()=>({postKO:NullPostKOUI.getLastResult(),move:NullMoveAIUI.getLastResult(),notes:$('#null-ai-assumptions').text(),dest:$('#null-ai-switch-destination').text()}));
  assert.equal(state.postKO.reason,'unknown-team');assert.equal(state.move.switch.candidates.length,0);assert.ok(state.notes.includes('Invalid trainer numeric data'));
  assert.equal(await page.locator('#null-post-ko-team .null-post-ko-likely').count(),0);
  await page.evaluate(()=>NullAI18n.setLanguage('fr'));assert.match(await page.locator('#null-ai-assumptions').textContent(),/Donnée numérique de trainer invalide/);
  await page.evaluate(()=>{SETDEX_SV.Dipplin['Bug Catcher Kenobi'].ivs=window.auditOriginalDipplin;delete window.auditOriginalDipplin;NullAI18n.setLanguage('en');NullMoveAIUI.refresh();});
  assert.equal(await page.evaluate(()=>NullPostKOUI.getLastResult().reason),'ranked');
  checks.push('Unreadable numeric reserve data gives an explicit translated explanation, no partial-team destination, and recovers when valid data is restored.');
  await page.evaluate(()=>$('#p2 .set-selector').val('Pelipper (Fisherman Ivan)').trigger('change'));
  await page.locator('#null-post-ko').screenshot({path:path.join(root,'verification/numeric-ivan-post-ko.png')});
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(root,'verification/numeric-browser.json'),JSON.stringify({recordedAt:new Date().toISOString(),entry,checks,errors},null,2)+'\n');
  console.log(JSON.stringify({checks,errors},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
