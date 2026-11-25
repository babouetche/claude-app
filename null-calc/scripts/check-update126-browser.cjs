'use strict';
// End-to-end release checks for the additive 1.2.6 migration. All browser
// requests stay local; the optional native ROM is opened read-only.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),vm=require('node:vm');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.NULL_AI_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),entry=path.resolve(process.env.NULL_CALC_ENTRY||path.join(root,'CALCULATEUR.html'));
const release=require('./release-config.json');
const trainerFile=path.join(root,'tests/fixtures/trainer-update-1.2.6.json'),trainers=JSON.parse(fs.readFileSync(trainerFile));
const numericFile=path.join(root,'tests/fixtures',release.romFixture),numeric=JSON.parse(fs.readFileSync(numericFile));
const aiFile=path.join(root,'verification/update126-ai-native.json'),ai=JSON.parse(fs.readFileSync(aiFile));
const levelupFile=path.join(root,'tests/fixtures/levelup-1.2.6.json'),levelup=JSON.parse(fs.readFileSync(levelupFile));
const teachingFile=path.join(root,'tests/fixtures/teachable-1.2.6.json'),teaching=JSON.parse(fs.readFileSync(teachingFile));
const itemsFile=path.join(root,'tests/fixtures/items-1.2.6.json'),items=JSON.parse(fs.readFileSync(itemsFile));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function legacyTrainerGroups(){
 const context={};vm.runInNewContext(fs.readFileSync(path.join(root,'docs/js/data/sets/gen9.js'),'utf8'),context);
 const groups=new Map();
 for(const [species,sets]of Object.entries(context.SETDEX_SV))for(const [trainer,set]of Object.entries(sets)){
  if(species==='None'||set.index===undefined)continue;
  if(!groups.has(trainer))groups.set(trainer,{trainer,rows:[]});
  groups.get(trainer).rows.push({id:species+' ('+trainer+')',index:Number(set.index)});
 }
 return [...groups.values()].map(group=>({...group,rows:group.rows.sort((a,b)=>a.index-b.index)})).sort((a,b)=>a.rows[0].index-b.rows[0].index);
}

