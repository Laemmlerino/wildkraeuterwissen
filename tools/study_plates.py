"""Render verified atlas plates and botanical illustrations from the course PDFs."""
import json
from pathlib import Path

import pymupdf


# PDF pages checked against the printed captions in the supplied volumes.
KOEHLER_PLATES = {
    'pinus-sylvestris': (1, 247),
    'picea-abies': (1, 249),
    'arnica-montana': (1, 257),
    'tilia-cordata': (1, 265),
    'frangula-alnus': (1, 275),
    'chelidonium-majus': (1, 277),
    'colchicum-autumnale': (1, 285),
    'viola-tricolor': (1, 289),
    'quercus-robur': (1, 295),
    'althaea-officinalis': (1, 319),
    'rubus-idaeus': (1, 321),
    'juniperus-communis': (1, 341),
    'digitalis-purpurea': (1, 363),
    'artemisia-absinthium': (1, 375),
    'cetraria-islandica': (1, 379),
    'elymus-repens': (2, 511),
    'foeniculum-vulgare': (2, 515),
    'inula-helenium': (2, 519),
    'carum-carvi': (2, 521),
    'rosmarinus-officinalis': (2, 589),
    'arctostaphylos-uva-ursi': (2, 619),
    'prunus-laurocerasus': (2, 631),
    'artemisia-vulgaris': (3, 399),
    'papaver-rhoeas': (3, 409),
}


def study_plates(profiles, data, plants, documents):
    plates = {}
    volumes = {int(doc['title'][-5]): doc for doc in documents
               if 'Medizinal Buch V_' in doc['title'] and doc['title'][-5] in '1234'}
    for plant in plants:
        source = plant.get('source')
        match = KOEHLER_PLATES.get(plant['id'])
        if match and match[0] in volumes:
            doc = volumes[match[0]]
            source = {'doc': doc['id'], 'title': doc['title'], 'page': match[1]}
        if not source or 'Medizinal Buch' not in source['title']:
            continue
        with pymupdf.open(data / 'documents' / (source['doc'] + '.pdf')) as document:
            if source['page'] > len(document):
                continue
            page = document[source['page'] - 1]
            scale = 1250 / page.rect.width
            filename = f"koehler-{source['doc']}-{source['page']}.jpg"
            page.get_pixmap(matrix=pymupdf.Matrix(scale, scale)).save(data / 'images' / filename, jpg_quality=92)
        plates[plant['id']] = {'image': '/images/' + filename, 'source': source}
    for profile in profiles:
        number = profile['number']
        # The Rapunzel entry uses two photographs. The violet illustration
        # covers the shared entry and cannot identify either individual card.
        if number in (6, 30) or len(profile['plant_ids']) != 1:
            continue
        if profile['plant_ids'][0] in plates:
            continue
        source = profile['source']
        with pymupdf.open(data / 'documents' / (source['doc'] + '.pdf')) as document:
            page = document[source['page'] - 1]
            images = [image for image in page.get_image_info() if image['width'] != 1200]
            if not images:
                continue
            picture = max(images, key=lambda image: pymupdf.Rect(image['bbox']).get_area())
            bounds = pymupdf.Rect(picture['bbox'])
            filename = f"kurstafel-{source['doc']}-{source['page']}.png"
            page.get_pixmap(matrix=pymupdf.Matrix(3, 3), clip=bounds).save(data / 'images' / filename)
        plates[profile['plant_ids'][0]] = {'image': '/images/' + filename, 'source': source}
    temporary = data / 'study-plates.tmp'
    temporary.write_text(json.dumps(plates, ensure_ascii=False), encoding='utf-8')
    temporary.replace(data / 'study-plates.json')
    return len(plates)


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('data', type=Path)
    data = parser.parse_args().data
    catalog = json.loads((data / 'catalog.json').read_text(encoding='utf-8'))
    print(study_plates(catalog.get('herb_profiles', []), data, catalog['plants'], catalog['documents']))
