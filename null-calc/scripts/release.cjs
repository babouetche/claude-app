'use strict';
// One supported release entry point. No shell expansion, install, fixture update,
// skipped check, cached attestation or unverified ZIP is accepted.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawn, spawnSync} = require('node:child_process');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const config = require('./release-config.json');
const revision = config.revision;
const browserCases = config.browserCases;
const archivePolicy = require('./archive-policy.json');
const excludedParts = new Set(['.git', 'node_modules', '__pycache__']);
const excludedReferences = new Set(['verification/move-changes-current.csv', 'verification/pokemon-null-ai-current.txt', 'verification/mechanic-changes-current.txt']);
for (const file of archivePolicy.excludeFiles) excludedReferences.add(file);
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const readJSON = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const writeJSON = (file, data) => {fs.mkdirSync(path.dirname(file), {recursive:true});fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');};

function filesIn(base) {
  const result = [];
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
      if (excludedParts.has(entry.name)) continue;
      const file = path.join(dir, entry.name), relative = path.relative(base, file).split(path.sep).join('/');
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile() && !/\.(gba|sav|log)$/i.test(entry.name) && !excludedReferences.has(relative)) result.push(relative);
      else if (entry.isSymbolicLink()) throw Error('Symlinks are not release inputs: ' + relative);
    }
  }
  visit(base);
  return result.sort();
}

function contentFiles(base) {
  return Object.fromEntries(filesIn(base).filter(file => !file.startsWith('verification/') && file !== 'documentation/MANIFESTE.json').map(file => [file, sha(fs.readFileSync(path.join(base, file)))]));
}

function fingerprint(files) {return sha(JSON.stringify(Object.fromEntries(Object.entries(files).sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0))));}

function parseTests(tap) {
  const get = name => {const matches=[...tap.matchAll(new RegExp('^# '+name+' (\\d+)\\r?$', 'gm'))];assert.equal(matches.length, 1, 'Missing/duplicate TAP summary: '+name);return Number(matches[0][1]);};
  const result = {tests:get('tests'),pass:get('pass'),fail:get('fail'),skipped:get('skipped')};
  assert.ok(result.tests > 0 && result.pass === result.tests && result.fail === 0 && result.skipped === 0, 'All tests must pass; none may be skipped.');
  assert.doesNotMatch(tap, /^not ok\b/m, 'TAP contains a failing test.');
  return result;
}

function pythonCommand(env) {
  const candidates = env.NULL_AI_PYTHON ? [[env.NULL_AI_PYTHON]] : env.PYTHON ? [[env.PYTHON]] : [['python'], ['py','-3'], ['python3']];
  for (const [command, ...prefix] of candidates) {
    const check = spawnSync(command, [...prefix, '-c', 'import sys; assert sys.version_info >= (3, 10); print(sys.version.split()[0])'], {encoding:'utf8', windowsHide:true});
    if (!check.error && check.status === 0) return {command, prefix, version:check.stdout.trim()};
  }
  throw Error('Python 3.10+ is required. Set NULL_AI_PYTHON to its executable; no package installation is needed.');
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {cwd:options.cwd || root, env:options.env || process.env, windowsHide:true, shell:false});
    const chunks=[];
    const log = options.log ? fs.createWriteStream(options.log) : null;
    child.stdout.on('data', bytes => {chunks.push(bytes);if(log)log.write(bytes);else process.stdout.write(bytes);});
    child.stderr.on('data', bytes => {if(log)log.write(bytes);process.stderr.write(bytes);});
    child.once('error', error => {if(log)log.end();reject(error);});
    child.once('close', code => {
      if(log)log.end();
      if(code !== 0) reject(Error('Release stopped: '+path.basename(command)+' '+args.join(' ')+' exited '+code+(options.log?' (details: '+options.log+')':'')));
      else resolve(Buffer.concat(chunks).toString('utf8'));
    });
  });
}