function checkNativeROM(){
 for(const fixture of [trainers,numeric,ai,levelup,teaching,items])assert.equal(fixture.romSHA256,release.romSHA256,'Current evidence ROM');
 if(!process.env.NULL_AI_ROM)return {rechecked:false,romSHA256:release.romSHA256,trainerRecords:0,aiBlocks:0,numericRecords:0};
 const rom=fs.readFileSync(process.env.NULL_AI_ROM);assert.equal(sha(rom),release.romSHA256,'Unsupported ROM');
 const seen=new Set();let trainerRecords=0,ownerHeaders=0,aiBlocks=0,numericRecords=0,levelupEntries=0,teachingProofs=0,itemRecords=0;
 function proof(p){
  const address=Number(p.offset===undefined?p.start:p.offset),offset=address>=0x08000000?address-0x08000000:address;
  const length=p.length===undefined?Number(p.endExclusive)-address:Number(p.length);
  assert.ok(Number.isInteger(offset)&&offset>=0&&Number.isInteger(length)&&length>0&&offset+length<=rom.length,'Native range');
  const bytes=rom.subarray(offset,offset+length);
  if(p.sha256)assert.equal(sha(bytes),p.sha256,'Native hash '+(p.offset||p.start));
  if(p.bytes)assert.equal(bytes.toString('hex'),p.bytes,'Native bytes '+(p.offset||p.start));
 }
 for(const slot of trainers.slots){
  const record=slot.native.record;if(seen.has(record.offset))continue;seen.add(record.offset);proof(record);
  const start=Number(record.offset);assert.equal(rom.readUInt16LE(start+12),slot.native.speciesID,slot.id+' species');
  assert.equal(rom.readUInt16LE(start+14),slot.native.itemID,slot.id+' item');
  assert.equal(rom.readUInt16LE(start+16),slot.native.abilityID,slot.id+' ability');
  assert.equal(rom[start+18],slot.native.level,slot.id+' level');trainerRecords++;
 }
 for(const group of trainers.ownerGroups||[])for(const owner of group.owners){
  proof({offset:owner.nativeHeaderOffset,length:40,sha256:owner.nativeHeaderSHA256,bytes:owner.nativeHeaderBytes});
  assert.equal(rom.readUInt32LE(Number(owner.nativePartyPointerFieldOffset))-0x08000000,Number(owner.nativePartyStart),owner.name+' party pointer');
  assert.equal(rom[Number(owner.nativePartySizeFieldOffset)],owner.nativePartySize,owner.name+' party size');ownerHeaders++;
 }
 for(const block of ai.blocks.filter(b=>b.version==='new')){proof(block);aiBlocks++;}
 for(const kind of ['moves','species'])for(const [name,row]of Object.entries(numeric[kind])){
  proof({offset:row.offset,length:Buffer.from(row.bytes,'hex').length,bytes:row.bytes});numericRecords++;
  if(kind==='species'&&row.weightOffset!==undefined)assert.equal(rom.readUInt16LE(Number(row.weightOffset))/10,row.weightkg,name+' weight');
 }
 proof({offset:levelup.pointerTableOffset,length:levelup.pointerTableLength,sha256:levelup.pointerTableSHA256});
 proof(levelup.learnsetDataRange);
 for(const entry of Object.values(levelup.entries)){
  const offset=Number(entry.learnsetOffset),length=(entry.moves.length+1)*4;
  proof({offset,length,sha256:entry.sha256});
  assert.equal(rom.readUInt32LE(Number(entry.pointerOffset))-0x08000000,offset,'Learnset pointer '+entry.speciesID);
  entry.moves.forEach((move,i)=>{assert.equal(rom.readUInt16LE(offset+i*4),move.id,'Learnset move '+entry.speciesID);assert.equal(rom.readUInt16LE(offset+i*4+2),move.level,'Learnset level '+entry.speciesID);});
  assert.equal(rom.readUInt16LE(offset+length-4),65535,'Learnset terminator '+entry.speciesID);levelupEntries++;
 }
 function teachingTree(value){
  if(!value||typeof value!=='object')return;
  if(value.sha256&&(value.offset!==undefined||value.start!==undefined)&&(value.length!==undefined||value.endExclusive!==undefined)){proof(value);teachingProofs++;}
  for(const child of Object.values(value))if(child&&typeof child==='object')teachingTree(child);
 }
 teachingTree(teaching.nativeTables.new);teachingTree(teaching.capabilityTableProof);
 for(const entry of Object.values(teaching.teachingMethods)){assert.ok(entry.capabilityProof,'Teaching proof '+entry.speciesID);teachingTree(entry.capabilityProof);}
 for(const item of items.items){
  assert.equal(Buffer.from(item.bytes,'hex').length,items.recordSize,'Native item width '+item.id);
  proof({offset:item.offset,length:items.recordSize,bytes:item.bytes});itemRecords++;
 }
 assert.ok(trainerRecords>1800&&aiBlocks>=11&&numericRecords>2000,'Native evidence coverage');
 assert.equal(levelupEntries,levelup.nativeSpeciesSlots);assert.ok(teachingProofs>1400&&itemRecords>800,'Native Pokédex evidence coverage');
 return {rechecked:true,romSHA256:release.romSHA256,trainerRecords,ownerHeaders,aiBlocks,numericRecords,levelupEntries,teachingProofs,itemRecords};
}

