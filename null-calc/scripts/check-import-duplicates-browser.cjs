'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.NULL_AI_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),entry=path.resolve(process.env.NULL_CALC_ENTRY||path.join(root,'CALCULATEUR.html'));
const fixture=fs.readFileSync(path.join(root,'tests/fixtures/import-duplicate-species.txt'),'utf8');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
async function importText(page,text,name='Custom Set'){
 await page.locator('.import-name-text').fill(name);await page.locator('.import-team-text').fill(text);await page.locator('#import').click();
}
async function data(page){return page.evaluate(()=>JSON.parse(localStorage.customsets));}
async function select(page,id){await page.evaluate(id=>$('#p1 .set-selector').val(id).trigger('change'),id);}
async function panel(page){return page.evaluate(()=>({level:$('#p1 .level').val(),nature:$('#p1 .nature').val(),ability:$('#p1 .ability').val(),
 ivs:Object.fromEntries(['hp','at','df','sa','sd','sp'].map(k=>[k,Number($('#p1 .'+k+' .ivs').val())])),
 moves:[1,2,3,4].map(i=>$('#p1 .move'+i+' select.move-selector').val())}));}
function stantlers(rows){return Object.values(rows.Stantler).map(x=>({level:x.level,nature:x.nature,ivs:Object.fromEntries(['hp','at','df','sa','sd','sp'].map(k=>[k,x.ivs[k]===undefined?31:x.ivs[k]])),moves:x.moves}));}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.NULL_AI_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe'}),errors=[],checks=[];
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1080}}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.stack));page.on('dialog',d=>d.accept());
  await page.route(/^https?:\/\//,r=>r.abort());await page.goto(pathToFileURL(entry).href,{waitUntil:'load'});
  await page.waitForFunction(()=>window.NullMoveAIUI&&NullMoveAIUI.getLastResult());
  const baseline=await page.evaluate(()=>({species:JSON.stringify(calc.SPECIES[9]),trainers:JSON.stringify(SETDEX_SV)}));
  await importText(page,fixture);const imported=await data(page);
  assert.equal(Object.values(imported).reduce((n,row)=>n+Object.keys(row).length,0),8);
  assert.deepEqual(Object.keys(imported.Stantler),['Custom Set','Custom Set 2']);
  assert.equal(await page.locator('#box-poke-list .trainer-pok').count(),8);
  await page.locator('#p1 #importedSets').check();
  await page.locator('#box-poke-list [data-id="Stantler (Custom Set)"]').click();
  const first=await panel(page);assert.equal(first.level,'25');assert.equal(first.nature,'Lonely');assert.equal(first.ivs.hp,14);assert.equal(first.moves[2],'Confuse Ray');
  await page.locator('#box-poke-list [data-id="Stantler (Custom Set 2)"]').click();
  const second=await panel(page);assert.equal(second.level,'13');assert.equal(second.nature,'Relaxed');assert.equal(second.ivs.hp,15);assert.equal(second.moves[2],'Leer');
  assert.equal(await page.evaluate(()=>JSON.stringify(calc.SPECIES[9])),baseline.species);
  checks.push('Real Import button preserves eight supplied individuals; both Stantler icons select their separate levels, IVs, natures and moves; species data unchanged.');
  await page.locator('#exportAll').click();const exported=await page.locator('.import-team-text').inputValue();
  assert.equal(exported.split(/\n\s*\n/).length,8);assert.equal((exported.match(/^Stantler(?: @[^\n]*)?$/gm)||[]).length,2);
  // A fresh context is needed: file pages in one context share the saved box.
  const roundContext=await browser.newContext(),round=await roundContext.newPage();round.on('pageerror',e=>errors.push(e.message));
  await round.route(/^https?:\/\//,r=>r.abort());await round.goto(pathToFileURL(entry).href,{waitUntil:'load'});
  await round.waitForFunction(()=>window.NullMoveAIUI&&NullMoveAIUI.getLastResult());await importText(round,exported);
  assert.deepEqual(stantlers(await data(round)),stantlers(imported));await roundContext.close();
  await page.reload({waitUntil:'load'});await page.waitForFunction(()=>window.NullMoveAIUI&&NullMoveAIUI.getLastResult());
  assert.deepEqual(await data(page),imported);assert.equal(await page.locator('#box-poke-list .trainer-pok').count(),8);
  checks.push('Export All includes both Stantler and round-trips their data; reloading preserves all eight saved sets and icons.');
  await page.evaluate(()=>{
   $('#doubles-format').prop('checked',true).trigger('change');$('#null-double-player-imported').prop('checked',true).trigger('change');
  });
  await page.locator('#s2id_null-double-player-setID .select2-choice').click();
  const offered=await page.evaluate(()=>$('#null-double-player [data-double-field=setID] option').toArray().filter(o=>!o.hidden).map(o=>o.value));
  assert.ok(offered.includes('Stantler (Custom Set)'));assert.ok(offered.includes('Stantler (Custom Set 2)'));await page.keyboard.press('Escape');
  await page.evaluate(()=>$('#null-double-player [data-double-field=setID]').val('Stantler (Custom Set 2)').trigger('change'));
  assert.equal(await page.locator('#null-double-player [data-double-field=level]').inputValue(),'13');
  await page.evaluate(()=>$('#singles-format').prop('checked',true).trigger('change'));
  checks.push('Imported-only doubles partner selector offers both independent Stantler sets.');
  const block='Stantler\nAbility: Intimidate\nLevel: 25\n- Stomp';
  await importText(page,[block,block,block].join('\n\n'));
  const five=await data(page);assert.equal(Object.keys(five.Stantler).length,5);assert.deepEqual(five.Stantler['Custom Set'],imported.Stantler['Custom Set']);
  assert.deepEqual(five.Stantler['Custom Set 2'],imported.Stantler['Custom Set 2']);
  checks.push('Three more identical same-species individuals get suffixes 3, 4 and 5 without replacing the existing levels 25 and 13.');
  await page.evaluate(()=>{
   const icon=Array.from(document.querySelectorAll('#box-poke-list .trainer-pok')).find(e=>e.dataset.id==='Stantler (Custom Set 3)');
   document.getElementById('trash-box').appendChild(icon);
  });
  await page.getByRole('button',{name:'Remove Pokémon from the trash',exact:true}).click();
  let rows=await data(page);assert.equal(Object.keys(rows.Stantler).length,4);assert.ok(!rows.Stantler['Custom Set 3']);assert.ok(rows.Stantler['Custom Set 2']);
  await page.reload({waitUntil:'load'});await page.waitForFunction(()=>window.NullMoveAIUI&&NullMoveAIUI.getLastResult());
  rows=await data(page);assert.equal(Object.keys(rows.Stantler).length,4);
  await select(page,'Stantler (Custom Set 2)');assert.equal((await panel(page)).level,'13');
  const trainerOnly=await page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(SETDEX_SV).map(([n,sets])=>[n,Object.fromEntries(Object.entries(sets).filter(([,s])=>!s.isCustomSet))]))));
  assert.equal(trainerOnly,baseline.trainers);
  checks.push('Deleting one trashed duplicate preserves its siblings after reload; all trainer records remain identical.');
  await select(page,'Stantler (Custom Set)');fs.mkdirSync(path.join(root,'verification'),{recursive:true});
  await page.locator('#p1').screenshot({path:path.join(root,'verification/import-duplicates-panel.png')});
  assert.deepEqual(errors,[]);
  const result={revision:'duplicate-species-import',checkedAt:new Date().toISOString(),htmlSHA256:sha(fs.readFileSync(entry)),trainerDataSHA256:sha(baseline.trainers),checks,errors};
  fs.writeFileSync(path.join(root,'verification/import-duplicates-browser.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
