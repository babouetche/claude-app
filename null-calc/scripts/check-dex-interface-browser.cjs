'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.NULL_AI_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),entry=path.resolve(process.env.NULL_CALC_ENTRY||path.join(root,'CALCULATEUR.html'));
const config=require('./release-config.json'),evidence=require('../verification/dex-interface-encounters-native.json');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
(async()=>{
 const checkedAt=new Date().toISOString(),checks=[],errors=[],details={};let browser;
 async function check(label,fn){try{details[label]=await fn();checks.push(label);}catch(error){errors.push(label+': '+error.stack);}}
 try{
  await check('All 245 encounter profiles retain independently checked native bytes and map pointers',async()=>{
   assert.equal(evidence.romSHA256,config.romSHA256);
   const rom=process.env.NULL_AI_ROM?fs.readFileSync(process.env.NULL_AI_ROM):null;
   if(rom)assert.equal(sha(rom),config.romSHA256);
   const profiles=new Set();
   for(const area of evidence.areas)for(const header of area.nativeHeaders){
    if(rom)assert.equal(rom.subarray(Number(header.headerOffset),Number(header.headerOffset)+20).toString('hex'),header.headerBytes);
    for(const table of header.tables){
     profiles.add(area.area+'/'+table.method);
     assert.equal(Buffer.from(table.bytes,'hex').length,table.nativeIds.length*4);
     if(rom){
      const start=Number(table.arrayOffset),info=Number(table.infoOffset);
      assert.equal(rom.subarray(start,start+table.nativeIds.length*4).toString('hex'),table.bytes);
      assert.equal(rom.subarray(info,info+8).toString('hex'),table.infoBytes);
      assert.equal(rom.readUInt32LE(info+4)-0x08000000+(table.method==='fish'?20:0),start);
     }
    }
   }
   assert.equal(profiles.size,245);
   return {rechecked:!!rom,profiles:profiles.size,areas:evidence.areas.length,slots:evidence.summary.slots};
  });
  browser=await chromium.launch({headless:true,executablePath:process.env.NULL_AI_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const context=await browser.newContext({viewport:{width:1566,height:980}});
  await context.route(/^https?:\/\//,route=>route.abort());
  const page=await context.newPage();page.setDefaultTimeout(12000);
  page.on('pageerror',error=>errors.push(error.message));
  const localEntry=path.join(path.dirname(entry),'docs/porydex/index.html');
  // Distribution uses dist/ rather than docs/.
  const dexPath=fs.existsSync(localEntry)?localEntry:path.join(path.dirname(entry),'dist/porydex/index.html');
  const dexURL=pathToFileURL(dexPath).href;
  await page.goto(dexURL);
  await page.waitForFunction(()=>window.NullDexAppliedVersion==='1.2.6');
  await check('Official header, theme, location list and independent split panels',async()=>{
   assert.deepEqual(await page.locator('.nav:not(.nav-theme) a').allTextContents(),['Trainer Sheet','Pokédex','Calculator','Download']);
   assert.equal(await page.locator('#theme-select').inputValue(),'light');
   await page.getByRole('button',{name:'Encounters',exact:true}).click();
   await page.locator('a[href$="#encounters/rustborogrove"]').click();
   const panel=page.locator('.dexentry').filter({has:page.getByRole('heading',{name:'Rustboro Grove',exact:true})});
   await panel.waitFor({state:'visible'});
   assert.deepEqual(await panel.locator('h3').allTextContents(),['Land','Surfing','Super Rod']);
   assert.equal(await panel.locator('a[data-entry^="pokemon|"]').count(),24);
   assert.match(await panel.innerText(),/5% Lv 15\s+Purrloin/);
   assert.match(await panel.innerText(),/20% Lv 45\s+Kangaskhan/);
   const layout=await page.evaluate(()=>pokedex.panels.map(p=>({fragment:p.fragment,left:p.el.getBoundingClientRect().left,width:p.el.getBoundingClientRect().width,overflow:getComputedStyle(p.el).overflowY})));
   assert.equal(layout.length,2);assert.ok(layout[1].left>layout[0].left);assert.ok(layout.every(p=>p.overflow==='auto'||p.overflow==='scroll'));
   return layout;
  });
  await check('Location to Pokémon to ability keeps the contextual Rustboro Grove back button',async()=>{
   await page.locator('a[data-entry="pokemon|Litten"]').click();
   const litten=page.locator('.dexentry').filter({has:page.getByRole('heading',{name:'Litten #725',exact:true})});
   await litten.waitFor({state:'visible'});
   assert.match(await litten.locator('.pfx-backbutton').innerText(),/Rustboro Grove/);
   await litten.locator('.abilityentry a').filter({hasText:'Intimidate'}).click();
   await page.getByRole('heading',{name:'Intimidate',exact:true}).waitFor({state:'visible'});
   assert.match(await litten.locator('.pfx-backbutton').innerText(),/Rustboro Grove/);
   await page.waitForFunction(()=>pokedex.panels.filter(p=>p.hidden).every(p=>getComputedStyle(p.el).display==='none'));
   await page.waitForFunction(()=>document.getAnimations().every(animation=>animation.playState!=='running'));
   await litten.evaluate(node=>{node.closest('.pfx-panel').scrollTop=0;});
   await page.screenshot({path:path.join(root,'verification/dex-interface-preview.png')});
   await litten.locator('.pfx-backbutton').click();
   await page.getByRole('heading',{name:'Rustboro Grove',exact:true}).waitFor({state:'visible'});
   return {backButton:'Rustboro Grove',ability:'Intimidate'};
  });
  await check('Pokémon fishing encounters show numeric rates, levels and working native new-tab links',async()=>{
   await page.locator('a[data-entry="pokemon|Totodile"]').click();
   const panel=page.locator('.dexentry').filter({has:page.getByRole('heading',{name:'Totodile #158',exact:true})});
   await panel.getByRole('button',{name:'Encounters',exact:true}).click();
   const row=panel.locator('a[data-entry="encounters|Rustboro Grove"]');
   await row.waitFor();assert.match(await row.innerText(),/20%/);assert.match(await panel.innerText(),/Lv 15/);
   assert.doesNotMatch(await panel.innerText(),/NaN|undefined/);
   for(const click of [{button:'middle'},{modifiers:['Control']}]){
    const before=page.url(),[tab]=await Promise.all([context.waitForEvent('page'),row.click(click)]);
    await tab.waitForLoadState('load');await tab.getByRole('heading',{name:'Rustboro Grove',exact:true}).waitFor();
    assert.equal(page.url(),before);assert.ok(tab.url().startsWith(dexURL+'#encounters/rustborogrove'));await tab.close();
   }
   return {rustboroRate:await row.innerText(),newTabActions:2};
  });
  await check('Dark theme persists and the official panels remain usable on narrow screens',async()=>{
   await page.locator('#theme-select').selectOption('dark');
   assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
   await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.NullDexAppliedVersion==='1.2.6');
   assert.equal(await page.locator('#theme-select').inputValue(),'dark');
   await page.setViewportSize({width:700,height:900});
   await page.getByRole('heading',{name:/Totodile/}).waitFor({state:'visible'});
   const bounds=await page.getByRole('heading',{name:/Totodile/}).boundingBox();assert.ok(bounds.x>=0&&bounds.x<700);
   await page.locator('#theme-select').selectOption('light');return {persistedTheme:'dark',viewportWidth:700};
  });
  await check('Official species encounter filters and keyboard navigation work from local routes',async()=>{
   await page.setViewportSize({width:1566,height:980});
   await page.goto(dexURL+'#encounters/',{waitUntil:'domcontentloaded'});
   const input=page.locator('input.searchbox:visible');
   await input.fill('Totodile');await input.press('End');
   await page.locator('.results a[data-entry="pokemon|Totodile"]').click();
   await page.locator('.filter[value="pokemon:totodile"]').first().waitFor();
   await page.locator('.results a[href$="#encounters/rustborogrove"]').waitFor();
   const filtered=await page.locator('.results .result').count();assert.ok(filtered>0&&filtered<145);
   await page.goto(dexURL,{waitUntil:'domcontentloaded'});
   await page.locator('input.searchbox').fill('Slowking');await page.locator('input.searchbox').press('End');await page.locator('input.searchbox').press('Enter');
   const slowking=page.locator('.dexentry').filter({has:page.getByRole('heading',{name:'Slowking #199',exact:true})});
   await slowking.waitFor({state:'visible'});assert.match(await slowking.locator('.abilityentry').innerText(),/Regenerator/);
   await slowking.getByRole('button',{name:'Flavor',exact:true}).click();
   assert.match(await slowking.innerText(),/Animated Gen 6-9 sprites/);assert.match(await slowking.innerText(),/Cry/);
   assert.ok((await slowking.locator('audio').getAttribute('src')).startsWith('https://play.pokemonshowdown.com/'));
   return {filteredAreas:filtered,keyboardRoute:'pokemon/slowking',flavorRestored:true};
  });
  await page.close();
  await check('Embedded official Calculator button returns without resetting the battle',async()=>{
   const calc=await context.newPage();await calc.goto(pathToFileURL(entry).href);
   await calc.waitForFunction(()=>window.NullMoveAIUI&&NullMoveAIUI.getLastResult());
   await calc.evaluate(()=>$('#p1 .current-hp').val(37).trigger('change'));
   const read=()=>calc.evaluate(()=>({sets:[$('#p1 .set-selector').val(),$('#p2 .set-selector').val()],hp:[$('#p1 .current-hp').val(),$('#p2 .current-hp').val()],trainers:JSON.stringify(SETDEX_SV)}));
   const before=await read();await calc.locator('#header-dex-button').click();
   const frame=calc.frameLocator('#porydex-frame');await frame.locator('.nav a').filter({hasText:/^Calculator$/}).click();
   await calc.locator('#porydex-frame').waitFor({state:'hidden'});
   await calc.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   assert.deepEqual(await read(),before);
   await calc.close();return {preservedHP:before.hp};
  });
  await context.close();
 }catch(error){errors.push(error.stack||String(error));}
 finally{
  if(browser)await browser.close();
  const report={revision:config.revision,checkedAt,entry,htmlSHA256:sha(fs.readFileSync(entry)),checks,details,errors};
  fs.writeFileSync(path.join(root,'verification/dex-interface-browser.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({checks:checks.length,errors},null,2));if(errors.length)process.exitCode=1;
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
