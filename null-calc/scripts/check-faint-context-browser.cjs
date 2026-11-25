'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.NULL_AI_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),entry=path.resolve(process.env.NULL_CALC_ENTRY||path.join(root,'CALCULATEUR.html'));
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
async function set(p,selector,value){await p.evaluate(({selector,value})=>$(selector).val(value).trigger('change'),{selector,value});}
async function check(p,selector,value){await p.evaluate(({selector,value})=>$(selector).prop('checked',value).trigger('change'),{selector,value});}
async function setup(p){await p.evaluate(()=>{
 $('#p1 .set-selector').val('Electabuzz (Blank Set)').trigger('change');$('#p1 .level').val(38).trigger('change');$('#p1 .nature').val('Quirky').trigger('change');$('#p1 .ability').val('Vital Spirit').trigger('change');$('#p1 .item').val('').trigger('change');
 Object.entries({hp:17,at:17,df:22,sa:20,sd:31,sp:19}).forEach(([k,v])=>{$('#p1 .'+k+' .ivs').val(v).trigger('change');$('#p1 .'+k+' .evs').val(0).trigger('change');});
 ['Discharge','Thunder Punch','Low Kick','Thunder Wave'].forEach((m,i)=>$('#p1 .move'+(i+1)+' .move-selector').val(m).trigger('change'));
 $('#p2 .set-selector').val('Vivillon (Bug Catcher Kenobi)').trigger('change');$('#p1 .percent-hp,#p2 .percent-hp').val(100).trigger('change');performCalculations();
});}
async function read(p){return p.evaluate(()=>({post:NullPostKOUI.getLastResult(),state:NullMoveAIState.readBattleState(damageResults),
 damage:damageResults.map(s=>s.map(r=>r.damage)),hp:[$('#p1 .current-hp').val(),$('#p2 .current-hp').val()],trainerData:JSON.stringify(SETDEX_SV),
 double:NullDoubleUI.getState(),reference:$('#null-ai-player-action').val()}));}
