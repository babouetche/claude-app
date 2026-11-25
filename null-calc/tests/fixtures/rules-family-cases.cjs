'use strict';
// Deterministic, engine-independent score inputs. The reference digests were
// recorded before splitting the scoring core, not regenerated from the split.
const attacking = ['Tackle','Surf','Air Slash','Headbutt','Fake Out','First Impression','Feint','Upper Hand','Pursuit','Sucker Punch','Thunderclap','Knock Off','U-turn','Volt Switch','Flip Turn','Dragon Tail','Circle Throw','Anchor Shot','Fire Spin','Salt Cure','Stone Axe','Ceaseless Edge','Nuzzle','Snore','Drain Punch','Giga Drain','Explosion','Self-Destruct','Misty Explosion','Final Gambit','Meteor Beam','Electro Shot','Sky Attack','Freeze Shock','Ice Burn','Future Sight','Doom Desire','Hyper Beam','Rapid Spin','Power-Up Punch','Torch Song','Leaf Storm','Superpower','Counter','Mirror Coat','Metal Burst','Fell Stinger','Secret Power','Fissure','Horn Drill','Guillotine','Sheer Cold','Beat Up','Round','Pollen Puff','Spectral Thief','Relic Song','Fling','Rollout','Ice Ball','Fury Cutter','Echoed Voice','Luster Purge','Sacred Fire','Mystery Hit'];
const utility = ['Swords Dance','Growth','Work Up','Iron Defense','Cosmic Power','Defense Curl','Stockpile','Bulk Up','Calm Mind','Curse','Agility','Scary Face','Growl','Screech','Sand Attack','Thunder Wave','Spore','Yawn','Toxic','Will-O-Wisp','Freezy Frost','Confuse Ray','Swagger','Stealth Rock','Spikes','Toxic Spikes','Sticky Web','Mean Look','Protect','Spiky Shield',"King's Shield",'Endure','Reflect','Light Screen','Aurora Veil','Memento','Parting Shot','Geomancy','Recover','Rest','Synthesis','Pain Split','Double Team','Powder','Topsy-Turvy','Sunny Day','Rain Dance','Electric Terrain','Taunt','Gravity','Magic Room','Trick Room','Tailwind','Roar','Whirlwind','Baton Pass','Leech Seed','Teleport','Chilly Reception','Substitute','Shed Tail','Sleep Talk','Destiny Bond','Wish','Aromatherapy','Heal Bell','Nightmare','Perish Song','Attract','Imprison','Belly Drum','Shell Smash','Fillet Away','Clangorous Soul','Acupressure','Charge','Disable','Encore','Psych Up','Laser Focus','Focus Energy','Magnet Rise','Wonder Room','Conversion','Conversion 2','Metronome','Revival Blessing','Copycat','Mirror Move','Me First','Helping Hand','Mystery Status'];
const move = (name, category = 'Physical', extra = {}) => ({name,category,priority:0,effect:'HIT',type:'Normal',target:'normal',damage:category==='Status'?[0]:[24,39,39,60],...extra});
const clone = x => JSON.parse(JSON.stringify(x));
function base(name, status, flavor) {
    const candidate=move(name,status?'Status':'Physical');
    if(['Air Slash','Headbutt'].includes(name)) candidate.effect='FLINCH';
    if(name==='Drain Punch'||name==='Giga Drain') candidate.drain=true;
    if(['Nuzzle','Freezy Frost','Power-Up Punch','Torch Song','Rapid Spin','Sacred Fire','Luster Purge'].includes(name)) candidate.guaranteedEffect=true;
    if(['Sucker Punch','Thunderclap','Fake Out','First Impression','Feint','Upper Hand'].includes(name)) candidate.priority=1;
    if(name==='Mystery Hit') candidate.effect='UNKNOWN';
    const player={name:'Reference player',hp:100,maxHP:100,speed:100,paralyzedSpeed:25,status:'',ability:'',item:'',types:['Normal'],boosts:{},moves:[move('Headbutt','Physical',{damage:[11,19,19,25]}),move('Surf','Special',{type:'Water',damage:[9,18,30]}),move('Taunt','Status')]};
    const opponent={name:'Reference opponent',hp:100,maxHP:100,speed:90,defense:80,specialDefense:60,status:'',ability:'',item:'',types:['Normal'],boosts:{},moves:[candidate,move('Tackle','Physical',{damage:[20,32]})]};
    const context={calculationMode:'estimate',opponentFirstTurn:true,opponentTurnsActive:1,opponentLastMon:false,playerLastMon:false,opponentTeamSize:6,opponentAliveCount:6,protectionStreak:0,opponentLastMove:'',playerLastMove:'Headbutt',predictedPlayerMove:'Headbutt'};
    for(const key of ['playerConfused','playerInfatuated','playerIncapacitated','protectionLastTurn','opponentEndTurnFaint','opponentCursed','opponentInfatuated','opponentPerishSong','opponentLeechSeeded','opponentYawn','playerCursed','playerPerishSong','playerLeechSeeded','playerYawn','playerTrapped','playerSaltCured','playerSubstitute','opponentSubstitute','opponentWrapped','opponentTypeChanged','resistsPlayerLastMove','opponentPositivePass','opponentWakeupTurn','opponentDefenseCurl','futureSightActive','moveImmediate','lockOn','opponentTransformed'])context[key]=false;
    const field={gameType:'Singles',weather:'',terrain:'',trickRoom:false,magicRoom:false,playerSpikes:0,playerToxicSpikes:0,playerStealthRock:false,playerStickyWeb:false};
    if(flavor===1) {
        opponent.hp=35;opponent.item='Iapapa Berry';opponent.ability='Gluttony';opponent.boosts={atk:2,def:2};
        player.hp=60;player.speed=160;player.types=['Water','Steel'];player.boosts={atk:2,spe:1};player.moves[0].damage=[40,55,60];
        context.opponentFirstTurn=false;context.opponentTurnsActive=3;context.opponentLastMove=name;context.opponentAliveCount=3;context.protectionLastTurn=true;
        field.playerSpikes=1;field.playerToxicSpikes=1;field.playerStealthRock=true;field.weather='Rain';
    } else if(flavor===2) {
        opponent.hp=70;opponent.item='Power Herb';opponent.ability='Contrary';opponent.speed=120;opponent.boosts={atk:6,def:6,spd:6,spe:6,eva:6};
        player.hp=40;player.status='par';player.item='Clear Amulet';player.ability='Unaware';player.boosts={atk:-2,spa:-2,spe:-2,acc:-2};
        field.trickRoom=true;field.playerTailwind=true;field.weather='Snow';context.playerLastMon=true;context.opponentLastMon=true;context.protectionStreak=2;
    } else if(flavor===3) {
        context.calculationMode='strict';player.status='slp';context.playerIncapacitated=true;
        opponent.status='slp';opponent.hp=45;opponent.item='Choice Scarf';opponent.ability='Serene Grace';opponent.speed=110;context.opponentFirstTurn=false;context.opponentTurnsActive=2;
        field.terrain='Grassy';field.playerSpikes=3;field.playerToxicSpikes=2;field.playerStickyWeb=true;
    }
    return {player,opponent,context,field,party:{complete:true,candidates:[{name:'Injured reserve',hp:20,maxHP:100,status:'brn'}]}};
}
function cases() {
    const result=[];
    for(const [names,status] of [[attacking,false],[utility,true]]) for(const name of names) for(let flavor=0;flavor<4;flavor++) {
        const state=base(name,status,flavor), id=`${name}/${flavor}`;
        result.push({id:`singles/${id}`,method:'getNullAIMoveProbabilities',state});
        const target=clone(state);target.field.gameType='Doubles';target.context.doublesComplete=true;target.partner=clone(state.opponent);target.partner.name='Partner';
        target.players=[target.player,{...clone(target.player),speed:130}];
        result.push({id:`target/${id}`,method:'getTargetScoreDistributions',state:target});
    }
    for(const name of ['Palafin','Palafin-Zero']) {const state=base('U-turn',false,1);state.opponent.name=name;result.push({id:`replacement/${name}`,method:'getTargetScoreDistributions',state:{...state,context:{...state.context,scoreOnly:true}}});}
    for(const name of ['Copycat','Mirror Move','Me First']) {const state=base(name,true,0);state.opponent.moves[0].predictionConfirmed=true;state.player.moves[0].copycatBanned=false;state.player.moves[0].mirrorMoveBanned=false;state.player.moves[0].meFirstBanned=false;result.push({id:`copy/${name}`,method:'getNullAIMoveProbabilities',state});}
    for(const flag of [false,true]) {const state=base('Last Resort',false,0);state.opponent.moves[1].usedSinceEntry=flag;result.push({id:`history/Last Resort/${flag}`,method:'getNullAIMoveProbabilities',state});}
    return result;
}
function doubleCases() {
    return ['Helping Hand','Round','Beat Up','Tailwind','Acupressure','Spikes','Gravity','U-turn','Belly Drum','Thunder Wave','Protect','Surf'].flatMap((name,index)=>{
        const pair=base(name,utility.includes(name),index%4), players=[pair.player,{...clone(pair.player),name:'Second player',speed:80}],opponents=[pair.opponent,{...clone(pair.opponent),name:'Partner',moves:[move('Round','Special',{damage:[30]}),move('Tackle','Physical',{damage:[25]})]}];
        const state={complete:true,players,opponents,context:{...pair.context,doublesComplete:true},field:{...pair.field,gameType:'Doubles'},assumptions:[],matchups:[]};
        if(name==='Surf')opponents[0].moves[0].target='allAdjacent';
        if(name==='Helping Hand')opponents[0].moves[0].target='adjacentAlly';
        if(name==='Acupressure')opponents[0].moves[0].target='adjacentAllyOrSelf';
        opponents.forEach((actor,i)=>{state.matchups[i]=players.map(player=>({player:clone(player),opponent:clone(actor),context:clone(state.context),field:clone(state.field)}));state.matchups[i].ally={player:clone(opponents[1-i]),opponent:{...clone(actor),moves:actor.moves.map(m=>({...clone(m),damage:[10]}))},context:clone(state.context),field:clone(state.field)};});
        return [{id:`doubles/${name}`,state}];
    });
}
module.exports={cases,doubleCases};
