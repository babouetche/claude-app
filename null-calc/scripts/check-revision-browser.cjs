'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.NULL_AI_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const artifacts = path.join(root, 'verification');
async function select(page, side, name) {
    await page.evaluate(({side,name}) => $('#' + side + ' .set-selector').val(name).trigger('change'), {side,name});
}
async function configure(page, moveNames) {
    await select(page, 'p1', 'Wailord (Blank Set)');
    await select(page, 'p2', 'Pikachu (Blank Set)');
    await page.evaluate(moveNames => {
        $('#p1 .level, #p2 .level').val(50).trigger('change');
        $('#p1 .ability, #p2 .ability, #p1 .item, #p2 .item').val('').trigger('change');
        $('#p1 .status, #p2 .status').val('Healthy').trigger('change');
        for (let i=1; i<=4; i++) {
            $('#p1 .move'+i+' .move-selector').val(i===1?'Surf':'(No Move)').trigger('change');
            $('#p2 .move'+i+' .move-selector').val(moveNames[i-1]).trigger('change');
        }
        $('#p1 .percent-hp, #p2 .percent-hp').val(100).trigger('change');
        performCalculations();
    }, moveNames);
}
async function output(page) { return page.evaluate(() => NullMoveAIUI.getLastResult()); }
async function numeric(page) {
    const result = await output(page);
    assert.ok(result.moves.every(m => typeof m.probability === 'number'), JSON.stringify(result));
    const sum = result.moves.reduce((s,m) => s+m.probability,0);
    assert.ok(Math.abs(sum-1)<1e-10, JSON.stringify(result));
    return result;
}
(async () => {
    fs.mkdirSync(artifacts,{recursive:true});
    const browser = await chromium.launch({headless:true,executablePath: process.env.NULL_AI_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
    try {
        const context = await browser.newContext({viewport:{width:1440,height:1000}});
        const page = await context.newPage();
        const errors=[];
        page.on('pageerror', e=>errors.push(e.message));
        const remoteRequests=[];
        await page.route(/^https?:\/\//, route=>{remoteRequests.push(route.request().url());return route.abort();});
        await page.goto(pathToFileURL(process.env.NULL_CALC_ENTRY || path.join(root,'CALCULATEUR.html')).href,{waitUntil:'load'});
        await page.waitForFunction(()=>window.NullMoveAIUI && NullMoveAIUI.getLastResult());
        assert.equal(await page.locator('#null-ai-language').inputValue(),'en');
        assert.equal(await page.locator('#null-ai-context > summary').innerText(),'AI: probabilities, switching and battle state');
        await configure(page,['Thunderbolt','Ice Beam','Stealth Rock','(No Move)']);
        const rock = await numeric(page);
        console.log('Screenshot example now numeric:',JSON.stringify(rock.moves.map(m=>({move:m.move,p:m.probability}))));
        const before = await page.evaluate(()=>damageResults.map(side=>side.map(r=>r.damage)));
        await page.evaluate(()=>NullMoveAIUI.refresh());
        assert.deepEqual(await page.evaluate(()=>damageResults.map(side=>side.map(r=>r.damage))),before);
        await page.screenshot({path:path.join(artifacts,'calculator-desktop.png'),fullPage:true});
        await configure(page,['Thunderbolt','Ice Beam','Thunder Wave','(No Move)']);
        const classic = await numeric(page);
        assert.ok(Math.abs(classic.moves[0].probability-0.25)<1e-10);
        assert.ok(Math.abs(classic.moves[2].probability-0.75)<1e-10);
        const baseline = await browser.newPage({viewport:{width:1440,height:1000}});
        baseline.on('pageerror',e=>errors.push('baseline: '+e.message));
        await baseline.addInitScript(()=>Object.defineProperty(window,'NullMoveAIUI',{configurable:true,get(){return {refresh(){}}},set(){}}));
        await baseline.route(/^https?:\/\//,r=>r.abort());
        await baseline.goto(pathToFileURL(path.join(root,'CALCULATEUR.html')).href,{waitUntil:'load'});
        await configure(baseline,['Thunderbolt','Ice Beam','Thunder Wave','(No Move)']);
        const displayedDamage = p=>p.evaluate(()=>({raw:damageResults.map(side=>side.map(r=>r.damage)),text:['L','R'].flatMap(side=>[1,2,3,4].map(i=>$('#resultDamage'+side+i).text()))}));
        assert.deepEqual(await displayedDamage(page),await displayedDamage(baseline));
        const changes=[
            ()=>$('#p1 .percent-hp').val(20).trigger('keyup'),
            ()=>$('#p1 .item').val('Assault Vest').trigger('change'),
            ()=>$('#p1 .sa .boost').val(2).trigger('change'),
            ()=>$('#p1 .status').val('Paralyzed').trigger('change'),
            ()=>$('#rain').prop('checked',true).trigger('change'),
            ()=>$('#critR1').prop('checked',true).trigger('change')
        ];
        for(const change of changes){await page.evaluate(change);await baseline.evaluate(change);assert.deepEqual(await displayedDamage(page),await displayedDamage(baseline));}
        await baseline.close();
        await page.evaluate(()=>{$('#critR1').prop('checked',false).trigger('change');$('#p1 .sa .boost').val(0).trigger('change');$('input[name=weather][value=""]').prop('checked',true).trigger('change');});
        await configure(page,['Thunderbolt','Ice Beam','Thunder Wave','(No Move)']);
        await page.evaluate(()=>$('#srL').prop('checked',true).trigger('change'));
        await configure(page,['Thunderbolt','Ice Beam','Protect','(No Move)']);
        await numeric(page);
        await select(page,'p2','Oshawott (Route 103 Rival)');
        const party = await page.evaluate(()=>NullMoveAIState.readBattleState(damageResults,{context:{playerConfused:false,playerInfatuated:false}}).party);
        assert.equal(party.complete,true,JSON.stringify(party));
        assert.ok(party.candidates.length>1,JSON.stringify(party));
        assert.equal(party.candidates.filter(c=>c.active).length,1,JSON.stringify(party));
        assert.ok(party.candidates.every(c=>c.moves.every(m=>Array.isArray(m.damage))),JSON.stringify(party));
        console.log('Trainer party:',party.candidates.map(c=>c.name).join(', '));
        await page.locator('#null-ai-context summary').first().click();
        await page.selectOption('#null-ai-switch-scenario','guaranteed');
        let scenario = await output(page);
        assert.equal(scenario.switch.probability,1);
        assert.ok(scenario.moves.every(m=>m.probability===0));
        let destination = await page.locator('#null-ai-switch-destination').innerText();
        assert.ok(destination.includes('Litten') && destination.includes('Route 103 Rival'),destination);
        await page.evaluate(()=>$('#null-ai-context').prop('open',false));
        assert.equal(await page.locator('#null-ai-switch-destination').isVisible(),true);
        await page.evaluate(()=>$('#null-ai-context').prop('open',true));
        await page.selectOption('#null-ai-switch-scenario','probably');
        await page.locator('#null-ai-switch-percent').fill('65');
        scenario = await output(page);
        assert.equal(scenario.switch.probability,0.65);
        assert.ok(Math.abs(scenario.moves.reduce((s,m)=>s+m.probability,0)-0.35)<1e-10,JSON.stringify(scenario));
        destination=await page.locator('#null-ai-switch-destination').innerText();
        assert.ok(destination.includes('if switching'),destination);
        await page.selectOption('#null-ai-switch-scenario','no-switch');
        await numeric(page);
        // Take the AI decision against the current player before switching the
        // displayed defender; incoming damage changes, choice distribution stays.
        const stay = await output(page);
        const damageBeforeSwitch = await page.evaluate(()=>damageResults[1].map(r=>r.damage));
        await page.selectOption('#null-ai-player-action','switch-in');
        await select(page,'p1','Golem (Blank Set)');
        assert.deepEqual((await output(page)).moves.map(m=>m.probability),stay.moves.map(m=>m.probability));
        assert.notDeepEqual(await page.evaluate(()=>damageResults[1].map(r=>r.damage)),damageBeforeSwitch);
        // Language changes translate existing nodes without rebuilding battle state,
        // checkbox children, reserve HP, expanded sections or the remembered player.
        await page.evaluate(()=>{
            $('#null-ai-pp-1').val(7).trigger('change');
            $('#null-ai-party .null-ai-party-row[data-active="false"] .null-ai-party-hp').first().val(42).trigger('change');
            $('#null-ai-context .null-ai-subsection').eq(2).prop('open',true);
        });
        const languageSnapshot = () => page.evaluate(()=>({
            result:NullMoveAIUI.getLastResult(), damage:damageResults.map(side=>side.map(r=>r.damage)),
            controls:$('#null-ai-context input, #null-ai-context select').map(function(){return {id:this.id,value:this.value,checked:this.checked,disabled:this.disabled};}).get(),
            sections:$('#null-ai-context, #null-ai-context details').map(function(){return this.open;}).get()
        }));
        const beforeLanguage = await languageSnapshot();
        await page.locator('#app-menu-toggle').click();
        await page.selectOption('#null-ai-language','fr');
        assert.equal(await page.locator('#null-ai-context > summary').innerText(),'IA : probabilités, switch et état du combat');
        assert.ok((await page.locator('#null-ai-switch-into-note').innerText()).startsWith('Pokémon actif mémorisé : Wailord'));
        assert.ok((await page.locator('#null-ai-switch-destination').innerText()).includes('Aucun switch prévu.'));
        assert.deepEqual(await languageSnapshot(),beforeLanguage);
        await page.screenshot({path:path.join(artifacts,'language-french.png'),fullPage:true});
        const persisted = await page.context().newPage();
        await persisted.route(/^https?:\/\//,route=>route.abort());
        await persisted.goto(pathToFileURL(path.join(root,'CALCULATEUR.html')).href,{waitUntil:'load'});
        await persisted.waitForFunction(()=>window.NullMoveAIUI && NullMoveAIUI.getLastResult());
        assert.equal(await persisted.locator('#null-ai-language').inputValue(),'fr');
        assert.equal(await persisted.locator('#null-ai-context > summary').innerText(),'IA : probabilités, switch et état du combat');
        await persisted.close();
        await page.selectOption('#null-ai-language','en');
        assert.deepEqual(await languageSnapshot(),beforeLanguage);
        assert.ok((await page.locator('#null-ai-switch-into-note').innerText()).startsWith('Remembered active Pokémon: Wailord'));
        assert.equal(await page.locator('#null-ai-switch-destination').innerText(),'No switch expected.');
        await page.locator('#app-menu-toggle').click();
        // Refresh after a language round trip must continue to use English.
        await page.evaluate(()=>NullMoveAIUI.refresh());
        assert.equal(await page.locator('#null-ai-context > summary').innerText(),'AI: probabilities, switching and battle state');
        assert.deepEqual((await output(page)).moves.map(m=>m.probability),beforeLanguage.result.moves.map(m=>m.probability));
        await page.evaluate(()=>$('#null-ai-pp-1').val('').trigger('change'));
        await page.selectOption('#null-ai-player-action','stay');
        await page.selectOption('#null-ai-switch-scenario','guaranteed');
        await page.evaluate(()=>{
            $('#null-ai-party .null-ai-party-row[data-active="false"] .null-ai-party-alive').prop('checked',false).trigger('change');
        });
        scenario = await output(page);
        assert.equal(scenario.switch.probability,0);
        assert.ok((await page.locator('#null-ai-switch-destination').innerText()).includes('No switch'));
        await page.selectOption('#null-ai-switch-scenario','auto');
        await page.evaluate(()=>{
            $('#null-ai-party .null-ai-party-row[data-active="false"] .null-ai-party-alive').prop('checked',true).trigger('change');
        });
        await page.selectOption('#null-ai-mode','strict');
        assert.equal((await output(page)).calculationMode,'strict');
        await page.selectOption('#null-ai-mode','estimate');
        await page.evaluate(()=>$('#null-ai-trick-room').closest('details').prop('open',true));
        await page.locator('#null-ai-trick-room').check();
        assert.equal(await page.evaluate(()=>NullMoveAIState.readBattleState(damageResults,{context:{}}).field.trickRoom),true);
        await page.locator('#null-ai-trick-room').uncheck();
        await page.evaluate(()=>$('#p2 .current-hp').val(6).trigger('keyup'));
        await select(page,'p2','Litten (Route 103 Rival)');
        const storedHP = await page.evaluate(()=>{
            NullMoveAIUI.refresh();
            const row=$('#null-ai-party .null-ai-party-row').filter(function(){return $(this).attr('data-id')==='Oshawott (Route 103 Rival)';});
            const input=row.find('.null-ai-party-hp');
            return {actual:Number(input.attr('data-actual-hp')),display:Number(input.val())};
        });
        assert.equal(storedHP.actual,6);
        assert.ok(storedHP.display>0 && storedHP.display<25,JSON.stringify(storedHP));
        await page.screenshot({path:path.join(artifacts,'switch-desktop.png'),fullPage:true});
        await page.locator('#app-menu-toggle').click();
        await page.screenshot({path:path.join(artifacts,'language-english.png'),fullPage:true});
        await page.locator('#app-menu-toggle').click();
        await page.setViewportSize({width:390,height:844});
        await configure(page,['Thunderbolt','Ice Beam','Stealth Rock','(No Move)']);
        await numeric(page);
        await page.screenshot({path:path.join(artifacts,'calculator-mobile.png'),fullPage:true});
        const labelBounds = await page.locator('.null-ai-probability').evaluateAll(nodes=>nodes.map(n=>{let r=n.getBoundingClientRect();return {x:r.x,width:r.width};}));
        assert.ok(labelBounds.every(b=>b.x>=0 && b.x+b.width<=390),JSON.stringify(labelBounds));
        assert.deepEqual(errors,[],errors.join('\n'));
        fs.writeFileSync(path.join(artifacts,'browser-results.json'),JSON.stringify({fileProtocol:true,offline:true,errors,remoteRequests,example:rock,classic,trainerParty:party},null,2));
        console.log('PASS file:// HTML entry, offline, numeric screenshot, classic 25/75, trainer party, forced/probable switches, KO reserves, Switch into snapshot, strict/estimate, Trick Room, English/French settings and persistence without resets, desktop/mobile, no JS errors.');
    } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