function assertProtected(base) {
  const originals = readJSON(path.join(base, 'tests/fixtures/input-archive.json')).hashes;
  for (const [file, expected] of Object.entries(originals)) assert.equal(sha(fs.readFileSync(path.join(base,file))), expected, 'Protected original: '+file);
  return Object.keys(originals).length;
}

function assertFreshReport(file, startedAt) {
  assert.ok(fs.statSync(file).mtimeMs >= startedAt - 2000, 'Browser report was not rewritten: '+file);
  const report = readJSON(file);
  const timestamp = report.checkedAt || report.recordedAt || report.checkedAtUTC;
  assert.ok(Number.isFinite(Date.parse(timestamp)) && Date.parse(timestamp) >= startedAt - 2000, 'Stale browser proof: '+file);
  assert.deepEqual(report.errors, [], 'Browser errors: '+file);
  return report;
}

function assertNativeEvidence(file) {
  const report=readJSON(file);
  assert.equal(report.status,'verified');assert.deepEqual(report.errors,[]);
  assert.equal(report.auditScriptSHA256,sha(fs.readFileSync(path.join(root,'scripts/audit-native-thresholds.py'))),'Native ROM evidence predates the audit script; recheck with NULL_AI_ROM.');
  assert.equal(report.romSHA256,require('../docs/js/null_ai/native_helpers.js').romSHA256,'Native helper ROM identity differs from the evidence.');
  if(report.evidenceFixtureSHA256)assert.equal(report.evidenceFixtureSHA256,sha(fs.readFileSync(path.join(root,'tests/fixtures/native-1.2.6-helpers.json'))),'Native evidence fixture changed since its ROM audit.');
  assert.ok(report.checks.length&&report.checks.every(c=>c.passed===true),'Native ROM checks failed.');
  return report;
}

