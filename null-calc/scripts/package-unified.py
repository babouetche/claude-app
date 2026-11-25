"""Portable staging and ZIP integrity. Public workflow: node scripts/release.cjs.

Package refuses absent/stale verification. Sources stay readable; bundles use
the exact HTML loader order. Existing stages are never deleted or overwritten.
"""
import argparse
import datetime
import hashlib
import json
import os
import pathlib
import re
import shutil
import uuid
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
CONFIG = json.loads((ROOT / 'scripts/release-config.json').read_text(encoding='utf8'))
POLICY = json.loads((ROOT / 'scripts/archive-policy.json').read_text(encoding='utf8'))
EXCLUDED_FILES = set(POLICY['excludeFiles'])
VERIFICATION_INPUTS = set(POLICY['verificationInputs'])
REVISION = CONFIG['revision']
DEFAULT = ROOT.parent / 'livraison' / 'version-unique-stage' / 'Null-Calculateur'
EXTERNAL = {'verification/move-changes-current.csv', 'verification/pokemon-null-ai-current.txt',
            'verification/mechanic-changes-current.txt'}
SKIP_PARTS = {'.git', 'node_modules', '__pycache__'}
ROM_MODULES = {'verified-data.js', 'verified-data-adapter.js'}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def json_read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def json_write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf8')


def eligible(path, root):
    rel = path.relative_to(root)
    return (path.is_file() and rel.as_posix() not in EXTERNAL
            and rel.as_posix() not in EXCLUDED_FILES
            and not any(p in SKIP_PARTS for p in rel.parts)
            and path.suffix.lower() not in {'.gba', '.sav', '.log'})


def files_under(root):
    # Prune dependency/history directories before traversing them, matching the
    # Node workflow rather than walking node_modules merely to discard its files.
    for directory, folders, names in os.walk(root):
        folders[:] = sorted(name for name in folders if name not in SKIP_PARTS)
        for name in folders + names:
            if (pathlib.Path(directory) / name).is_symlink():
                raise RuntimeError('Symlinks are not release inputs: ' + str(pathlib.Path(directory) / name))
        for name in sorted(names):
            yield pathlib.Path(directory) / name


def content_files(root):
    """Same freshness contract as release.cjs; evidence is deliberately excluded."""
    result = {}
    for p in sorted(files_under(root)):
        if not eligible(p, root):
            continue
        rel = p.relative_to(root)
        if rel.parts[0] == 'verification' or rel.as_posix() == 'documentation/MANIFESTE.json':
            continue
        result[rel.as_posix()] = digest(p.read_bytes())
    return result


def fingerprint(files):
    return digest(json.dumps(files, ensure_ascii=False, separators=(',', ':'), sort_keys=True).encode('utf8'))


def protected(root):
    expected = json_read(root / 'tests/fixtures/input-archive.json')['hashes']
    for rel, value in expected.items():
        if digest((root / rel).read_bytes()) != value:
            raise RuntimeError('Protected original changed: ' + rel)
    return len(expected)


def compact(text):
    a, b = text.index('{'), text.rindex('}') + 1
    value = json.loads(text[a:b])
    return text[:a] + json.dumps(value, ensure_ascii=False, separators=(',', ':')) + text[b:]


def module_groups(index):
    modules = re.findall(r'<script type="text/javascript" src="\./js/null_ai/([^"/]+\.js)"></script>', index)
    if not modules or len(modules) != len(set(modules)):
        raise RuntimeError('Missing or duplicated AI module loader entries.')
    rom = [n for n in modules if n in ROM_MODULES]
    ia = [n for n in modules if n not in ROM_MODULES]
    if set(rom) != ROM_MODULES or not {'core.js', 'state.js', 'switch.js', 'ui.js'}.issubset(ia):
        raise RuntimeError('Unexpected loader groups; inspect index.html before release.')
    if any(n.endswith('.bundle.js') for n in modules):
        raise RuntimeError('Source index must load readable modules, not generated bundles.')
    return {'rom': rom, 'ia': ia}


def refresh_manifest(target, manifest=None):
    path = target / 'documentation/MANIFESTE.json'
    manifest = manifest or json_read(path)
    manifest['checksums'] = {p.relative_to(target).as_posix(): digest(p.read_bytes())
                             for p in sorted(files_under(target)) if p != path}
    json_write(path, manifest)
    return manifest


