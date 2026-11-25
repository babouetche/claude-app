(function(root) {
    "use strict";
    var lastState, lastPrediction;
    var stats=[['hp','HP'],['atk','Attack'],['def','Defense'],['spa','Sp. Atk'],['spd','Sp. Def'],['spe','Speed']];
    function row(parent,label,key,input) {
        var line=$('<div>',{'class':'null-ai-control-row'}),id=parent.attr('id')+'-'+key;
        line.append($('<label>',{for:id}).text(label)).append(input.attr('id',id).attr('data-double-field',key));parent.append(line);return input;
    }
    function select(parent,label,key,options) {
        var input=$('<select>');options.forEach(function(o){input.append($('<option>',{value:Array.isArray(o)?o[0]:o}).text(Array.isArray(o)?o[1]:o));});return row(parent,label,key,input);
    }
    function number(parent,label,key,min,max,value) {return row(parent,label,key,$('<input>',{type:'number',min:min,max:max,value:value}));}
    function value(card,key) {return card.find('[data-double-field="'+key+'"]').val();}
    function field(card,key,v) {card.find('[data-double-field="'+key+'"]').val(v);}
    function choiceList() {return [['','Choose a partner…'],['__empty__','Empty / fainted slot']];}
    function syncChoices(card,options,keepSelection) {
        var input=card.find('[data-double-field="setID"]'),current=input.val()||'',choices=choiceList().concat(options.map(function(o){return [o.id,o.text];}));
        var outside=current&&current!=='__empty__'&&!options.some(function(o){return o.id===current;});
        // Filtering the player's list must not erase an already configured
        // battler. A hidden selected row preserves it without offering it.
        if(outside&&keepSelection)choices.push([current,current,true]);
        else if(outside){current='';field(card,'hp',0);card.find('.null-double-stats-preview').empty();}
        var key=JSON.stringify(choices);
        if(input.data('null-double-choices')===key&&input.val()===current)return;
        input.empty();choices.forEach(function(o){input.append($('<option>',{value:o[0],hidden:!!o[2],'data-double-outside':String(!!o[2])}).text(o[1]));});
        input.val(current).data('null-double-choices',key);
        // Update Select2's display without emitting a change event: loading a
        // set again would reset partner HP, PP and manually edited stats.
        if($.fn.select2)input.select2('val',current);
    }
    function syncPartnerLists(base) {
        var options=getSetOptions().filter(function(o){return o.id;}),party=base.party||{},candidates=party.candidates||[];
        var player=$('#null-double-player'),opponent=$('#null-double-opponent');
        var imported=$('#null-double-player-imported').prop('checked');
        syncChoices(player,options.filter(function(o){return !imported||o.isCustom;}),true);
        var trainer=party.trainerName,primary=$('#p2 .set-selector').val(),onlyTrainer=$('#null-double-opponent-trainer-only').prop('checked');
        var bank=options.filter(function(o){var set=setdex[o.pokemon]&&setdex[o.pokemon][o.set];return String(o.set).trim()===trainer&&set&&set.index!==undefined;});
        var known=!!candidates.length||!!bank.length;
        var allowed=new Set(),active=new Set();
        candidates.forEach(function(c){(c.aliases||[c.id]).forEach(function(id){(c.active?active:allowed).add(id);});});
        if(!candidates.length)bank.forEach(function(o){(o.id===primary?active:allowed).add(o.id);});
        // Exact logical party slots also exclude base/Mega aliases of the
        // displayed opponent. A similarly named trainer is never merged.
        syncChoices(opponent,options.filter(function(o){return !onlyTrainer||!known||allowed.has(o.id)&&!active.has(o.id);}),!onlyTrainer||!known);
        $('#null-double-trainer-note').text(known?'Trainer: '+trainer+'. Select the other Pokémon actually on the field.':'Choose a known trainer below to filter its team here.');
        if(known&&!party.complete)$('#null-double-trainer-note').append(document.createTextNode(' This list is not a confirmed party; replacement predictions remain unavailable.'));
        $('#null-double-player-filter-note').toggle(!!imported).text('Only imported sets are offered. An existing partner outside the filter stays selected.');
    }
    function createCard(parent,id,label) {
        var card=$('<details>',{id:id,'class':'null-double-card',open:true});card.append($('<summary>').text(label));
        var sets=select(card,'Active partner','setID',choiceList());
        if($.fn.select2)sets.select2({width:'100%',placeholder:'Choose a partner…',matcher:function(term,text,option){
            if(option.attr('data-double-outside')==='true')return false;
            return term.toUpperCase().split(/\s+/).filter(Boolean).every(function(word){return text.toUpperCase().indexOf(word)>=0;});
        }});
        var isPlayer=id==='null-double-player',filterID=isPlayer?id+'-imported':id+'-trainer-only';
        card.append($('<label>',{'class':'null-double-set-filter',for:filterID})
            .append($('<input>',{id:filterID,type:'checkbox',checked:!isPlayer}))
            .append(document.createTextNode(isPlayer?' Only show imported sets':' Only this trainer’s team')));
        card.append($('<p>',{id:isPlayer?'null-double-player-filter-note':'null-double-trainer-note','class':'null-ai-note'}));
        number(card,'Current HP (0 = fainted)','hp',0,9999,0);card.append($('<small>',{'class':'null-double-stats-preview'}));
        var info=$('<details>',{id:id+'-info'}).append($('<summary>').text('Stats, ability and item'));
        number(info,'Level','level',1,100,50);
        select(info,'Nature','nature',Object.keys(calc.NATURES));
        select(info,'Ability','ability',['(other)'].concat(calc.ABILITIES[gen]));
        select(info,'Ability enabled','abilityOn',[[1,'Yes'],[0,'No']]);
        select(info,'Item','item',[''].concat(calc.ITEMS[gen]));
        select(info,'Status','status',[['','Healthy'],['par','Paralyzed'],['slp','Asleep'],['psn','Poisoned'],['tox','Badly poisoned'],['brn','Burned'],['frz','Frozen']]);
        var types=$('#p1 .type1 option').map(function(){return $(this).val();}).get().filter(Boolean);
        select(info,'Type 1','type1',types);select(info,'Type 2','type2',[['','(none)']].concat(types));
        var table=$('<table>',{'class':'null-double-stats'}).append('<thead><tr><th>Stat</th><th>IV</th><th>EV</th><th>Boost</th></tr></thead>'),body=$('<tbody>');
        stats.forEach(function(s){var tr=$('<tr>').append($('<th>').text(s[1]));['iv','ev','boost'].forEach(function(k){var input=$('<input>',{type:'number',min:k==='boost'?-6:0,max:k==='boost'?6:k==='iv'?31:252,value:k==='iv'?31:0,'data-double-field':k+'-'+s[0],'aria-label':s[1]+' '+k});if(k==='boost'&&s[0]==='hp')input.prop('disabled',true);tr.append($('<td>').append(input));});body.append(tr);});
        info.append(table.append(body));card.append(info);
        var moves=$('<details>',{id:id+'-moves'}).append($('<summary>').text('Moves, PP and availability'));
        var names=Object.keys(calc.MOVES[gen]).sort();if(!names.includes('(No Move)'))names.unshift('(No Move)');
        for(var i=0;i<4;i++) {
            select(moves,'Move '+(i+1),'move-'+i,names).val('(No Move)');
            var line=$('<div>',{'class':'null-double-pp'});line.append($('<label>').text('PP ').append($('<input>',{type:'number',min:0,max:64,placeholder:'?','data-double-field':'pp-'+i,'aria-label':'Remaining PP for move '+(i+1)})));
            line.append($('<label>').text(' Available ').append($('<input>',{type:'checkbox',checked:true,'data-double-field':'usable-'+i})));moves.append(line);
            line.append($('<label>',{'class':'null-double-used-label'}).text(' Attempted since entry ').append($('<input>',{type:'checkbox','data-double-field':'used-'+i})));
        }
        moves.append($('<p>',{'class':'null-double-last-resort-help null-ai-note'}).text('Last Resort: mark each other move actually attempted since entry, even if it failed. Switching resets this history. Damage shown assumes Last Resort is unlocked; probabilities use this history.'));
        moves.append($('<button>',{type:'button','class':'null-double-last-resort-help','data-double-reset-attempts':''}).text('Reset attempts: new entry'));
        select(moves,'Forced move (Choice / Encore)','forcedMoveSlot',[['','None'],[0,'Move 1'],[1,'Move 2'],[2,'Move 3'],[3,'Move 4']]);
        if(id==='null-double-opponent') {
            select(moves,'Known action this turn','plannedMove',[['','Predict automatically'],[0,'Move 1'],[1,'Move 2'],[2,'Move 3'],[3,'Move 4']]);
            row(moves,'Last move used','lastMove',$('<input>',{type:'text'}));
            select(moves,'First turn on the field','firstTurn',[[1,'Yes'],[0,'No']]);select(moves,'Wakes up this turn','wakeupTurn',[[0,'No'],[1,'Yes']]);
        }
        card.append(moves);parent.append(card);
    }
    function ensure() {
        if($('#null-double-context').length)return;
        var panel=$('<details>',{id:'null-double-context','class':'null-ai-context null-double-context',open:true});
        panel.append($('<summary>').text('Doubles AI: four active Pokémon'));
        panel.append($('<div>',{id:'null-double-board','class':'null-double-board'}));
        panel.append($('<p>',{'class':'null-ai-note'}).text('Select both partners and their current HP. Probabilities compare moves AND targets. ≈ indicates assumptions listed in the AI panel; strict mode hides unestablished predictions.'));
        panel.append($('<label>').text(' Enable doubles predictions ').prepend($('<input>',{id:'null-double-enabled',type:'checkbox',checked:true})));
        select(panel,'Player shown on the left occupies','playerSlot',[[0,'Slot 1'],[1,'Slot 2']]);
        select(panel,'AI shown on the right occupies','opponentSlot',[[0,'Slot 1'],[1,'Slot 2']]);
        select(panel,'Known action of the displayed AI','primaryPlannedMove',[['','Predict automatically'],[0,'Move 1'],[1,'Move 2'],[2,'Move 3'],[3,'Move 4']]);
        var partners=$('<div>',{'class':'null-double-partners'});createCard(partners,'null-double-player','Your other active Pokémon');createCard(partners,'null-double-opponent','Trainer’s other active Pokémon');panel.append(partners);
        panel.append($('<div>',{id:'null-double-target-results','aria-live':'polite'}));
        panel.insertBefore($('.move-result-group').first());
    }
    function settingsFor(card) {
        var s={};['setID','nature','ability','item','status','lastMove'].forEach(function(k){s[k]=value(card,k);});
        s.hp=Number(value(card,'hp'));s.level=Number(value(card,'level'));s.types=[value(card,'type1'),value(card,'type2')].filter(Boolean);
        s.abilityOn=value(card,'abilityOn')!=='0';s.firstTurn=value(card,'firstTurn')!=='0';s.wakeupTurn=value(card,'wakeupTurn')==='1';
        ['forcedMoveSlot','plannedMove'].forEach(function(k){var v=value(card,k);s[k]=v===''||v===null||v===undefined?undefined:Number(v);});
        s.ivs={};s.evs={};s.boosts={};stats.forEach(function(t){s.ivs[t[0]]=Number(value(card,'iv-'+t[0]));s.evs[t[0]]=Number(value(card,'ev-'+t[0]));if(t[0]!=='hp')s.boosts[t[0]]=Number(value(card,'boost-'+t[0]));});
        s.moves=Array.from({length:4},function(_,i){var pp=value(card,'pp-'+i);return {name:value(card,'move-'+i),pp:pp===''?undefined:Number(pp),usable:card.find('[data-double-field="usable-'+i+'"]').prop('checked'),usedSinceEntry:card.find('[data-double-field="used-'+i+'"]').prop('checked')};});
        return s;
    }
    function preview(card,resetHP) {
        if(!value(card,'setID'))return;
        try {var settings=settingsFor(card);card.find('.null-double-used-label, .null-double-last-resort-help').toggle(settings.moves.some(function(m){return m.name==='Last Resort';}));if(resetHP)settings.hp=0;var mon=root.NullMoveAIState.createDoublePartner(settings);if(resetHP)field(card,'hp',value(card,'setID')==='__empty__'?0:mon.maxHP());card.find('.null-double-stats-preview').text('Max HP: '+mon.maxHP()+' · Speed: '+mon.stats.spe);}catch(err){card.find('.null-double-stats-preview').text(err.message);}
    }
    function load(card) {
        var id=value(card,'setID');if(!id)return;
        var split=id.indexOf(' ('),name=id.slice(0,split),key=id.slice(split+2,-1),set=setdex[name]&&setdex[name][key]||{},dex=pokedex[name]||{};
        field(card,'level',set.level||50);field(card,'nature',set.nature||'Serious');field(card,'ability',set.ability||dex.abilities&&dex.abilities[0]||'(other)');field(card,'abilityOn',1);field(card,'item',set.item||'');field(card,'status','');
        field(card,'type1',dex.types&&dex.types[0]||'Normal');field(card,'type2',dex.types&&dex.types[1]||'');
        var legacy={hp:'hp',atk:'at',def:'df',spa:'sa',spd:'sd',spe:'sp'};
        stats.forEach(function(t){var k=legacy[t[0]];field(card,'iv-'+t[0],set.ivs&&set.ivs[k]!==undefined?set.ivs[k]:31);field(card,'ev-'+t[0],set.evs&&set.evs[k]||0);field(card,'boost-'+t[0],0);});
        for(var i=0;i<4;i++){field(card,'move-'+i,set.moves&&set.moves[i]||'(No Move)');field(card,'pp-'+i,'');card.find('[data-double-field="usable-'+i+'"]').prop('checked',true);card.find('[data-double-field="used-'+i+'"]').prop('checked',false);}
        field(card,'forcedMoveSlot','');field(card,'plannedMove','');field(card,'lastMove','');field(card,'firstTurn',1);field(card,'wakeupTurn',0);preview(card,true);
    }
    function pct(p) {return typeof p==='number'?(p*100).toFixed(1).replace(/\.0$/,'')+' %':'unknown';}
    function board(state,base) {
        var holder=$('#null-double-board').empty(),pi=state.selectedPlayer||Number(value($('#null-double-context'),'playerSlot'))||0,ai=state.selectedOpponent||Number(value($('#null-double-context'),'opponentSlot'))||0;
        ['player','opponent'].forEach(function(side){var team=$('<section>',{'class':'null-double-side null-double-side-'+side}).append($('<h3>').text(side==='player'?'Your side':'Trainer’s side'));
            for(var i=0;i<2;i++){var main=i===(side==='player'?pi:ai),mon=state.complete?(side==='player'?state.players:state.opponents)[i]:main?base[side]:null;
                var card=$('<article>',{'class':'null-double-battler'+(mon&&mon.hp<=0?' null-double-fainted':'')});card.append($('<small>').text('Slot '+(i+1)+(main?' · Main calculator':' · Partner')));
                card.append($('<strong>').text(mon?mon.name:'Choose a partner…'));
                if(mon){card.append($('<p>').text('HP '+mon.hp+'/'+mon.maxHP+' · Speed '+mon.speed));card.append($('<progress>',{max:mon.maxHP,value:mon.hp,'aria-label':'HP '+mon.name}));card.append($('<p>').text(mon.ability+' · '+(mon.item||'(none)')));card.append($('<p>',{'class':'null-double-board-moves'}).text(mon.moves.filter(function(m){return m.name!=='(No Move)';}).map(function(m){return m.name;}).join(' / ')));}
                team.append(card);
            }holder.append(team);
        });
    }
    function render(state,prediction) {
        var holder=$('#null-double-target-results').empty();
        if(!prediction.slots.length){holder.append($('<p>').text((prediction.reasons||[]).join(' ')));return;}
        holder.append($('<p>',{'class':'null-ai-note'}).text('Move + target probabilities below are conditional on this Pokémon attacking. The top move probabilities also include its switch risk when known.'));
        prediction.slots.forEach(function(slot,i){
        var section=$('<details>',{open:true,'class':'null-double-slot-results'}).append($('<summary>').text('AI slot '+(i+1)+' — '+state.opponents[i].name));
            var table=$('<table>',{'class':'null-double-targets'}).append('<thead><tr><th>Move</th><th>Target(s)</th><th>Chance</th><th>Damage by target</th></tr></thead>'),body=$('<tbody>');
            (slot.targets||[]).filter(function(a){return a.probability===null||a.probability>1e-9;}).sort(function(a,b){return (b.probability||0)-(a.probability||0);}).forEach(function(a){
                var target=a.target==='spread'?'All affected Pokémon: '+a.targetNames.join(', '):a.target==='self'?'Self':a.target==='ally'?'Ally: '+a.targetNames.join(', '):a.target==='field'?'Team / field':('Player slot '+(Number(a.target.slice(-1))+1)+': '+a.targetNames.join(', '));
                var damages=Object.keys(a.damage||{}).map(function(key){var mon=key==='ally'?state.opponents[1-i]:state.players[Number(key.slice(-1))],values=a.damage[key]||[0];return mon.name+': '+(Math.min.apply(null,values)*100/mon.maxHP).toFixed(1)+'–'+(Math.max.apply(null,values)*100/mon.maxHP).toFixed(1)+' %';}).join(' / ');
                body.append($('<tr>').append($('<td>').text(a.move)).append($('<td>').text(target)).append($('<td>').text((slot.status==='estimated'&&a.probability>0?'≈ ':'')+pct(a.probability))).append($('<td>').text(damages||'—')));
            });
            section.append(table.append(body));(slot.reasons||[]).forEach(function(r){section.append($('<p>').text(r));});
            if(!slot.targets.length)section.append($('<p>').text('No usable move-target choice.'));
            holder.append(section);
        });
    }
    function refresh(results,controls,base) {
        ensure();var panel=$('#null-double-context');panel.toggle(base.field.gameType==='Doubles');
        $('body').toggleClass('null-doubles-mode',base.field.gameType==='Doubles');
        if(base.field.gameType!=='Doubles')return null;
        syncPartnerLists(base);
        var s={playerPartner:settingsFor($('#null-double-player')),opponentPartner:settingsFor($('#null-double-opponent')),playerSlot:Number(value(panel,'playerSlot')),opponentSlot:Number(value(panel,'opponentSlot'))};
        var planned=value(panel,'primaryPlannedMove');s.primaryPlannedMove=planned===''?undefined:Number(planned);
        var enabled=$('#null-double-enabled').prop('checked'), fresh=enabled?root.NullMoveAIState.readDoubleBattleState(results,controls,s,base):{complete:false};
        var key=$('#p2 .set-selector').val()+'|'+s.opponentPartner.setID+'|'+s.opponentSlot+'|'+s.playerSlot;
        lastState=fresh;board(fresh,base);var state=fresh;
        var reference=fresh.complete?root.NullBattleStore.reference('double',key,root.NullFaintContext.historyKey(fresh.switchState),fresh,controls.context.playerAction==='switch-in'):null;
        if(reference&&reference.reason==='history'){
            controls.context.playerAction='stay';$('#null-ai-player-action').val('stay');$('#null-ai-faint-snapshot-note').show();
            fresh.context.playerAction=fresh.switchState.context.playerAction='stay';
            fresh.opponents[fresh.selectedOpponent].context.playerAction='stay';
            fresh.matchups[fresh.selectedOpponent].concat([fresh.matchups[fresh.selectedOpponent].ally]).forEach(function(p){p.context.playerAction='stay';});
        }
        if(fresh.complete) {
            if(controls.context.playerAction==='switch-in'){
                if(reference.frozen){state=reference.state;state.context=Object.assign({},state.context,controls.context);state.opponents[state.selectedOpponent].context=Object.assign({},state.opponents[state.selectedOpponent].context,controls.context);
                    state.opponents[state.selectedOpponent].moves.forEach(function(m,i){Object.assign(m,controls.moves[i]);});
                    state.opponents.forEach(function(m){m.context.calculationMode=controls.context.calculationMode;});
                    state.opponents[state.selectedOpponent].plannedMove=s.primaryPlannedMove;state.opponents[1-state.selectedOpponent].plannedMove=s.opponentPartner.plannedMove;
                    state.matchups[state.selectedOpponent].concat([state.matchups[state.selectedOpponent].ally]).forEach(function(pair,j){var changed=Object.assign({},controls.context);if(j!==state.selectedPlayer)Object.keys(changed).filter(function(k){return k.startsWith('player')&&!['playerToxicSpikes','playerStickyWeb'].includes(k);}).forEach(function(k){delete changed[k];});pair.context=Object.assign({},pair.context,changed);pair.opponent.moves.forEach(function(m,i){Object.assign(m,controls.moves[i]);});});
                    var partnerIndex=1-state.selectedOpponent,partner=fresh.opponents[partnerIndex];
                    state.opponents[partnerIndex].context=Object.assign({},state.opponents[partnerIndex].context,{opponentFirstTurn:partner.context.opponentFirstTurn,opponentLastMove:partner.lastMove});
                    state.opponents[partnerIndex].lastMove=partner.lastMove;
                    function partnerAvailability(m,i){var freshMove=partner.moves[i];m.usable=freshMove.usable;m.pp=freshMove.pp;m.usedSinceEntry=freshMove.usedSinceEntry;}
                    state.opponents[partnerIndex].moves.forEach(partnerAvailability);
                    state.matchups[partnerIndex].concat([state.matchups[partnerIndex].ally]).forEach(function(pair){
                        pair.context.opponentFirstTurn=partner.context.opponentFirstTurn;pair.context.opponentLastMove=partner.lastMove;
                        pair.opponent.moves.forEach(partnerAvailability);
                    });
                    state.switchState.context=Object.assign({},state.switchState.context,controls.context);
                    // Rebuild conditional reserve damage against the memorized
                    // player/field if its own HP or availability changed.
                    var rebuiltParty=state.rebuildFrozenParty&&state.rebuildFrozenParty(controls);
                    if(rebuiltParty)state.party=state.switchState.party=rebuiltParty;
                    state.switchState.party.candidates.forEach(function(c){var changed=fresh.party.candidates.find(function(x){return x.id===c.id;});if(changed){c.hp=changed.hp;c.alive=changed.alive;c.nativeSashSturdyProtected=root.NullNativeAIHelpers.recomputeSashSturdy(c,state.switchState.field);}});
                    $('#null-ai-switch-into-note').text('Doubles snapshot: AI decisions use the two player Pokémon active before your switch. Damage above uses the Pokémon currently displayed. Return to Already active to update the reference.');
                }
            }
        }
        lastPrediction=root.NullDoubleAI.predict(state);render(state,lastPrediction);
        var chosen=lastPrediction.slots[state.selectedOpponent||0]||{status:'unavailable',scope:'conditional-on-move',reasons:lastPrediction.reasons,moves:base.opponent.moves.map(function(m,i){return {move:m.name,probability:m.name==='(No Move)'||controls.moves[i].pp===0||controls.moves[i].usable===false?0:null};})};
        return {moves:chosen,switchResult:root.NullSwitchAI.getSwitchProbabilities(state.complete?state.switchState:base),party:fresh.party||base.party,postKOState:fresh.complete?fresh.switchState:base};
    }
    root.NullDoubleUI={refresh:refresh,hide:function(){$('#null-double-context').hide();$('body').removeClass('null-doubles-mode');},clear:function(){$('#null-double-context').remove();$('body').removeClass('null-doubles-mode');lastState=lastPrediction=null;root.NullBattleStore.resetReference('double');},invalidate:function(){$('#null-double-target-results').empty();lastState=lastPrediction=null;root.NullBattleStore.resetReference('double');},getState:function(){return lastState;},getPrediction:function(){return lastPrediction;}};
    $(document).on('click.nullDoubleAI','[data-double-reset-attempts]',function(){
        var card=$(this).closest('.null-double-card');card.find('[data-double-field^="used-"]').prop('checked',false);field(card,'firstTurn',1);field(card,'lastMove','');
        if(root.NullMoveAIUI)root.NullMoveAIUI.refresh();
    });
    $(document).on('input.nullDoubleAI change.nullDoubleAI','#null-double-context input, #null-double-context select',function(){
        var card=$(this).closest('.null-double-card');if(card.length){if($(this).attr('data-double-field')==='setID')load(card);else {
            if (/^used-/.test($(this).attr('data-double-field') || '') && this.checked) field(card,'firstTurn',0);
            if ($(this).attr('data-double-field')==='lastMove') {
                var lastMove=$(this).val().trim();for(var i=0;i<4;i++)if(lastMove&&lastMove!=='(No Move)'&&value(card,'move-'+i)===lastMove){card.find('[data-double-field="used-'+i+'"]').prop('checked',true);field(card,'firstTurn',0);}
            }
            preview(card,false);
        }}
        if(root.NullMoveAIUI)root.NullMoveAIUI.requestRefresh();
    });
    // Imports may not trigger damage recalculation. Refresh before opening
    // either picker so newly imported sets are available without a reload.
    $(document).on('select2-opening.nullDoubleAI','#null-double-player-setID, #null-double-opponent-setID',function(){if(root.NullMoveAIUI)root.NullMoveAIUI.refresh();});
})(window);
