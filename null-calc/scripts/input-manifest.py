"""Read the supplied archive without altering it; record protected original files."""
import hashlib, json, pathlib, sys, zipfile

root = pathlib.Path(__file__).resolve().parents[1]
archive_path = pathlib.Path(sys.argv[1])
protected = {}
with zipfile.ZipFile(archive_path) as archive:
    for entry in archive.infolist():
        if entry.is_dir():
            continue
        parts = pathlib.PurePosixPath(entry.filename).parts
        relative = '/'.join(parts[1:])
        if relative.startswith(('docs/calc/', 'docs/js/data/', 'docs/porydex/data/')) or relative in ['docs/js/shared_controls.js', 'docs/js/moveset_import.js']:
            protected[relative] = hashlib.sha256(archive.read(entry)).hexdigest()
manifest = {'archive': archive_path.name, 'archiveSHA256': hashlib.sha256(archive_path.read_bytes()).hexdigest(),
            'hashes': protected}
(root / 'tests/fixtures/input-archive.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf8')
print(f'{len(protected)} protected files recorded from the supplied ZIP.')
