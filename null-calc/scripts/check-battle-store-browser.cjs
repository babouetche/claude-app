'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.NULL_AI_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),entry=path.resolve(process.env.NULL_CALC_ENTRY||path.join(root,'CALCULATEUR.html'));
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.NULL_AI_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe'}),errors=[],checks=[];
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1080}});page.on('pageerror',e=>errors.push(e.stack));await page.route(/^https?:\/\//,r=>r.abort());
  await page.goto(pathToFileURL(entry).href,{waitUntil:'load'});await page.waitForFunction(()=>window.NullBattleStore&&window.NullMoveAIUI&&NullMoveAIUI.getLastResult());
  const trainers=await page.evaluate(()=>JSON.stringify(SETDEX_SV));
  await page.evaluate(()=>{
   $('#p1 .set-selector').val('Electabuzz (Blank Set)').trigger('change');$('#p1 .level').val(38).trigger('change');$('#p1 .ability').val('Vital Spirit').trigger('change');$('#p1 .nature').val('Quirky').trigger('change');$('#p1 .item').val('').trigger('change');
   Object.entries({hp:17,at:17,df:22,sa:20,sd:31,sp:19}).forEach(([k,v])=>{$('#p1 .'+k+' .ivs').val(v).trigger('change');$('#p1 .'+k+' .evs').val(0).trigger('change');});
   ['Discharge','Thunder Punch','Low Kick','Thunder Wave'].forEach((name,i)=>$('#p1 .move'+(i+1)+' .move-selector').val(name).trigger('change'));
   $('#p2 .set-selector').val('Vivillon (Bug Catcher Kenobi)').trigger('change');$('#p1 .percent-hp,#p2 .percent-hp').val(100).trigger('change');performCalculations();
  });
  const measurements=await page.evaluate(()=>{
   const api=NullBattleStore,read=()=>NullMoveAIState.readBattleState(damageResults),serialize=s=>JSON.stringify(s);
   api.invalidate();api.stats(true);let start=performance.now();const cold=read(),coldMs=performance.now()-start,coldStats=api.stats(true);
   start=performance.now();let warm;for(let i=0;i<10;i++)warm=read();const warmMs=performance.now()-start,warmStats=api.stats(true);
   const memo=api.memo;api.memo=(_ns,_input,compute)=>compute();let uncached,uncachedMs;
   try{start=performance.now();for(let i=0;i<10;i++)uncached=read();uncachedMs=performance.now()-start;}finally{api.memo=memo;}
   return {coldMs,warmMs,uncachedMs,coldStats,warmStats,equal:serialize(cold)===serialize(warm)&&serialize(warm)===serialize(uncached),party:uncached.party.candidates.map(c=>c.name)};
  });
  assert.equal(measurements.equal,true);assert.ok(measurements.coldStats.misses>0);assert.ok(measurements.coldStats.engineCalls>0);assert.equal(measurements.warmStats.misses,0);assert.equal(measurements.warmStats.engineCalls,0);assert.ok(measurements.warmStats.hits>0);assert.ok(measurements.warmStats.size<=measurements.warmStats.limit);
  checks.push('Kenobi: cold, 10 warm and 10 uncached real-engine adapter states are exactly equal. The bounded whole-state cache avoids repeated party reconstruction and damage calls; elapsed timings are recorded, not treated as a universal speed guarantee.');
  const changes=[
   ['current HP',()=>$('#p1 .current-hp').val(70).trigger('change')],['opponent HP',()=>$('#p2 .current-hp').val(50).trigger('change')],
   ['stat stage',()=>$('#p1 .at .boost').val('1').trigger('change')],['held item',()=>$('#p1 .item').val('Choice Specs').trigger('change')],
   ['ability',()=>$('#p1 .ability').val('Static').trigger('change')],['move power',()=>$('#p1 .move1 .move-bp').val(100).trigger('change')],
   ['weather',()=>$('#rain').prop('checked',true).trigger('change')],['Trick Room',()=>$('#trickroom').prop('checked',true).trigger('change')],
   ['PP',()=>$('#null-ai-pp-1').val(0).trigger('change')],['faint history',()=>$('#null-ai-faint-count').val(2).trigger('change')],
   ['reserve HP',()=>$('.null-ai-party-row').eq(1).find('.null-ai-party-hp').val(25).trigger('change')]
  ];
  const invalidations=[];
  for(const [name,action]of changes){
   await page.evaluate(action);await page.evaluate(()=>NullMoveAIUI.refresh());
   const compare=await page.evaluate(()=>{
    const api=NullBattleStore,first=NullMoveAIState.readBattleState(damageResults),memo=api.memo;api.memo=(_ns,_input,compute)=>compute();let second;
    try{second=NullMoveAIState.readBattleState(damageResults);}finally{api.memo=memo;}
    return JSON.stringify(first)===JSON.stringify(second);
   });assert.equal(compare,true,name);invalidations.push(name);
  }
  checks.push('Every sampled HP/stat/item/ability/power/field/PP/faint/reserve input agrees with a fresh uncached engine read.');
  const coalescing=await page.evaluate(async()=>{NullBattleStore.stats(true);$('#null-ai-mode').trigger('input').trigger('change');await Promise.resolve();return NullBattleStore.stats();});
  assert.equal(coalescing.scheduled,2);assert.equal(coalescing.coalesced,1);
  checks.push('A same-event-loop input/change burst requests two refreshes and executes one; explicit synchronous refresh calls remain synchronous.');
  await page.evaluate(()=>{$('#trickroom').prop('checked',false).trigger('change');$('#null-ai-faint-count,#null-ai-pp-1').val('');NullMoveAIUI.refresh();$('#null-ai-player-action').val('switch-in').trigger('change');NullMoveAIUI.refresh();});
  const frozen=await page.evaluate(()=>JSON.stringify(NullMoveAIUI.getLastResult()));
  await page.evaluate(()=>$('#p1 .set-selector').val('Golem (Blank Set)').trigger('change'));
  assert.equal(await page.evaluate(()=>JSON.stringify(NullMoveAIUI.getLastResult())),frozen);
  await page.evaluate(()=>{$('#null-ai-player-action').val('stay').trigger('change');NullMoveAIUI.refresh();$('#doubles-format').prop('checked',true).trigger('change');});
  await page.evaluate(()=>{$('#null-double-player [data-double-field=setID]').val('Blastoise (Blank Set)').trigger('change');$('#null-double-opponent [data-double-field=setID]').val('Dipplin (Bug Catcher Kenobi)').trigger('change');NullMoveAIUI.refresh();});
  assert.equal(await page.evaluate(()=>NullDoubleUI.getState().complete),true);
  const doubleBaseline=await page.evaluate(()=>{const state=NullDoubleUI.getState();return {prediction:NullDoubleUI.getPrediction(),ally:state.matchups.map(p=>p.ally),hp:state.players.map(p=>p.hp)};});
  await page.evaluate(()=>{$('#null-ai-player-action').val('switch-in').trigger('change');NullMoveAIUI.refresh();});
  const doubleFrozen=await page.evaluate(()=>NullDoubleUI.getPrediction());await page.evaluate(()=>$('#p1 .set-selector').val('Pikachu (Blank Set)').trigger('change'));
  assert.deepEqual(await page.evaluate(()=>NullDoubleUI.getPrediction()),doubleFrozen);assert.ok(doubleBaseline.ally.every(p=>p.opponent.moves.length===4));
  await page.evaluate(()=>{$('#null-ai-player-action').val('stay').trigger('change');NullMoveAIUI.refresh();$('#null-double-context [data-double-field=opponentSlot]').val('1').trigger('change');NullMoveAIUI.refresh();});
  assert.equal(await page.evaluate(()=>NullDoubleUI.getState().selectedOpponent),1);
  await page.evaluate(()=>{$('#null-double-opponent [data-double-field=hp]').val(0).trigger('change');NullMoveAIUI.refresh();});
  assert.equal(await page.evaluate(()=>NullDoubleUI.getState().opponents[0].hp),0);
  const doubleCache=await page.evaluate(()=>{
   const api=NullBattleStore,serialize=s=>JSON.stringify({s,ally:s.matchups.map(p=>p.ally)});
   // The UI's public fresh state is used to verify cloning retains the graph
   // that the doubles predictor consumes, including array-owned ally matchups.
   const original=NullDoubleUI.getState(),copy=api.clone(original);return {equal:serialize(copy)===serialize(original),size:api.stats().size,limit:api.stats().limit};
  });assert.equal(doubleCache.equal,true);assert.ok(doubleCache.size<=doubleCache.limit);
  checks.push('Singles and four-battler frozen references survive player changes, preserve ally matchups and use the common clone/lifecycle. Opponent slot changes and a partner at zero HP remain live.');
  // Isolated fixture: original trainer data is restored below. Capture the
  // actual state passed to the switch API to inspect the frozen reference,
  // which intentionally differs from the currently displayed damage battle.
  await page.evaluate(()=>{
   window.battleStoreSashBackup=SETDEX_SV.Watchog['Bug Catcher Kenobi'].item;window.battleStoreMovesBackup=SETDEX_SV.Watchog['Bug Catcher Kenobi'].moves;
   SETDEX_SV.Watchog['Bug Catcher Kenobi'].item='Focus Sash';SETDEX_SV.Watchog['Bug Catcher Kenobi'].moves=['Water Spout','Eruption','Flail','Reversal'];
   window.battleStoreOriginalSwitch=NullSwitchAI.getSwitchProbabilities;
   NullSwitchAI.getSwitchProbabilities=function(s){if(s&&s.context&&s.context.playerAction==='switch-in')window.battleStoreCapturedSwitch=s;return battleStoreOriginalSwitch.apply(this,arguments);};
  });
  for(const format of ['singles','doubles']){
   await page.evaluate(format=>{
    $('#null-ai-player-action').val('stay');$('#magicroom').prop('checked',false).trigger('change');$('#'+format+'-format').prop('checked',true).trigger('change');
    $('#p1 .set-selector').val('Pikachu (Blank Set)').trigger('change');$('#none').prop('checked',true).trigger('change');
    if(format==='doubles')$('#null-double-context [data-double-field=opponentSlot]').val('0').trigger('change');
    NullMoveAIUI.refresh();
   },format);
   const expected={};
   for(const hp of [50,100])expected[hp]=await page.evaluate(({hp,format})=>{
    const row=$('.null-ai-party-row').filter(function(){return $(this).attr('data-id')==='Watchog (Bug Catcher Kenobi)';});row.find('.null-ai-party-hp').val(100).trigger('change');
    row.find('.null-ai-party-hp').val(hp).trigger('change');NullMoveAIUI.refresh();
    const state=format==='doubles'?NullDoubleUI.getState():NullMoveAIState.readBattleState(damageResults,{party:{'Watchog (Bug Catcher Kenobi)':{hpPercent:hp,alive:true}}});
    const c=state.party.candidates.find(c=>c.name==='Watchog');return {outgoing:c.moves.map(m=>m.damage),incoming:c.incomingMoves.map(m=>m.damage)};
   },{hp,format});
   await page.evaluate(()=>{
    $('#null-ai-player-action').val('switch-in').trigger('change');NullMoveAIUI.refresh();$('#p1 .set-selector').val('Golem (Blank Set)').trigger('change');
    $('#sun').prop('checked',true).trigger('change');$('#magicroom').prop('checked',true).trigger('change');NullMoveAIUI.refresh();
   });
   for(const hp of [50,100]){
    const captured=await page.evaluate(hp=>{
     $('.null-ai-party-row').filter(function(){return $(this).attr('data-id')==='Watchog (Bug Catcher Kenobi)';}).find('.null-ai-party-hp').val(hp).trigger('change');NullMoveAIUI.refresh();
     const s=battleStoreCapturedSwitch,c=s.party.candidates.find(c=>c.name==='Watchog');return {hp:c.hp,maxHP:c.maxHP,flag:c.nativeSashSturdyProtected,field:s.field.magicRoom,action:$('#null-ai-player-action').val(),outgoing:c.moves.map(m=>m.damage),incoming:c.incomingMoves.map(m=>m.damage)};
    },hp);
    assert.equal(captured.action,'switch-in',format);assert.equal(captured.flag,hp===100,format+' Sash '+hp);assert.equal(captured.field,false);
    assert.equal(captured.hp,Math.floor(captured.maxHP*hp/100),format+' uses the same floor rule as the live party');
    assert.deepEqual(captured.outgoing,expected[hp].outgoing,format+' conditional outgoing '+hp);assert.deepEqual(captured.incoming,expected[hp].incoming,format+' original target incoming '+hp);
   }
   const frozenField=await page.evaluate(()=>{
    $('#magicroom').prop('checked',true).trigger('change');NullMoveAIUI.refresh();const s=battleStoreCapturedSwitch,c=s.party.candidates.find(c=>c.name==='Watchog');
    return {flag:c.nativeSashSturdyProtected,memorizedRoom:s.field.magicRoom,displayedRoom:createField().isMagicRoom};
   });
   assert.deepEqual(frozenField,{flag:true,memorizedRoom:false,displayedRoom:true},format+' uses the memorized field');
  }
  await page.evaluate(()=>{
   $('#null-ai-player-action').val('stay');$('#magicroom').prop('checked',false).trigger('change');
   if(battleStoreSashBackup===undefined)delete SETDEX_SV.Watchog['Bug Catcher Kenobi'].item;else SETDEX_SV.Watchog['Bug Catcher Kenobi'].item=battleStoreSashBackup;
   SETDEX_SV.Watchog['Bug Catcher Kenobi'].moves=battleStoreMovesBackup;
   NullSwitchAI.getSwitchProbabilities=battleStoreOriginalSwitch;delete window.battleStoreSashBackup;delete window.battleStoreMovesBackup;delete window.battleStoreOriginalSwitch;delete window.battleStoreCapturedSwitch;NullMoveAIUI.refresh();
  });
  checks.push('Frozen Singles and Doubles references rebuild Water Spout/Eruption/Flail/Reversal and Focus Sash across reserve HP 100% → 50% → 100%, against the original player and field after the displayed Pokémon, weather and Magic Room change. Original trainer data is restored.');
  assert.equal(await page.evaluate(()=>JSON.stringify(SETDEX_SV)),trainers);assert.deepEqual(errors,[]);
  const report={revision:'battle-store',checkedAt:new Date().toISOString(),entry,htmlSHA256:sha(fs.readFileSync(entry)),trainerDataSHA256:sha(trainers),measurements,invalidations,coalescing,checks,errors};
  fs.writeFileSync(path.join(root,'verification/battle-store-browser.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
