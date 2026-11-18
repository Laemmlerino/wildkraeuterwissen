"""Extract the numbered plant profiles and their PDF references."""
import re
import unicodedata

SCRIPT = re.compile(r'^\d{2}-\d{2}_Wildkräuterskript', re.I)
TITLE = re.compile(r'^\s*(\d{1,2})\. ([^\n]+(?:\nViola [^\n]+)?)', re.M)
LATIN = re.compile(r'\b[A-Z][a-z]+ [a-z][a-z-]+\b')
HEADINGS = {
    'Vorkommen': 'habitat',
    'Botanische Merkmale': 'features',
    'Inhaltsstoffe': 'contents',
    'Verwendete Teile': 'parts',
    'Wirkungskreis': 'effects',
}
SECTION = re.compile(
    r'^ *(' + '|'.join(HEADINGS)
    + r'|(?:Rezepte.*? )?Heilanwendungen[^\n]*|Verwendung(?:en)? in der Küche[^\n]*'
      r'|Rezepte für die Küche[^\n]*|Achtung[^\n]*|Kontraindikationen[^\n]*|Quellen\b[^\n]*)\b *:? *',
    re.M | re.I,
)
APPLICATION_SUMMARIES = {
    17: 'Verdauungsbeschwerden und Blähungen',
    28: 'Hautverletzungen und Blutarmut',
    29: 'Reizhusten, raue Stimme, Bronchitis und Ohrbeschwerden',
    64: 'Stoffwechselstörungen, Hautunreinheiten sowie Blasen- und Nierenbeschwerden',
}

SYNONYMS = {
    'Ranunculus ficaria': 'Ficaria verna',
    'Chenopodium bonus-henricus': 'Blitum bonus-henricus',
    'Hieracium pilosella': 'Pilosella officinarum',
    'Euphrasia rostkoviana': 'Euphrasia officinalis',
    'Mutellina adonidifolia': 'Ligusticum mutellina',
    'Alchemilla vulgaris': 'Alchemilla spp.',
    'Rosmarinus officinalis': 'Salvia rosmarinus',
    'Polygonum bistorta': 'Bistorta officinalis',
}


def herb_profiles(pages, plants):
    by_latin = {plant['latin']: plant['id'] for plant in plants}
    by_page = {(page['doc'], page['page']): page for page in pages}
    for page in pages:
        if page['page'] < 3 or not SCRIPT.match(unicodedata.normalize('NFC', page['title'])):
            continue
        title = TITLE.search(page['text'])
        if not title:
            continue
        number, heading = title.groups()
        german, _, scientific = ' '.join(heading.split()).rpartition(', ')
        if not LATIN.match(scientific):
            continue
        names = LATIN.findall(scientific.split(' (', 1)[0])
        fields = {}
        body = page['text'][title.end():]
        ref = {key: page[key] for key in ('doc', 'title', 'page')}
        application_source = ref
        next_page = by_page.get((page['doc'], page['page'] + 1))
        if next_page and not TITLE.search(next_page['text']) and 'Heilanwendungen' not in body:
            continuation = next_page['text']
            application = next((section for section in SECTION.finditer(continuation)
                                if 'heilanwendungen' in section[1].casefold()), None)
            if application:
                body += '\n' + continuation[application.start():]
                application_source = dict(ref, page=next_page['page'])
        sections = list(SECTION.finditer(body))
        for index, section in enumerate(sections):
            heading = section[1]
            end = sections[index + 1].start() if index + 1 < len(sections) else len(body)
            content = body[section.end():end].strip()
            if heading in HEADINGS:
                # A blank paragraph separates the named field from commentary or warnings.
                paragraph = re.split(r'\n[ \t]*\n', content, maxsplit=1)[0]
                if paragraph:
                    fields[HEADINGS[heading]] = ' '.join(paragraph.split())
            elif 'heilanwendungen' in heading.casefold():
                # Keep topic labels and leave preparations and amounts in the source PDF.
                items = re.split(r'^ *[o•●] *$', content, flags=re.M)[1:]
                topics = [' '.join(item.partition(':')[0].split()) for item in items if ':' in item]
                topics = [topic for topic in topics if 3 <= len(topic) <= 145
                          and not re.match(r'^(?:Tee|Sirup|Tinktur|Salbe|Öl|Rezept|Kur)\b', topic, re.I)]
                if topics:
                    fields['applications'] = ' · '.join(dict.fromkeys(topics))
        if int(number) in APPLICATION_SUMMARIES:
            fields['applications'] = APPLICATION_SUMMARIES[int(number)]
        ids = [by_latin.get(name) or by_latin.get(SYNONYMS.get(name)) for name in names]
        yield dict(number=int(number), de=german, latin=' und '.join(names), fields=fields,
                   source=ref, application_source=application_source, plant_ids=[ident for ident in ids if ident])
