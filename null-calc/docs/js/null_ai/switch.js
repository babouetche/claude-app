(function(root, factory) {
    "use strict";
    var api = factory(typeof module === "object" && module.exports ? require("./core.js") : root.NullMoveAI,
        typeof module === "object" && module.exports ? require("./faint_context.js") : root.NullFaintContext,
        typeof module === "object" && module.exports ? require("./native_helpers.js") : root.NullNativeAIHelpers);
    if (typeof module === "object" && module.exports) module.exports = api;
    else root.NullSwitchAI = api;
})(typeof window !== "undefined" ? window : globalThis, function(core, faintContext, native) {
    "use strict";
    var SOURCE = "https://playcode.io/c-playground--019ec228-a451-75f9-8be6-c7b68df3784a";
    var UTILITY = new Set("Fake Out|Feint|Upper Hand|Endeavor|Super Fang|Dragon Tail|Circle Throw|Knock Off|Foul Play|Future Sight|Bug Bite|Pollen Puff|Rock Tomb|Glaciate|Icy Wind|Electroweb|Mud Shot|Low Sweep|Bulldoze|Drum Beating|Pounce|Syrup Bomb".split("|"));
    var AVOID = new Set("Pursuit|Roar|Whirlwind|Dragon Tail|Circle Throw".split("|"));
    var WEATHER = { Drought: ["weather", "Sun"], Drizzle: ["weather", "Rain"], "Sand Stream": ["weather", "Sand"], "Snow Warning": ["weather", "Snow"], "Electric Surge": ["terrain", "Electric"], "Grassy Surge": ["terrain", "Grassy"], "Misty Surge": ["terrain", "Misty"], "Psychic Surge": ["terrain", "Psychic"] };
    function support(mon) {
        if (typeof mon.isSupport === "boolean") return mon.isSupport;
        if (mon.ability === "Imposter") return false;
        var count = 0;
        return !(mon.moves || []).some(function(m) {
            if (!m || m.name === "(No Move)") return false;
            var power = Number(m.basePower !== undefined ? m.basePower : m.bp);
            if (power > 75) return true;
            var utility = UTILITY.has(m.name) || (mon.name && mon.name.indexOf("Cramorant") === 0 && ["Surf", "Dive"].indexOf(m.name) >= 0);
            if (m.category !== "Status" && !utility) count++;
            return count > 1;
        });
    }
    function values(damage) {
        if (typeof damage === "number") return [damage];
        if (!Array.isArray(damage)) return [];
        return damage.reduce(function(list, value) { return list.concat(Array.isArray(value) ? values(value) : value); }, []).filter(function(d) { return Number.isFinite(d) && d >= 0; });
    }
    function bestDamage(mon, reserve, incomingCheck) {
        var choices = (mon.moves || []).filter(function(m) { return m.category !== "Status" && (incomingCheck || m.usable !== false && m.pp !== 0) && !m.imprisoned && !m.gravityBlocked &&
            (m.name !== "Last Resort" || (reserve && !incomingCheck ? false : core.lastResortReady(mon, mon.context || {}) !== false)) &&
            (!reserve || Number(m.basePower===undefined?m.bp:m.basePower)!==0 && !["Explosion","Self-Destruct","Misty Explosion","Final Gambit"].includes(m.name)); }).map(function(m) { return {rolls:values(m.damage),name:m.name,estimated:!!m.damageEstimated}; }).filter(function(d) { return d.rolls.length; });
        if (!choices.length) return { min: 0, max: 0, mean: 0 };
        var best=choices.reduce(function(best, choice) {
            var rolls=choice.rolls;
            var result = { min: Math.min.apply(null, rolls), max: Math.max.apply(null, rolls), mean: rolls.reduce(function(a, b) { return a + b; }, 0) / rolls.length,name:choice.name,estimated:choice.estimated };
            return (reserve?result.max>best.max:result.mean>best.mean) ? result : best;
        }, { min: 0, max: 0, mean: 0 });
        // An approximated competing attack could change which move is best,
        // even when its present estimate lies below an ordinary attack.
        best.estimated=choices.some(function(choice){return choice.estimated;});
        return best;
    }
    function incoming(candidate) {
        if (candidate.incomingMoves) return bestDamage({moves:candidate.incomingMoves}, true, true);
        var rolls = values(candidate.incomingDamage);
        return rolls.length ? { min: Math.min.apply(null, rolls), max: Math.max.apply(null, rolls), mean: rolls.reduce(function(a, b) { return a + b; }, 0) / rolls.length } : { min: 0, max: 0, mean: 0, missing: true };
    }
    function scoreCandidate(candidate, s, hardSwitch) {
        var player=s.player,context=s.context||{},damage=bestDamage(candidate,true),received=incoming(candidate);
        var hp=Math.max(0,candidate.hp-(candidate.entryHazardDamage||0)),reversed=!!(s.field&&s.field.trickRoom);
        // Documented AI convention: speed ties count as faster, also under Trick Room.
        // This scores the AI's decision; it does not resolve the battle's turn order.
        var fast=reversed?candidate.speed<=player.speed:candidate.speed>=player.speed,slow=reversed?candidate.speed>player.speed:candidate.speed<player.speed;
        var breaker=["Mold Breaker","Teravolt","Turboblaze"].includes(player.ability);
        var disguise=typeof candidate.disguiseProtected==="boolean"?candidate.disguiseProtected:candidate.name==="Mimikyu"&&candidate.ability==="Disguise"&&!breaker&&!candidate.disguiseBroken;
        var assumptions=[];
        if(hardSwitch===undefined)hardSwitch=!!context.immediateSwitchDamage;
        if(hp<=0)return {candidate:candidate,score:-Infinity,min:-Infinity,max:-Infinity,support:false,outcomes:[],assumptions:[],reasons:["KO à l’entrée après les hazards."]};
        var candidateProtection=native.sashSturdy(candidate,s.field),playerProtection=native.sashSturdy(player,s.field);
        function outgoingHits(d){return native.hitsToKO(d,player.hp,playerProtection);}
        // The ROM subtracts hazards for the early slow-OHKO rejection above.
        // Its hit-count helper reads the original battler HP, before hazards.
        function incomingHits(d){return native.hitsToKO(d,candidate.hp,candidateProtection);}
        function base(out,taken){
            if(Number.isFinite(candidate.switchScore))return candidate.switchScore;
            // 1.2.6 only bypasses this early rejection with Sash/Sturdy if
            // entry hazards deal zero damage. The later native hit-count
            // wrapper still reads raw HP/full-HP protection separately.
            if(taken>=hp&&slow&&!(candidateProtection&&!(candidate.entryHazardDamage||0))&&!disguise&&candidate.ability!=="Imposter")return -1;
            if(out>=player.hp&&player.hp>0&&fast)return 5;
            if(out>=player.hp&&player.hp>0&&slow||["Palafin","Palafin-Zero"].includes(candidate.name))return 4;
            if(outgoingHits(out)<=incomingHits(taken)&&fast||candidate.name==="Ditto")return 3;
            if(outgoingHits(out)<incomingHits(taken)&&slow||["Wynaut","Wobbuffet"].includes(candidate.name))return 2;
            return fast?1:0;
        }
        // Native hard-switch adjustments ASSIGN scores after Support.
        function entry(value,taken){return hardSwitch&&incomingHits(taken)===1?-2:hardSwitch&&incomingHits(taken)===2&&slow?-1:value;}
        var raw=base(damage.max,received.max),estimate=entry(raw,received.max);
        var bonus=support(candidate)&&raw!==-1&&entry(raw+2,received.max)===estimate+2;
        var low=estimate,high=estimate+(bonus?2:0);
        if(damage.estimated||received.estimated)assumptions.push("Dégâts multi-coups estimés par le moteur ; le score natif utilise le profil sans variance.");
        if(received.missing)assumptions.push("Dégâts du joueur sur ce candidat non disponibles.");
        return {candidate:candidate,score:estimate,min:low,max:high,support:bonus,outcomes:bonus?[{score:estimate,probability:.9},{score:estimate+2,probability:.1}]:[{score:estimate,probability:1}],assumptions:assumptions,reasons:[],
            damageBasis:native.damageBasis,scoreDamage:{outgoing:damage.max,incoming:received.max,outgoingMove:damage.name,incomingMove:received.name,hitsToKO:outgoingHits(damage.max),hitsToBeKOed:incomingHits(received.max)}};
    }
    // Selection masses include native rejection; never normalize rejected branches.
    function chooseCandidates(scored, variance, minScore) {
        minScore=minScore===undefined?-Infinity:minScore;
        var distribution=scored.map(function(){return 0;}),rejected=0;
        function visit(i,mass,scores){
            if(i<scored.length){(scored[i].outcomes||[{score:scored[i].score,probability:1}]).forEach(function(o){visit(i+1,mass*o.probability,scores.concat(o.score));});return;}
            var best=Math.max.apply(null,scores),winners=[];
            scores.forEach(function(v,j){if(v===best)winners.push(j);});
            if(best<minScore||best===-Infinity||!winners.length){rejected+=mass;return;}
            var weights=[1];if(variance)for(var j=1;j<winners.length;j++){weights=weights.map(function(w){return w*.5;});weights.push(.5);}
            winners.forEach(function(j,k){distribution[j]+=mass*(variance?weights[k]:k===0?1:0);});
        }
        visit(0,1,[]);
        return {distribution:distribution,rejected:rejected,exact:scored.every(function(c){return !(c.assumptions||[]).length;}),independentSupport:scored.filter(function(c){return c.support;}).length>1};
    }
    function getTrainerItemAction(s) {
        var ctx=s&&s.context||{},mode=ctx.trainerItemScenario,inventory=ctx.trainerItems;
        if(mode==="confirmed") return {probability:1,status:"estimated",item:"Confirmed trainer item",assumptions:["Trainer item use is a confirmed scenario supplied by the user; inventory is not decoded from the ROM."]};
        if(mode==="none") return {probability:0,status:"determined",assumptions:[]};
        if(!Array.isArray(inventory)) return {probability:null,status:"unavailable",assumptions:["Trainer inventory is unknown: move and switch probabilities are conditional on no trainer item being used."]};
        var ai=s.opponent,player=s.player,first=ctx.opponentFirstTurn===undefined?(ctx.opponentTurnsActive||1)<=1:ctx.opponentFirstTurn;
        if(!ai||!player||ctx.opponentEmbargo||ctx.opponentSkyDropped||ctx.inGamePlayerPartner||ctx.opponentCanKOAnyPlayer||bestDamage(ai).mean>=player.hp) return {probability:0,status:"determined",assumptions:[]};
        var incomingDamage=bestDamage(player).mean,usedDamageHelper=false;
        for(var i=0;i<inventory.length;i++) {
            var item=inventory[i]; if(!item||item.used||!item.name)continue;
            var use=false,target=null;
            if(item.usage==="restore-hp"||item.usage==="heal-cure") {
                usedDamageHelper=true;
                var amount=item.usage==="heal-cure"?0:Number(item.healAmount);
                if(!Number.isFinite(amount)||amount<0) return {probability:null,status:"unavailable",assumptions:["Trainer healing amount is missing; the item decision cannot be established."]};
                if(item.usage==="heal-cure"&&ai.hp<Math.floor(ai.maxHP/4)&&incomingDamage>=ai.hp&&ctx.trainerHealSurvives===undefined) return {probability:null,status:"unavailable",assumptions:["The native healing modifier for a full-restoration item is not available; confirm survival after healing to resolve this item decision."]};
                use=(ai.hp<Math.floor(ai.maxHP/4)||ai.hp===0||amount!==0&&ai.maxHP-ai.hp>amount)&&incomingDamage<Math.min(ai.maxHP,ai.hp+amount);
                if(item.usage==="heal-cure"&&typeof ctx.trainerHealSurvives==="boolean")use=(ai.hp<Math.floor(ai.maxHP/4)||ai.hp===0)&&ctx.trainerHealSurvives;
            } else if(item.usage==="cure-status") use=(item.statuses||[]).includes(ai.status)||ctx.opponentConfused&&(item.statuses||[]).includes("confusion");
            else if(item.usage==="increase-stat"||item.usage==="increase-all-stats") { usedDamageHelper=true;use=first&&incomingDamage<ai.hp; }
            else if(item.usage==="focus-energy") { usedDamageHelper=true;use=first&&!ctx.opponentFocusEnergy&&incomingDamage<ai.hp; }
            else if(item.usage==="mist") use=first&&!ctx.opponentMist;
            else if(item.usage==="revive") { target=(s.party&&s.party.candidates||[]).filter(function(c){return c.hp===0||c.alive===false;}).sort(function(a,b){return a.partyIndex-b.partyIndex;})[0];use=!!target; }
            else return {probability:0,status:"determined",assumptions:[]};
            if(use) return {probability:1,status:"estimated",item:item.name,target:target&&target.id,assumptions:["Trainer item conditions follow the supplied C; damage and healing helpers use the calculator estimate. Inventory must be provided explicitly."]};
        }
        return {probability:0,status:usedDamageHelper?"estimated":"determined",assumptions:usedDamageHelper?["Trainer item damage checks use the calculator estimate; the native helper is unavailable."]:[]};
    }
    function getSwitchProbabilities(s) {
        var ctx=Object.assign({},s&&s.context),scenario=ctx.switchScenario||"auto",strict=ctx.calculationMode==="strict",party=s&&s.party||{};
        var assumptions=(party.assumptions||[]).slice(),reasons=[],rule="",probability=null,uncertain=false,fallback=false,reserved=ctx.reservedPartyIds||[];
        var doubles=s&&s.field&&s.field.gameType==="Doubles",forced=scenario==="post-ko"||s&&s.opponent&&s.opponent.hp===0;
        if(doubles&&party.owner){
            ctx.partyFirstIndex=Math.max(ctx.partyFirstIndex===undefined?0:ctx.partyFirstIndex,party.owner.partyFirstIndex);
            ctx.partyLastIndex=Math.min(ctx.partyLastIndex===undefined?Infinity:ctx.partyLastIndex,party.owner.partyLastIndex);
        }
        if (forced && s) { s = faintContext.afterKO(s); party = s.party; }
        var candidates=(party.candidates||[]).filter(function(c){return !c.active&&c.alive!==false&&c.hp>0&&!(c.aliases||[c.id]).some(function(id){return reserved.includes(id);})&&!reserved.includes(c.partyIndex)&&(ctx.partyFirstIndex===undefined||c.partyIndex>=ctx.partyFirstIndex)&&(ctx.partyLastIndex===undefined||c.partyIndex<ctx.partyLastIndex);}).sort(function(a,b){return a.partyIndex-b.partyIndex;});
        var hard=forced||scenario==="guaranteed"?!!ctx.immediateSwitchDamage:true;
        var scored=party.complete&&s&&s.player&&s.opponent&&(!doubles||ctx.doublesComplete)?candidates.map(function(c){return scoreCandidate(c,s,hard);}).filter(function(c){return c.score!==-Infinity;}):[];
        var destination=scored.map(function(){return 0;});
        function finish(){
            if(probability>0)scored.forEach(function(c){assumptions=assumptions.concat(c.assumptions||[]);});
            assumptions=Array.from(new Set(assumptions));
            var targetUnknown=fallback||strict&&(uncertain||scored.some(function(c){return c.assumptions.length;}));
            if(strict&&uncertain)probability=null;
            return {status:probability===null?"unavailable":uncertain||assumptions.length?"estimated":"determined",probability:probability,probabilityStatus:probability===null?"unavailable":uncertain?"estimated":"determined",
                category:probability===null?"unknown":probability===1?"guaranteed":probability===0?"no-switch":"probably",rule:rule,scenario:scenario,trainerName:party.trainerName||"",partyComplete:!!party.complete,source:SOURCE,reasons:reasons,assumptions:assumptions,fallbackRequired:fallback,
                trainerItemAction:getTrainerItemAction(s),
                candidates:scored.map(function(c,i){var q=targetUnknown?null:probability>0?destination[i]/probability:0;return {id:c.candidate.id,name:c.candidate.name,partyIndex:c.candidate.partyIndex,score:c.score,scoreRange:[c.min,c.max],
                    status:q===null?"unavailable":uncertain||c.assumptions.length?"estimated":"determined",scoreStatus:c.assumptions.length?"estimated":"determined",probabilityStatus:q===null?"unavailable":uncertain||c.assumptions.length?"estimated":"determined",probability:q,switchActionProbability:q===null||probability===null?null:destination[i],damageBasis:c.damageBasis,scoreDamage:c.scoreDamage};})};
        }
        if(!s||!s.player||!s.opponent){reasons.push("État de combat incomplet.");return finish();}
        if(scenario==="no-switch"){probability=0;rule="Scénario imposé : l’IA reste en jeu";return finish();}
        if(doubles&&!ctx.doublesComplete){reasons.push("Switch en doubles : les deux créneaux et les quatre Pokémon actifs sont nécessaires.");return finish();}
        if(!party.complete){
            reasons.push("Choisir une équipe de trainer connue pour vérifier les Pokémon de réserve.");
            if(forced||scenario==="guaranteed"){probability=1;uncertain=true;rule="Guaranteed switch-in — scénario imposé";assumptions.push("Une réserve valide est supposée disponible ; la cible est inconnue.");}
            else if(scenario==="probably"){probability=Number.isFinite(ctx.assumedSwitchProbability)?Math.max(0,Math.min(1,ctx.assumedSwitchProbability)):.5;uncertain=true;}
            return finish();
        }
        if(!scored.length){probability=0;rule="Aucun Pokémon de réserve vivant pouvant entrer";return finish();}
        if(forced||scenario==="guaranteed"||scenario==="probably"){
            probability=scenario==="probably"?Math.max(0,Math.min(1,Number.isFinite(ctx.assumedSwitchProbability)?ctx.assumedSwitchProbability:.5)):1;
            var selection=chooseCandidates(scored,false,forced?0:-Infinity);
            destination=selection.distribution.map(function(q){return q*probability;});fallback=selection.rejected>1e-9;
            if(fallback){uncertain=true;reasons.push("Le score natif ne désigne aucune réserve : le choix de repli après KO reste inconnu.");}
            if(scenario==="guaranteed"||scenario==="probably"){uncertain=true;assumptions.push("Probabilité imposée par l’utilisateur ; elle ne représente pas une fréquence mesurée du jeu.");}
            if(selection.independentSupport){uncertain=true;assumptions.push("Bonus Support de 10 % supposés indépendants entre les candidats.");}
            rule=forced?"Post-KO — remplacement forcé":scenario==="probably"?"Probably switch — hypothèse personnalisée":"Guaranteed switch-in — scénario imposé";
            return finish();
        }
        var opponent=s.opponent,player=s.player,turns=Number(ctx.opponentTurnsActive||ctx.turnInBattle||1),damage=bestDamage(opponent),playerDamage=bestDamage(player);
        if(ctx.opponentWrapped||ctx.opponentTrapped||ctx.opponentRooted||ctx.escapePrevented||ctx.abilityPreventsEscape||ctx.commanderActive||ctx.battleArena){probability=0;rule="Switch interdit par l’état du combat";return finish();}
        var positive=Object.values(opponent.boosts||{}).some(function(v){return v>0;});
        var avoid=positive||(doubles?ctx.opponentCanKOAnyPlayer:damage.mean>=player.hp)||(doubles?ctx.playerHasAvoidMove:(player.moves||[]).some(function(m){return AVOID.has(m.name);}));
        if(damage.min<player.hp&&damage.max>=player.hp){uncertain=true;assumptions.push("Avoid Switch : possibilité de KO évaluée avec les dégâts moyens quand les jets se chevauchent.");}
        var remaining=1,labels=[];
        function accepted(c){return (c.outcomes||[]).reduce(function(p,o){return p+(o.score>=0?o.probability:0);},0);}
        function specific(name,predicate,chance){
            scored.forEach(function(c,i){if(c.candidate.aceReserved||!predicate(c))return;var p=chance(c);if(!(p>0))return;var mass=remaining*p;destination[i]+=mass;remaining-=mass;if(mass>0)labels.push(name);});
        }
        if(!doubles&&player.ability==="Wonder Guard"&&!(opponent.moves||[]).some(function(m){return m.superEffective;}))
            specific("Wonder Guard",function(c){return c.candidate.moves.some(function(m){return m.superEffective;});},function(c){var n=c.candidate.moves.filter(function(m){return m.superEffective&&m.name!=="(No Move)";}).length;return 1-Math.pow(1/3,n);});
        var allBad=ctx.allMovesUseless;
        if(typeof allBad!=="boolean"&&turns>1&&!ctx.playerSemiInvulnerable){
            var scores=ctx.finalMoveScoreDistributions||core.getTargetScoreDistributions(Object.assign({},s,{context:Object.assign({},ctx,{scoreOnly:true,calculationMode:"estimate"})}));
            if(scores&&scores.distributions&&scores.distributions.length){
                allBad=scores.distributions.reduce(function(p,d){return p*(d.length?d.reduce(function(q,o){return q+(o.score<=-5?o.probability:0);},0):1);},1);
                assumptions=assumptions.concat(scores.assumptions||[]);
                if(allBad>0&&allBad<1){uncertain=true;assumptions.push("Anti-Setup : les scores finaux aléatoires sont comparés au seuil natif de 95 ; leur loi conjointe est estimée.");}
            }else{allBad=0;uncertain=true;assumptions.push("Anti-Setup : scores finaux non disponibles ; renseigner la condition pour ce scénario.");}
        }
        var faded=ctx.weatherFaded,weather=WEATHER[opponent.ability];
        if(weather&&typeof faded!=="boolean")faded=(s.field||{})[weather[0]]!==weather[1]&&!(weather[1]==="Snow"&&s.field.weather==="Hail");
        var recovery=player.item==="Leftovers"||player.item==="Black Sludge"&&(player.types||[]).includes("Poison")||ctx.opponentLeechSeeded&&opponent.ability!=="Magic Guard"||player.ability==="Poison Heal"&&["psn","tox"].includes(player.status);
        var walled=!doubles&&!avoid&&turns>5&&Math.floor(damage.mean*1000/player.maxHP)<=(recovery?200:100);
        var slow=s.field&&s.field.trickRoom?opponent.speed>player.speed:opponent.speed<player.speed;
        var guaranteed=(ctx.perishNextTurn||ctx.opponentPerishSong===1)&&opponent.ability!=="Soundproof"?"Perish Song":["Palafin","Palafin-Zero"].includes(opponent.name)&&slow&&playerDamage.mean>=opponent.hp?"Palafin lent et OHKO":"";
        var stages=guaranteed?[{name:guaranteed,chance:1}]:[
            {name:"Anti-Setup AI",chance:turns>1&&!ctx.playerSemiInvulnerable?.4*(typeof allBad==="number"?allBad:Number(!!allBad)):0,variance:true},
            {name:"Anti-Setup AI Plus",chance:turns>25?.4:0,variance:true,ignoreScore:true},
            {name:"Walled AI",chance:walled?.2:0},
            {name:"Support / Weather / Anti-Stall AI",chance:!avoid&&turns>1&&(support(opponent)||weather&&faded||turns>12)?.2:0},
            {name:"Regenerator AI",chance:!avoid&&opponent.ability==="Regenerator"&&(typeof ctx.regeneratorSwitchTrigger==="boolean"?ctx.regeneratorSwitchTrigger:opponent.hp<Math.floor(opponent.maxHP*2/3))?.4:0}
        ];
        var gameRemaining=remaining,failedSelection=0;
        stages.forEach(function(t){
            if(!t.chance)return;var mass=gameRemaining*t.chance;gameRemaining-=mass;
            var choice=chooseCandidates(scored,!!t.variance,t.ignoreScore?-Infinity:0);
            choice.distribution.forEach(function(q,i){destination[i]+=mass*q;});failedSelection+=mass*choice.rejected;
            if(mass*(1-choice.rejected)>0)labels.push(t.name);
            if(choice.independentSupport)uncertain=true;
        });
        // A failed destination aborts GameStatePrompt, then absorption may run.
        remaining=gameRemaining+failedSelection;
        var last=ctx.playerLastMoveInfo||(player.moves||[]).find(function(m){return m.name===ctx.playerLastMove;});
        var absorb={Fire:["Flash Fire","Well-Baked Body"],Water:["Water Absorb","Storm Drain","Dry Skin"],Electric:["Volt Absorb","Motor Drive","Lightning Rod"],Grass:["Sap Sipper"]};
        if(ctx.immunitySwitchTrigger!==false&&turns>1&&last&&!["self","foeSide","adjacentAlly","all","allySide","allyTeam","allAdjacent"].includes(last.target)){
            var abilities=absorb[last.type]||[];
            if(!abilities.includes(opponent.ability))specific("Absorption de la dernière attaque",function(c){return abilities.includes(c.candidate.ability);},function(c){return .75*accepted(c);});
            if(last.wind&&opponent.ability!=="Wind Rider")specific("Wind Rider",function(c){return c.candidate.ability==="Wind Rider";},function(c){return .75*accepted(c);});
        }else if(ctx.playerLastMove&&!last){uncertain=true;assumptions.push("La dernière attaque doit être identifiée pour évaluer les switchs d’immunité.");}
        if(ctx.immunitySwitchTrigger===true&&!last){uncertain=true;assumptions.push("Confirmation Immunity : renseigner la dernière attaque ; la destination dépend du talent de la réserve.");}
        probability=destination.reduce(function(a,b){return a+b;},0);rule=labels.length?Array.from(new Set(labels)).join(" → "):"Aucune condition de switch documentée activée";
        if(stages.filter(function(t){return t.chance>0;}).length>1||labels.includes("Wonder Guard")||labels.some(function(l){return l.includes("Absorption")||l==="Wind Rider";})){uncertain=true;assumptions.push("Routines C successives : un tirage raté poursuit vers la suite ; les tirages sont estimés avec les probabilités documentaires arrondies.");}
        if(doubles)assumptions.push("Doubles : les réserves déjà actives ou déjà choisies pour l’autre créneau sont exclues ; le classement compare le vis-à-vis du créneau.");
        reasons.push("Ordre des routines du C ; maximum de score puis ordre d’équipe, avec remplacement séquentiel à 50 % lors des égalités Anti-Setup.");
        return finish();
    }
    function composeActionProbabilities(moveResult, switchResult) {
        var probability = switchResult && switchResult.probability;
        var switchStatus = switchResult && (switchResult.probabilityStatus || switchResult.status);
        var item=switchResult&&switchResult.trainerItemAction||{probability:0,status:"determined",assumptions:[]},itemP=item.probability;
        var multiplier=typeof probability==="number"?1-probability:1;
        if(typeof itemP==="number") multiplier*=1-itemP;
        return { probability: probability, itemProbability: typeof probability==="number"&&typeof itemP==="number"?(1-probability)*itemP:null,
            scope: itemP===null?"conditional-no-item":typeof probability === "number" ? "all-actions" : "conditional-on-move",assumptions:item.assumptions||[],
            status: probability === 1 ? switchStatus : moveResult.status === "estimated" || switchStatus === "estimated" || item.status==="estimated" ? "estimated" : moveResult.status,
            moves: (moveResult.moves || []).map(function(m) { return Object.assign({}, m, { conditionalProbability: m.probability,
                probability: multiplier===0?0:typeof m.probability === "number" ? m.probability*multiplier : null }); }) };
    }
    return { source: SOURCE, isSupport: support, scoreCandidate: scoreCandidate, bestDamage: bestDamage, chooseCandidates: chooseCandidates, getTrainerItemAction:getTrainerItemAction, getSwitchProbabilities: getSwitchProbabilities, composeActionProbabilities: composeActionProbabilities };
});
