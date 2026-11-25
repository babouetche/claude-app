'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.NULL_AI_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),entry=path.resolve(process.env.NULL_CALC_ENTRY||path.join(root,'CALCULATEUR.html'));
async function choose(page,side,id){await page.evaluate(({side,id})=>$('#null-double-'+side+' [data-double-field=setID]').val(id).trigger('change'),{side,id});}
async function offered(page,side){return page.evaluate(side=>$('#null-double-'+side+' [data-double-field=setID] option').toArray().filter(o=>o.value&&o.value!=='__empty__'&&!o.hidden).map(o=>o.value),side);}
async function snapshot(page){return page.evaluate(()=>({player:$('#null-double-player [data-double-field=setID]').val(),hp:$('#null-double-player [data-double-field=hp]').val(),pp:$('#null-double-player [data-double-field=pp-0]').val(),opponent:$('#null-double-opponent [data-double-field=setID]').val(),opponentHP:$('#null-double-opponent [data-double-field=hp]').val(),opponentPP:$('#null-double-opponent [data-double-field=pp-0]').val(),prediction:NullDoubleUI.getPrediction(),postKO:NullPostKOUI.getLastResult(),damage:damageResults.map(s=>s.map(r=>r.damage))}));}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.NULL_AI_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe'}),errors=[],checks=[];
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1100}});page.on('pageerror',e=>errors.push(e.message));await page.route(/^https?:\/\//,r=>r.abort());
  await page.goto(pathToFileURL(entry).href,{waitUntil:'load'});await page.waitForFunction(()=>window.NullMoveAIUI&&NullMoveAIUI.getLastResult());
  const protectedSets=await page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(SETDEX_SV).map(([n,sets])=>[n,Object.fromEntries(Object.entries(sets).filter(([,s])=>s.index!==undefined))]))));
  await page.evaluate(()=>{$('#p1 .set-selector').val('Chesnaught (Blank Set)').trigger('change');$('#p2 .set-selector').val('Poipole (Twins Gina&Mia)').trigger('change');$('#doubles-format').prop('checked',true).trigger('change');});
  assert.equal(await page.locator('#null-double-player-imported').isVisible(),true);
  assert.equal(await page.locator('#null-double-opponent-trainer-only').isChecked(),true);
  let ids=await offered(page,'opponent');assert.ok(ids.length>0);assert.ok(ids.every(id=>id.endsWith(' (Twins Gina&Mia)')));assert.ok(!ids.includes('Poipole (Twins Gina&Mia)'));
  assert.ok((await page.locator('#null-double-trainer-note').innerText()).includes('Twins Gina&Mia'));
  const other=ids[0];await choose(page,'opponent',other);await choose(page,'player','Blastoise (Blank Set)');
  await page.evaluate(()=>$('#null-double-player-moves, #null-double-opponent-moves, #null-ai-context, #null-post-ko .null-post-ko-details').prop('open',true));
  await page.locator('#null-double-player [data-double-field=hp]').fill('37');await page.locator('#null-double-player [data-double-field=pp-0]').fill('3');
  await page.locator('#null-double-opponent [data-double-field=hp]').fill('29');await page.locator('#null-double-opponent [data-double-field=pp-0]').fill('2');
  let before=await snapshot(page);assert.equal(before.postKO.reason,'ranked');
  checks.push('Upper right defaults to the exact selected trainer party, excluding the displayed active logical slot.');
  await page.locator('#null-double-player-imported').check();
  let after=await snapshot(page);assert.deepEqual(after,before);assert.equal((await offered(page,'player')).length,0);
  assert.equal(await page.locator('#null-double-player-setID option:checked').evaluate(o=>o.hidden),true);
  assert.equal(await page.evaluate(()=>$('#null-double-player #null-double-player-setID').select2('data').id),'Blastoise (Blank Set)');
  // Exercise the calculator's actual importer after the doubles list already exists.
  await page.evaluate(()=>addSets('Pikachu @ Light Ball\nAbility: Static\nLevel: 38\nTimid Nature\n- Thunderbolt\n- Protect\n- Quick Attack\n- Thunder Wave','Doubles Filter Test'));
  await page.locator('#s2id_null-double-player-setID .select2-choice').click();
  assert.deepEqual(await offered(page,'player'),['Pikachu (Doubles Filter Test)']);
  assert.ok((await page.locator('.select2-results:visible').innerText()).includes('Pikachu'));
  assert.ok(!(await page.locator('.select2-results:visible').innerText()).includes('Blastoise'));
  await page.keyboard.press('Escape');after=await snapshot(page);assert.deepEqual(after,before);
  await choose(page,'player','Pikachu (Doubles Filter Test)');
  assert.equal(await page.locator('#null-double-player [data-double-field=level]').inputValue(),'38');
  assert.equal(await page.locator('#null-double-player [data-double-field=move-0]').inputValue(),'Thunderbolt');
  await page.locator('#null-double-player [data-double-field=hp]').fill('31');
  before=await snapshot(page);await page.locator('#null-double-player-imported').uncheck();assert.deepEqual(await snapshot(page),before);
  await page.locator('#null-double-player-imported').check();assert.deepEqual(await snapshot(page),before);
  assert.equal(await page.evaluate(()=>$('#p1 #importedSets').prop('checked')),false);
  checks.push('Imported-only filters the real Select2 search, finds new imports without reload, and preserves HP/PP/partner selection independently of the lower filter.');
  await page.locator('#null-double-opponent-trainer-only').uncheck();assert.ok((await offered(page,'opponent')).some(id=>id.endsWith(' (Youngster Joey)')));
  assert.deepEqual(await snapshot(page),before);await page.locator('#null-double-opponent-trainer-only').check();assert.deepEqual(await snapshot(page),before);
  // Switching trainers invalidates only the old opposing partner, not our edited imported set.
  await page.evaluate(()=>$('#p2 .set-selector').val('Arboliva (Youngster Joey)').trigger('change'));
  after=await snapshot(page);assert.equal(after.player,before.player);assert.equal(after.hp,before.hp);assert.equal(after.opponent,'');assert.equal(after.postKO.reason,'doubles');
  ids=await offered(page,'opponent');assert.ok(ids.length>0&&ids.every(id=>id.endsWith(' (Youngster Joey)')));assert.ok(!ids.includes('Arboliva (Youngster Joey)'));
  const next=ids[0];await choose(page,'opponent',next);await page.locator('#null-double-opponent [data-double-field=hp]').fill('24');
  await page.locator('#null-double-opponent [data-double-field=pp-0]').fill('4');before=await snapshot(page);
  await page.evaluate(()=>{$('#p2 .percent-hp').val(80).trigger('change');NullMoveAIUI.refresh();});
  after=await snapshot(page);assert.equal(after.opponent,next);assert.equal(after.opponentHP,'24');assert.equal(after.opponentPP,'4');
  const another=ids.find(id=>id!==next);await page.evaluate(id=>$('#p2 .set-selector').val(id).trigger('change'),another);after=await snapshot(page);
  assert.equal(after.opponent,next);assert.equal(after.opponentHP,'24');assert.equal(after.opponentPP,'4');
  await page.evaluate(id=>$('#p2 .set-selector').val(id).trigger('change'),next);assert.equal((await snapshot(page)).opponent,'');
  checks.push('Trainer changes refresh the list and clear only an incompatible opposing partner; same-party changes preserve partner edits and prevent duplicate active slots.');
  ids=await offered(page,'opponent');await choose(page,'opponent',ids[0]);before=await snapshot(page);
  assert.equal(before.postKO.reason,'ranked');assert.ok(!before.postKO.switch.candidates.some(c=>[next,ids[0]].includes(c.id)));
  await page.evaluate(()=>$('#null-double-context [data-double-field=opponentSlot]').val('1').trigger('change'));
  after=await snapshot(page);assert.equal(after.postKO.playerName,'Pikachu');assert.ok((await page.locator('#null-post-ko-reference').innerText()).includes('player slot 2 (Pikachu)'));
  await page.locator('#null-double-player [data-double-field=hp]').fill('7');assert.equal(await page.evaluate(()=>NullDoubleUI.getState().switchState.player.hp),7);
  const aliveReserve=await page.evaluate(()=>NullPostKOUI.getLastResult().candidates.find(c=>c.eligibility==='candidate').id);
  await page.evaluate(id=>$('#null-post-ko-team .null-post-ko-row').filter(function(){return $(this).attr('data-id')===id;}).find('button').trigger('click'),aliveReserve);
  assert.ok(!(await snapshot(page)).postKO.switch.candidates.some(c=>c.id===aliveReserve));
  assert.equal(await page.evaluate(id=>$('#null-post-ko-team .null-post-ko-row').filter(function(){return $(this).attr('data-id')===id;}).hasClass('null-post-ko-fainted'),aliveReserve),true);
  await page.evaluate(id=>$('#null-post-ko-team .null-post-ko-row').filter(function(){return $(this).attr('data-id')===id;}).find('button').trigger('click'),aliveReserve);
  assert.ok((await snapshot(page)).postKO.switch.candidates.some(c=>c.id===aliveReserve));
  await page.selectOption('#null-ai-mode','strict');assert.ok((await snapshot(page)).postKO.switch.candidates.every(c=>c.probability===null));await page.selectOption('#null-ai-mode','estimate');
  await page.locator('#null-post-ko-immediate').check();
  assert.equal(await page.evaluate(()=>JSON.stringify(NullPostKOUI.getLastResult())===JSON.stringify(NullPostKO.predict(NullDoubleUI.getState().switchState,{immediateDamage:true}))),true);
  checks.push('Post-KO uses the matching player slot and entered HP; both active opponents stay excluded; KO/Restore, immediate-entry toggle and strict uncertainty still work.');
  before=await snapshot(page);await page.evaluate(()=>NullAI18n.setLanguage('fr'));
  assert.ok((await page.locator('#null-double-player .null-double-set-filter').innerText()).includes('sets importés'));
  assert.ok((await page.locator('#null-double-opponent .null-double-set-filter').innerText()).includes('équipe de ce trainer'));
  assert.ok((await page.locator('#null-post-ko-reference').innerText()).includes('créneau joueur 2 (Pikachu)'));
  assert.deepEqual(await snapshot(page),before);await page.evaluate(()=>NullAI18n.setLanguage('en'));assert.deepEqual(await snapshot(page),before);
  checks.push('English/French translates new filters and the explicit post-KO slot reference without resetting battle state.');
  // Bank candidates are useful suggestions, but do not establish a six-member party.
  const bankID=await page.evaluate(()=>getSetOptions().find(o=>o.id&&/^Root Academy.* Slot \d+/.test(o.set)).id);
  await page.evaluate(id=>$('#p2 .set-selector').val(id).trigger('change'),bankID);
  const bankTrainer=bankID.slice(bankID.indexOf(' (')+2,-1);ids=await offered(page,'opponent');
  assert.ok(ids.length>0&&ids.every(id=>id.endsWith(' ('+bankTrainer+')')));
  assert.ok((await page.locator('#null-double-trainer-note').innerText()).includes('not a confirmed party'));
  await choose(page,'opponent',ids[0]);assert.equal((await snapshot(page)).postKO.reason,'unknown-team');
  checks.push('Root Academy banks offer their matching trainer entries with an explicit unconfirmed-party warning; no certified replacement is inferred.');
  await page.evaluate(()=>$('#p2 .set-selector').val('Poipole (Twins Gina&Mia)').trigger('change'));
  ids=await offered(page,'opponent');await choose(page,'opponent',ids[0]);
  assert.equal(await page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(SETDEX_SV).map(([n,sets])=>[n,Object.fromEntries(Object.entries(sets).filter(([,s])=>s.index!==undefined))])))),protectedSets);
  assert.deepEqual(errors,[]);await page.locator('#null-double-context').screenshot({path:path.join(root,'verification/doubles-filters-en.png')});
  await page.evaluate(()=>NullAI18n.setLanguage('fr'));await page.locator('#null-double-context').screenshot({path:path.join(root,'verification/doubles-filters-fr.png')});
  await page.locator('#null-post-ko').screenshot({path:path.join(root,'verification/doubles-filters-post-ko-fr.png')});
  fs.writeFileSync(path.join(root,'verification/doubles-filters-browser.json'),JSON.stringify({recordedAt:new Date().toISOString(),entry,checks,errors},null,2)+'\n');
  console.log(JSON.stringify({checks,errors},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
