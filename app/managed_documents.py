"""Files uploaded through the app, stored separately from the course package."""
import hashlib
import json
import re
import tempfile
import shutil
from pathlib import Path

import pymupdf

MAX_PDF_BYTES = 100 * 1024 * 1024
IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.webp'}
IMAGE_ID = re.compile(r'image-[a-f0-9]{64}')
MAX_IMAGE_BYTES = 20 * 1024 * 1024
DOCUMENT_ID = re.compile(r'upload-[a-f0-9]{64}')


def read_documents(root):
    documents, pages = [], []
    for path in sorted(root.glob('upload-*/index.json')):
        try:
            index = json.loads(path.read_text(encoding='utf-8'))
        except FileNotFoundError:  # Concurrent deletion.
            continue
        documents.append(index['document'])
        pages.extend({**page, 'title': index['document']['title']} for page in index['pages'])
    return documents, pages


def document_title(title):
    title = title.strip()
    if not title.lower().endswith('.pdf'):
        title += '.pdf'
    if len(title) > 255 or title.lower() == '.pdf' or re.search(r'[/\\\x00-\x1f\x7f]', title):
        raise ValueError('Bitte einen gültigen Dateinamen eingeben.')
    return title


def add_document(root, title, data, existing_roots=()):
    title = document_title(title)
    if not data.startswith(b'%PDF-'):
        raise ValueError('Bitte eine PDF-Datei auswählen.')
    ident = 'upload-' + hashlib.sha256(data).hexdigest()
    target = root / ident
    if target.exists() or any((directory / ident).exists() for directory in existing_roots):
        raise FileExistsError('Diese PDF ist bereits vorhanden.')
    try:
        with pymupdf.open(stream=data, filetype='pdf') as pdf:
            if pdf.needs_pass or not len(pdf):
                raise ValueError('Die PDF ist leer oder mit einem Passwort geschützt.')
            document = dict(id=ident, title=title, pages=len(pdf), managed=True)
            pages = [
                dict(doc=ident, page=number, text=text)
                for number, page in enumerate(pdf, 1)
                if (text := page.get_text().strip())
            ]
    except (RuntimeError, pymupdf.FileDataError) as exc:
        raise ValueError('Die PDF konnte nicht gelesen werden.') from exc

    root.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=root) as temporary:
        staged = Path(temporary) / 'document'
        staged.mkdir()
        (staged / 'document.pdf').write_bytes(data)
        (staged / 'index.json').write_text(
            json.dumps(dict(document=document, pages=pages), ensure_ascii=False), encoding='utf-8')
        staged.rename(target)
    return document


def update_document(root, ident, title):
    if not isinstance(ident, str) or not DOCUMENT_ID.fullmatch(ident):
        raise FileNotFoundError
    path = root / ident
    if title is None:
        with tempfile.TemporaryDirectory(dir=root) as temporary:
            path.rename(Path(temporary) / 'deleted')
        return
    index_file = path / 'index.json'
    index = json.loads(index_file.read_text(encoding='utf-8'))
    index['document']['title'] = document_title(title)
    temporary = path / 'index.tmp'
    temporary.write_text(json.dumps(index, ensure_ascii=False), encoding='utf-8')
    temporary.replace(index_file)


def read_images(roots):
    images = []
    for root in roots:
        for path in sorted(root.glob('image-*/index.json')):
            try:
                images.append(json.loads(path.read_text(encoding='utf-8')))
            except FileNotFoundError:
                continue
    return images


def add_image(roots, filename, data):
    extension = Path(filename).suffix.lower()
    if not data or len(data) > MAX_IMAGE_BYTES:
        raise ValueError('Das Bild fehlt oder ist grösser als 20 MB.')
    if data.startswith(b'\x89PNG\r\n\x1a\n'):
        extension = '.png'
    elif data.startswith(b'\xff\xd8\xff'):
        extension = '.jpeg' if extension == '.jpeg' else '.jpg'
    elif data.startswith(b'RIFF') and data[8:12] == b'WEBP':
        extension = '.webp'
    else:
        raise ValueError('Bitte ein gültiges PNG-, JPEG- oder WebP-Bild auswählen.')
    clean_name = Path(filename).name
    if len(clean_name) > 255:
        raise ValueError('Der Dateiname ist zu lang.')
    ident = 'image-' + hashlib.sha256(data).hexdigest()
    if any((root / ident).exists() for root in roots):
        raise FileExistsError('Dieses Bild ist bereits vorhanden.')
    destination = Path(roots[-1])
    destination.mkdir(parents=True, exist_ok=True)
    folder = destination / ident
    with tempfile.TemporaryDirectory(dir=destination) as temporary:
        staged = Path(temporary) / ident
        staged.mkdir()
        (staged / f'image{extension}').write_bytes(data)
        image = dict(id=ident, title=clean_name, image=f'/images/{ident}{extension}',
                     bytes=len(data), managed=True)
        (staged / 'index.json').write_text(json.dumps(image, ensure_ascii=False), encoding='utf-8')
        staged.rename(folder)
    return image


def delete_image(roots, ident):
    if not isinstance(ident, str) or not IMAGE_ID.fullmatch(ident):
        raise FileNotFoundError
    for root in roots:
        folder = root / ident
        if folder.is_dir():
            shutil.rmtree(folder)
            return
    raise FileNotFoundError
