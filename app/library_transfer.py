"""Export and activate an Herbarium library as a single ZIP."""
from functools import lru_cache
import hashlib
import json
from pathlib import Path
import re
import shutil
import tempfile
import zipfile

from managed_documents import IMAGE_EXTENSIONS

MAX_BYTES = 1024 * 1024 * 1024
INDEXES = {'catalog.json', 'photos.json', 'study-plates.json',
           'image-decisions.json', 'name-decisions.json'}
MANAGED_MANAGED_IMAGE = re.compile(r'managed-documents/(image-[a-f0-9]{64})/(index\.json|image\.(?:png|jpe?g|webp))')
ASSET = re.compile(r'managed-documents/(upload-[a-f0-9]{64})/(document\.pdf|index\.json)')
MANAGED_IMAGE = re.compile(r'managed-documents/(image-[a-f0-9]{64})/(index\.json|image\.(?:png|jpe?g|webp))')
ASSET = re.compile(r'(?:documents/[a-f0-9]{16}\.pdf|images/[a-zA-Z0-9_-]+\.(?:png|jpe?g|webp))')


def library_data(root):
    uploaded = root / 'uploaded-library'
    return uploaded if uploaded.is_dir() else root


def managed_roots(root):
    base = library_data(root)
    if base != root:
        yield base / 'managed-documents'
    yield root / 'managed-documents'


@lru_cache(maxsize=512)
def pdf_digest(path, size, modified, changed):
    with path.open('rb') as pdf:
        return hashlib.file_digest(pdf, 'sha256').hexdigest()


def course_pdfs(data):
    fingerprints = {}
    for path in (data / 'documents').glob('*.pdf'):
        if path.is_file():
            stat = path.stat()
            fingerprints[path.stem] = pdf_digest(path, stat.st_size, stat.st_mtime_ns, stat.st_ctime_ns)
    return fingerprints


def course_upload_ids(data):
    return {'upload-' + digest for digest in course_pdfs(data).values()}


def deduplicate_course(catalog, data):
    fingerprints = course_pdfs(data)
    aliases = catalog.get('document_aliases', {}).copy()
    primary = {}
    for document in sorted(catalog['documents'], key=lambda doc: bool(re.search(r' \(\d+\)\.pdf$', doc['title']))):
        ident = document['id']
        if digest := fingerprints.get(ident):
            original = primary.setdefault(digest, ident)
            if original != ident:
                aliases[ident] = original
    if aliases:
        catalog['document_aliases'] = {alias: aliases.get(doc, doc) for alias, doc in aliases.items()}
        catalog['documents'] = [doc for doc in catalog['documents'] if doc['id'] not in aliases]
        catalog['pages'] = [page for page in catalog['pages'] if page['doc'] not in aliases]
    return catalog


def write_bundle(data, output, uploads=()):
    catalog = deduplicate_course(read_object(data / 'catalog.json'), data)
    aliases = catalog.get('document_aliases', {})
    with zipfile.ZipFile(output, 'w') as archive:
        archive.writestr('catalog.json', json.dumps(catalog, ensure_ascii=False), compress_type=zipfile.ZIP_DEFLATED)
        for name in sorted(INDEXES - {'catalog.json'}):
            path = data / name
            if path.is_file():
                archive.write(path, name, compress_type=zipfile.ZIP_DEFLATED)
        for directory in ('documents', 'images'):
            for path in sorted((data / directory).glob('*')):
                name = path.relative_to(data).as_posix()
                if ASSET.fullmatch(name) and path.is_file() and (directory != 'documents' or path.stem not in aliases):
                    archive.write(path, name)

        seen = course_upload_ids(data)
        for directory in dict.fromkeys(uploads):
            for folder in sorted(directory.iterdir()) if directory.is_dir() else ():
                if folder.name in seen:
                    continue
                files = [path for path in folder.glob('*')
                         if path.is_file() and (MANAGED_ASSET.fullmatch(f'managed-documents/{folder.name}/{path.name}')
                                               or MANAGED_IMAGE.fullmatch(f'managed-documents/{folder.name}/{path.name}'))]
                if files:
                    seen.add(folder.name)
                for path in files:
                    name = f'managed-documents/{folder.name}/{path.name}'
                    archive.write(path, name, compress_type=zipfile.ZIP_DEFLATED if path.suffix == '.json' else zipfile.ZIP_STORED)


