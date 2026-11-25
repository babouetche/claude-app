'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {pathToFileURL,fileURLToPath}=require('node:url');
const {chromium}=require(process.env.NULL_AI_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),entry=path.resolve(process.env.NULL_CALC_ENTRY||path.join(root,'CALCULATEUR.html'));
const aliasAssets={'Minior-Meteor':'Minior-Form-7','Mime Jr.':'Mime Jr.','Pumpkaboo-Super':'Pumpkaboo','Zygarde-10%':'Zygarde-10%','Darmanitan-Galar-Zen':'Darmanitan-Zen-Mode-Galar','Darmanitan-Zen-Mode':'Darmanitan-Zen'};
async function snapshot(page){return page.evaluate(()=>({sets:[$('#p1 .set-selector').val(),$('#p2 .set-selector').val()],hp:[$('#p1 .current-hp').val(),$('#p2 .current-hp').val()],damage:damageResults.map(side=>side.map(r=>r.damage)),moves:NullMoveAIUI.getLastResult().moves.map(m=>m.probability),postKO:NullPostKOUI.getLastResult()}));}
async function icons(page,size){
 await page.locator('.opposing-team-box').scrollIntoViewIfNeeded();
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('.trainer-pok.right-side')).every(e=>e.complete&&e.naturalWidth>0));
 const rows=await page.evaluate(()=>Array.from(document.querySelectorAll('.trainer-pok.right-side')).map(e=>({id:e.dataset.id,src:e.src,box:e.getBoundingClientRect().toJSON(),wrap:e.parentElement.getBoundingClientRect().toJSON(),panel:e.closest('.opposing-team-box').getBoundingClientRect().toJSON()})));
 assert.equal(rows.length,6);
 for(const row of rows){assert.equal(row.box.width,size==='small'?40:64);assert.equal(row.box.height,size==='small'?30:64);assert.equal(row.wrap.width,row.box.width);assert.equal(row.wrap.height,row.box.height);assert.ok(row.box.right<=row.panel.right&&row.box.left>=row.panel.left,'Sprite must stay inside its trainer panel');}
 assert.ok(rows.find(e=>e.id==='Minior-Meteor (Hiker Marcster)').src.includes('Minior-Form-7'));
 return rows;
}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.NULL_AI_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe'}),checks=[],errors=[];
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1080}});page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('icon-size-mode','small'));await page.route(/^https?:\/\//,r=>r.abort());
  await page.goto(pathToFileURL(entry).href,{waitUntil:'load'});await page.waitForFunction(()=>window.NullPostKOUI&&NullPostKOUI.getLastResult());
  const sourceData=await page.evaluate(()=>JSON.stringify(SETDEX_SV));
  await page.evaluate(()=>{$('#p1 .set-selector').val('Chesnaught (Blank Set)').trigger('change');$('#p2 .set-selector').val('Glimmet (Hiker Marcster)').trigger('change');});
  const baseline=await snapshot(page);let small=await icons(page,'small');
  checks.push('The six Hiker Marcster icons load, including the actual Meteor form; no broken-image text or oversized wrapper.');
  await page.locator('.opposing-team-box').screenshot({path:path.join(root,'verification/sprites-small.png')});
  await page.evaluate(()=>document.getElementById('icon-size-big').click());await icons(page,'big');assert.deepEqual(await snapshot(page),baseline);
  await page.locator('.opposing-team-box').screenshot({path:path.join(root,'verification/sprites-big.png')});
  checks.push('Small 40×30 and Big 64×64 keep sprite/wrapper dimensions aligned and preserve HP, move probabilities, damage and post-KO ranking.');
  const inventory=await page.evaluate(()=>{
   const result=[];['small','big'].forEach(mode=>{const previous=localStorage.getItem('icon-size-mode');localStorage.setItem('icon-size-mode',mode);
    Object.keys(SETDEX_SV).forEach(name=>['panel','team'].forEach(kind=>{const url=new URL(getSrcImgPokemon({name:kind==='team'?normalizeTrainerIconSpeciesName(name):name},kind==='panel'),document.baseURI).href;result.push({name,mode,kind,url});}));localStorage.setItem('icon-size-mode',previous);});return result;
  });
  const missing=[],checkedFiles=new Set();
  for(const row of inventory){
   try{const filename=fileURLToPath(row.url);assert.ok(fs.existsSync(filename));assert.ok(fs.readdirSync(path.dirname(filename)).includes(path.basename(filename)),'Case-sensitive asset name');
    if(!checkedFiles.has(filename)){const bytes=fs.readFileSync(filename);assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.ok(bytes.readUInt32BE(16)>0&&bytes.readUInt32BE(20)>0);checkedFiles.add(filename);}
    if(aliasAssets[row.name])assert.ok(path.basename(filename).startsWith(aliasAssets[row.name]));
   }catch(error){missing.push({...row,error:error.message});}
  }
  assert.equal(inventory.length,5024);assert.deepEqual(missing,[]);
  checks.push('All 1,256 supplied species/form keys resolve to valid local PNGs: 5,024 panel/team routes across Small/Big, including URL encoding and exact filename case.');
  await page.evaluate(()=>document.getElementById('icon-size-small').click());await icons(page,'small');
  const candidate=baseline.postKO.candidates.find(c=>(c.aliases||[]).includes('Minior-Meteor (Hiker Marcster)'));
  const row=page.locator('#null-post-ko-team .null-post-ko-row[data-id="'+candidate.id+'"]');await row.locator('button').click();
  assert.equal(await page.locator('.trainer-pok.right-side.null-post-ko-fainted').count(),2);
  const crosses=await page.evaluate(()=>Array.from(document.querySelectorAll('.trainer-pok.right-side.null-post-ko-fainted')).map(e=>getComputedStyle(e.parentElement,'::after').content));assert.ok(crosses.every(v=>v.includes('×')));
  await row.locator('button').click();assert.equal(await page.locator('.trainer-pok.right-side.null-post-ko-fainted').count(),0);
  await page.locator('.trainer-pok.right-side[data-id="Minior-Meteor (Hiker Marcster)"]').click();
  assert.equal(await page.evaluate(()=>$('#p2 .set-selector').val()),'Minior-Meteor (Hiker Marcster)');
  await page.waitForFunction(()=>{const e=document.querySelector('#p2mon');return e&&e.complete&&e.naturalWidth>0&&e.src.includes('Minior-Form-7.png');});
  checks.push('Meteor icon still selects the original trainer set; KO/Restore crosses correctly decorate both logical aliases and the top-panel preview loads.');
  await page.evaluate(()=>$('#p2 .set-selector').val('Glimmet (Hiker Marcster)').trigger('change'));assert.deepEqual(await snapshot(page),baseline);
  await page.setViewportSize({width:390,height:844});await icons(page,'small');await page.locator('.opposing-team-box').screenshot({path:path.join(root,'verification/sprites-mobile.png')});
  checks.push('Sprites stay inside the trainer panel at a narrow viewport; restoring the battle preserves the original calculations.');
  assert.equal(await page.evaluate(()=>JSON.stringify(SETDEX_SV)),sourceData);assert.deepEqual(errors,[]);
  const manifest=require('../tests/fixtures/input-archive.json');for(const [file,expected]of Object.entries(manifest.hashes))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),expected,file);
  fs.writeFileSync(path.join(root,'verification/sprites-browser.json'),JSON.stringify({recordedAt:new Date().toISOString(),entry,checks,errors,routeCount:inventory.length,speciesCount:inventory.length/4,assetFiles:checkedFiles.size,missing,small,trainerDataUnchanged:true,protectedFiles:Object.keys(manifest.hashes).length},null,2)+'\n');
  console.log(JSON.stringify({checks,errors,routeCount:inventory.length,assetFiles:checkedFiles.size},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
