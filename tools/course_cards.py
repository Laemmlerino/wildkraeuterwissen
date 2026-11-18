"""Species explicitly listed in the supplied wild-fruit and root modules."""
import re

ROOTS = {
 21: 'Valeriana officinalis|Baldrian;Phyteuma spicatum|Ährige Rapunzel;Polypodium vulgare|Engelsüss;Symphytum officinale|Beinwell',
 22: 'Taraxacum officinale|Löwenzahn;Scorzoneroides autumnalis|Herbst-Löwenzahn;Hypochaeris radicata|Ferkelkraut;Tragopogon pratensis|Wiesen-Bocksbart;Sonchus asper|Raue Gänsedistel',
 23: 'Carduus crispus|Krause Distel;Cirsium vulgare|Gewöhnliche Kratzdistel;Cirsium arvense|Acker-Kratzdistel;Cirsium oleraceum|Kohl-Kratzdistel;Helianthus tuberosus|Topinambur;Inula helenium|Alant;Leucanthemum vulgare|Wiesen-Margerite',
 24: 'Cichorium intybus|Wegwarte;Tussilago farfara|Huflattich;Lamium galeobdolon|Goldnessel;Lamium album|Weisse Taubnessel;Lamium purpureum|Rote Taubnessel;Lamium maculatum|Gefleckte Taubnessel;Stachys palustris|Sumpf-Ziest;Stachys sylvatica|Wald-Ziest',
 25: 'Angelica sylvestris|Wald-Engelwurz;Peucedanum ostruthium|Meisterwurz;Meum athamanticum|Bärwurz;Heracleum sphondylium|Wiesen-Bärenklau;Anthriscus sylvestris|Wiesen-Kerbel',
 26: 'Carum carvi|Wiesen-Kümmel;Bunium bulbocastanum|Knollen-Kümmel;Daucus carota|Wilde Möhre;Pastinaca sativa|Pastinake;Myrrhis odorata|Süssdolde;Pimpinella saxifraga|Bibernelle;Arctium lappa|Grosse Klette',
 27: 'Allium ursinum|Bärlauch;Alliaria petiolata|Knoblauchsrauke;Armoracia rusticana|Meerrettich;Capsella bursa-pastoris|Hirtentäschel',
 28: 'Potentilla erecta|Blutwurz;Potentilla anserina|Gänsefingerkraut;Geum urbanum|Nelkenwurz;Filipendula ulmaria|Mädesüss;Sanguisorba officinalis|Grosser Wiesenknopf',
 29: 'Plantago lanceolata|Spitzwegerich;Dipsacus fullonum|Wilde Karde;Bistorta officinalis|Schlangen-Wiesenknöterich;Oenothera biennis|Nachtkerze;Epilobium angustifolium|Schmalblättriges Weidenröschen',
 30: 'Malva sylvestris|Wilde Malve;Althaea officinalis|Eibisch;Elymus repens|Kriechende Quecke;Phragmites australis|Schilf',
 31: 'Typha latifolia|Breitblättriger Rohrkolben;Schoenoplectus lacustris|Teichsimse',
 32: 'Primula veris|Schlüsselblume;Iris germanica|Schwertlilie;Saponaria officinalis|Seifenkraut;Mandragora officinarum|Alraune;Urtica dioica|Brennnessel;Gentiana lutea|Gelber Enzian;Carlina acaulis|Silberdistel;Petasites hybridus|Pestwurz;Scrophularia nodosa|Braunwurz',
}

SPELLINGS = {
 'Herera helix': 'Hedera helix',
 'Symphoricarpus albus': 'Symphoricarpos albus',
 'Daura stramonium': 'Datura stramonium',
}

def course_cards(pages):
 for page in pages:
  title, number, text = page['title'], page['page'], page['text']
  if title.startswith('10_Wurzel Skript') and number in ROOTS:
   for entry in ROOTS[number].split(';'):
    latin, german = entry.split('|')
    yield latin, german, page
  if title.startswith('08_2_Liste_Wildfrüchte') and number <= 3:
   for german, latin in re.findall(r'^([^()\n]{2,55}) \(([A-Z][a-z]+ [a-z][a-z.-]*(?:/[a-z]+)?)\)\s*$', text, re.M):
    if latin == 'Morus alba/nigra':
     yield 'Morus alba', 'Weisse Maulbeere', page
     yield 'Morus nigra', 'Schwarze Maulbeere', page
    else:
     yield SPELLINGS.get(latin, latin), german.strip().replace('Nachschatten', 'Nachtschatten'), page
   if number == 2 and 'Lonicera caerulea' in text:
    yield 'Lonicera caerulea', 'Blaue Heckenkirsche / Maibeere', page
  if title.startswith('03_Die') and 'Forschungsauftr' in title:
   if number == 1:
    yield 'Potentilla reptans', 'Kriechendes Fingerkraut', page
   if number == 2:
    yield 'Veronica persica', 'Persischer Ehrenpreis', page
    yield 'Veronica chamaedrys', 'Gamander-Ehrenpreis', page
    yield 'Veronica serpyllifolia', 'Thymian-Ehrenpreis', page