def build(target):
    if target.exists():
        raise RuntimeError('Choose a fresh --stage directory; existing builds are not deleted.')
    protected_count = protected(ROOT)
    index = (ROOT / 'docs/index.html').read_text(encoding='utf8')
    groups = module_groups(index)
    for name in ['DOCUMENTATION_COMPLETE.md', 'GUIDE_AGENTS.md', 'HISTORIQUE.md']:
        if not (ROOT / 'documentation' / name).is_file():
            raise RuntimeError('Missing current or historical handoff: ' + name)
    for name in VERIFICATION_INPUTS:
        if not (ROOT / 'verification' / name).is_file():
            raise RuntimeError('Missing current audit input: ' + name)
    target.mkdir(parents=True)
    omitted_verification = 0
    for source in sorted(files_under(ROOT)):
        if not eligible(source, ROOT):
            continue
        rel = source.relative_to(ROOT)
        # Copy audit inputs, not earlier runs, screenshots or generated reports.
        # Fresh source/distribution proofs are added by release.cjs after checks.
        if rel.parts[0] == 'verification' and (
                len(rel.parts) != 2 or rel.parts[1] not in VERIFICATION_INPUTS):
            omitted_verification += 1
            continue
        if len(rel.parts) == 1 and source.suffix.lower() in {'.md', '.txt'} and rel.name != 'README.md':
            continue
        if rel.as_posix() == 'documentation/MANIFESTE.json':
            continue
        dest = target / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, dest)
    transformations = []
    for group, names in groups.items():
        content = []
        for name in names:
            text = (ROOT / 'docs/js/null_ai' / name).read_text(encoding='utf8')
            if name in {'metadata.js', 'verified-data.js'}:
                text = compact(text)
            content.append('// Source: docs/js/null_ai/' + name + '\n' + text + '\n;\n')
        rel = 'docs/js/null_ai/' + group + '.bundle.js'
        (target / rel).write_text('\n'.join(content), encoding='utf8')
        transformations.append({'output': rel, 'inputs': ['docs/js/null_ai/' + n for n in names],
                                'method': 'Loader-order concatenation; only generated JSON whitespace is compacted.'})
        pattern = r'\s*'.join(re.escape('<script type="text/javascript" src="./js/null_ai/' + n + '"></script>') for n in names)
        index, count = re.subn(pattern, '<script type="text/javascript" src="./js/null_ai/' + group + '.bundle.js"></script>', index)
        if count != 1:
            raise RuntimeError('AI scripts must be contiguous in loader order: ' + group)
    (target / 'CALCULATEUR.html').write_text(index.replace('<head>', '<head>\n    <base href="./docs/" />'), encoding='utf8')
    manifest = {'revision': 'unified-complete-distribution', 'date': datetime.date.today().isoformat(),
                'builtAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                'buildId': str(uuid.uuid4()), 'applicationRevision': REVISION, 'gameplayRevision': REVISION,
                'trainerSetsPreserved': 2280, 'protectedOriginalFilesVerified': protected_count,
                'readableSourceModulesIncluded': True, 'transformations': transformations,
                'archivePolicy': {'schemaVersion': POLICY['schemaVersion'],
                                  'policySHA256': digest((ROOT / 'scripts/archive-policy.json').read_bytes()),
                                  'previousVerificationFilesOmitted': omitted_verification,
                                  'verificationInputs': sorted(VERIFICATION_INPUTS),
                                  'supersededToolsExcluded': sorted(EXCLUDED_FILES)}}
    manifest = refresh_manifest(target, manifest)
    protected(target)
    print(json.dumps({'stage': str(target), 'buildId': manifest['buildId'],
                      'files': len(manifest['checksums']) + 1, 'protectedOriginalFilesVerified': protected_count}))


def verify_attestation(target, manifest):
    report = json_read(target / 'verification/unified-validation.json')
    if not report.get('releaseVerified') or report.get('revision') != REVISION:
        raise RuntimeError('Run node scripts/release.cjs: missing current release verification.')
    if report.get('buildId') != manifest['buildId']:
        raise RuntimeError('Stale verification: buildId differs from the fresh staging build.')
    if datetime.datetime.fromisoformat(report['checkedAt'].replace('Z', '+00:00')) < datetime.datetime.fromisoformat(manifest['builtAt']):
        raise RuntimeError('Verification predates this build.')
    for key in ['sourceTests', 'distributionTests']:
        tests = report[key]
        if not tests['tests'] or tests['tests'] != tests['pass'] or tests['fail'] or tests['skipped']:
            raise RuntimeError('Incomplete or failing tests: ' + key)
    if report['sourceTests'] != report['distributionTests']:
        raise RuntimeError('Source and staged tests disagree.')
    if not report.get('sourceAndDistributionModulesEqual'):
        raise RuntimeError('Readable modules were not compared.')
    native_path = target / 'verification/native-threshold-rom.json'
    native = json_read(native_path)
    if native.get('status') != 'verified' or native.get('errors') or not all(c['passed'] for c in native['checks']):
        raise RuntimeError('Native ROM audit evidence is invalid.')
    if native['auditScriptSHA256'] != digest((target / 'scripts/audit-native-thresholds.py').read_bytes()):
        raise RuntimeError('Native ROM audit evidence predates its script.')
    if report['nativeAudit'] != {'romSHA256': native['romSHA256'], 'auditScriptSHA256': native['auditScriptSHA256'], 'reportSHA256': digest(native_path.read_bytes())}:
        raise RuntimeError('Native ROM audit evidence differs from release validation.')
    if report['sourceContentSHA256'] != fingerprint(content_files(ROOT)):
        raise RuntimeError('Source changed after verification; run release again.')
    if report['distributionContentSHA256'] != fingerprint(content_files(target)):
        raise RuntimeError('Distribution changed after verification; run release again.')
    if not report.get('browsers') or not report.get('browserEquivalence', {}).get('equivalent'):
        raise RuntimeError('Missing browser scenarios or source/distribution equivalence.')
    if report['browserEquivalence']['comparedSnapshots'] < CONFIG['minimumComparedSnapshots']:
        raise RuntimeError('Incomplete browser comparison.')
    for variant in ['source', 'distribution']:
        entry = (ROOT if variant == 'source' else target) / 'CALCULATEUR.html'
        for script, _ in CONFIG['browserCases']:
            case = report['browsers'][variant + '/' + script]
            if case['errors'] or case['entrySHA256'] != digest(entry.read_bytes()):
                raise RuntimeError('Missing or mismatched browser target: ' + variant + '/' + script)
            proof = target / case['report']
            if digest(proof.read_bytes()) != case['sha256'] or case['report'] not in report['proofFiles']:
                raise RuntimeError('Missing browser evidence: ' + script)
            raw = json_read(proof)
            if raw['errors'] or (raw.get('htmlSHA256') and raw['htmlSHA256'] != case['entrySHA256']):
                raise RuntimeError('Browser evidence has errors or a different entry: ' + script)
    for rel, expected in report['proofFiles'].items():
        if digest((target / rel).read_bytes()) != expected:
            raise RuntimeError('Verification evidence changed: ' + rel)
    return report


