"""Read only the supplied ROM's seven healing-berry records. Never alter the ROM."""
import hashlib, json, pathlib, re, struct, sys
root=pathlib.Path(__file__).resolve().parents[1]
rom=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else 'C:/Users/pseud/Desktop/g/pokemon null/Pokemon - Null.gba')
data=rom.read_bytes()
digest=hashlib.sha256(data).hexdigest()
assert digest=='a6f4f3f9d9b68515c70b134d6f0e79b3fd22e00c2f1468dbafa5b7529d98dbf4', 'Unsupported ROM'
lua=(rom.parent/'NullLuaV1.2.4.lua').read_text(encoding='utf8')
names=re.findall(r'"([^"\n]*)"',re.search(r'^item\s*=\s*\{(.*?)^\}',lua,re.M|re.S).group(1))
def encoded(text):
    return bytes(0 if c==' ' else 0xBB+ord(c)-65 if 'A'<=c<='Z' else 0xD5+ord(c)-97 for c in text)+b'\xff'
berries={}
bases=set()
for name,effect,param in [('Oran Berry',1,10),('Sitrus Berry',100,25),('Figy Berry',10,2),('Wiki Berry',11,2),('Mago Berry',12,2),('Aguav Berry',13,2),('Iapapa Berry',14,2)]:
    pos=data.find(encoded(name))
    assert pos>=0 and data.find(encoded(name),pos+1)<0, 'Non-unique berry anchor'
    raw=data[pos:pos+44]
    item_id=names.index(name)+1
    assert struct.unpack_from('<H',raw,20)[0]==item_id, name
    assert raw[24:26]==bytes([effect,param]), name
    bases.add(pos-item_id*44)
    berries[name]={'id':item_id,'offset':hex(pos),'recordBytes':raw.hex(),'holdEffect':effect,'holdEffectParam':param}
assert len(bases)==1, 'The independent item anchors disagree on the item-table base'
out={'romSHA256':digest,'itemTableBase':hex(bases.pop()),'recordSize':44,'holdEffectOffset':24,'holdEffectParamOffset':25,
     'method':'Seven unique encoded name anchors, native item IDs matched to supplied Lua enum, and consistent 44-byte stride. Healing amounts are native table parameters; trigger thresholds and the missing AI helper remain documented estimates.',
     'berries':berries}
(root/'tests/fixtures/rom-setup-berries.json').write_text(json.dumps(out,indent=2)+'\n',encoding='utf8')
print(json.dumps({'berriesVerified':len(berries),'romSHA256':digest,'pinchBerryHealingDivisor':2}))
