'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.NULL_AI_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),entry=path.resolve(process.env.NULL_CALC_ENTRY||path.join(root,'CALCULATEUR.html'));
const fixture=fs.readFileSync(path.join(root,'tests/fixtures/import-duplicate-species.txt'),'utf8');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
async function importText(page,text){await page.locator('.import-name-text').fill('Custom Set');await page.locator('.import-team-text').fill(text);await page.locator('#import').click();}
async function set(page,selector,value){await page.evaluate(({selector,value})=>$(selector).val(value).trigger('change'),{selector,value});}
async function read(page){return page.evaluate(()=>{
 const tables=['SETDEX_SV','SETDEX_SS','SETDEX_SM','SETDEX_XY','SETDEX_BW','SETDEX_DPP','SETDEX_ADV','SETDEX_GSC','SETDEX_RBY'];
 return {saved:localStorage.getItem('customsets'),customs:getSetOptions().filter(o=>o.isCustom).map(o=>o.id),
  tables:Object.fromEntries(tables.map(t=>[t,Object.entries(window[t]).flatMap(([n,ss])=>Object.entries(ss).filter(([,s])=>s.isCustomSet).map(([s])=>n+' ('+s+')'))])),
  trainerSets:JSON.stringify(Object.fromEntries(Object.entries(SETDEX_SV).map(([n,ss])=>[n,Object.fromEntries(Object.entries(ss).filter(([,s])=>!s.isCustomSet))]).filter(([,ss])=>Object.keys(ss).length))),
  boxes:Object.fromEntries(['box-poke-list','box-poke-list2','team-poke-list','trash-box'].map(id=>[id,$('#'+id+' .trainer-pok').toArray().map(e=>e.dataset.id)])),
  panels:[$('#p1 .set-selector').val(),$('#p2 .set-selector').val()],
  partners:['player','opponent'].map(s=>({id:$('#null-double-'+s+' [data-double-field=setID]').val(),hp:$('#null-double-'+s+' [data-double-field=hp]').val()})),
  partnerOptions:$('#null-double-player [data-double-field=setID] option').toArray().map(o=>o.value),
  settings:{language:localStorage.getItem('nullcalc_aiLanguage'),trainer:localStorage.getItem('lasttimetrainer'),notes:localStorage.getItem('reset-test-notes')},
  format:$('#doubles-format').prop('checked'),result:NullMoveAIUI.getLastResult()};
 });}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.NULL_AI_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe'}),errors=[],checks=[];
 try{
  async function open(file){const context=await browser.newContext({viewport:{width:1440,height:1080}}),page=await context.newPage();
   page.on('pageerror',e=>errors.push(e.stack));await page.route(/^https?:\/\//,r=>r.abort());await page.goto(pathToFileURL(file).href,{waitUntil:'load'});
   await page.waitForFunction(()=>window.NullMoveAIUI&&NullMoveAIUI.getLastResult());return {context,page};}
  let previous;
  if(process.env.NULL_PREVIOUS_ENTRY){const old=await open(path.resolve(process.env.NULL_PREVIOUS_ENTRY));old.page.on('dialog',d=>d.accept());
   await importText(old.page,fixture);await old.page.locator('#clearSets').click();const cleared=await read(old.page);
   assert.equal(cleared.saved,null);assert.equal(cleared.customs.length,8);
   await importText(old.page,'Stantler\nLevel: 25\n- Stomp');const rows=JSON.parse((await read(old.page)).saved);
   assert.deepEqual(Object.keys(rows.Stantler),['Custom Set 3']);
   previous={customsLeftInMemory:cleared.customs.length,nextStantlerName:Object.keys(rows.Stantler)[0]};await old.context.close();
   checks.push('Previous release removes storage/icons but leaves eight custom selector entries; next Stantler gets Custom Set 3.');}
  const {page}=await open(entry);let accept=false;const dialogs=[];
  page.on('dialog',d=>{dialogs.push(d.message());return accept?d.accept():d.dismiss();});
  const baseline=await read(page);await importText(page,fixture);
  await set(page,'#p1 .set-selector','Stantler (Custom Set 2)');
  await page.locator('#p1 #importedSets').check();await set(page,'#p2 .set-selector','Poipole (Twins Gina&Mia)');
  await page.evaluate(()=>{$('#doubles-format').prop('checked',true).trigger('change');$('#null-double-player-imported').prop('checked',true).trigger('change');});
  await set(page,'#null-double-player [data-double-field=setID]','Stantler (Custom Set)');
  const other=await page.evaluate(()=>Object.keys(SETDEX_SV).find(n=>n!=='Poipole'&&SETDEX_SV[n]['Twins Gina&Mia']));
  await set(page,'#null-double-opponent [data-double-field=setID]',other+' (Twins Gina&Mia)');
  await page.evaluate(()=>{
   const icons=$('#box-poke-list .trainer-pok').toArray();['team-poke-list','box-poke-list2','trash-box'].forEach((id,i)=>document.getElementById(id).appendChild(icons[i]));
   ['SETDEX_SV','SETDEX_SS','SETDEX_SM','SETDEX_XY','SETDEX_BW','SETDEX_DPP','SETDEX_ADV','SETDEX_GSC','SETDEX_RBY'].forEach(t=>{
    window[t].Pikachu=window[t].Pikachu||{};window[t].Pikachu['Old Custom']={level:5,moves:['Thunder Shock'],isCustomSet:true};
   });
   localStorage.setItem('reset-test-notes','keep');NullAI18n.setLanguage('fr');queueBox2SetIdsSync();NullMoveAIUI.refresh();
  });
  const imported=await read(page);assert.equal(imported.customs.length,9);assert.equal(imported.trainerSets,baseline.trainerSets);
  assert.ok(imported.format);assert.equal(imported.partners[0].id,'Stantler (Custom Set)');
  await page.locator('#clearSets').click();assert.equal(dialogs.length,1);assert.deepEqual(await read(page),imported);
  checks.push('Cancel leaves all duplicate sets, storage, four zones, active doubles partners and settings unchanged.');
  accept=true;await page.locator('#clearSets').click();assert.equal(dialogs.length,2);
  await page.waitForFunction(()=>!localStorage.customsets&&getSetOptions().every(o=>!o.isCustom));
  const cleared=await read(page);assert.equal(cleared.saved,null);assert.deepEqual(cleared.customs,[]);
  assert.ok(Object.values(cleared.tables).every(ids=>ids.length===0));assert.ok(Object.values(cleared.boxes).every(ids=>ids.length===0));
  assert.equal(cleared.panels[0],'Stantler (Blank Set)',JSON.stringify(await page.evaluate(()=>$('.poke-info .set-selector').toArray().map(e=>({tag:e.tagName,id:e.id,cls:e.className,value:$(e).val(),connected:e.isConnected})))));assert.equal(cleared.panels[1],imported.panels[1]);
  assert.equal(cleared.partners[0].id,'');assert.equal(cleared.partners[0].hp,'0');assert.deepEqual(cleared.partners[1],imported.partners[1]);
  assert.ok(!cleared.partnerOptions.some(id=>imported.customs.includes(id)));assert.deepEqual(cleared.settings,imported.settings);
  assert.equal(cleared.trainerSets,baseline.trainerSets);assert.equal(cleared.format,true);
  assert.ok(!await page.locator('#p1 #importedSets').isChecked());assert.ok(!await page.locator('#p1 #importedSetsOptions').isVisible());
  checks.push('Accepted reset clears all saved and ghost customs in nine tables, Team/Box/Box 2/Trash and main/doubles selectors. Trainer sets, opposing active partner, battle format and preferences are preserved.');
  await importText(page,fixture);let current=await read(page);const rows=JSON.parse(current.saved);
  assert.deepEqual(Object.keys(rows.Stantler),['Custom Set','Custom Set 2']);assert.equal(current.customs.length,8);
  await page.locator('#exportAll').click();assert.equal((await page.locator('.import-team-text').inputValue()).split(/\n\s*\n/).length,8);
  await page.reload({waitUntil:'load'});await page.waitForFunction(()=>window.NullMoveAIUI&&NullMoveAIUI.getLastResult());
  current=await read(page);assert.deepEqual(JSON.parse(current.saved),rows);assert.equal(current.customs.length,8);
  accept=true;await page.locator('#clearSets').click();await page.reload({waitUntil:'load'});await page.waitForFunction(()=>window.NullMoveAIUI&&NullMoveAIUI.getLastResult());
  current=await read(page);assert.equal(current.saved,null);assert.deepEqual(current.customs,[]);assert.ok(Object.values(current.boxes).every(ids=>ids.length===0));assert.equal(current.trainerSets,baseline.trainerSets);
  await importText(page,'Stantler\nLevel: 25\n- Stomp');assert.deepEqual(Object.keys(JSON.parse((await read(page)).saved).Stantler),['Custom Set']);
  checks.push('Fresh import restarts numbering at Custom Set, exports only eight new individuals and survives reload; clearing survives another reload and next import starts at Custom Set again.');
  fs.mkdirSync(path.join(root,'verification'),{recursive:true});assert.deepEqual(errors,[]);
  const result={revision:'custom-set-reset',checkedAt:new Date().toISOString(),htmlSHA256:sha(fs.readFileSync(entry)),previous,
   trainerDataSHA256:sha(baseline.trainerSets),checks,errors};
  fs.writeFileSync(path.join(root,'verification/custom-set-reset-browser.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
