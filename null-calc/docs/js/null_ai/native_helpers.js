(function(root,factory) {
    "use strict";
    var api=factory();
    if(typeof module==="object"&&module.exports)module.exports=api;
    else root.NullNativeAIHelpers=api;
})(typeof window!=="undefined"?window:globalThis,function() {
    "use strict";
    // Reverified in supplied Null 1.2.6 ROM, SHA78455d8d...17e9045.
    // See documentation/SEUILS_KO_ROM.md and verification/native-threshold-rom.json.
    // AI_CalcPartyMonScore passes random=FALSE to AI_CalcDamage. This removes
    // the 85..100% damage roll, rather than averaging its possible outcomes.
    function hitsToKO(damage,hp,protectedAtFullHP) {
        damage=Math.max(0,Math.floor(Number(damage)||0));
        hp=Math.max(0,Math.floor(Number(hp)||0));
        // 1.2.6:0x0816c858;1.2.4:0x0816c27c. Unsigned ceil, zero→UINT32_MAX.
        var hits=damage?Math.floor((hp+damage-1)/damage):0xffffffff;
        // 1.2.6:0x0816c874. The AI helper only checks full-HP protection.
        // It intentionally does not simulate multihit or Mold Breaker here.
        return hits===1&&protectedAtFullHP?2:hits;
    }
    function recomputeSashSturdy(mon,field) {
        var item=field&&field.magicRoom||mon.ability==="Klutz"?"":mon.item;
        return mon.hp===mon.maxHP&&(item==="Focus Sash"||mon.ability==="Sturdy");
    }
    function sashSturdy(mon,field) {
        if(typeof mon.nativeSashSturdyProtected==="boolean")return mon.nativeSashSturdyProtected;
        return recomputeSashSturdy(mon,field);
    }
    return {hitsToKO:hitsToKO,sashSturdy:sashSturdy,recomputeSashSturdy:recomputeSashSturdy,damageBasis:"rom-no-variance",
        romSHA256:"78455d8dabf57ab6b90cf2041bdc173c1b825cc035a9f416c5e96903717e9045"};
});
