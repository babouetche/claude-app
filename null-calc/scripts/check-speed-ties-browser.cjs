'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.NULL_AI_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),entry=path.resolve(process.env.NULL_CALC_ENTRY||path.join(root,'CALCULATEUR.html'));
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
async function read(page){return page.evaluate(()=>({post:NullPostKOUI.getLastResult(),
    hp:[$('#p1 .current-hp').val(),$('#p2 .current-hp').val()],
    damage:damageResults.map(side=>side.map(r=>r.damage)),sets:JSON.stringify(SETDEX_SV)}));}
function entrant(r){return r.post.switch.candidates.find(c=>c.probability===1).name;}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.NULL_AI_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const errors=[],checks=[];
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1080}});page.on('pageerror',e=>errors.push(e.message));
  await page.route(/^https?:\/\//,r=>r.abort());await page.goto(pathToFileURL(entry).href,{waitUntil:'load'});
  await page.waitForFunction(()=>window.NullPostKOUI&&NullPostKOUI.getLastResult());
  await page.evaluate(()=>{
   $('#p1 .set-selector').val('Masquerain (Blank Set)').trigger('change');$('#p1 .level').val(45).trigger('change');$('#p1 .nature').val('Impish').trigger('change');$('#p1 .ability').val('Intimidate').trigger('change');$('#p1 .abilityToggle').prop('checked',false).trigger('change');
   Object.entries({hp:8,at:28,df:31,sa:11,sd:14,sp:29}).forEach(([k,v])=>{$('#p1 .'+k+' .ivs').val(v).trigger('change');$('#p1 .'+k+' .evs').val(0).trigger('change');});
   ['Bubble Beam','Icy Wind','Struggle Bug','Air Slash'].forEach((m,i)=>$('#p1 .move'+(i+1)+' .move-selector').val(m).trigger('change'));$('#p1 .current-hp').val(88).trigger('change');
   $('#p2 .set-selector').val('Mightyena (Rusturf Team Aqua Grunt)').trigger('change');$('#p2 .at .boost').val(-1).trigger('change');$('#p2 .abilityToggle').prop('checked',false).trigger('change');performCalculations();
  });
  const baseline=await read(page), phione=baseline.post.candidates.find(c=>c.name==='Phione');
  assert.equal(phione.speed,90);assert.equal(entrant(baseline),'Phione');
  assert.deepEqual(baseline.post.switch.candidates.map(c=>[c.name,c.score,c.probability]),[['Slowbro-Galar',2,0],['Wormadam',-1,0],['Phione',3,1]]);
  assert.deepEqual(baseline.hp,['88','123']);
  const row=page.locator('.null-post-ko-row').filter({has:page.locator('.null-post-ko-name',{hasText:'Phione'})});
  assert.ok(await row.evaluate(e=>e.classList.contains('null-post-ko-likely')));
  checks.push('Screenshot reproduced: tied speed 90, Phione score 3 beats Slowbro-Galar 2; green prediction.');
  await page.evaluate(()=>$('#null-ai-context').prop('open',true));
  await page.selectOption('#null-ai-mode','strict');assert.equal(entrant(await read(page)),'Phione');
  await page.selectOption('#null-ai-mode','estimate');
  await page.evaluate(()=>$('#p1 .sp .ivs').val(28).trigger('change'));assert.equal(entrant(await read(page)),'Phione');
  await page.evaluate(()=>$('#p1 .sp .ivs').val(29).trigger('change'));assert.equal(entrant(await read(page)),'Phione');
  await row.locator('button').click();assert.equal(entrant(await read(page)),'Slowbro-Galar');
  await row.locator('button').click();assert.equal(entrant(await read(page)),'Phione');
  let current=await read(page);assert.deepEqual(current.hp,baseline.hp);assert.deepEqual(current.damage,baseline.damage);
  assert.equal(current.sets,baseline.sets);
  checks.push('Strict mode, nearby speed, KO/Restore preserve damage, current HP and trainer data.');
  await page.evaluate(()=>$('#null-ai-trick-room').prop('checked',true).trigger('change'));
  current=await read(page);assert.equal(current.post.candidates.find(c=>c.name==='Phione').score,3);assert.equal(entrant(current),'Slowbro-Galar');
  await page.evaluate(()=>$('#null-ai-trick-room').prop('checked',false).trigger('change'));
  assert.equal(entrant(await read(page)),'Phione');
  await page.evaluate(()=>NullAI18n.setLanguage('fr'));assert.equal(entrant(await read(page)),'Phione');
  await page.evaluate(()=>NullAI18n.setLanguage('en'));assert.equal(entrant(await read(page)),'Phione');
  checks.push('Trick Room keeps ties favorable; faster reserves and party order still apply. Languages preserve the result.');
  await page.evaluate(()=>{
   $('#doubles-format').prop('checked',true).trigger('change');
   $('#null-double-player [data-double-field=setID]').val('Blastoise (Blank Set)').trigger('change');
   $('#null-double-opponent [data-double-field=setID]').val('Slowbro-Galar (Rusturf Team Aqua Grunt)').trigger('change');
  });
  current=await read(page);assert.equal(entrant(current),'Phione');
  assert.equal(current.post.candidates.find(c=>c.name==='Slowbro-Galar').eligibility,'partner');
  assert.equal(current.post.candidates.find(c=>c.name==='Phione').score,3);
  await page.evaluate(()=>$('#singles-format').prop('checked',true).trigger('change'));
  current=await read(page);assert.equal(entrant(current),'Phione');
  assert.deepEqual(current.hp,baseline.hp);assert.deepEqual(current.damage,baseline.damage);assert.equal(current.sets,baseline.sets);
  checks.push('Complete doubles shares the corrected reserve scorer and excludes the active partner; returning to singles restores the same preview.');
  await page.evaluate(()=>$('#null-ai-context').prop('open',false));
  fs.mkdirSync(path.join(root,'verification'),{recursive:true});
  await page.locator('#null-post-ko').screenshot({path:path.join(root,'verification/speed-tie-phione.png')});
  assert.deepEqual(errors,[]);
  const result={checkedAt:new Date().toISOString(),revision:'speed-ties-documentation',htmlSHA256:sha(fs.readFileSync(entry)),trainerDataSHA256:sha(baseline.sets),checks,errors};
  fs.writeFileSync(path.join(root,'verification/speed-tie-browser.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