def receive_bundle(root, stream, size):
    root.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.library-', dir=root) as temp:
        staged = Path(temp) / 'library'
        staged.mkdir()
        with tempfile.TemporaryFile(dir=temp) as payload:
            while size:
                chunk = stream.read(min(size, 1024 * 1024))
                if not chunk:
                    raise ValueError('Der Upload wurde unterbrochen.')
                payload.write(chunk)
                size -= len(chunk)
            with zipfile.ZipFile(payload) as archive:
                files = archive.infolist()
                names = {entry.filename for entry in files}
                if (len(files) != len(names) or len(files) > 10_000
                        or sum(entry.file_size for entry in files) > MAX_BYTES
                        or 'catalog.json' not in names
                        or any(name not in INDEXES and not ASSET.fullmatch(name) and not MANAGED_ASSET.fullmatch(name)
                               and not MANAGED_IMAGE.fullmatch(name) for name in names)):
                    raise ValueError('Das ZIP ist kein gültiges Herbarium-Paket.')
                for entry in files:
                    path = staged / entry.filename
                    path.parent.mkdir(parents=True, exist_ok=True)
                    with archive.open(entry) as source, path.open('wb') as destination:
                        shutil.copyfileobj(source, destination)
        catalog = read_object(staged / 'catalog.json')
        for name in INDEXES - {'catalog.json'}:
            path = staged / name
            if path.exists():
                read_object(path)
        if any(not isinstance(catalog.get(key), list) for key in ('plants', 'documents', 'pages')):
            raise ValueError('Der Bibliotheksindex ist unvollständig.')
        if not catalog['plants'] or not catalog['documents']:
            raise ValueError('Das Paket enthält keine Pflanzen oder Unterlagen.')
        aliases = catalog.get('document_aliases', {})
        if (not isinstance(aliases, dict)
                or any(not re.fullmatch(r'[a-f0-9]{16}', alias) or not isinstance(doc, str)
                       or not re.fullmatch(r'[a-f0-9]{16}', doc) or f'documents/{doc}.pdf' not in names
                       for alias, doc in aliases.items())):
            raise ValueError('Das Paket enthält einen ungültigen PDF-Verweis.')
        for document in catalog['documents']:
            if not isinstance(document, dict) or f"documents/{document.get('id')}.pdf" not in names:
                raise ValueError('Im Paket fehlt ein referenziertes PDF.')
        for plant in catalog['plants']:
            if not isinstance(plant, dict) or not all(isinstance(plant.get(k), str) for k in ('id','latin','de')):
                raise ValueError('Das Paket enthält eine ungültige Pflanzenkarte.')
            if plant.get('image') and str(plant['image']).lstrip('/') not in names:
                raise ValueError('Im Paket fehlt ein referenziertes Pflanzenbild.')
        managed = staged / 'managed-documents'
        duplicates = course_upload_ids(staged)
        for folder in managed.glob('upload-*'):
            pdf = folder / 'document.pdf'
            if not pdf.is_file() or not (folder / 'index.json').is_file():
                raise ValueError('Im Paket fehlt eine hochgeladene PDF oder ihr Index.')
            index = read_object(folder / 'index.json')
            document = index.get('document')
            pages = index.get('pages')
            if (not isinstance(document, dict) or document.get('id') != folder.name
                    or not isinstance(document.get('title'), str) or document.get('managed') is not True
                    or not isinstance(document.get('pages'), int) or not isinstance(pages, list)
                    or any(not isinstance(page, dict) or page.get('doc') != folder.name
                           or not isinstance(page.get('page'), int) or not isinstance(page.get('text'), str)
                           for page in pages)):
                raise ValueError('Das Paket enthält einen ungültigen PDF-Index.')
            if folder.name in duplicates or any((directory / folder.name).exists() for directory in managed_roots(root)):
                shutil.rmtree(folder)
        for folder in managed.glob('image-*'):
            index = read_object(folder / 'index.json') if (folder / 'index.json').is_file() else {}
            files = [path for path in folder.iterdir() if path.name != 'index.json']
            if (len(files) != 1 or files[0].suffix not in IMAGE_EXTENSIONS
                    or index.get('id') != folder.name or not isinstance(index.get('title'), str)
                    or index.get('image') != f'/images/{folder.name}{files[0].suffix}'):
                raise ValueError('Im Paket fehlt ein hochgeladenes Bild oder sein Index ist ungültig.')
            if any((directory / folder.name).exists() for directory in managed_roots(root)):
                shutil.rmtree(folder)
        if (library_data(root) / 'catalog.json').exists():
            raise FileExistsError('Auf diesem Server ist bereits eine Bibliothek eingerichtet.')
        staged.rename(root / 'uploaded-library')
        return len(catalog['documents']) + sum(1 for _ in (root / 'uploaded-library' / 'managed-documents').glob('upload-*')), len(catalog['plants'])


def read_object(path):
    value = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(value, dict):
        raise ValueError('Das Paket enthält einen ungültigen Index.')
    return value
