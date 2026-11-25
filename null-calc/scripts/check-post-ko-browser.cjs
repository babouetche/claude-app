'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {pathToFileURL} = require('node:url');
const {chromium} = require(process.env.NULL_AI_PLAYWRIGHT_MODULE || 'playwright');
const crypto = require('node:crypto');
const root = path.resolve(__dirname,'..');
const entry = path.resolve(process.env.NULL_CALC_ENTRY || path.join(root,'CALCULATEUR.html'));
const artifacts = path.join(root,'verification');
async function select(page,side,set) { await page.evaluate(({side,set}) => $('#'+side+' .set-selector').val(set).trigger('change'),{side,set}); }
async function snapshot(page) {
    return page.evaluate(()=>({hp:[$('#p1 .current-hp').val(),$('#p2 .current-hp').val()],
        sets:[$('#p1 .set-selector').val(),$('#p2 .set-selector').val()],
        damage:damageResults.map(side=>side.map(r=>r.damage)),
        moves:NullMoveAIUI.getLastResult().moves.map(m=>m.probability)}));
}
(async()=>{
    fs.mkdirSync(artifacts,{recursive:true});
    const browser = await chromium.launch({headless:true,executablePath:process.env.NULL_AI_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
    const checks=[], errors=[], remote=[];
    try {
        const context=await browser.newContext({viewport:{width:1440,height:1050}}), page=await context.newPage();
        page.on('pageerror',e=>errors.push(e.message));
        await page.route(/^https?:\/\//,r=>{remote.push(r.request().url());return r.abort();});
        await page.goto(pathToFileURL(entry).href,{waitUntil:'load'});
        await page.waitForFunction(()=>window.NullPostKOUI && NullPostKOUI.getLastResult());
        await select(page,'p1','Emboar (Blank Set)');
        await select(page,'p2','Vivillon (Bug Catcher Kenobi)');
        let r = await page.evaluate(()=>NullPostKOUI.getLastResult());
        assert.equal(r.reason,'ranked');
        assert.equal(r.trainerName,'Bug Catcher Kenobi');
        assert.ok(r.candidates.some(c=>c.name==='Vivillon'&&c.eligibility==='active'));
        assert.equal(await page.locator('#null-post-ko legend').innerText(),'Next Pokémon after KO');
        let text=await page.locator('#null-post-ko').innerText();
        assert.ok(!/après|probabilité|équipe|Restaurer|Déjà/.test(text),text);
        const p2=await page.locator('.opposing-team-box').boundingBox(), panel=await page.locator('#null-post-ko').boundingBox();
        assert.ok(panel.y>=p2.y+p2.height-1&&Math.abs(panel.x-p2.x)<5,'panel belongs below opposing team');
        checks.push('Trainer panel below opposing team, English default, selected opponent excluded.');
        const before=await snapshot(page);
        await page.locator('#null-post-ko-enabled').uncheck();
        assert.equal(await page.locator('#null-post-ko-body').isVisible(),false);
        assert.equal(await page.locator('.trainer-pok.null-post-ko-likely').count(),0);
        await page.locator('#null-post-ko-enabled').check();
        assert.deepEqual(await snapshot(page),before,'preview option must not mutate live battle');
        checks.push('Preview enable/disable preserves HP, selections, damage and live action probabilities.');
        const target=r.candidates.find(c=>c.eligibility==='candidate'&&c.probability>0);
        assert.ok(target,JSON.stringify(r));
        const row=page.locator('.null-post-ko-row').filter({has:page.locator('.null-post-ko-name',{hasText:target.name})});
        await row.locator('button').click();
        r=await page.evaluate(()=>NullPostKOUI.getLastResult());
        assert.equal(r.candidates.find(c=>c.id===target.id).eligibility,'fainted');
        assert.ok(!r.switch.candidates.some(c=>c.id===target.id));
        assert.equal(await row.locator('button').innerText(),'Restore');
        assert.equal(await page.evaluate(id=>Array.from(document.querySelectorAll('.trainer-pok.right-side')).some(e=>e.dataset.id===id&&e.classList.contains('opponent-marked')),target.id),true);
        assert.equal(await page.evaluate(id=>{
            const e=Array.from(document.querySelectorAll('.trainer-pok.right-side')).find(e=>e.dataset.id===id);
            return getComputedStyle(e.parentElement,'::after').content;
        },target.id),'"×"');
        assert.deepEqual((await snapshot(page)).hp,before.hp,'marking does not force live HP to zero');
        await row.locator('button').click();
        assert.equal((await page.evaluate(()=>NullPostKOUI.getLastResult())).candidates.find(c=>c.id===target.id).eligibility,'candidate');
        // Existing legacy right-click restore must also re-enable the reserve.
        await page.evaluate(id=>$('.trainer-pok.right-side').filter(function(){return this.dataset.id===id;}).first()[0].dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true})),target.id);
        assert.equal((await page.evaluate(()=>NullPostKOUI.getLastResult())).candidates.find(c=>c.id===target.id).eligibility,'fainted');
        await page.evaluate(id=>$('.trainer-pok.right-side').filter(function(){return this.dataset.id===id;}).first()[0].dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true})),target.id);
        assert.equal((await page.evaluate(()=>NullPostKOUI.getLastResult())).candidates.find(c=>c.id===target.id).eligibility,'candidate');
        checks.push('KO/Restore and existing right-click synchronize red cross, shared marks and exclusion.');
        await page.evaluate(()=>$('#null-ai-context').prop('open',true));
        await page.selectOption('#null-ai-switch-scenario','no-switch');
        assert.equal((await page.evaluate(()=>NullMoveAIUI.getLastResult())).switch.probability,0);
        assert.equal((await page.evaluate(()=>NullPostKOUI.getLastResult())).switch.probability,1);
        await page.selectOption('#null-ai-player-action','switch-in');
        const saved=await page.evaluate(()=>NullMoveAIUI.getLastResult().moves.map(m=>m.probability));
        await select(page,'p1','Golem (Blank Set)');
        assert.equal((await page.evaluate(()=>NullPostKOUI.getLastResult())).playerName,'Golem');
        assert.deepEqual(await page.evaluate(()=>NullMoveAIUI.getLastResult().moves.map(m=>m.probability)),saved);
        checks.push('Independent post-KO scenario uses displayed player even with a frozen Switch into reference.');
        // Field damage and player HP must be reconstructed against all reserves.
        await page.evaluate(()=>$('#srR').prop('checked',true).trigger('change'));
        r=await page.evaluate(()=>NullPostKOUI.getLastResult());
        assert.ok(r.candidates.some(c=>c.entryHazardDamage>0));
        await page.evaluate(()=>$('#null-ai-trick-room').prop('checked',true).trigger('change'));
        assert.equal(await page.evaluate(()=>NullPostKO.predict(NullMoveAIState.readBattleState(damageResults,{context:{}})).switch.scenario),'post-ko');
        await page.evaluate(()=>NullAI18n.setLanguage('fr'));
        assert.equal(await page.locator('#null-post-ko legend').innerText(),'Prochain Pokémon après KO');
        assert.ok((await page.locator('#null-post-ko-summary').innerText()).includes('face à Golem'));
        await page.evaluate(()=>NullAI18n.setLanguage('en'));
        assert.ok((await page.locator('#null-post-ko-summary').innerText()).includes('against Golem'));
        checks.push('Hazards and Trick Room are read; language changes preserve controls.');
        await page.locator('#null-post-ko-enabled').uncheck();
        await page.reload({waitUntil:'load'});
        await page.waitForFunction(()=>window.NullPostKOUI && NullPostKOUI.getLastResult());
        assert.equal(await page.locator('#null-post-ko-enabled').isChecked(),false);
        await page.locator('#null-post-ko-enabled').check();
        await select(page,'p1','Emboar (Blank Set)');
        await select(page,'p2','Vivillon (Bug Catcher Kenobi)');
        await page.evaluate(()=>$('#null-ai-context').prop('open',true));
        await page.selectOption('#null-ai-mode','strict');
        r=await page.evaluate(()=>NullPostKOUI.getLastResult());
        assert.ok(r.switch.candidates.every(c=>c.scoreStatus!=='estimated'||c.probability===null));
        await page.selectOption('#null-ai-mode','estimate');
        await page.evaluate(()=>$('#null-ai-context').prop('open',false));
        await page.locator('#null-post-ko').screenshot({path:path.join(artifacts,'post-ko-panel-en.png')});
        r=await page.evaluate(()=>NullPostKOUI.getLastResult());
        const reserve=r.candidates.find(c=>!c.active);
        await page.locator('.null-post-ko-row').filter({has:page.locator('.null-post-ko-name',{hasText:reserve.name})}).locator('button').click();
        await page.evaluate(()=>NullAI18n.setLanguage('fr'));
        await page.locator('#null-post-ko').screenshot({path:path.join(artifacts,'post-ko-panel-fr.png')});
        await page.locator('#p2').locator('..').locator('..').screenshot({path:path.join(artifacts,'post-ko-team-cross.png')});
        await page.locator('#null-post-ko-reset').click();
        assert.ok((await page.evaluate(()=>NullPostKOUI.getLastResult())).candidates.every(c=>c.alive));
        await page.locator('.null-post-ko-row .null-post-ko-mark').first().click();
        assert.ok((await page.evaluate(()=>NullPostKOUI.getLastResult())).candidates.find(c=>c.active).alive===false);
        await page.locator('#null-post-ko-reset').click();
        const megaSet=await page.evaluate(()=>{
            for(const name of Object.keys(SETDEX_SV)) {
                if(!name.includes('-Mega') || !pokedex[name]) continue;
                const base=pokedex[name].baseSpecies;
                for(const trainer of Object.keys(SETDEX_SV[name])) {
                    if(SETDEX_SV[name][trainer].index!==undefined && SETDEX_SV[base] && SETDEX_SV[base][trainer]) return name+' ('+trainer+')';
                }
            }
        });
        assert.ok(megaSet);
        await select(page,'p2',megaSet);
        r=await page.evaluate(()=>NullPostKOUI.getLastResult());
        assert.ok(r.candidates.some(c=>c.aliases.length>1),JSON.stringify(r));
        const mega=r.candidates.find(c=>c.aliases.length>1);
        await page.locator('.null-post-ko-row').filter({has:page.locator('.null-post-ko-name',{hasText:mega.name})}).locator('button').click();
        const aliasState=await page.evaluate(aliases=>({marks:aliases.filter(id=>opposingMarkedSetIds.has(id)),
            icons:Array.from(document.querySelectorAll('.trainer-pok.right-side')).filter(e=>aliases.includes(e.dataset.id)).map(e=>({id:e.dataset.id,cross:e.classList.contains('null-post-ko-fainted'),counted:e.classList.contains('opponent-marked')}))}),mega.aliases);
        assert.equal(aliasState.marks.length,1,JSON.stringify(aliasState));
        assert.ok(aliasState.icons.every(e=>e.cross),JSON.stringify(aliasState));
        assert.equal(aliasState.icons.filter(e=>e.counted).length,1,JSON.stringify(aliasState));
        await page.locator('#null-post-ko-reset').click();
        checks.push('Strict mode withholds uncertain targets; active KO marking and base/Mega aliases share one legacy mark.');
        await select(page,'p2','Pikachu (Blank Set)');
        assert.equal((await page.evaluate(()=>NullPostKOUI.getLastResult())).reason,'unknown-team');
        checks.push('Visibility preference persists; reset and unknown trainer handled.');
        assert.deepEqual(errors,[]);
        fs.writeFileSync(path.join(artifacts,'post-ko-browser.json'),JSON.stringify({checkedAt:new Date().toISOString(),htmlSHA256:crypto.createHash('sha256').update(fs.readFileSync(entry)).digest('hex'),checks,errors,remoteRequestsBlocked:remote.length,trainerExample:'Bug Catcher Kenobi'},null,2)+'\n');
        console.log(JSON.stringify({checks,errors,remoteRequestsBlocked:remote.length},null,2));
    } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
