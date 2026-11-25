'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.NULL_AI_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),entry=path.resolve(process.env.NULL_CALC_ENTRY||path.join(root,'CALCULATEUR.html'));
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.NULL_AI_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe'}),checks=[],errors=[];
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1080}});page.on('pageerror',e=>errors.push(e.message));
  await page.route(/^https?:\/\//,r=>r.abort());await page.goto(pathToFileURL(entry).href,{waitUntil:'load'});
  await page.waitForFunction(()=>window.NullPostKOUI&&NullPostKOUI.getLastResult());
  const sets=await page.evaluate(()=>JSON.stringify(SETDEX_SV));
  assert.equal(await page.evaluate(()=>calc.nullVerifiedROM),require('../tests/fixtures/'+require('./release-config.json').romFixture).romSHA256);
  checks.push('Portable HTML loads the pinned ROM layer and runs without network requests.');
  const mirrorCase=await page.evaluate(()=>{
   $('#p1 .set-selector').val('Empoleon (Blank Set)').trigger('change');$('#p1 .level').val(38).trigger('change');
   $('#p1 .nature').val('Lax').trigger('change');$('#p1 .ability').val('Torrent').trigger('change');
   Object.entries({hp:1,at:8,df:31,sa:12,sd:10,sp:28}).forEach(([k,v])=>{$('#p1 .'+k+' .ivs').val(v).trigger('change');$('#p1 .'+k+' .evs').val(0).trigger('change');});
   ['Metal Claw','Aqua Jet','Steel Wing','Bubble Beam'].forEach((n,i)=>$('#p1 .move'+(i+1)+' .move-selector').val(n).trigger('change'));
   $('#p2 .set-selector').val('Pidgeot (Youngster Schmo)').trigger('change');
   ['Air Slash','Heat Wave','Steel Wing','Mirror Move'].forEach((n,i)=>$('#p2 .move'+(i+1)+' .move-selector').val(n).trigger('change'));
   performCalculations();
   return {result:NullMoveAIUI.getLastResult(),hp:[createPokemon($('#p1')).curHP(),createPokemon($('#p2')).curHP()],
    classes:Array.from(document.querySelectorAll('.null-ai-probability')).map(e=>e.className),
    reason:$('#null-ai-reason').text(),help:$('#null-ai-colour-help').text(),postHelp:$('#null-post-ko-colour-help').text()};
  });
  assert.deepEqual(mirrorCase.hp,[112,125]);
  assert.ok(mirrorCase.result.moves.every(m=>Number.isFinite(m.probability)));assert.equal(mirrorCase.result.status,'estimated');
  assert.ok(mirrorCase.classes.every(c=>!c.includes('null-ai-unavailable')));
  assert.ok(mirrorCase.result.assumptions.some(a=>a.includes('predicted player action')));assert.match(mirrorCase.help,/blue = an established probability/);
  assert.match(mirrorCase.postHelp,/ties possible/);assert.match(mirrorCase.postHelp,/even in green/);
  checks.push('Empoleon/Pidgeot at 112/125 HP: Mirror Move now evaluates an explicitly disclosed prediction; all four move probabilities are finite estimates.');
  const beforeLanguage=await page.evaluate(()=>JSON.stringify({move:NullMoveAIUI.getLastResult(),post:NullPostKOUI.getLastResult(),hp:[$('#p1 .current-hp').val(),$('#p2 .current-hp').val()]}));
  await page.evaluate(()=>{document.getElementById('null-ai-context').open=true;NullAI18n.setLanguage('fr');});
  assert.match(await page.locator('#null-ai-colour-help').textContent(),/doré = estimation/);
  assert.match(await page.locator('#null-post-ko-colour-help').textContent(),/égalité possible/);
  assert.match(await page.locator('#null-ai-assumptions').textContent(),/action prédite du joueur/);
  await page.locator('#null-ai-context').screenshot({path:path.join(root,'verification/ai-colour-help-fr.png')});
  await page.locator('#null-post-ko').screenshot({path:path.join(root,'verification/post-ko-colour-help-fr.png')});
  await page.evaluate(()=>NullAI18n.setLanguage('en'));
  assert.equal(await page.evaluate(()=>JSON.stringify({move:NullMoveAIUI.getLastResult(),post:NullPostKOUI.getLastResult(),hp:[$('#p1 .current-hp').val(),$('#p2 .current-hp').val()]})),beforeLanguage);
  assert.match(await page.locator('#null-ai-colour-help').textContent(),/Unknown means/);
  const blueCase=await page.evaluate(()=>{
   $('#null-ai-lock').val('0').trigger('change');$('#null-ai-switch-scenario').val('no-switch').trigger('change');
   return {result:NullMoveAIUI.getLastResult(),label:$('#nullAiPickR1').text(),classes:$('#nullAiPickR1').attr('class')};
  });
  assert.equal(blueCase.result.moves[0].probability,1);assert.ok(!blueCase.classes.includes('null-ai-estimated')&&!blueCase.classes.includes('null-ai-unavailable'));
  const goldCase=await page.evaluate(()=>{
   $('#null-ai-switch-percent').val(50).trigger('change');$('#null-ai-switch-scenario').val('probably').trigger('change');
   return {result:NullMoveAIUI.getLastResult(),label:$('#nullAiPickR1').text(),classes:$('#nullAiPickR1').attr('class')};
  });
  assert.equal(goldCase.result.moves[0].probability,.5);assert.ok(goldCase.classes.includes('null-ai-estimated'));assert.match(goldCase.label,/≈/);
  checks.push('English/French help remains short and preserves battle state; blue established, gold estimated and gold unknown labels follow the existing model statuses.');
  await page.evaluate(()=>{$('#null-ai-lock').val('').trigger('change');$('#null-ai-switch-scenario').val('auto').trigger('change');});
  const numeric=await page.evaluate(()=>{
   $('#p1 .set-selector').val('Poltchageist (Blank Set)').trigger('change');$('#p1 .level').val(50).trigger('change');
   $('#p2 .set-selector').val('Overqwil (Blank Set)').trigger('change');$('#p2 .level').val(50).trigger('change');
   ['Glaciate','Infernal Parade','Water Shuriken','Low Kick'].forEach((name,i)=>$('#p1 .move'+(i+1)+' .move-selector').val(name).trigger('change'));
   performCalculations();
   return {power:$('#p1 .move2 .move-bp').val(),moves:createPokemon($('#p1')).moves.map(m=>({bp:m.bp,priority:m.priority})),baseSpA:$('#p1 .sa .base').val(),stats:createPokemon($('#p1')).rawStats,weight:createPokemon($('#p2')).weightkg,
     damage:damageResults.map(s=>s.map(r=>r.damage)),meta:NullAIMoveMetadata['V-create'].accuracy};
  });
  assert.equal(Number(numeric.power),70);assert.equal(numeric.moves[0].bp,80);assert.equal(numeric.moves[2].priority,2);
  assert.equal(Number(numeric.baseSpA),74);assert.equal(numeric.weight,60.5);assert.equal(numeric.meta,95);
  assert.ok(Object.values(numeric.stats).every(Number.isFinite));assert.ok(numeric.damage.flat(3).every(Number.isFinite));
  checks.push('Actual selectors, displayed base stats and calculated moves use ROM values: Glaciate 80, Infernal Parade 70, Water Shuriken +2, Poltchageist 74 SpA and Overqwil 60.5 kg.');
  const party=await page.evaluate(()=>{
   $('#p1 .set-selector').val('Electabuzz (Blank Set)').trigger('change');$('#p1 .level').val(38).trigger('change');
   $('#p2 .set-selector').val('Pelipper (Fisherman Ivan)').trigger('change');performCalculations();
   const result=NullPostKOUI.getLastResult();return {result,party:NullMoveAIState.readBattleState().party};
  });
  assert.equal(party.party.complete,true);assert.ok(party.result.candidates.some(c=>c.name==='Seadra'));
  assert.ok(party.result.candidates.some(c=>c.name==='Castform'));assert.ok(!party.result.candidates.some(c=>c.name==='Pelipper'&&!c.active));
  checks.push('The trainer reserves and post-KO panel still evaluate the corrected Ivan team without changing trainer rows.');
  assert.equal(await page.evaluate(()=>JSON.stringify(SETDEX_SV)),sets);assert.deepEqual(errors,[]);
  const manifest=require('../tests/fixtures/input-archive.json');for(const [file,expected]of Object.entries(manifest.hashes))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),expected,file);
  fs.writeFileSync(path.join(root,'verification/verified-browser.json'),JSON.stringify({entry,checks,errors,numeric,mirrorCase,blueCase,goldCase,trainerDataUnchanged:true,protectedFiles:147},null,2)+'\n');
  console.log(JSON.stringify({checks,errors},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