(async()=>{
 const checkedAt=new Date().toISOString(),checks=[],errors=[],details={};let browser,native;
 async function check(label,fn){try{const result=await fn();checks.push(label);if(result!==undefined)details[label]=result;}catch(error){errors.push(label+': '+(error.stack||error));}}
 try{
  await check('Pinned native trainer, AI, numeric, learnset, teaching and item evidence',()=>{native=checkNativeROM();return native;});
  browser=await chromium.launch({headless:true,executablePath:process.env.NULL_AI_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const context=await browser.newContext({viewport:{width:1440,height:1080}}),page=await context.newPage();
  page.on('pageerror',error=>errors.push('Browser: '+error.stack));
  await page.route(/^https?:\/\//,route=>route.abort());
  await page.goto(pathToFileURL(entry).href,{waitUntil:'load'});
  await page.waitForFunction(()=>window.NullPostKOUI&&NullPostKOUI.getLastResult()&&window.NullVersion126Trainers,{timeout:30000});
  const originalData=await page.evaluate(()=>JSON.stringify(SETDEX_SV));
  const select=async(id,singles=false)=>page.evaluate(({id,singles})=>{
   const boundary=id.indexOf(' ('),species=id.slice(0,boundary),key=id.slice(boundary+2,-1),set=SETDEX_SV[species]?.[key];
   // Use the app's selection path: navigation intentionally reads Select2's
   // displayed choice as well as the underlying value. A bare .val().change()
   // can leave the display stale and does not reproduce a user selection.
   if(set&&set.index!==undefined)selectTrainer(set.index);
   else {const input=$('#p2 .set-selector');input.val(id);if($.fn.select2)input.select2('val',id);input.trigger('change');}
   if(singles)$('#singles-format').prop('checked',true).trigger('change');
   performCalculations();
  },{id,singles});
  const partner=async(side,id)=>page.evaluate(({side,id})=>$('#null-double-'+side+' [data-double-field=setID]').val(id).trigger('change'),{side,id});
  const state=()=>page.evaluate(()=>{
   const current=NullDoubleUI.getState(),battle=current&&current.complete?current:NullMoveAIState.readBattleState(damageResults);
   return {complete:battle.complete,party:battle.party,post:NullPostKOUI.getLastResult()};
  });
  async function doubles(primary,other){
   await select(primary);
   await page.evaluate(()=>{$('#doubles-format').prop('checked',true).trigger('change');$('#null-double-enabled').prop('checked',true).trigger('change');$('#null-double-player-imported').prop('checked',false).trigger('change');$('#null-double-opponent-trainer-only').prop('checked',true).trigger('change');});
   await partner('player','Blastoise (Blank Set)');await partner('opponent',other);
   await page.evaluate(()=>performCalculations());
   assert.equal((await state()).complete,true,'Four active battlers must be configured');
  }
  async function markExactlyOne(firstID,secondID){
   const find=(s,id)=>s.party.candidates.find(c=>(c.aliases||[c.id]).includes(id));
   const before=await state(),a=find(before,firstID),b=find(before,secondID);
   assert.ok(a&&b&&a.id!==b.id,'Distinct logical roster slots');assert.equal(a.alive,true);assert.equal(b.alive,true);
   const row=page.locator('#null-post-ko-team .null-post-ko-row[data-id='+JSON.stringify(a.id)+']');
   assert.equal(await row.count(),1,'Exactly one KO control for first logical slot');
   await row.locator('button').click();
   try{const marked=await state();assert.equal(find(marked,firstID).alive,false);assert.equal(find(marked,secondID).alive,true,'KO must not mark the other individual');}
   finally{await row.locator('button').click();}
   const restored=await state();assert.equal(find(restored,firstID).alive,true);assert.equal(find(restored,secondID).alive,true);
   return {firstSlot:a.id,secondSlot:b.id};
  }

  await check('Version 1.2.6 appears in the title and game-data settings',async()=>{
   assert.match(await page.title(),/Null 1\.2\.6/);assert.match(await page.locator('.title-text').innerText(),/Null 1\.2\.6/);
   assert.match(await page.locator('#null-data-reference').innerText(),/1\.2\.6/);
   const version=await page.evaluate(()=>({trainer:NullVersion126Trainers.version,game:NullVerifiedData.gameVersion,fixture:NullVersion126Trainers.data.fixtureSHA256}));
   assert.equal(version.trainer,'1.2.6');assert.equal(version.game,'1.2.6');assert.equal(version.fixture,sha(fs.readFileSync(trainerFile)));return version;
  });
  await check('Every trainer patch and new native member reaches the browser dataset',async()=>{
   const failures=await page.evaluate(f=>{
    const failures=[];
    for(const p of f.patches)for(const [key,value]of Object.entries(p.changes))if(JSON.stringify(SETDEX_SV[p.species]?.[p.trainer]?.[key])!==JSON.stringify(value))failures.push(p.species+' / '+p.trainer+' / '+key);
    for(const p of f.additions)if(JSON.stringify(SETDEX_SV[p.species]?.[p.setKey])!==JSON.stringify(p.set))failures.push('Addition '+p.species+' / '+p.setKey);
    return failures;
   },trainers);assert.deepEqual(failures,[]);return {patches:trainers.patches.length,additions:trainers.additions.length};
  });
  await check('The two Lanturn remain separate partner choices and independent KO controls',async()=>{
   const t='Fisherman Elliot & Fisherman Ned',a='Lanturn ('+t+')',b='Lanturn ('+t+' [Slot 2])';
   await doubles('Seaking ('+t+')','Lapras ('+t+')');
   const choices=await page.locator('#null-double-opponent [data-double-field=setID] option').evaluateAll(options=>options.filter(o=>!o.hidden).map(o=>o.value));
   assert.ok(choices.includes(a)&&choices.includes(b),'Both native Lanturn must be offered');
   await partner('opponent',a);assert.equal(await page.locator('#null-double-opponent [data-double-field=setID]').inputValue(),a);
   await partner('opponent',b);assert.equal(await page.locator('#null-double-opponent [data-double-field=setID]').inputValue(),b);
   await partner('opponent','Lapras ('+t+')');return markExactlyOne(a,b);
  });
  await check('Mega Raichu X and Y remain separate partner choices and independent KO controls',async()=>{
   const t='Triathlete Benjamin & Triathlete Alyssa',a='Raichu-Mega-X ('+t+')',b='Raichu-Mega-Y ('+t+')';
   await doubles('Eiscue ('+t+')','Ninetales-Alola ('+t+')');
   const choices=await page.locator('#null-double-opponent [data-double-field=setID] option').evaluateAll(options=>options.filter(o=>!o.hidden).map(o=>o.value));
   assert.ok(choices.includes(a)&&choices.includes(b),'Both native Raichu individuals must be offered');
   await partner('opponent',a);assert.equal(await page.locator('#null-double-opponent [data-double-field=setID]').inputValue(),a);
   await partner('opponent',b);assert.equal(await page.locator('#null-double-opponent [data-double-field=setID]').inputValue(),b);
   await partner('opponent','Ninetales-Alola ('+t+')');return markExactlyOne(a,b);
  });
  await check('Both separate-trainer doubles restrict post-KO reserves to the native owner and translate the owner indicator',async()=>{
   assert.equal(trainers.ownerGroups.length,2,'Exactly the two native-confirmed owner groups');const results=[];
   for(const group of trainers.ownerGroups)for(const owner of group.owners){
    const other=group.owners.find(o=>o.id!==owner.id),primary=owner.slots[0].aliases[0],partnerID=other.slots[0].aliases[0];
    await doubles(primary,partnerID);const current=await state();
    assert.equal(current.party.owner.id,owner.id);assert.equal(current.party.owner.partyFirstIndex,owner.partyFirstIndex);assert.equal(current.party.owner.partyLastIndex,owner.partyLastIndex);
    assert.equal(current.post.reserveOwner,owner.name);
    const expected=owner.slots.slice(1).map(s=>s.id).sort();
    const actual=await page.evaluate(()=>NullPostKOUI.getLastResult().switch.candidates.map(c=>NullVersion126Trainers.slotForSet(c.id)?.id).sort());
    assert.deepEqual(actual,expected,owner.name+' may only use its own living reserves');
    const partnerSlot=current.post.candidates.find(c=>(c.aliases||[c.id]).includes(partnerID));assert.equal(partnerSlot.eligibility,'partner');
    for(const slot of other.slots.slice(1)){
     const c=current.post.candidates.find(c=>(c.aliases||[c.id]).some(id=>slot.aliases.includes(id)));
     assert.equal(c.eligibility,'reserved','Other trainer reserve must be excluded: '+slot.id);
    }
    for(const [language,prefix]of [['en','Reserves belong to: '],['fr','Réserves appartenant à : ']]){
     await page.evaluate(language=>NullAI18n.setLanguage(language),language);
     await page.waitForFunction(text=>document.querySelector('#null-post-ko-summary')?.textContent.includes(text),prefix+owner.name);
     assert.ok((await page.locator('#null-post-ko-summary').innerText()).includes(prefix+owner.name));
    }
    await page.evaluate(()=>NullAI18n.setLanguage('en'));results.push({trainer:group.trainer,owner:owner.name,bounds:[owner.partyFirstIndex,owner.partyLastIndex],eligibleSlots:actual});
   }return results;
  });
  await check('Regenor selects Doubles automatically and has six distinct logical members',async()=>{
   const trainer=trainers.newTrainer.name,first=trainers.additions.find(a=>a.trainer===trainer),id=first.species+' ('+first.setKey+')';
   await page.evaluate(()=>$('#singles-format').prop('checked',true).trigger('change'));
   await select(id);assert.equal(await page.locator('#doubles-format').isChecked(),true,'Set selection must invoke applyBattleSettings');
   const party=await page.evaluate(()=>NullMoveAIState.readBattleState(damageResults).party);
   assert.equal(party.trainerName,trainer);assert.equal(party.complete,true,party.assumptions.join('; '));assert.equal(party.candidates.length,6);assert.equal(new Set(party.candidates.map(c=>c.id)).size,6);
   return {trainer,members:party.candidates.map(c=>c.name)};
  });
  await check('Trainer navigation enters and leaves the new Regenor team',async()=>{
   const trainer=trainers.newTrainer.name;
   await select('Raichu-Mega-X ('+trainer+')');
   await page.locator('#next-trainer').click();
   let selected=await page.evaluate(()=>getTrainerNameFromSet($('#p2 .set-selector').val()));assert.equal(selected,trainers.newTrainer.insertBefore);
   await page.locator('#previous-trainer').click();selected=await page.evaluate(()=>getTrainerNameFromSet($('#p2 .set-selector').val()));assert.equal(selected,trainer);
   const previous=await page.evaluate(()=>NullVersion126Trainers.navigationSetFor($('#p2 .set-selector').val(),'previous'));
   assert.ok(previous);await select(previous);
   const beforeNext=await page.evaluate(()=>({id:$('#p2 .set-selector').val(),navigationChoice:getOpposingSetStringForTrainerNav()}));
   await page.locator('#next-trainer').click();
   const afterPrevious=await page.evaluate(()=>({id:$('#p2 .set-selector').val(),trainer:getTrainerNameFromSet($('#p2 .set-selector').val())}));
   details.navigationAttempt={previous,beforeNext,afterPrevious};assert.equal(afterPrevious.trainer,trainer);return {next:trainers.newTrainer.insertBefore,previous};
  });
  await check('All 348 historical trainer groups retain their navigation order around the Regenor insertion',async()=>{
   const baseline=legacyTrainerGroups();assert.equal(baseline.length,348,'Historical trainer group count');
   const expected=baseline.map(g=>g.trainer),insertion=expected.indexOf(trainers.newTrainer.insertBefore);assert.ok(insertion>=0);
   expected.splice(insertion,0,trainers.newTrainer.name);
   const actual=await page.evaluate(first=>{
    const api=NullVersion126Trainers,seen=new Set(),order=[],reverse=[];let id=first;
    while(id){
     const trainer=api.trainerForSet(id);if(seen.has(trainer))throw Error('Trainer navigation cycle: '+trainer);
     seen.add(trainer);order.push(trainer);const previous=api.navigationSetFor(id,'previous');reverse.push(previous?api.trainerForSet(previous):null);
     id=api.navigationSetFor(id,'next');if(order.length>400)throw Error('Unexpected trainer navigation size');
    }return {order,reverse};
   },baseline[0].rows[0].id);
   assert.deepEqual(actual.order,expected);assert.deepEqual(actual.reverse,[null,...expected.slice(0,-1)]);
   return {historicalGroups:baseline.length,currentGroups:actual.order.length,insertionBefore:trainers.newTrainer.insertBefore,orderSHA256:sha(Buffer.from(JSON.stringify(actual.order)))};
  });
  await check('Fennekin/Froakie rival teams and both Drake teams preserve the historical logical party order',async()=>{
   const groups=legacyTrainerGroups().filter(g=>/Rival (?:Fennekin|Froakie)$/.test(g.trainer)||/^Elite Four Drake (?:Singles|Doubles)$/.test(g.trainer));
   assert.equal(groups.length,10,'Eight rival teams and two Drake teams');const results=[];
   for(const group of groups){
    await select(group.rows[0].id,true);
    const actual=await page.evaluate(rows=>{
     const api=NullVersion126Trainers,expected=[];
     rows.forEach(row=>{const slot=api.slotForSet(row.id);if(!slot)throw Error('Unmapped historical row '+row.id);if(!expected.includes(slot.id))expected.push(slot.id);});
     const party=NullMoveAIState.readBattleState(damageResults).party;
     return {expected,actual:party.candidates.map(c=>{const slot=(c.aliases||[c.id]).map(id=>api.slotForSet(id)).find(Boolean);return slot&&slot.id;}),complete:party.complete,assumptions:party.assumptions};
    },group.rows);
    assert.equal(actual.complete,true,group.trainer+': '+actual.assumptions.join('; '));assert.deepEqual(actual.actual,actual.expected,group.trainer);
    results.push({trainer:group.trainer,slots:actual.actual});
   }return results;
  });
  await check('Reserve evaluation uses native base species and preserves four native Mega reserves',async()=>{
   const cases=[['Raichu-Mega-X',trainers.newTrainer.name,'Raichu'],['Zygarde-Mega','Adventurer Brandon 1','Zygarde'],
    ['Tyranitar-Mega','Team Aqua Grunt Steve 3','Tyranitar-Mega'],['Steelix-Mega','Team Aqua Grunt Steve 3','Steelix-Mega'],
    ['Garchomp-Mega','Team Aqua Grunt Steve 3','Garchomp-Mega'],['Salamence-Mega','Lorekeeper Zinnia','Salamence-Mega']],results=[];
   for(const [species,trainer,expected]of cases){
    const target=species+' ('+trainer+')';
    const active=await page.evaluate(({target,trainer})=>{
     const api=NullVersion126Trainers,slot=api.slotForSet(target);
     return api.data.slots.filter(s=>s.trainer===trainer&&s.id!==slot.id).flatMap(s=>s.aliases).find(id=>{
      const i=id.indexOf(' ('),name=id.slice(0,i),key=id.slice(i+2,-1);return SETDEX_SV[name]?.[key];
     });
    },{target,trainer});assert.ok(active,'Other active opponent for '+target);await select(active,true);
    const value=await page.evaluate(target=>{
     const slot=NullVersion126Trainers.slotForSet(target),party=NullMoveAIState.readBattleState(damageResults).party;
     const candidates=party.candidates.filter(c=>(c.aliases||[c.id]).includes(target));
     return {nativeSpecies:slot.native.species,complete:party.complete,assumptions:party.assumptions,candidates};
    },target);
    assert.equal(value.nativeSpecies,expected,target);assert.equal(value.complete,true,value.assumptions.join('; '));assert.equal(value.candidates.length,1,target);
    assert.equal(value.candidates[0].active,false);assert.equal(value.candidates[0].evaluationForm,expected,target);results.push({target,evaluationForm:value.candidates[0].evaluationForm});
   }return results;
  });
  await check('The embedded Pokédex uses ROM 1.2.6 species, moves, learnsets and encounters',async()=>{
   const iframe=page.frameLocator('#porydex-frame');await iframe.locator('body').waitFor({state:'attached'});
   const element=await page.locator('#porydex-frame').elementHandle(),frame=await element.contentFrame();
   await frame.waitForFunction(()=>window.NullDexAppliedVersion==='1.2.6',{timeout:30000});
   const values=await frame.evaluate(()=>({version:NullDexAppliedVersion,slowking:BattlePokedex.slowking.abilities,
    hurricaneWind:BattleMovedex.hurricane.flags.wind,delphox:BattleLearnsets.delphox.learnset,
    route119:BattleLocationdex.route119,magma:BattleLocationdex.magmahideout1f,statics:NullDexStaticPools}));
   assert.equal(values.version,'1.2.6');assert.equal(values.slowking[0],'Regenerator');assert.ok(values.hurricaneWind);
   assert.ok(values.delphox.powergem.includes('L68'));assert.ok(!values.delphox.psystrike?.includes('L68'),'Delphox learns Power Gem at68; Psystrike is taught by Scale');
   assert.ok(values.delphox.psystrike?.length,'Delphox Psystrike teaching fix must be present');
   assert.deepEqual(values.route119.land.encs.slice(8).map(c=>c.species),['castform','tapukoko','tapubulu','tapubulu']);
   assert.deepEqual(values.route119.fish.encs.map(c=>c.species),['quaquaval','samurotthisui','samurott','tentacruel','goomy','dragonair']);
   assert.deepEqual([values.route119.fish.encs[0].minLvl,values.route119.fish.encs[0].maxLvl],[50,50]);
   assert.equal(values.magma.land.encs[1].species,'runerigus');assert.equal(values.magma.land.encs[11].species,'heatran');
   assert.ok(values.statics.some(p=>p.area==='route111'&&p.encs.some(c=>c.species==='orthworm')));
   return {version:values.version,slowking:values.slowking,hurricaneWind:values.hurricaneWind,delphox:{powergem:values.delphox.powergem,psystrike:values.delphox.psystrike},route119Land:values.route119.land.encs.slice(8),magmaLast:values.magma.land.encs[11]};
  });
  await check('Visible Pokédex panels render current abilities, native details, special tutors and level-up moves',async()=>{
   await page.locator('#header-dex-button').click();assert.equal(await page.locator('#porydex-frame').isVisible(),true);
   const frame=await (await page.locator('#porydex-frame').elementHandle()).contentFrame();
   async function searchPokemon(query,id){
    const input=frame.locator('input.searchbox:visible').first();await input.fill(query);await input.press('End');
    await frame.locator('.results .result a[href$="pokemon/'+id+'"]').first().click();
    const panel=frame.locator('.dexentry').filter({has:frame.locator('h1 a[href$="pokemon/'+id+'"]')}).last();
    await panel.waitFor({state:'visible'});return panel;
   }
   const slowking=await searchPokemon('Slowking','slowking');
   assert.match(await slowking.locator('.abilityentry').innerText(),/Regenerator/);
   const nativeDetails=await slowking.locator('.null-native-details').innerText();
   assert.match(nativeDetails,/Catch rate:/);assert.match(nativeDetails,new RegExp('\\b'+numeric.species.Slowking.catchRate+'\\b'));
   assert.match(nativeDetails,/Wild held items:/);assert.match(nativeDetails,/None/);
   const delphox=await searchPokemon('Delphox','delphox');await delphox.locator('.tabbar button[value=move]').click();
   await delphox.locator('.null-tutor-details').waitFor();const tutorNote=await delphox.locator('.null-tutor-details').innerText();assert.match(tutorNote,/Psystrike.*Starter Tutor/);
   const psystrikeRows=await delphox.locator('.utilichart a[href$="moves/psystrike"]').evaluateAll(links=>links.map(link=>link.closest('li').textContent));
   assert.ok(psystrikeRows.length>0,'Psystrike is visible in the rendered full moves list');assert.ok(psystrikeRows.every(text=>!/L\s*68/.test(text)),'Psystrike must not be displayed as level68');
   const kingdra=await searchPokemon('Kingdra','kingdra');await kingdra.locator('.tabbar button[value=move]').click();
   const icyWind=kingdra.locator('.utilichart a[href$="moves/icywind"]').first();await icyWind.waitFor();
   const prevo=await icyWind.evaluate(link=>{const row=link.closest('li');let header=row.previousElementSibling;while(header&&!header.querySelector('h3'))header=header.previousElementSibling;return {row:row.textContent,section:header&&header.textContent};});
   assert.ok(levelup.entries.find(e=>e.speciesID===230).moves.some(m=>m.id===196&&m.level===47),'Native Kingdra learns Icy Wind directly at47');
   assert.match(prevo.row,/L\s*47/);assert.equal(prevo.section.trim(),'Level-up');
   const forms=await frame.evaluate(()=>({blade:Dex.species.get('Aegislash-Blade').baseStats,shield:Dex.species.get('Aegislash-Shield').baseStats}));
   assert.equal(forms.blade.atk,140);assert.equal(forms.shield.def,140);
   await page.locator('#header-calc-button').click();return {slowking:nativeDetails,tutorNote,psystrikeRows,kingdraIcyWind:prevo,aegislash:{bladeAttack:forms.blade.atk,shieldDefense:forms.shield.def}};
  });
  await check('Browsing, form evaluation and KO toggles leave trainer data intact',async()=>assert.equal(await page.evaluate(()=>JSON.stringify(SETDEX_SV)),originalData));
 }catch(error){errors.push(error.stack||String(error));}
 finally{
  if(browser)await browser.close();
  const report={revision:release.revision,checkedAt,entry,htmlSHA256:fs.existsSync(entry)?sha(fs.readFileSync(entry)):null,
   fixtureSHA256:{trainers:sha(fs.readFileSync(trainerFile)),numeric:sha(fs.readFileSync(numericFile)),ai:sha(fs.readFileSync(aiFile)),levelup:sha(fs.readFileSync(levelupFile)),teaching:sha(fs.readFileSync(teachingFile)),items:sha(fs.readFileSync(itemsFile))},native,checks,details,errors};
  fs.mkdirSync(path.join(root,'verification'),{recursive:true});fs.writeFileSync(path.join(root,'verification/update126-browser.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({checks:checks.length,native,errors},null,2));if(errors.length)process.exitCode=1;
 }
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
