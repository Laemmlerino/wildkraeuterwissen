"""Cache reusable taxon photos from iNaturalist and Wikimedia Commons with attribution."""
import argparse
import hashlib
from html import unescape
import json
from pathlib import Path
import re
import time
import threading
from concurrent.futures import ThreadPoolExecutor
from urllib import error, parse, request

API = 'https://api.inaturalist.org/v1'
LICENSES = {'cc0': ('CC0', 'https://creativecommons.org/publicdomain/zero/1.0/'),
            'cc-by': ('CC BY', 'https://creativecommons.org/licenses/by/4.0/'),
            'cc-by-sa': ('CC BY-SA', 'https://creativecommons.org/licenses/by-sa/4.0/')}
SYNONYMS = {
    'Bryonia dioica': ['Bryonia cretica subsp. dioica'],
    'Iris germanica': ['Iris × germanica'],
    'Rubus fruticosus': ['Rubus armeniacus'],
    'Atropa belladonna': ['Atropa bella-donna'],
    'Bistorta officinalis': ['Polygonum bistorta'],
    'Chenopodium bonus-henricus': ['Blitum bonus-henricus'],
    'Crataegus spp.': ['Crataegus'],
    'Dipsacus fullonum': ['Dipsacus sylvestris'],
    'Elymus repens': ['Elytrigia repens'],
    'Epilobium angustifolium': ['Chamerion angustifolium', 'Chamaenerion angustifolium'],
    'Euphrasia rostkoviana': ['Euphrasia officinalis rostkoviana'],
    'Hieracium pilosella': ['Pilosella officinarum'],
    'Lamium galeobdolon': ['Lamiastrum galeobdolon'],
    'Mespilus germanica': ['Crataegus germanica'],
    'Mutellina adonidifolia': ['Ligusticum mutellina', 'Meum mutellina'],
    'Mycelis muralis': ['Lactuca muralis'],
    'Potentilla anserina': ['Argentina anserina'],
    'Ranunculus ficaria': ['Ficaria verna'],
    'Rosmarinus officinalis': ['Salvia rosmarinus'],
    'Scorzoneroides autumnalis': ['Leontodon autumnalis'],
    'Sedum telephium': ['Hylotelephium telephium'],
    'Sorbus aria': ['Aria edulis'],
    'Sorbus torminalis': ['Torminalis glaberrima', 'Torminalis torminalis'],
    'Vaccinium oxycoccos': ['Oxycoccus palustris'],
}


def download(url, limit):
    req = request.Request(url, headers={'User-Agent': 'Wildkraeuterwissen/1.0 (local herbarium; source attribution retained)'})
    with request.urlopen(req, timeout=12) as response:
        data = response.read(limit + 1)
    if len(data) > limit:
        raise ValueError('Antwort zu gross')
    return data


_request_lock = threading.Lock()
_next_request = 0.0


def api(collection, parameters):
    global _next_request
    with _request_lock:
        time.sleep(max(0, _next_request - time.monotonic()))
        _next_request = time.monotonic() + 1.1
    url = f'{API}/{collection}?{parse.urlencode(parameters)}'
    return json.loads(download(url, 5_000_000))['results']


def store_photo(taxon, photo, images, observation_url=None, observer=None):
    license_code = photo.get('license_code')
    original = photo.get('medium_url') or photo.get('url', '')
    ident = photo.get('id')
    credit = photo.get('attribution_name') or (
        observer if license_code == 'cc0' else photo.get('attribution'))
    if license_code not in LICENSES or not isinstance(ident, int) or not credit:
        return None
    match = re.fullmatch(r'https://inaturalist-open-data\.s3\.amazonaws\.com/photos/(\d+)/(?:square|medium)\.(jpe?g)', original)
    if not match or int(match[1]) != ident:
        return None
    try:
        url = f'https://inaturalist-open-data.s3.amazonaws.com/photos/{ident}/medium.{match[2]}'
        content = download(url, 5_000_000)
    except error.HTTPError as exc:
        if exc.code in (403, 404):
            return None
        raise
    if not content.startswith(b'\xff\xd8\xff'):
        return None
    license_name, license_url = LICENSES[license_code]
    clean_credit = re.match(r'\(c\) (.*?), some rights reserved', credit)
    filename = 'foto-' + hashlib.sha256(str(ident).encode()).hexdigest()[:20] + '.jpg'
    (images / filename).write_bytes(content)
    return dict(image=f'/images/{filename}', url=observation_url or f'https://www.inaturalist.org/photos/{ident}',
                taxon=taxon, credit=clean_credit[1] if clean_credit else credit,
                license=license_name, license_url=license_url)


