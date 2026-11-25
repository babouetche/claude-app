(function(root, factory) {
    "use strict";
    if (typeof module === "object" && module.exports) module.exports = factory(require("./core.js"));
    else root.NullDoubleAI = factory(root.NullMoveAI);
})(typeof window !== "undefined" ? window : globalThis, function(core) {
    "use strict";
    function alive(mon) { return mon && mon.hp > 0; }
    function has(mon, move) { return (mon.moves || []).some(function(m) { return m.name === move; }); }
    function attacking(mon) { return (mon.moves || []).some(function(m) { return m.name !== "(No Move)" && m.category !== "Status"; }); }
    function fast(a, b, field) { return field.trickRoom ? a.speed <= b.speed : a.speed >= b.speed; }
    function cap(mon, stat) { return (mon.boosts || {})[stat] >= 6; }
    function meanDamage(pair) { return Math.max.apply(null, pair.player.moves.map(function(m) { return m.usable!==false&&m.pp!==0&&m.damage && m.damage.length ? m.damage.reduce(function(a,b) {return a+b;},0)/m.damage.length : 0; }).concat([0])); }
    function threatens(pair, hp) { return pair.player.moves.some(function(m) { return m.usable!==false&&m.pp!==0&&m.category !== "Status" && m.damage && Math.max.apply(null,m.damage) >= hp; }); }
    function merge(d) {
        var map = new Map(); d.forEach(function(x) { map.set(x.score,(map.get(x.score)||0)+x.probability); });
        return Array.from(map,function(x) {return {score:x[0],probability:x[1]};});
    }
    function shift(d, n) { return d.map(function(x) {return {score:x.score+n,probability:x.probability};}); }
    function bonus(d, values) { return merge(d.flatMap(function(x) {return values.map(function(y) {return {score:x.score+y.score,probability:x.probability*y.probability};});})); }
    function roll(d, n, p) { return bonus(d,[{score:0,probability:1-p},{score:n,probability:p}]); }
    function maximum(a,b) { return merge(a.flatMap(function(x) {return b.map(function(y) {return {score:Math.max(x.score,y.score),probability:x.probability*y.probability};});})); }
    function partnerScore(move, mon, partner, pair, state, slot, selected, assumptions) {
        var d=[{score:0,probability:1}], power=pair.opponent.moves[slot], damage=power.damage || [0];
        var safe=Math.max.apply(null,damage)<partner.hp, boostable=false;
        if (power.type === "Electric" && partner.ability === "Volt Absorb" && partner.hp<=partner.maxHP*.75 ||
            power.type === "Ground" && partner.ability === "Earth Eater" && partner.hp<=partner.maxHP*.75 ||
            power.type === "Water" && ["Water Absorb","Dry Skin"].includes(partner.ability) && partner.hp<=partner.maxHP*.75 ||
            power.type === "Electric" && partner.ability === "Lightning Rod" && !cap(partner,"spa") && partner.moves.some(function(m){return m.category==="Special";}) ||
            power.type === "Water" && partner.ability === "Storm Drain" && !cap(partner,"spa") && partner.moves.some(function(m){return m.category==="Special";}) ||
            power.type === "Grass" && partner.ability === "Sap Sipper" && !cap(partner,"atk") && partner.moves.some(function(m){return m.category==="Physical";}) ||
            power.type === "Electric" && partner.ability === "Motor Drive" && !cap(partner,"spe")) boostable=true;
        if (partner.ability === "Contrary" && ["Growl","Charm","Feather Dance","Tail Whip","Leer","Screech","Fake Tears","Metal Sound","Scary Face","Confide","Eerie Impulse"].includes(move.name)) boostable=true;
        if (boostable) d=roll(d,6,.25);
        var protecting=selected&&["Protect","Detect","Spiky Shield","Baneful Bunker","Obstruct","Silk Trap","Burning Bulwark"].includes(selected.name);
        if(!protecting&&move.name==="Ice Shard"&&partner.item==="Weakness Policy"&&power.superEffective)return bonus(d,[{score:12,probability:.25},{score:7,probability:.75}]);
        if(!protecting&&move.name==="Fling"&&["Iron Ball","Macho Brace","Power Anklet","Power Band","Power Belt","Power Bracer","Power Lens","Power Weight"].includes(mon.item)) {
            if(partner.item==="Weakness Policy"||power.superEffective)return bonus(d,[{score:12,probability:.25},{score:8,probability:.75}]);
            return bonus(d,state.players.filter(alive).some(function(p){return !fast(partner,p,state.field);})?[{score:10,probability:.25},{score:8,probability:.75}]:[{score:8,probability:.25},{score:7,probability:.75}]);
        }
        if (move.name === "Beat Up" && (partner.ability === "Justified" || partner.item === "Scraftinite") &&
            partner.moves.some(function(m){return m.category==="Physical";}) && !(partner.boosts && partner.boosts.atk>0) && safe && partner.firstTurn!==false) return bonus(d,[{score:9,probability:.75},{score:12,probability:.25}]);
        if (["Heal Pulse","Floral Healing","Pollen Puff"].includes(move.name)) return shift(d,partner.hp<partner.maxHP/2 && state.players.filter(alive).every(function(p){return fast(mon,p,state.field);}) ? 6 : 0);
        if (move.name === "Helping Hand") {
            if (!selected) assumptions.push("Doubles: unknown partner action is assumed damaging when a damaging move is available.");
            return (selected ? selected.category!=="Status" : attacking(partner)) ? roll(d,7,.5) : d;
        }
        if (move.name === "Dragon Cheer") return shift(d,6+Number(partner.types.includes("Dragon")));
        if (move.name === "Coaching") {
            var inside=roll([{score:0,probability:1}],1,.5);
            if ((partner.boosts && partner.boosts.atk || 0)<2) inside=roll(inside,1,.5);
            if ((partner.boosts && partner.boosts.def || 0)<2) inside=roll(inside,1,.5);
            return bonus(d,[{score:0,probability:.5}].concat(inside.map(function(x){return {score:x.score,probability:x.probability*.5};})));
        }
        if (["Swagger","Flatter"].includes(move.name)) {
            var stat=move.name==="Swagger"?"atk":"spa", benefits=partner.moves.some(function(m){return m.category===(stat==="atk"?"Physical":"Special");});
            if ((partner.ability === "Own Tempo" || partner.item === "Persim Berry" || partner.item === "Lum Berry") && !cap(partner,stat) && benefits) return bonus(d,[{score:9,probability:.25},{score:8,probability:.75}]);
        }
        if (move.name === "Psych Up" && Object.values(partner.boosts||{}).filter(function(x){return x>0;}).length > Object.values(mon.boosts||{}).filter(function(x){return x>0;}).length) return bonus(d,[{score:10,probability:.25},{score:8,probability:.75}]);
        if (move.name === "Role Play" && !["Huge Power","Pure Power"].includes(mon.ability) && ["Huge Power","Pure Power","Illuminate"].includes(partner.ability) ||
            move.name === "Entrainment" && mon.ability === "Huge Power" && !["Huge Power","Pure Power"].includes(partner.ability)) return bonus(d,[{score:10,probability:.25},{score:8,probability:.75}]);
        if (move.name === "Acupressure" || move.name === "Speed Swap") return roll(d,8,.25);
        if (move.name === "Instruct") {
            d=shift(d,6); var instructed=fast(mon,partner,state.field) ? (partner.moves || []).find(function(m){return m.name===partner.lastMove;}) : selected;
            if (!instructed) assumptions.push("Doubles: Instruct's instructed move is unknown; no additional spread bonus is assumed.");
            return instructed && instructed.category!=="Status" && ["allAdjacent","allAdjacentFoes"].includes(instructed.target) ? roll(d,1,.5) : d;
        }
        if (boostable) return d;
        return shift(d,-30);
    }
    function solveActions(actions, strict, assumptions) {
        var distributions=actions.map(function(a){return a.distribution;});
        if (strict && assumptions.length) return null;
        if (strict && !distributions.every(function(d){return d.length===1;})) return null;
        if (!strict && distributions.some(function(d){return d.length>1;})) assumptions.push("Doubles: random scores and damage comparisons across move-target choices are treated as independent; their joint RNG law is not documented.");
        // C chooses a best move per target, THEN a best target. Polynomial
        // tie masses compute these two nested uniform choices without sampling.
        var groups=new Map();actions.forEach(function(a,i){var key=a.selectionTarget||a.target;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);});
        function cdf(i,x,equal){return distributions[i].reduce(function(p,o){return p+(o.score<x||equal&&o.score===x?o.probability:0);},0);}
        function groupCDF(key,x,equal){var indices=groups.get(key);if(key==="ally"&&x<0)return indices.reduce(function(p,i){return p*cdf(i,0,false);},1);return indices.reduce(function(p,i){return p*cdf(i,x,equal);},1);}
        function tieWeight(pairs){var poly=[1];pairs.forEach(function(pair){var next=Array(poly.length+1).fill(0);poly.forEach(function(p,k){next[k]+=p*pair[0];next[k+1]+=p*pair[1];});poly=next;});return poly.reduce(function(p,q,k){return p+q/(k+1);},0);}
        return actions.map(function(a,i){
            var group=a.selectionTarget||a.target,p=0;
            distributions[i].forEach(function(o){
                if(group==="ally"&&o.score<0)return;
                var inside=groups.get(group).filter(function(j){return j!==i;}).map(function(j){var below=cdf(j,o.score,false);return [below,cdf(j,o.score,true)-below];});
                var outside=Array.from(groups.keys()).filter(function(key){return key!==group;}).map(function(key){var below=groupCDF(key,o.score,false);return [below,groupCDF(key,o.score,true)-below];});
                p+=o.probability*tieWeight(inside)*tieWeight(outside);
            });return p;
        });
    }
    function predictSlot(state,index,selected) {
        var mon=state.opponents[index], partner=state.opponents[1-index], ctx=Object.assign({},mon.context||state.context), strict=ctx.calculationMode==="strict";
        if(mon.plannedMove!==undefined)ctx.forcedMoveSlot=mon.plannedMove;
        if(!selected&&partner&&partner.plannedMove!==undefined)selected=partner.moves[partner.plannedMove];
        var moves=mon.moves||[], actions=[], assumptions=(state.assumptions||[]).slice(), reasons=[], eligibilityKnown=false, legal=moves.map(function(m,i){return m.name!=="(No Move)"&&m.usable!==false&&m.pp!==0&&(!['Sleep Talk','Snore'].includes(m.name)||mon.status==='slp'||mon.ability==='Comatose')&&(ctx.forcedMoveSlot===undefined||ctx.forcedMoveSlot===i);});
        if(index===1&&alive(partner)&&has(mon,'Round')&&has(partner,'Round')&&fast(mon,partner,state.field))assumptions.push("Doubles: a faster Round user in slot 2 can overwrite slot 1's previous score; this retroactive override is not reconstructed.");
        function finish(probabilities) {
            var totals=moves.map(function(_,i){return !legal[i]?0:probabilities?0:null;});
            var displayed=new Map();actions.forEach(function(a,i){a.probability=probabilities?probabilities[i]:null;if(probabilities)totals[a.moveSlot]+=probabilities[i];delete a.distribution;var key=a.moveSlot+":"+a.target;if(!displayed.has(key))displayed.set(key,a);else if(probabilities)displayed.get(key).probability+=a.probability;delete a.selectionTarget;});
            actions=Array.from(displayed.values());
            if (!probabilities && eligibilityKnown && legal.filter(Boolean).length===1) totals=legal.map(Number);
            return {status:!probabilities&&legal.some(Boolean)?"unavailable":assumptions.length?"estimated":"determined",scope:"conditional-on-move",source:core.source,reasons:reasons,assumptions:Array.from(new Set(assumptions)),
                moves:moves.map(function(m,i){return {move:m.name,probability:totals[i]};}),targets:actions};
        }
        if (!alive(mon)) { legal=legal.map(function(){return false;}); reasons.push("The selected AI slot has fainted."); return finish(null); }
        try {
            legal = core.moveAvailability(mon, ctx).legal.map(function(v, i) { return v && legal[i]; });
            eligibilityKnown = true;
            var matchups=state.matchups[index], live=state.players.map(function(p,i){return alive(p)?i:null;}).filter(function(i){return i!==null;});
            if (!live.length) throw new Error("No living player target is available.");
            var scored={}; live.forEach(function(j){
                var scoreOpponent=Object.assign({},matchups[j].opponent,{moves:matchups[j].opponent.moves.map(function(m,k){return Object.assign({},m,{usable:legal[k]});})});
                var input=Object.assign({},matchups[j],{opponent:scoreOpponent,partner:partner,players:state.players,party:state.party&&state.party.complete?Object.assign({},state.party,{candidates:state.party.candidates.filter(function(c){return c.alive!==false&&c.hp>0;})}):undefined,context:Object.assign({},matchups[j].context||ctx,{calculationMode:"estimate",doublesComplete:true})});
                scored[j]=core.getTargetScoreDistributions(input);
                if(scored[j].status==="unavailable") throw new Error((scored[j].reasons||[]).join(" "));
                assumptions=assumptions.concat(scored[j].assumptions||[]);
            });
            var reference=live.slice().sort(function(a,b){return meanDamage(matchups[b])-meanDamage(matchups[a]);})[0];
            moves.forEach(function(move,slot){
                if (!legal[slot]) return;
                var target=move.target||"normal", self=["self","allySide","allyTeam","foeSide","all"].includes(target), ally=["normal","any","adjacentAlly","adjacentAllyOrSelf"].includes(target);
                var spread=["allAdjacent","allAdjacentFoes"].includes(target), onlyAlly=["adjacentAlly","adjacentAllyOrSelf"].includes(target);
                if (target==="randomNormal" || !["normal","any","adjacentFoe","self","allySide","allyTeam","foeSide","all","allAdjacent","allAdjacentFoes","adjacentAlly","adjacentAllyOrSelf"].includes(target)) throw new Error("Unsupported doubles target kind for "+move.name+": "+target);
                function decorate(d) {
                    if (move.name==="Round" && alive(partner)) {
                        if(fast(mon,partner,state.field)&&has(partner,"Round")) d=roll(d,7,.9);
                        else if(index===1&&selected&&selected.name==="Round") d=shift(d,13);
                    }
                    if(move.name==="Teatime") {
                        d=roll(d,-1,.5); var pinch=/^(Liechi|Ganlon|Salac|Petaya|Apicot|Lansat|Starf|Micle|Custap) Berry$/;
                        d=shift(d,pinch.test(mon.item)||alive(partner)&&pinch.test(partner.item)?8:/Berry$/.test(mon.item)||alive(partner)&&/Berry$/.test(partner.item)?6:0);
                    }
                    if (["Follow Me","Rage Powder","Ally Switch"].includes(move.name) && alive(partner)) {
                        var danger=(state.matchups[1-index]||[]).some(function(p){return p&&threatens(p,partner.hp);});
                        if(danger&&(state.matchups[1-index]||[]).some(function(p){return p&&p.player.moves.some(function(m){return m.damage&&Math.min.apply(null,m.damage)<partner.hp&&Math.max.apply(null,m.damage)>=partner.hp;});}))assumptions.push("Doubles: ambiguous partner KO checks for redirection moves use the maximum incoming damage.");
                        if(danger) d=move.name==="Ally Switch"?roll(d,state.players.filter(alive).every(function(p){return fast(mon,p,state.field);})?2:1,.2):roll(d,1,.5);
                    }
                    return d;
                }
                function add(key,names,d,damage,selectionTarget) { actions.push({move:move.name,moveSlot:slot,target:key,selectionTarget:selectionTarget||key,targetNames:names,distribution:decorate(d),damage:damage||{}}); }
                if (spread) {
                    var damages={};live.forEach(function(j){damages['player-'+j]=matchups[j].opponent.moves[slot].damage;});
                    var spreadBonus=[{score:0,probability:1}];
                    if(target==="allAdjacent"&&alive(partner)) {
                        var pd=matchups.ally.opponent.moves[slot].damage||[0]; damages.ally=pd;
                        if(["Emergency Exit","Truant","Defeatist","Slow Start"].includes(mon.ability) && ["Mummy","Wandering Spirit","Lingering Aroma"].includes(partner.ability) && move.contact && Math.max.apply(null,pd)<partner.hp)spreadBonus=[{score:9,probability:.25},{score:7,probability:.75}];
                        if(Math.max.apply(null,pd)>=partner.hp) {assumptions.push("Doubles: a spread move that can KO its ally receives an estimated -20 friendly-fire penalty.");spreadBonus=shift(spreadBonus,-20);}
                    }
                    live.forEach(function(j){add("spread",live.map(function(k){return state.players[k].name;}).concat(target==="allAdjacent"&&alive(partner)?[partner.name]:[]),bonus(scored[j].distributions[slot],spreadBonus),damages,"player-"+j);});
                } else if(self || target==="adjacentAllyOrSelf") {
                    live.forEach(function(j){add(target==="self"||target==="adjacentAllyOrSelf"?"self":"field",[target==="self"||target==="adjacentAllyOrSelf"?mon.name:"Team / field"],scored[j].distributions[slot],{},"player-"+j);});
                } else if(!onlyAlly) live.forEach(function(j){add('player-'+j,[state.players[j].name],scored[j].distributions[slot],{['player-'+j]:matchups[j].opponent.moves[slot].damage});});
                if(ally&&alive(partner)) add("ally",[partner.name],partnerScore(move,mon,partner,matchups.ally,state,slot,selected,assumptions),{ally:matchups.ally.opponent.moves[slot].damage});
            });
            if(!actions.length) { legal=legal.map(function(){return false;}); reasons.push("No usable move-target choice; Struggle is outside these four slots."); return finish(null); }
            return finish(solveActions(actions,strict,assumptions));
        } catch(err) {reasons.push(err.message);return finish(null);}
    }
    function predict(state) {
        if(!state||!state.complete||!Array.isArray(state.players)||state.players.length!==2||!Array.isArray(state.opponents)||state.opponents.length!==2) return {status:"unavailable",reasons:["Choose both active partners to provide all four battlers."],slots:[]};
        for(var mon of state.players.concat(state.opponents)) {
            if(!Number.isFinite(mon.hp)||!Number.isFinite(mon.maxHP)||mon.hp<0||mon.hp>mon.maxHP||mon.maxHP<=0||!Number.isFinite(mon.speed)||mon.speed<0||
                (mon.moves||[]).some(function(m){return m.pp!==undefined&&(!Number.isInteger(m.pp)||m.pp<0||m.pp>64);})) return {status:"unavailable",reasons:["Invalid doubles HP, speed or remaining PP."],slots:[]};
        }
        if(state.opponents.some(function(m){var c=m.context||state.context;return [c.forcedMoveSlot,m.plannedMove].some(function(x){return x!==undefined&&(!Number.isInteger(x)||x<0||x>3);});}))return {status:"unavailable",reasons:["Invalid forced or known doubles move slot."],slots:[]};
        var first=predictSlot(state,0,null), second;
        var specified=state.opponents[0].plannedMove;
        var choices=specified!==undefined ? [{move:state.opponents[0].moves[specified],probability:1}] : first.moves.map(function(m,i){return {move:state.opponents[0].moves[i],probability:m.probability};}).filter(function(c){return c.probability>0;});
        if(choices.length && choices.every(function(c){return c.move;})) {
            var branches=choices.map(function(c){return {mass:c.probability,result:predictSlot(state,1,c.move)};});
            second=branches[0].result;
            if(branches.some(function(b){return b.result.moves.some(function(m){return m.probability===null;});})) second=predictSlot(state,1,null);
            else {
                second.moves=second.moves.map(function(m,i){return Object.assign({},m,{probability:branches.reduce(function(p,b){return p+b.mass*b.result.moves[i].probability;},0)});});
                second.targets=second.targets.map(function(t){return Object.assign({},t,{probability:branches.reduce(function(p,b){var a=b.result.targets.find(function(x){return x.moveSlot===t.moveSlot&&x.target===t.target;});return p+b.mass*(a&&a.probability||0);},0)});});
                second.assumptions=Array.from(new Set(branches.flatMap(function(b){return b.result.assumptions;})));
                second.status=branches.some(function(b){return b.result.status!=="determined";})?"estimated":"determined";
            }
        } else {
            second=predictSlot(state,1,null);
            if(alive(state.opponents[0])&&has(state.opponents[1],"Round")) {second.status="unavailable";second.reasons.push("Slot 1's selected move is unavailable; Round sequencing cannot be established.");second.moves.forEach(function(m){m.probability=null;});second.targets.forEach(function(t){t.probability=null;});}
        }
        return {status:first.status==="unavailable"||second.status==="unavailable"?"unavailable":"estimated",slots:[first,second]};
    }
    return {predict:predict,predictSlot:predictSlot,solveActions:solveActions};
});