def assert_archive_layout(names, report):
    """Do not allow previous evidence/tools to reappear through a later copy."""
    expected = {'verification/' + name for name in VERIFICATION_INPUTS}
    expected.add('verification/unified-validation.json')
    expected.update(report['proofFiles'])
    actual = {name for name in names if name.startswith('verification/')}
    if actual != expected:
        raise RuntimeError('Archive contains obsolete or missing verification files.')
    prefix = 'verification/release-proof/' + report['runId'] + '/'
    if not all(name.startswith(prefix) for name in report['proofFiles']):
        raise RuntimeError('Archive must contain exactly the current proof run.')
    if set(names) & EXCLUDED_FILES:
        raise RuntimeError('A superseded packaging/documentation tool was included.')


def package(target):
    manifest = json_read(target / 'documentation/MANIFESTE.json')
    actual = {p.relative_to(target).as_posix() for p in files_under(target)
              if p != target / 'documentation/MANIFESTE.json'}
    if actual != set(manifest['checksums']):
        raise RuntimeError('Distribution file list differs from manifest.')
    for rel, expected in manifest['checksums'].items():
        if digest((target / rel).read_bytes()) != expected:
            raise RuntimeError('Generated file changed: ' + rel)
    protected_count = protected(target)
    report = verify_attestation(target, manifest)
    assert_archive_layout(actual, report)
    out = ROOT.parent / 'livraison'
    out.mkdir(exist_ok=True)
    path = out / ('Null-' + CONFIG['gameVersion'] + '-Calculateur-Complet-EN-FR.zip')
    temporary = out / ('.' + manifest['buildId'] + '.tmp.zip')
    files = sorted(files_under(target))
    with zipfile.ZipFile(temporary, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for p in files:
            archive.write(p, 'Null-Calculateur/' + p.relative_to(target).as_posix())
    with zipfile.ZipFile(temporary) as archive:
        if archive.testzip() is not None:
            raise RuntimeError('ZIP CRC verification failed.')
        if len(archive.namelist()) != len(files):
            raise RuntimeError('ZIP file list differs from distribution.')
        for rel, expected in manifest['checksums'].items():
            if digest(archive.read('Null-Calculateur/' + rel)) != expected:
                raise RuntimeError('ZIP content differs: ' + rel)
        if archive.read('Null-Calculateur/documentation/MANIFESTE.json') != (target / 'documentation/MANIFESTE.json').read_bytes():
            raise RuntimeError('ZIP manifest differs.')
        if any(n.lower().endswith(('.gba', '.sav')) for n in archive.namelist()):
            raise RuntimeError('Private ROM/save accidentally included.')
    os.replace(temporary, path)
    sha = digest(path.read_bytes())
    path.with_suffix('.zip.sha256').write_text(sha + '  ' + path.name + '\n', encoding='utf8')
    result = {'zip': str(path), 'bytes': path.stat().st_size, 'files': len(files), 'sha256': sha,
              'revision': REVISION, 'buildId': manifest['buildId'], 'tests': report['sourceTests']['tests'],
              'protectedOriginalFilesVerified': protected_count, 'singleArchive': True,
              'verificationFiles': sum(p.relative_to(target).parts[0] == 'verification' for p in files),
              'proofRuns': 1}
    json_write(out / 'version-unique-resultats.json', result)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['build', 'package', 'refresh-manifest'])
    parser.add_argument('--stage', type=pathlib.Path, default=DEFAULT)
    args = parser.parse_args()
    target = args.stage.resolve()
    if target == ROOT or target.is_relative_to(ROOT):
        raise RuntimeError('Output must be outside the source project.')
    {'build': build, 'package': package, 'refresh-manifest': refresh_manifest}[args.action](target)
