'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const fixture=require('./fixtures/reserve-form-rom-1.2.6.json');
const trainers=require('./fixtures/trainer-update-1.2.6.json');
function sha(bytes){return crypto.createHash('sha256').update(bytes).digest('hex');}
function bytesOf(proof){
    assert.match(proof.bytes,/^(?:[0-9a-f]{2})+$/);
    const bytes=Buffer.from(proof.bytes,'hex');assert.equal(bytes.length,proof.length);assert.equal(sha(bytes),proof.sha256);return bytes;
}
test('all30 current reserve-form proof bytes agree with their decoded species, moves, U8 level and hashes without requiring a private ROM',()=>{
    assert.equal(fixture.cases.length,29);assert.equal(fixture.layout.levelWidth,1);bytesOf(fixture.copySpeciesProof);
    let records=0;
    for(const group of fixture.cases)for(const record of group.records){
        const bytes=bytesOf(record),layout=fixture.layout;assert.equal(bytes.length,40);
        assert.equal(bytes.readUInt16LE(layout.species),record.speciesID,group.trainer+' species');
        assert.equal(bytes.readUInt8(layout.level),record.level,group.trainer+' level');
        assert.deepEqual(Array.from({length:4},(_,i)=>bytes.readUInt16LE(layout.moves+i*2)),record.moves,group.trainer+' moves');
        bytesOf(record.speciesProof);assert.equal(Number(record.speciesProof.offset),Number(layout.speciesTable)+record.speciesID*layout.speciesStride);records++;
    }
    assert.equal(records,30);
});
test('selected form anchors agree with final trainer metadata, while the duplicate Liza profile has its actual separate native owner',()=>{
    let selected=0,other=0;
    for(const group of fixture.cases){
        const aliases=group.displayForms.map(name=>name+' ('+group.trainer+')'),slots=trainers.slots.filter(slot=>slot.aliases.some(id=>aliases.includes(id)));
        assert.equal(slots.length,1,group.trainer);
        for(const record of group.records){
            if(record.bindingRole==='selected final trainer profile anchor'){assert.equal(record.offset,slots[0].native.record.offset);selected++;}
            else{assert.equal(group.trainer,'Leader Liza');assert.equal(record.offset,'0x3c256c');assert.equal(record.nativeTrainer.trainerID,271);assert.equal(record.nativeTrainer.nativeName,'Tate&Liza');other++;}
            if(record.nativeTrainer){
                const owner=record.nativeTrainer,header=bytesOf(owner.headerProof);
                assert.equal(Number(owner.headerProof.offset),Number(owner.gTrainers)+owner.trainerID*owner.trainerStride);
                assert.equal(header.readUInt32LE(owner.partyPointerOffset),0x08000000+Number(record.offset)-fixture.layout.anchorOffsetFromTrainerMon);
                assert.equal(header.readUInt8(owner.partySizeOffset),owner.partySize);
            }
        }
    }
    assert.equal(selected,29);assert.equal(other,1);
    const darm=fixture.cases.find(group=>group.trainer==='Leader Liza'&&group.displayForms.includes('Darmanitan'));
    assert.equal(darm.records[0].nativeTrainer.trainerID,795);assert.equal(darm.records[0].offset,'0x3b2cd8');
    assert.equal(fixture.cases.find(group=>group.trainer==='Trainer Maxie').records[0].moves[3],630);
    assert.equal(fixture.cases.find(group=>group.trainer==='Trainer Archie').records[0].moves[3],250);
});
