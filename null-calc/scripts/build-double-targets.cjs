'use strict';
// Extract factual target kinds only; never evaluate downloaded TypeScript.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),source=process.argv[2];
if(!source)throw new Error('Provide a saved Pokemon Showdown data/moves.ts path.');
const bytes=fs.readFileSync(source),text=bytes.toString('utf8'),targets={};
const blocks=text.split(/(?=^\t[\w"'-]+: \{)/m);
for(const block of blocks){const name=block.match(/^\t\tname: "([^"\n]+)",/m),target=block.match(/^\t\ttarget: "([^"\n]+)",/m);if(name&&target)targets[name[1]]=target[1];}
if(Object.keys(targets).length<900||targets.Acupressure!=='adjacentAllyOrSelf'||targets['Helping Hand']!=='adjacentAlly')throw new Error('Incomplete or unexpected source target table.');
const result={source:'https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/moves.ts',retrievedOn:'2026-10-08',sourceSHA256:crypto.createHash('sha256').update(bytes).digest('hex'),scope:'Target kinds only; standard-game fallback where the supplied Null move data omits its target.',targets};
fs.writeFileSync(path.join(root,'tests/fixtures/standard-move-targets.json'),JSON.stringify(result,null,2)+'\n');
console.log(Object.keys(targets).length+' standard move target kinds recorded.');