const candidate=(r,n)=>r.post.candidates.find(c=>c.name===n),range=m=>[Math.min(...m.damage),Math.max(...m.damage)];
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.NULL_AI_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe'}),errors=[],checks=[];
 try{
  async function open(file){const context=await browser.newContext({viewport:{width:1440,height:1080}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.stack));await page.route(/^https?:\/\//,r=>r.abort());
   await page.goto(pathToFileURL(file).href,{waitUntil:'load'});await page.waitForFunction(()=>window.NullPostKOUI&&NullPostKOUI.getLastResult());return {context,page};}
  let previous;
  if(process.env.NULL_PREVIOUS_ENTRY){const old=await open(path.resolve(process.env.NULL_PREVIOUS_ENTRY));await setup(old.page);const r=await read(old.page);
   assert.equal(candidate(r,'Dipplin').probability,1);assert.equal(candidate(r,'Watchog').score,0);previous={htmlSHA256:sha(fs.readFileSync(process.env.NULL_PREVIOUS_ENTRY)),scores:r.post.switch.candidates.map(c=>({name:c.name,score:c.score}))};await old.context.close();}
  const {page}=await open(entry);await setup(page);const baseline=await read(page),watch=baseline.state.party.candidates.find(c=>c.name==='Watchog');
  assert.deepEqual(baseline.hp,['103','111']);assert.deepEqual(range(watch.moves[1]),[55,66]);assert.deepEqual(range(candidate(baseline,'Watchog').moves[1]),[109,130]);
  assert.deepEqual(baseline.post.switch.candidates.map(c=>c.score),[2,0,4]);assert.equal(candidate(baseline,'Watchog').probability,1);
  const normal=await page.evaluate(()=>NullSwitchAI.getSwitchProbabilities({...NullMoveAIState.readBattleState(damageResults),context:{switchScenario:'guaranteed'}}));assert.equal(normal.candidates.find(c=>c.name==='Watchog').score,0);
  await set(page,'#null-ai-switch-scenario','post-ko');assert.equal((await read(page)).post.switch.candidates.find(c=>c.name==='Watchog').probability,1);
  await set(page,'#null-ai-switch-scenario','auto');await set(page,'#null-ai-mode','strict');assert.equal(candidate(await read(page),'Watchog').score,4);await set(page,'#null-ai-mode','estimate');
  await check(page,'#trickroom',true);const tr=await read(page);assert.equal(candidate(tr,'Watchog').score,3);assert.equal(candidate(tr,'Dipplin').probability,1);assert.ok(range(candidate(tr,'Watchog').moves[1])[1]<109);
  await check(page,'#trickroom',false);assert.deepEqual((await read(page)).damage,baseline.damage);assert.deepEqual((await read(page)).hp,baseline.hp);
  checks.push('Kenobi screenshot reproduced exactly: ordinary Retaliate 55–66, post-KO Retaliate 109–130; Watchog score 4 beats Dipplin 2. Normal switches, strict mode, Trick Room/Analytic and repeated recalculation use the correct separate profiles without changing battle HP/damage.');
  await page.evaluate(()=>NullAI18n.setLanguage('fr'));assert.match(await page.locator('#null-post-ko-faint-help').textContent(),/une seule fois/);
  await page.evaluate(()=>NullAI18n.setLanguage('en'));assert.match(await page.locator('#null-post-ko-faint-help').textContent(),/next turn/);
  await set(page,'#p2 .set-selector','Watchog (Bug Catcher Kenobi)');const layout=await page.evaluate(()=>[1,2,3,4].map(i=>({slot:i,name:$('#p2 .move'+i+' select.move-selector').val(),bp:$('#p2 .move'+i+' .move-bp').val()})));
  assert.ok(layout.some(m=>m.name==='Retaliate'),JSON.stringify(layout));const retaliateSlot=layout.find(m=>m.name==='Retaliate').slot;
  assert.equal(await page.locator('#p2 .move'+retaliateSlot+' .move-bp').inputValue(),'70',JSON.stringify(layout));
  await set(page,'#p2 .move'+retaliateSlot+' .move-bp',140);let active=await read(page);assert.deepEqual([Math.min(...active.damage[1][retaliateSlot-1]),Math.max(...active.damage[1][retaliateSlot-1])],[109,130]);
  await setup(page);assert.equal((await read(page)).trainerData,baseline.trainerData);
  checks.push('EN/FR explanations agree. The active Retaliate power remains an explicit manual input (70 or 140); source trainer sets stay unchanged.');
  // Synthetic data exists only in this isolated browser context and is removed
  // below. It tests the real adapter without altering any shipped trainer row.
  await page.evaluate(()=>{
   window.faintTestBackup={};
   const rows={Mew:{ability:'Synchronize',moves:['Tackle','Protect','Rest','Psychic']},Houndstone:{ability:'Sand Rush',moves:['Last Respects','Tackle','Protect','Rest']},Kingambit:{ability:'Supreme Overlord',moves:['Iron Head','Tackle','Protect','Rest']},Charizard:{ability:'Blaze',moves:['Flamethrower','Tackle','Protect','Rest']}};
   Object.entries(rows).forEach(([name,data],i)=>{faintTestBackup[name]=SETDEX_SV[name]['Faint context fixture'];SETDEX_SV[name]['Faint context fixture']={...data,index:9000+i,level:35,nature:'Serious',item:''};});
   $('#p2 .set-selector').val('Mew (Faint context fixture)').trigger('change');performCalculations();
  });
  let r=await read(page);assert.equal(r.post.trainerName,'Faint context fixture');assert.equal(candidate(r,'Houndstone').moves[0].effectiveBasePower,100);assert.equal(candidate(r,'Kingambit').alliesFaintedAfterKO,1);
  async function mark(name){await page.evaluate(name=>{$('#null-post-ko-team .null-post-ko-row').filter(function(){return $(this).attr('data-id')===name+' (Faint context fixture)';}).find('button').trigger('click');},name);}
  await mark('Charizard');r=await read(page);assert.equal(candidate(r,'Houndstone').moves[0].effectiveBasePower,150);assert.equal(candidate(r,'Kingambit').alliesFaintedAfterKO,2);
  await mark('Charizard');r=await read(page);assert.equal(candidate(r,'Houndstone').moves[0].effectiveBasePower,100);
  await mark('Mew');r=await read(page);assert.equal(candidate(r,'Houndstone').moves[0].effectiveBasePower,100);await mark('Mew');
  await set(page,'#null-ai-faint-count',4);r=await read(page);assert.equal(candidate(r,'Houndstone').moves[0].effectiveBasePower,300);assert.equal(candidate(r,'Kingambit').alliesFaintedAfterKO,5);
  await set(page,'#p2 .set-selector','Charizard (Faint context fixture)');assert.equal(await page.locator('#null-ai-faint-count').inputValue(),'4');
  await set(page,'#p2 .set-selector','Mew (Faint context fixture)');await set(page,'#null-ai-faint-count','');
  await set(page,'#null-ai-player-action','switch-in');await set(page,'#null-ai-faint-count',2);r=await read(page);assert.equal(r.reference,'stay');assert.equal(await page.locator('#null-ai-faint-snapshot-note').evaluate(e=>getComputedStyle(e).display),'block');
  await set(page,'#null-ai-faint-count','');
  checks.push('Last Respects and Supreme Overlord include prior faints plus the simulated KO once; KO/Restore reverses profiles, an already marked active is not counted twice, explicit cumulative revival totals persist within the trainer, and changed faint history invalidates a frozen Switch into reference.');
  await check(page,'#doubles-format',true);await set(page,'#null-double-player [data-double-field=setID]','Pikachu (Blank Set)');await set(page,'#null-double-opponent [data-double-field=setID]','Charizard (Faint context fixture)');
  r=await read(page);assert.equal(r.double.complete,true);assert.equal(candidate(r,'Houndstone').moves[0].effectiveBasePower,100);assert.equal(candidate(r,'Charizard').eligibility,'partner');
  await set(page,'#null-double-opponent [data-double-field=hp]',0);r=await read(page);assert.equal(candidate(r,'Houndstone').moves[0].effectiveBasePower,150);assert.equal(candidate(r,'Kingambit').alliesFaintedAfterKO,2);
  await check(page,'#singles-format',true);await setup(page);assert.equal(await page.locator('#null-ai-faint-count').inputValue(),'');
  await page.evaluate(()=>{Object.entries(faintTestBackup).forEach(([name,old])=>{if(old===undefined)delete SETDEX_SV[name]['Faint context fixture'];else SETDEX_SV[name]['Faint context fixture']=old;});delete window.faintTestBackup;performCalculations();});
  r=await read(page);assert.equal(r.trainerData,baseline.trainerData);assert.deepEqual(r.hp,baseline.hp);assert.equal(candidate(r,'Watchog').probability,1);
  checks.push('Complete doubles counts only the selected simulated KO and includes a partner at 0 HP; the living active partner remains excluded from reserves. Singles/trainer changes restore Kenobi and clear the previous trainer faint-total input.');
  await page.evaluate(()=>{$('#null-post-ko').get(0).scrollIntoView();$('#null-post-ko details').prop('open',true);});await page.screenshot({path:path.join(root,'verification/faint-context-kenobi.png')});
  assert.deepEqual(errors,[]);
  const report={revision:'post-ko-faint-context',checkedAt:new Date().toISOString(),htmlSHA256:sha(fs.readFileSync(entry)),trainerDataSHA256:sha(baseline.trainerData),previous,
   scores:baseline.post.switch.candidates.map(c=>({name:c.name,score:c.score,probability:c.probability})),checks,errors};
  fs.writeFileSync(path.join(root,'verification/faint-context-browser.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