def fetch_photo(plant, images, excluded_url=None):
    names = [plant['latin'], *SYNONYMS.get(plant['latin'], [])]
    for name in names:
        if name.endswith(' spp.'):
            continue
        results = api('observations', {'taxon_name': name, 'per_page': 10, 'quality_grade': 'research',
                                        'photo_license': ','.join(LICENSES), 'order_by': 'votes'})
        for result in results:
            if result.get('uri') == excluded_url:
                continue
            taxon = (result.get('taxon') or {}).get('name', '')
            exact = taxon.casefold() == name.casefold()
            descendant = taxon.casefold().startswith(name.casefold() + ' ')
            if not exact and not descendant:
                continue
            observer = result.get('user', {})
            for photo in result.get('photos', []):
                entry = store_photo(taxon, photo, images, result.get('uri'), observer.get('name') or observer.get('login'))
                if entry:
                    return entry
    for name in names:
        results = api('taxa', {'q': name, 'per_page': 12, 'is_active': 'true'})
        taxon = next((result for result in results if result['name'].casefold() == name.casefold()), None)
        if taxon:
            entry = store_photo(taxon['name'], taxon.get('default_photo') or {}, images)
            if entry:
                return entry
    return None


def commons_photo(plant, images):
    names = [plant['latin'], *SYNONYMS.get(plant['latin'], [])]
    for name in names:
        if name.endswith(' spp.'):
            continue
        query = parse.urlencode({
            'action': 'query', 'format': 'json', 'generator': 'categorymembers',
            'gcmtype': 'file', 'gcmlimit': 20, 'gcmtitle': 'Category:' + name,
            'prop': 'imageinfo', 'iiprop': 'url|size|extmetadata', 'iiurlwidth': 800
        })
        pages = json.loads(download('https://commons.wikimedia.org/w/api.php?' + query, 3_000_000))
        for page in pages.get('query', {}).get('pages', {}).values():
            filename = page['title'].casefold().replace('_', ' ')
            if name.casefold() not in filename or not filename.endswith(('.jpg', '.jpeg')):
                continue
            if re.search(r'illustration|herbarium|plate|köhler|flore|painting|distribution|drawing', filename):
                continue
            info = page['imageinfo'][0]
            meta = {key: field['value'] for key, field in info['extmetadata'].items()}
            license_name = meta.get('LicenseShortName', '')
            license_url = meta.get('LicenseUrl', '').replace('http://creativecommons.org/', 'https://creativecommons.org/', 1)
            if not re.fullmatch(r'CC BY(?:-SA)? [1-4]\.\d|CC0(?: 1\.0)?', license_name):
                continue
            if not license_url.startswith('https://creativecommons.org/'):
                continue
            url = info.get('url', '') if info.get('size', 0) in range(1, 5_000_001) else info.get('thumburl', '')
            host = parse.urlsplit(url).hostname
            credit = unescape(re.sub(r'<[^>]*>', '', meta.get('Artist', ''))).strip()
            if host not in {'thumb.wikimedia.org', 'upload.wikimedia.org'} or not credit:
                continue
            try:
                content = download(url, 5_000_000)
            except error.HTTPError as exc:
                if exc.code in (403, 404, 429):
                    continue
                raise
            if not content.startswith(b'\xff\xd8\xff'):
                continue
            local = 'foto-' + hashlib.sha256(info['url'].encode()).hexdigest()[:20] + '.jpg'
            (images / local).write_bytes(content)
            return dict(image=f'/images/{local}', url=info['descriptionurl'], taxon=name,
                        credit=credit, platform='Wikimedia Commons', license=license_name,
                        license_url=license_url)
    return None


def attempt(plant, images):
    for fetch in (commons_photo, fetch_photo):
        try:
            photo = fetch(plant, images)
            if photo:
                return photo
        except (OSError, ValueError, KeyError) as exc:
            print(f"{plant['latin']}: {exc}", flush=True)
            if fetch is fetch_photo and isinstance(exc, error.HTTPError) and exc.code == 429:
                time.sleep(60)
    return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('data', type=Path)
    args = parser.parse_args()
    index = args.data / 'photos.json'
    photos = json.loads(index.read_text()) if index.exists() else {}
    images = args.data / 'images'
    plants = json.loads((args.data / 'catalog.json').read_text())['plants']
    plants.sort(key=lambda p: (not p.get('school'), bool(p.get('image')), p['latin']))
    pending = [plant for plant in plants if plant['id'] not in photos and not plant['image']]
    with ThreadPoolExecutor(max_workers=4) as pool:
        for plant, photo in zip(pending, pool.map(lambda plant: attempt(plant, images), pending)):
            if not photo:
                print(f"{plant['latin']}: kein passendes frei lizenziertes Foto", flush=True)
                continue
            photos[plant['id']] = photo
            temporary = index.with_suffix('.tmp')
            temporary.write_text(json.dumps(photos, ensure_ascii=False), encoding='utf-8')
            temporary.replace(index)
            if len(photos) % 20 == 0:
                print(f'{len(photos)} Fotos gespeichert', flush=True)
    print(f'{len(photos)} Fotos gespeichert', flush=True)


if __name__ == '__main__':
    main()
