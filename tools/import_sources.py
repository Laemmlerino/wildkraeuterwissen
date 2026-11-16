"""Import only supplied PDFs; retain provenance, never fetch plant content online."""
import argparse, hashlib, json, re, shutil, unicodedata
from pathlib import Path
import pymupdf

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
def norm(s): return unicodedata.normalize('NFKD',s).casefold()
def build(source, output):
 source, output = Path(source), Path(output)
 pdfs=sorted(source.rglob('*.pdf'))
 if not pdfs: raise ValueError('Keine PDF-Unterlagen gefunden')
 (output/'images').mkdir(parents=True,exist_ok=True)
 (output/'documents').mkdir(exist_ok=True)
 pages=[]; docs=[]; plants=[]
 for p in pdfs:
  ident=hashlib.sha256(str(p.relative_to(source)).encode()).hexdigest()[:16]
  shutil.copyfile(p,output/'documents'/f'{ident}.pdf')
  doc=pymupdf.open(p)
  docs.append(dict(id=ident,title=p.name,pages=len(doc)))
  # Full corpus includes all four historical volumes. OCR text is retained as supplied.
  for n,page in enumerate(doc):
   text=page.get_text().strip()
   if text: pages.append(dict(doc=ident,title=p.name,page=n+1,text=text))
  if re.search(r'V_1\.pdf$',p.name):
   for ident_plant,de,latin,n,aliases in PLATES:
    page=doc[n-1]
    # Crop printed family/name bands; no invented or external images.
    name_blocks=[b for b in page.get_text('blocks') if latin.split()[0].casefold() in b[4].casefold() and b[1] > page.rect.height*.6]
    bottom=min([b[1]-page.rect.height*.008 for b in name_blocks],default=page.rect.height*.82)
    clip=pymupdf.Rect(page.rect.width*.03,page.rect.height*.105,page.rect.width*.97,bottom)
    pix=page.get_pixmap(matrix=pymupdf.Matrix(1000/clip.width,1000/clip.width),clip=clip)
    pix.save(output/'images'/f'{ident_plant}.png')
    plants.append(dict(id=ident_plant,de=de,latin=latin,aliases=aliases,image=f'/images/{ident_plant}.png',source=dict(doc=ident,title=p.name,page=n),excerpts=[]))
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
