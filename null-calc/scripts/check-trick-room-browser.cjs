'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.NULL_AI_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),entry=path.resolve(process.env.NULL_CALC_ENTRY||path.join(root,'CALCULATEUR.html'));
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
async function set(page,selector,value){await page.evaluate(({selector,value})=>$(selector).val(value).trigger('change'),{selector,value});}
async function read(page){return page.evaluate(()=>({checked:$('#trickroom').prop('checked'),mirror:$('#null-ai-trick-room').prop('checked'),field:createField().isTrickRoom,
 speeds:damageResults.map(s=>s[0].attacker.stats.spe),hp:[$('#p1 .current-hp').val(),$('#p2 .current-hp').val()],
 icons:['#p1','#p2'].map(s=>({first:$(s+' .speed-faster').length,last:$(s+' .speed-slower').length,tie:$(s+' .speed-tied').length,title:$(s+' .speed-indicator').attr('title')})),
 damage:damageResults.map(s=>s.map(r=>r.damage)),powers:damageResults.map(s=>s.map(r=>r.rawDesc.moveBP)),
 moves:NullMoveAIUI.getLastResult(),post:NullPostKOUI.getLastResult(),trainers:JSON.stringify(SETDEX_SV),
 double:NullDoubleUI.getState(),prediction:NullDoubleUI.getPrediction(),reference:$('#null-ai-player-action').val()}));}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.NULL_AI_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe'}),errors=[],checks=[];
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1080}}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.stack));page.on('dialog',d=>d.accept());await page.route(/^https?:\/\//,r=>r.abort());
  await page.goto(pathToFileURL(entry).href,{waitUntil:'load'});await page.waitForFunction(()=>window.NullPostKOUI&&NullPostKOUI.getLastResult());
  await page.locator('.import-name-text').fill('TR test');await page.locator('.import-team-text').fill('Slowbro\nAbility: Oblivious\nLevel: 38\nBold Nature\nIVs: 2 HP / 23 Atk / 19 Def / 14 SpA / 23 SpD / 22 Spe\n- Water Pulse\n- Zen Headbutt\n- Disable\n- Life Dew');await page.locator('#import').click();
  await set(page,'#p1 .set-selector','Slowbro (TR test)');await set(page,'#p2 .set-selector','Golem-Alola (Youngster Tommy)');
  const base=await read(page);assert.deepEqual(base.speeds,[36,44]);assert.ok(base.icons[0].last);assert.ok(base.icons[1].first);assert.equal(base.field,false);
  const geometry=await page.evaluate(()=>['harsh-sunshine','heavy-rain','strong-winds','trickroom','magicroom','wonderroom'].map(id=>{const r=document.querySelector('label[for="'+id+'"]').getBoundingClientRect();return {id,x:r.x,y:r.y,w:r.width,h:r.height};}));
  for(let i=0;i<3;i++){assert.ok(Math.abs(geometry[i].x-geometry[i+3].x)<1);assert.ok(Math.abs(geometry[i].w-geometry[i+3].w)<1);assert.equal(geometry[i+3].y,geometry[3].y);}
  await page.locator('label[for=trickroom]').click();let on=await read(page);
  assert.equal(on.checked,true);assert.equal(on.mirror,true);assert.equal(on.field,true);assert.ok(on.icons[0].first);assert.ok(on.icons[1].last);assert.match(on.icons[0].title,/equal priority/);
  assert.deepEqual(on.speeds,base.speeds);assert.deepEqual(on.damage,base.damage);assert.deepEqual(on.hp,base.hp);assert.equal(on.trainers,base.trainers);
  await page.waitForFunction(()=>document.querySelector('#box-poke-list .trainer-pok[data-id="Slowbro (TR test)"]').classList.contains('mon-speed-F'));
  checks.push('Screenshot Slowbro 36 vs Alolan Golem 44: six aligned cells; main click reverses arrows and live box speed border, with ordinary damage, HP, raw speeds and trainer data unchanged.');
  await page.evaluate(()=>{$('#null-ai-context').prop('open',true);$('#null-ai-trick-room').closest('details').prop('open',true);});
  await page.locator('#null-ai-trick-room').uncheck();let off=await read(page);assert.equal(off.checked,false);assert.equal(off.field,false);assert.ok(off.icons[0].last);assert.deepEqual(off.damage,base.damage);
  await page.locator('#null-ai-trick-room').check();assert.equal((await read(page)).checked,true);
  await page.evaluate(()=>NullAI18n.setLanguage('fr'));assert.equal((await read(page)).field,true);await page.evaluate(()=>NullAI18n.setLanguage('en'));assert.equal((await read(page)).field,true);
  await set(page,'#null-ai-player-action','switch-in');await set(page,'#p1 .set-selector','Mew (Blank Set)');
  await page.locator('label[for=trickroom]').click();off=await read(page);assert.equal(off.reference,'stay');assert.equal(off.field,false);assert.ok(await page.locator('#trick-room-snapshot-note').isVisible());
  checks.push('Legacy AI checkbox stays synchronized in both directions and languages; changing the room exits a frozen Switch into snapshot and explains the updated active reference.');
  await set(page,'#p1 .set-selector','Machamp (Blank Set)');await set(page,'#p2 .set-selector','Mew (Blank Set)');
  await page.evaluate(()=>['Payback','Fishious Rend','Gyro Ball','Electro Ball'].forEach((m,i)=>$('#p1 .move'+(i+1)+' select.move-selector').val(m).trigger('change')));
  off=await read(page);await page.locator('label[for=trickroom]').click();on=await read(page);
  assert.equal(off.powers[0][0],100);assert.equal(on.powers[0][0],50);assert.equal(off.powers[0][1],85);assert.equal(on.powers[0][1],170);
  assert.deepEqual(on.damage[0][2],off.damage[0][2]);assert.deepEqual(on.damage[0][3],off.damage[0][3]);assert.deepEqual(on.speeds,off.speeds);
  await page.locator('label[for=trickroom]').click();assert.deepEqual((await read(page)).damage,off.damage);
  await set(page,'#p1 .ability','Analytic');await set(page,'#p1 .move1 select.move-selector','Surf');
  off=await read(page);await page.locator('label[for=trickroom]').click();on=await read(page);assert.ok(Math.max(...off.damage[0][0])>Math.max(...on.damage[0][0]));
  checks.push('Browser mechanics reverse Payback, Fishious Rend and Analytic; Gyro Ball/Electro Ball and displayed real speeds stay unchanged; disabling the room restores original damage.');
  await page.locator('label[for=trickroom]').click();await set(page,'#p1 .set-selector','Mew (Blank Set)');
  off=await read(page);assert.equal(off.speeds[0],off.speeds[1]);await page.locator('label[for=trickroom]').click();on=await read(page);assert.ok(on.icons.every(i=>i.tie));assert.deepEqual(on.speeds,off.speeds);
  await page.evaluate(()=>$('#doubles-format').prop('checked',true).trigger('change'));await set(page,'#p2 .set-selector','Poipole (Twins Gina&Mia)');
  await set(page,'#null-double-player [data-double-field=setID]','Slowbro (TR test)');
  const other=await page.evaluate(()=>Object.keys(SETDEX_SV).find(n=>n!=='Poipole'&&SETDEX_SV[n]['Twins Gina&Mia']));await set(page,'#null-double-opponent [data-double-field=setID]',other+' (Twins Gina&Mia)');
  on=await read(page);assert.equal(on.double.complete,true);assert.equal(on.double.field.trickRoom,true);assert.equal(on.double.switchState.field.trickRoom,true);
  assert.ok(on.double.matchups.every(row=>row.every(pair=>pair.field.trickRoom)));assert.ok(on.prediction.slots.every(s=>s.moves.every(m=>typeof m.probability==='number')));
  const doubleHP=on.hp;await page.locator('label[for=trickroom]').click();off=await read(page);assert.equal(off.double.field.trickRoom,false);assert.deepEqual(off.hp,doubleHP);
  await page.evaluate(()=>$('#singles-format').prop('checked',true).trigger('change'));assert.equal((await read(page)).field,false);assert.equal((await read(page)).checked,false);
  checks.push('Equal-speed arrows stay tied. Complete doubles shares the room across all four battlers, move-target and reserve states; returning to singles preserves the setting and HP.');
  await set(page,'#p1 .set-selector','Slowbro (TR test)');await set(page,'#p2 .set-selector','Golem-Alola (Youngster Tommy)');await page.locator('label[for=trickroom]').click();
  await page.evaluate(()=>localStorage.setItem('theme','light'));await page.reload({waitUntil:'load'});await page.waitForFunction(()=>window.NullPostKOUI&&NullPostKOUI.getLastResult());
  await set(page,'#p1 .set-selector','Slowbro (TR test)');await set(page,'#p2 .set-selector','Golem-Alola (Youngster Tommy)');await page.locator('label[for=trickroom]').click();
  fs.mkdirSync(path.join(root,'verification'),{recursive:true});await page.locator('.field-info').screenshot({path:path.join(root,'verification/trick-room-field.png')});
  assert.deepEqual(errors,[]);const result={revision:'trick-room-field',checkedAt:new Date().toISOString(),htmlSHA256:sha(fs.readFileSync(entry)),checks,geometry,errors};
  fs.writeFileSync(path.join(root,'verification/trick-room-browser.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
