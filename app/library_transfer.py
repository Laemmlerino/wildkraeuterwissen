"""Export and activate an Herbarium library as a single ZIP."""
import json
from pathlib import Path
import re
import shutil
import tempfile
import zipfile

MAX_BYTES = 1024 * 1024 * 1024
INDEXES = {'catalog.json', 'photos.json', 'study-plates.json',
           'image-decisions.json', 'name-decisions.json'}
ASSET = re.compile(r'(?:documents/[a-f0-9]{16}\.pdf|images/[a-zA-Z0-9_-]+\.(?:png|jpe?g|webp))')


def library_data(root):
    uploaded = root / 'uploaded-library'
    return uploaded if uploaded.is_dir() else root


def write_bundle(data, output):
    with zipfile.ZipFile(output, 'w') as archive:
        for name in sorted(INDEXES):
            path = data / name
            if path.is_file():
                archive.write(path, name, compress_type=zipfile.ZIP_DEFLATED)
        for directory in ('documents', 'images'):
            for path in sorted((data / directory).glob('*')):
                name = path.relative_to(data).as_posix()
                if ASSET.fullmatch(name) and path.is_file():
                    archive.write(path, name)


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
                        or any(name not in INDEXES and not ASSET.fullmatch(name) for name in names)):
                    raise ValueError('Das ZIP ist kein gültiges Herbarium-Paket.')
                for entry in files:
                    path = staged / entry.filename
                    path.parent.mkdir(exist_ok=True)
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
        for document in catalog['documents']:
            if not isinstance(document, dict) or f"documents/{document.get('id')}.pdf" not in names:
                raise ValueError('Im Paket fehlt ein referenziertes PDF.')
        for plant in catalog['plants']:
            if not isinstance(plant, dict) or not all(isinstance(plant.get(k), str) for k in ('id','latin','de')):
                raise ValueError('Das Paket enthält eine ungültige Pflanzenkarte.')
            if plant.get('image') and str(plant['image']).lstrip('/') not in names:
                raise ValueError('Im Paket fehlt ein referenziertes Pflanzenbild.')
        if (library_data(root) / 'catalog.json').exists():
            raise FileExistsError('Auf diesem Server ist bereits eine Bibliothek eingerichtet.')
        staged.rename(root / 'uploaded-library')
        return len(catalog['documents']), len(catalog['plants'])


def read_object(path):
    value = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(value, dict):
        raise ValueError('Das Paket enthält einen ungültigen Index.')
    return value
