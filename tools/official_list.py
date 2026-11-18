"""Read the columns of the school's six-page October 2026 plant list."""
import re
import unicodedata


NAME_SPELLINGS = {
    'Portulaca oleraceae': 'Portulaca oleracea',
    'Atropa bella-donna': 'Atropa belladonna',
}
FAMILY_SPELLINGS = {'Laminaceae': 'Lamiaceae', 'Asperagaceae': 'Asparagaceae',
                    'Laburnum': 'Fabaceae'}


def display_name(label):
    special = {'Linde': 'Sommerlinde', 'Buche, Hage': 'Hagebuche', 'Kiefer, Wald-Föhre': 'Wald-Föhre',
               'Ulme, (Berg-)': 'Bergulme', 'Weide, (Sal-)': 'Salweide', 'Erdbeere, Wald': 'Walderdbeere',
               'Thymian, Feld-': 'Feld-Thymian', 'Rose, Hunds-, Hag-': 'Hundsrose',
               'Schlehe, Schwarzdorn': 'Schlehe', 'Engelwurz, Wald': 'Wald-Engelwurz',
               'Malve, Stockrose-Garten': 'Garten-Stockrose', 'Erbse, Wiesen-Platt-': 'Wiesen-Platterbse'}
    if label in special:
        return special[label]
    base, separator, modifier = label.partition(',')
    modifier = modifier.strip()
    if separator and modifier and ',' not in modifier and not modifier.startswith('syn.'):
        if modifier.endswith('-'):
            if base[0] in 'AEIOUÄÖÜ' or base in {'Bärenklau', 'Schachtelhalm', 'Schaumkraut', 'Storchenschnabel'}:
                return modifier + base
            return modifier[:-1] + base.lower() if modifier.count('-') == 1 else modifier + base
        if re.fullmatch(r'[\w-]+', modifier):
            return modifier.capitalize() + ' ' + base
    return label


def official_rows(document):
    section = 'Wildkräuter'
    for page in document:
        lines = sorted(
            (span['bbox'][1], span['bbox'][0], unicodedata.normalize('NFC', span['text'].strip()))
            for block in page.get_text('dict', flags=0)['blocks']
            for line in block.get('lines', [])
            for span in line['spans'] if span['text'].strip()
        )
        families = [(y, value) for y, x, value in lines if 642 < x < 649]
        for y, x, label in lines:
            if not 51 < x < 56:
                continue
            if label in {'Bäume', 'Giftpflanzen'} or label.startswith('Beeren & Sträucher'):
                section = label.split(' (')[0]
                continue
            nearby = sorted((xx, text) for yy, xx, text in lines if abs(yy-y)<2)
            label = ' '.join(text for xx, text in nearby if 51 < xx < 176)
            latin = ' '.join(text for xx, text in nearby if 413 < xx < 531)
            if not latin:
                continue
            match = re.match(r'([A-Za-z]+(?:\s+[a-z][a-z-]+)?)(?:\s+(agg\.))?', latin)
            if not match:
                continue
            name = ' '.join(match[1].split())
            name = name[0].upper()+name[1:]
            if name in {'Pflanzenname', 'Familie'}:
                continue
            name = NAME_SPELLINGS.get(name, name)
            family = next((text.split()[0] for yy,text in families if abs(yy-y)<3 and text), '')
            if not family:
                family = next((text.split()[0] for yy,text in families if 0 < yy-y < 12 and text), '')
            family = FAMILY_SPELLINGS.get(family,family)
            group = ' ' not in name or bool(match[2]) or name == 'Rubus fruticosus'
            yield dict(latin=name,de=display_name(label),family=family,section=section,
                       group=group,page=page.number+1)
            if name == 'Tilia platyphyllos':
                yield dict(latin='Tilia cordata',de='Winterlinde',family=family,section=section,
                           group=False,page=page.number+1)
            if re.search(r'/\s*pulegioides', latin):
                yield dict(latin='Thymus pulegioides',de='Arznei-Thymian',family=family,section=section,
                           group=False,page=page.number+1)
