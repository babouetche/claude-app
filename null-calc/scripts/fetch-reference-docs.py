"""Refresh public documentary sources into verification, without touching inputs."""
import concurrent.futures
import hashlib
import json
import pathlib
import urllib.request

root = pathlib.Path(__file__).resolve().parents[1]
sources = {
    'move-changes-current.csv': 'https://docs.google.com/spreadsheets/d/17Vyr-bXeu9MGMZt_7dttb1OF8cuIcc5LihYmL0DEUu8/export?format=csv',
    'pokemon-null-ai-current.txt': 'https://docs.google.com/document/d/1KwkghD6eOZ026HR81C7yToDD_7fPwL2Iccc_XNL-G48/export?format=txt',
    'mechanic-changes-current.txt': 'https://drive.google.com/uc?export=download&id=1eT_iu57FVhxJHkjPC0zy5qAkmVxdmD85',
}
def fetch(item):
    name, url = item
    with urllib.request.urlopen(url, timeout=25) as response:
        content = response.read()
    text = content.decode('utf-8-sig')
    if len(text) < 1000 or '<html' in text[:300].lower():
        raise ValueError('Not a public document export: ' + name)
    (root / 'verification' / name).write_bytes(content)
    return name, dict(url=url, sha256=hashlib.sha256(content).hexdigest(), bytes=len(content))
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    manifest = dict(pool.map(fetch, sources.items()))
(root / 'verification/documentary-sources.json').write_text(json.dumps(manifest, indent=2)+'\n', encoding='utf8')
print(json.dumps(manifest))
