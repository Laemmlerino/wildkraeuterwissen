"""Import only supplied PDFs; retain provenance, never fetch plant content online."""
import argparse, hashlib, json, re, shutil, unicodedata
from pathlib import Path
import pymupdf
from course_cards import course_cards

# Manually matched to the actual plates in the supplied first Köhler volume.
PLATES = [
 ('loewenzahn','Löwenzahn','Taraxacum officinale',243,[]),
 ('thymian','Feld-Thymian','Thymus serpyllum',313,['Quendel']),
 ('melisse','Zitronenmelisse','Melissa officinalis',369,['Melisse']),
 ('schafgarbe','Schafgarbe','Achillea millefolium',377,[]),
 ('salbei','Echter Salbei','Salvia officinalis',311,['Salbei']),
 ('holunder','Schwarzer Holunder','Sambucus nigra',327,['Holunder']),
 ('malve','Wilde Malve','Malva sylvestris',355,['Malva silvestris']),
 ('kamille','Echte Kamille','Matricaria chamomilla',367,['Kamille']),
]
# Additional plates inspected against their printed captions. Historical synonyms
# and OCR spelling in the atlas can differ from the course name.
ATLAS_PLATES = {
 1: {241: 'Juglans regia', 245: 'Tussilago farfara', 281: 'Datura stramonium',
     287: 'Daphne mezereum', 293: 'Viscum album', 329: 'Valeriana officinalis',
     407: 'Potentilla erecta'},
 3: {535: 'Convallaria majalis'},
 4: {85: 'Saponaria officinalis'},
}
CAPTION_LABELS = {'Convallaria majalis': 'mafalis', 'Saponaria officinalis': 'offieinalis'}

def norm(s): return unicodedata.normalize('NFKD',s).casefold()
def build(source, output):
 source, output = Path(source), Path(output)
 pdfs=sorted(source.rglob('*.pdf'))
 if not pdfs: raise ValueError('Keine PDF-Unterlagen gefunden')
 (output/'images').mkdir(parents=True,exist_ok=True)
 (output/'documents').mkdir(exist_ok=True)
 pages=[]; docs=[]; plants=[]; atlases=[]
 for p in pdfs:
  ident=hashlib.sha256(str(p.relative_to(source)).encode()).hexdigest()[:16]
  shutil.copyfile(p,output/'documents'/f'{ident}.pdf')
  doc=pymupdf.open(p)
  docs.append(dict(id=ident,title=p.name,pages=len(doc)))
  # Full corpus includes all four historical volumes. OCR text is retained as supplied.
  for n,page in enumerate(doc):
   text=page.get_text().strip()
   if text: pages.append(dict(doc=ident,title=p.name,page=n+1,text=text))
  if re.search(r'V_[1-4]\.pdf$',p.name):
   atlases.append((docs[-1], doc))
  else:
   doc.close()

 by_latin={}
 for ident,de,latin,n,aliases in PLATES:
  by_latin[latin]=dict(id=ident,de=de,latin=latin,aliases=aliases,image=None,source=None,excerpts=[])
 for latin,de,page in course_cards(pages):
  ref={key:page[key] for key in ('doc','title','page')}
  plant=by_latin.setdefault(latin, dict(id=re.sub(r'[^a-z]+','-',latin.casefold()).strip('-'),
      de=de,latin=latin,aliases=[],image=None,source=None,excerpts=[]))
  plant.setdefault('course',ref)
  if latin.endswith(' spp.'):
   plant['group']=True
 plants=sorted(by_latin.values(),key=lambda p:p['latin'])
 for metadata, doc in atlases:
  volume=int(metadata['title'][-5])
  known=dict(ATLAS_PLATES.get(volume, {}))
  if volume == 1:
   known.update({entry[3]:entry[2] for entry in PLATES})
  for index,latin in known.items():
   if index > len(doc):
    continue
   page=doc[index-1]
   plant=by_latin.get(latin)
   if plant is None or plant['image']:
    continue
   ref=dict(doc=metadata['id'],title=metadata['title'],page=index)
   label=CAPTION_LABELS.get(latin, latin.split()[0]).casefold()
   captions=[line for block in page.get_text('dict',flags=pymupdf.TEXTFLAGS_TEXT)['blocks']
             for line in block['lines'] if line['bbox'][1] > page.rect.height*.78
             and any(label in span['text'].casefold() for span in line['spans'])]
   for line in captions:
    rect=pymupdf.Rect(line['bbox'])
    pad=page.rect.width*.008
    rect+=(-pad,-pad,pad,pad)
    page.draw_rect(rect,color=None,fill=(.94,.89,.77),overlay=True)
   scale=1250/page.rect.width
   pix=page.get_pixmap(matrix=pymupdf.Matrix(scale,scale))
   filename=hashlib.sha256(plant['id'].encode()).hexdigest()[:20]+'.png'
   pix.save(output/'images'/filename)
   plant.update(image=f"/images/{filename}",source=ref)
   if latin in {'Juglans regia','Sambucus nigra','Viscum album'}:
    plant['image_note']='Tafel zeigt Zweige und Details der Pflanze.'
  doc.close()
 for plant in plants:
  terms=[plant['latin'],plant['de'],*plant['aliases']]
  matches=[p for p in pages if 'Medizinal Buch' not in p['title'] and any(norm(t) in norm(p['text']) for t in terms)]
  plant['excerpts']=[dict(doc=p['doc'],title=p['title'],page=p['page'],text=p['text'][:3500]) for p in matches[:4]]
 catalog=dict(plants=plants,documents=docs,pages=pages)
 temporary=output/'catalog.tmp'
 temporary.write_text(json.dumps(catalog,ensure_ascii=False),encoding='utf-8')
 temporary.replace(output/'catalog.json')
 print(json.dumps(dict(documents=len(docs),pages=len(pages),plants=len(plants))))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('source');p.add_argument('output');a=p.parse_args();build(a.source,a.output)
