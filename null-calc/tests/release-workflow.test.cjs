'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {contentFiles,fingerprint,parseTests,assertFreshReport,pythonCommand} = require('../scripts/release.cjs');

function temporary(run) {
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'null-release-test-'));
  try {return run(base);} finally {
    const resolved=fs.realpathSync(base), allowed=fs.realpathSync(os.tmpdir())+path.sep;
    assert.ok(resolved.startsWith(allowed)&&path.basename(resolved).startsWith('null-release-test-'));
    fs.rmSync(resolved,{recursive:true,force:true});
  }
}

test('release fails closed for absent/duplicate TAP summaries, failed or skipped tests',()=>{
  const passing='TAP version 13\nok 1 - example\n# tests 1\n# pass 1\n# fail 0\n# skipped 0\n';
  assert.deepEqual(parseTests(passing),{tests:1,pass:1,fail:0,skipped:0});
  for(const bad of [passing.replace('# tests 1',''),passing+'# tests 1\n',passing.replace('# skipped 0','# skipped 1'),passing.replace('# pass 1','# pass 0'),passing.replace('# fail 0','# fail 1'),passing.replace('ok 1','not ok 1')])assert.throws(()=>parseTests(bad));
});

test('release freshness fingerprint detects code/fixture changes while fresh evidence may be written',()=>temporary(base=>{
  fs.mkdirSync(path.join(base,'docs'));fs.mkdirSync(path.join(base,'tests'));fs.mkdirSync(path.join(base,'verification'));
  fs.writeFileSync(path.join(base,'docs/app.js'),'original');fs.writeFileSync(path.join(base,'tests/fixture.json'),'{}');
  const before=fingerprint(contentFiles(base));
  fs.writeFileSync(path.join(base,'verification/current.json'),'new report');
  assert.equal(fingerprint(contentFiles(base)),before);
  fs.writeFileSync(path.join(base,'docs/app.js'),'changed');assert.notEqual(fingerprint(contentFiles(base)),before);
  fs.writeFileSync(path.join(base,'docs/app.js'),'original');assert.equal(fingerprint(contentFiles(base)),before);
  fs.writeFileSync(path.join(base,'tests/fixture.json'),'{"changed":true}');assert.notEqual(fingerprint(contentFiles(base)),before);
}));

test('freshly touched but old browser report is rejected, as is a fresh report with errors',()=>temporary(base=>{
  const report=path.join(base,'browser.json'),began=Date.now();
  fs.writeFileSync(report,JSON.stringify({checkedAt:'2001-01-01T00:00:00.000Z',errors:[]}));
  assert.throws(()=>assertFreshReport(report,began),/Stale/);
  fs.writeFileSync(report,JSON.stringify({checkedAt:new Date().toISOString(),errors:['browser failed']}));
  assert.throws(()=>assertFreshReport(report,began),/Browser errors/);
  fs.writeFileSync(report,JSON.stringify({recordedAt:new Date().toISOString(),errors:[]}));
  assert.deepEqual(assertFreshReport(report,began).errors,[]);
}));

test('packaging keeps editable sources and native inputs but never imports earlier proof runs',()=>temporary(base=>{
 const python=pythonCommand(process.env),script=path.resolve(__dirname,'../scripts/package-unified.py');
 const program=String.raw`
import importlib.util, hashlib, json, pathlib, sys
spec=importlib.util.spec_from_file_location('packager',sys.argv[1])
p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
base=pathlib.Path(sys.argv[2]);source=base/'source';target=base/'target'
def put(name,body):
 path=source/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_text(body,encoding='utf8')
put('scripts/archive-policy.json',json.dumps(p.POLICY))
put('docs/calc/original.js','original data retained')
put('README.md','Public overview: [Guide](documentation/USER_GUIDE_EN.md)')
put('documentation/USER_GUIDE_EN.md','English guide')
put('documentation/screenshots/example.png','public screenshot')
protected={'docs/calc/original.js':hashlib.sha256(b'original data retained').hexdigest()}
put('tests/fixtures/input-archive.json',json.dumps({'hashes':protected}))
modules=['verified-data.js','verified-data-adapter.js','core.js','state.js','switch.js','ui.js']
for name in modules:put('docs/js/null_ai/'+name,'var fixture = {};\n')
put('docs/index.html','<head></head>'+''.join('<script type="text/javascript" src="./js/null_ai/'+name+'"></script>' for name in modules))
for name in ['DOCUMENTATION_COMPLETE.md','GUIDE_AGENTS.md','HISTORIQUE.md']:put('documentation/'+name,'Current guide and consolidated history')
for name in p.VERIFICATION_INPUTS:put('verification/'+name,'{}')
for name in p.EXCLUDED_FILES:put(name,'superseded tool')
for name in ['verification/old-tests.txt','verification/old-image.png','verification/history/old.json','verification/release-proof/old/source/browser.json']:put(name,'obsolete')
put('documentation/MANIFESTE.json','{"stale":true}')
p.ROOT=source;p.build(target)
assert p.protected(target)==1
for name in modules:assert (target/'docs/js/null_ai'/name).read_text()=='var fixture = {};\n'
assert (target/'documentation/HISTORIQUE.md').is_file()
assert (target/'README.md').read_text()=='Public overview: [Guide](documentation/USER_GUIDE_EN.md)'
assert (target/'documentation/USER_GUIDE_EN.md').is_file()
assert (target/'documentation/screenshots/example.png').is_file()
assert {f.name for f in (target/'verification').iterdir()}==p.VERIFICATION_INPUTS
assert not any((target/name).exists() for name in p.EXCLUDED_FILES)
assert 'rom.bundle.js' in (target/'CALCULATEUR.html').read_text()
manifest=json.loads((target/'documentation/MANIFESTE.json').read_text())
assert manifest['archivePolicy']['previousVerificationFilesOmitted']==4
assert not manifest.get('stale')
`;
 const result=spawnSync(python.command,[...python.prefix,'-c',program,script,base],{encoding:'utf8',windowsHide:true});
 assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
}));

test('final archive guard rejects stale evidence and tools even if they were copied after the build',()=>{
 const python=pythonCommand(process.env),script=path.resolve(__dirname,'../scripts/package-unified.py');
 const program=String.raw`
import importlib.util,sys
spec=importlib.util.spec_from_file_location('packager',sys.argv[1])
p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
report={'runId':'current','proofFiles':{'verification/release-proof/current/source/browser.json':'hash'}}
names={'verification/'+n for n in p.VERIFICATION_INPUTS}
names.update(['verification/unified-validation.json','verification/release-proof/current/source/browser.json','docs/app.js'])
p.assert_archive_layout(names,report)
for obsolete in ['verification/release-proof/old/browser.json','verification/history/old.json','verification/old-image.png',next(iter(p.EXCLUDED_FILES))]:
 try:p.assert_archive_layout(names|{obsolete},report)
 except RuntimeError:pass
 else:raise AssertionError('Obsolete content accepted: '+obsolete)
try:p.assert_archive_layout(names-{'verification/native-threshold-rom.json'},report)
except RuntimeError:pass
else:raise AssertionError('Missing native evidence accepted')
`;
 const result=spawnSync(python.command,[...python.prefix,'-c',program,script],{encoding:'utf8',windowsHide:true});
 assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
});
