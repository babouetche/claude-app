'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.NULL_AI_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),stage=process.env.NULL_OPTIMIZED_ROOT||path.join(root,'../livraison/optimisation-stage/Null-Calculateur-Optimise');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
async function run(browser,base){
 const context=await browser.newContext({viewport:{width:1440,height:1080}}),page=await context.newPage(),errors=[],snapshots={},checks=[];
 page.on('pageerror',e=>errors.push(e.message));await context.route(/^https?:\/\//,r=>r.abort());
 try{
  let scripts=0;page.on('request',r=>{if(r.resourceType()==='script'&&r.url().startsWith('file:'))scripts++;});
  await page.goto(pathToFileURL(path.join(base,'CALCULATEUR.html')).href,{waitUntil:'load'});
  await page.waitForFunction(()=>window.NullMoveAIUI&&NullMoveAIUI.getLastResult());
  const data=await page.evaluate(()=>({sets:JSON.stringify(SETDEX_SV),metadata:JSON.stringify(NullAIMoveMetadata),verified:JSON.stringify(NullVerifiedData)}));
  Object.entries(data).forEach(([k,v])=>snapshots['data-'+k]=sha(v));
  const read=async key=>snapshots[key]=await page.evaluate(()=>({moves:NullMoveAIUI.getLastResult(),post:NullPostKOUI.getLastResult(),damage:$('#resultHeader').text()||$('.calc-description').text(),hp:[$('#p1 .current-hp').val(),$('#p2 .current-hp').val()]}));
  await read('initial');
  await page.evaluate(()=>{
   $('#p1 .set-selector').val('Electivire (Blank Set)').trigger('change');$('#p1 .level').val(45).trigger('change');$('#p1 .nature').val('Impish').trigger('change');$('#p1 .ability').val('Motor Drive').trigger('change');
   const ivs={hp:25,at:12,df:9,sa:7,sd:7,sp:18};Object.keys(ivs).forEach(s=>$('#p1 .'+s+' .ivs').val(ivs[s]).trigger('change'));
   ['Thunderbolt','Thunder Punch','Low Kick','Light Screen'].forEach((m,i)=>$('#p1 .move'+(i+1)+' .move-selector').val(m).trigger('change'));
   $('#p1 .current-hp').val(69).trigger('change');$('#p2 .set-selector').val('Linoone (Youngster Schmo)').trigger('change');
  });
  await read('belly-drum');assert.deepEqual(snapshots['belly-drum'].moves.moves.map(m=>m.probability),[0,0,.125,.875]);
  await page.evaluate(()=>{$('#p1 .set-selector').val('Empoleon (Blank Set)').trigger('change');$('#p1 .level').val(38).trigger('change');['Metal Claw','Aqua Jet','Steel Wing','Bubble Beam'].forEach((m,i)=>$('#p1 .move'+(i+1)+' .move-selector').val(m).trigger('change'));$('#p2 .set-selector').val('Pidgeot (Youngster Schmo)').trigger('change');});
  await read('mirror-move');assert.ok(snapshots['mirror-move'].moves.moves.every(m=>Number.isFinite(m.probability)));
  await page.evaluate(()=>NullAI18n.setLanguage('fr'));await read('french');
  await page.evaluate(()=>NullAI18n.setLanguage('en'));await read('english');
  await page.evaluate(()=>{
   $('#p1 .set-selector').val('Chesnaught (Blank Set)').trigger('change');$('#p1 .level').val(38).trigger('change');$('#p2 .set-selector').val('Poipole (Twins Gina&Mia)').trigger('change');$('#doubles-format').prop('checked',true).trigger('change');
   $('#null-double-player [data-double-field=setID]').val('Blastoise (Blank Set)').trigger('change');
   const n=Object.keys(SETDEX_SV).find(n=>n!=='Poipole'&&SETDEX_SV[n]['Twins Gina&Mia']);$('#null-double-opponent [data-double-field=setID]').val(n+' (Twins Gina&Mia)').trigger('change');
  });
  await read('doubles');assert.ok(snapshots.doubles.moves.moves.every(m=>Number.isFinite(m.probability)));
  await page.evaluate(()=>$('#singles-format').prop('checked',true).trigger('change'));
  await page.evaluate(()=>{$('#p1 .set-selector').val('Electabuzz (Blank Set)').trigger('change');$('#p2 .set-selector').val('Pelipper (Fisherman Ivan)').trigger('change');$('#rain').prop('checked',true).trigger('change');});
  await read('post-ko');assert.ok(snapshots['post-ko'].post.candidates.length>1);
  const ko=page.locator('#null-post-ko-team button').filter({hasText:/^KO$/}).first();
  await ko.click();await read('marked');
  await page.locator('#null-post-ko-team button').filter({hasText:/^Restore$/}).first().click();await read('restored');
  await page.locator('#exportL').click();snapshots.export=await page.locator('textarea.import-team-text').inputValue();assert.match(snapshots.export,/Electabuzz/);
  await page.locator('.import-name-text').fill('Optimized verification');await page.locator('.save-to-box[data-panel=p1]').click();
  snapshots.saved=await page.evaluate(()=>JSON.parse(localStorage.customsets).Electabuzz['Optimized verification']);assert.ok(snapshots.saved);
  // A real link keeps the calculator's left-click view and native new-tab actions.
  const dexLink=page.getByRole('link',{name:'Pokédex',exact:true});
  const expectedDexURL=await dexLink.evaluate(link=>link.href);
  const navigationState=()=>page.evaluate(()=>({url:location.href,dex:document.body.classList.contains('dex-mode'),
   selected:[$('#p1 .set-selector').val(),$('#p2 .set-selector').val()],
   hp:[$('#p1 .current-hp').val(),$('#p2 .current-hp').val()],customsets:localStorage.customsets}));
  const beforeNavigation=await navigationState();
  for(const click of [{button:'middle'},{modifiers:['Control']}]){
   const [tab]=await Promise.all([context.waitForEvent('page',{timeout:10000}),dexLink.click(click)]);
   try{
    tab.on('pageerror',e=>errors.push(e.message));
    await tab.waitForLoadState('load');
    await tab.waitForFunction(()=>window.NullDexAppliedVersion==='1.2.6');
    assert.equal(new URL(tab.url()).pathname,new URL(expectedDexURL).pathname);
    await tab.locator('input.searchbox').first().waitFor({state:'visible'});
    await tab.locator('input.searchbox').first().fill('Slowking');
    await tab.locator('input.searchbox').first().press('End');
    await tab.locator('a[data-entry="pokemon|Slowking"]').click();
    await tab.getByRole('heading',{name:/Slowking/}).first().waitFor({state:'visible'});
    assert.deepEqual(await navigationState(),beforeNavigation);
   }finally{await tab.close();}
  }
  checks.push('Middle-click and Ctrl+click open a working standalone local Pokédex tab and preserve the calculator selection, HP, URL and custom sets.');
  // Embedded dex uses real Null data, including search and selected details.
  await page.getByRole('link',{name:'Pokédex',exact:true}).click();
  const frame=page.frameLocator('#porydex-frame');await frame.locator('input.searchbox').first().waitFor({state:'visible'});
  await frame.locator('input.searchbox').first().pressSequentially('Linoone');
  await frame.locator('a[data-entry="pokemon|Linoone"]').click();
  await frame.getByRole('heading',{name:/Linoone/}).first().waitFor({state:'visible',timeout:8000});
  snapshots.dex=await frame.locator('body').innerText();assert.match(snapshots.dex,/Linoone #264/);
  const dexFrame=page.frames().find(f=>f.url().includes('/porydex/index.html'));
  snapshots.dexData=await dexFrame.evaluate(()=>({species:JSON.stringify(BattlePokedex),learnsets:JSON.stringify(BattleLearnsets),moves:JSON.stringify(BattleMovedex)}));
  Object.keys(snapshots.dexData).forEach(k=>snapshots.dexData[k]=sha(snapshots.dexData[k]));
  await page.getByRole('button',{name:'Calculator',exact:true}).click();
  assert.deepEqual(errors,[]);
  checks.push('Equivalent generated data, trainer sets, damage/AI, Belly Drum, Mirror Move, languages, doubles, post-KO, KO/Restore, export/save and embedded dex.');
  return {snapshots,scripts,errors,checks};
 }finally{await context.close();}
}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.NULL_AI_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const original=await run(browser,root),optimized=await run(browser,stage);
  assert.deepEqual(optimized.snapshots,original.snapshots);
  const manifest=JSON.parse(fs.readFileSync(path.join(stage,'documentation/MANIFESTE.json')));
  for(const [file,digest]of Object.entries(manifest.checksums))assert.equal(sha(fs.readFileSync(path.join(stage,file))),digest,file);
  const result={checkedAt:new Date().toISOString(),equivalent:true,errors:[],checks:optimized.checks,comparedSnapshots:Object.keys(optimized.snapshots),scriptRequests:{original:original.scripts,optimized:optimized.scripts},distributionFilesVerified:Object.keys(manifest.checksums).length};
  fs.writeFileSync(path.join(root,'verification/organized-browser.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