async function main(argv = process.argv.slice(2)) {
  if(argv.includes('--help') || argv.includes('--plan')) {
    console.log('node scripts/release.cjs [--stage ABSOLUTE_NEW_DIRECTORY]\n\nBuild portable HTML/tutorial; run every Node test and source browser case; build a fresh bundled distribution; rerun tests/browser cases on its HTML; compare 16+ source/distribution snapshots; verify hashes/original trainers; write fresh proofs; verify and replace the one final ZIP.\n\nEnvironment: NULL_AI_PYTHON (Python 3.10+), NULL_AI_PLAYWRIGHT_MODULE (Playwright module), NULL_AI_BROWSER (Chrome/Chromium executable). Optional NULL_AI_ROM rechecks the supplied ROM read only. No dependencies are installed.\nBrowser cases: '+browserCases.map(([s])=>s).join(', ')+', check-organized-browser.cjs');
    return;
  }
  let stageArg;
  for(let i=0;i<argv.length;i++) {if(argv[i]==='--stage' && argv[i+1])stageArg=argv[++i];else throw Error('Unknown or incomplete argument: '+argv[i]);}
  const startedAt = new Date().toISOString(), runId = startedAt.replace(/[-:.TZ]/g, '') + '-' + crypto.randomBytes(3).toString('hex');
  const stage = stageArg ? path.resolve(stageArg) : path.join(root, '../livraison', 'release-'+runId, 'Null-Calculateur');
  const relative = path.relative(root, stage);
  assert.ok(relative && (relative.startsWith('..'+path.sep) || path.isAbsolute(relative)), 'Stage must be outside source project.');
  assert.ok(!fs.existsSync(stage), 'Stage must be new; existing files are never removed.');
  const lockPath = path.join(os.tmpdir(), 'null-calc-release-'+sha(root).slice(0,16)+'.lock');
  let lock;
  try {lock=fs.openSync(lockPath, 'wx');} catch {throw Error('Another release is running (or a previous interrupted release left '+lockPath+').');}
  try {
    fs.writeFileSync(lock, JSON.stringify({pid:process.pid,root,startedAt}));
    const env = {...process.env}, python = pythonCommand(env);
    const module = env.NULL_AI_PLAYWRIGHT_MODULE || 'playwright';
    assert.ok(require(module).chromium, 'Playwright chromium API is required.');
    for(const [script] of browserCases)assert.ok(fs.existsSync(path.join(root,'scripts',script)), 'Missing required browser case: '+script);
    const protectedCount = assertProtected(root);
    const previousValidation=path.join(root,'verification/unified-validation.json');
    if(fs.existsSync(previousValidation)) {
      const previous=readJSON(previousValidation), bytes=fs.readFileSync(previousValidation);
      const safeRevision=String(previous.revision||'unknown').replace(/[^a-zA-Z0-9_-]/g,'_');
      const history=path.join(root,'verification/history',safeRevision+'-'+sha(bytes).slice(0,12)+'.json');
      if(!fs.existsSync(history)) {fs.mkdirSync(path.dirname(history),{recursive:true});fs.writeFileSync(history,bytes);}
    }
    const proofRoot = path.join(root,'verification/release-proof',runId);
    fs.mkdirSync(proofRoot,{recursive:true});
    let nativeROMRechecked=false;
    const nativeReport=path.join(root,'verification/native-threshold-rom.json');
    if(env.NULL_AI_ROM) {
      console.log('[release] Recheck supplied ROM native helper evidence (read only).');
      const nativeProof=nativeReport,began=Date.now();
      await run(python.command,[...python.prefix,'scripts/audit-native-thresholds.py','--rom',path.resolve(env.NULL_AI_ROM),'--output',nativeProof],{env});
      assertFreshReport(nativeProof,began);assertNativeEvidence(nativeProof);
      nativeROMRechecked=true;
    }
    const nativeEvidence=assertNativeEvidence(nativeReport);
    console.log('[release] Rebuild versioned game data, portable calculator and tutorial.');
    await run(process.execPath,['scripts/build-verified-data.cjs'],{env});
    await run(process.execPath,['scripts/build-ai-metadata.cjs'],{env});
    await run(process.execPath,['scripts/build-version126-trainers.cjs'],{env});
    await run(process.execPath,['scripts/build-version126-dex.cjs'],{env});
    await run(process.execPath,['scripts/build-portable.cjs'],{env});
    await run(process.execPath,['scripts/build-tutorial.cjs'],{env});
    const sourceFiles = contentFiles(root), sourceHash = fingerprint(sourceFiles);
    const tests = fs.readdirSync(path.join(root,'tests')).filter(n=>n.endsWith('.test.cjs')).sort().map(n=>'tests/'+n);
    console.log('[release] Run source tests.');
    const sourceTAP = await run(process.execPath,['--test','--test-reporter=tap',...tests],{env,log:path.join(proofRoot,'source-tests.txt')});
    const sourceTests = parseTests(sourceTAP), browsers={};
    const copyProof = (file, relative) => {const dest=path.join(proofRoot,relative);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(file,dest);return path.relative(root,dest).split(path.sep).join('/');};
    async function checkBrowser(script, output, variant) {
      console.log('[release] Browser '+variant+': '+script);
      const entry=path.join(variant==='source'?root:stage,'CALCULATEUR.html'), began=Date.now();
      await run(process.execPath,['scripts/'+script],{env:{...env,NULL_CALC_ENTRY:entry},log:path.join(proofRoot,variant+'-'+script+'.log')});
      const file=path.join(root,'verification',output), report=assertFreshReport(file,began);
      const proof=copyProof(file,variant+'/'+output);
      browsers[variant+'/'+script]={entrySHA256:sha(fs.readFileSync(entry)),checkedAt:report.checkedAt||report.recordedAt,report:proof,sha256:sha(fs.readFileSync(file)),errors:[]};
    }
    for(const [script,output] of browserCases)await checkBrowser(script,output,'source');
    assert.equal(fingerprint(contentFiles(root)),sourceHash,'Source changed during verification; start a fresh release.');
    console.log('[release] Build fresh bundled distribution.');
    await run(python.command,[...python.prefix,'scripts/package-unified.py','build','--stage',stage],{env});
    const manifest=readJSON(path.join(stage,'documentation/MANIFESTE.json'));
    console.log('[release] Run staged tests.');
    const stageTAP=await run(process.execPath,['--test','--test-reporter=tap',...tests],{cwd:stage,env,log:path.join(proofRoot,'distribution-tests.txt')});
    const distributionTests=parseTests(stageTAP);assert.deepEqual(distributionTests,sourceTests);
    for(const [script,output] of browserCases)await checkBrowser(script,output,'distribution');
    console.log('[release] Compare source/distribution behavior and assets.');
    const equivalenceAt=Date.now();
    await run(process.execPath,['scripts/check-organized-browser.cjs'],{env:{...env,NULL_OPTIMIZED_ROOT:stage},log:path.join(proofRoot,'organized-browser.log')});
    const equivalence=assertFreshReport(path.join(root,'verification/organized-browser.json'),equivalenceAt);
    assert.equal(equivalence.equivalent,true);assert.ok(equivalence.comparedSnapshots.length>=config.minimumComparedSnapshots);
    copyProof(path.join(root,'verification/organized-browser.json'),'organized-browser.json');
    assert.equal(fingerprint(contentFiles(root)),sourceHash,'Source changed during verification; start a fresh release.');
    const stageFiles=contentFiles(stage);
    for(const [file,expected] of Object.entries(sourceFiles)) {
      if(file==='CALCULATEUR.html'||file.endsWith('.bundle.js')||(!file.includes('/')&&/\.(md|txt)$/i.test(file)))continue;
      assert.equal(stageFiles[file],expected,'Readable source differs from distribution: '+file);
    }
    assert.equal(assertProtected(stage),protectedCount);
    // New staged reports were written outside the stage so equivalence saw an
    // untouched manifest. Only now copy evidence and refresh its checksum list.
    const proofFiles={};
    for(const file of filesIn(proofRoot)) {
      const relative=path.relative(root,path.join(proofRoot,file)).split(path.sep).join('/');
      const dest=path.join(stage,relative);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,relative),dest);
      proofFiles[relative]=sha(fs.readFileSync(dest));
    }
    const validation={revision,aiRevision:revision,releaseVerified:true,runId,buildId:manifest.buildId,startedAt,checkedAt:new Date().toISOString(),sourceTests,distributionTests,browsers,
      browserEquivalence:{equivalent:true,comparedSnapshots:equivalence.comparedSnapshots.length},
      gameVersion:config.gameVersion,trainerSetsPreserved:2280,trainerSetsCurrent:2288,protectedOriginalFilesVerified:protectedCount,singleArchive:true,nativeParityCertified:false,nativeROMRechecked,sourceAndDistributionModulesEqual:true,
      nativeAudit:{romSHA256:nativeEvidence.romSHA256,auditScriptSHA256:nativeEvidence.auditScriptSHA256,reportSHA256:sha(fs.readFileSync(nativeReport))},
      sourceContentSHA256:sourceHash,distributionContentSHA256:fingerprint(stageFiles),proofFiles};
    writeJSON(path.join(root,'verification/unified-validation.json'),validation);
    writeJSON(path.join(stage,'verification/unified-validation.json'),validation);
    await run(python.command,[...python.prefix,'scripts/package-unified.py','refresh-manifest','--stage',stage],{env});
    console.log('[release] Verify ZIP CRC and every manifest checksum.');
    await run(python.command,[...python.prefix,'scripts/package-unified.py','package','--stage',stage],{env});
    console.log('[release] Complete: '+sourceTests.tests+' tests on source and distribution; one verified ZIP.');
  } finally {if(lock!==undefined)fs.closeSync(lock);fs.unlinkSync(lockPath);}
}

module.exports={browserCases,contentFiles,fingerprint,parseTests,assertFreshReport,pythonCommand,main};
if(require.main===module)main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
