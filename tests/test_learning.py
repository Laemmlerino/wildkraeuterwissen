import http.cookiejar, json, os, sys, tempfile, threading, unittest
from pathlib import Path
from urllib import request, error
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'app'))
import server

class LearningTest(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.tmp=tempfile.TemporaryDirectory();cls.previous=server.DATA;server.DATA=Path(cls.tmp.name)
  cls.plant=dict(id='a',de='Löwenzahn',latin='Taraxacum officinale',aliases=[],image='/images/a.png',source=dict(doc='d',title='Band.pdf',page=3),excerpts=[])
  (server.DATA/'catalog.json').write_text(json.dumps(dict(plants=[cls.plant,dict(cls.plant,id='b',de='Melisse',latin='Melissa officinalis')],documents=[],pages=[])))
  cls.http=server.ThreadingHTTPServer(('127.0.0.1',0),server.Handler)
  threading.Thread(target=cls.http.serve_forever,daemon=True).start();cls.base='http://127.0.0.1:'+str(cls.http.server_port)
 @classmethod
 def tearDownClass(cls):cls.http.shutdown();cls.http.server_close();server.DATA=cls.previous;cls.tmp.cleanup()
 def setUp(self):
  self.client=request.build_opener(request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
  self.boot=self.call('/api/bootstrap')
 def call(self,path,body=None,csrf=True):
  headers={'Content-Type':'application/json'}
  if body is not None and csrf:headers['X-CSRF-Token']=self.boot['csrf']
  with self.client.open(request.Request(self.base+path,data=json.dumps(body).encode() if body is not None else None,headers=headers)) as r:return json.load(r)
 def test_challenge_answer_and_no_reuse(self):
  c=self.call('/api/challenge');p=next(x for x in json.loads((server.DATA/'catalog.json').read_text())['plants'] if x['image']==c['image'])
  # Both fixture plants share an image, determine answer from session's challenge.
  s=next(v for v in server.SESSIONS.values() if v['csrf']==self.boot['csrf']);ident=s['challenges'][c['challenge']]
  p=next(x for x in json.loads((server.DATA/'catalog.json').read_text())['plants'] if x['id']==ident)
  answer={'challenge':c['challenge'],'mode':'latin','answer':'  '+p['latin'].upper()+'  '}
  self.assertTrue(self.call('/api/answer',answer)['correct'])
  with self.assertRaises(error.HTTPError) as ctx:self.call('/api/answer',answer)
  self.assertEqual(ctx.exception.code,409);ctx.exception.close()
 def test_latin_options_and_separate_name_parts(self):
  for mode,answer in [('genus','Taraxacum'),('species','officinale')]:
   task=self.call('/api/challenge?id=a')
   self.assertEqual({option['label'] for option in task['options']},{'Taraxacum officinale','Melissa officinalis'})
   self.assertTrue(self.call('/api/answer',{'challenge':task['challenge'],'mode':mode,'answer':answer})['correct'])
 def test_name_review_applies_only_after_confirmation_and_can_be_reset(self):
  proposal={'latin':'Leontodon autumnalis','de':'Herbst-Milchkraut','reason':'', 'url':'https://www.infoflora.ch/'}
  server.NAME_PROPOSALS['a']=proposal
  self.addCleanup(server.NAME_PROPOSALS.pop,'a',None)
  self.addCleanup((server.DATA/'name-decisions.json').unlink,missing_ok=True)
  self.assertEqual(self.call('/api/card?id=a')['latin'],'Taraxacum officinale')
  self.assertIsNone(self.call('/api/name-review')[0]['decision'])
  self.call('/api/name-review',{'id':'a','choice':'accept'})
  self.assertEqual(self.call('/api/card?id=a')['latin'],proposal['latin'])
  task=self.call('/api/challenge?id=a')
  self.assertIn(proposal['latin'],[item['label'] for item in task['options']])
  self.assertTrue(self.call('/api/answer',{'challenge':task['challenge'],'mode':'latin','answer':proposal['latin']})['correct'])
  self.call('/api/name-review',{'id':'a','choice':'reset'})
  self.assertEqual(self.call('/api/card?id=a')['latin'],'Taraxacum officinale')
 def test_image_review_saves_note_and_rejects_outdated_picture(self):
  self.addCleanup((server.DATA/'image-decisions.json').unlink,missing_ok=True)
  body=dict(id='a',image='/images/a.png',choice='replace',note='Die ganze Pflanze')
  self.assertEqual(self.call('/api/image-review',body)['review']['note'],body['note'])
  card=next(p for p in self.call('/api/deck') if p['id']=='a')
  self.assertEqual(card['image_review']['choice'],'replace')
  with self.assertRaises(error.HTTPError) as ctx:
   self.call('/api/image-review',dict(body,image='/images/old.png',choice='accept'))
  self.assertEqual(ctx.exception.code,409)
  ctx.exception.close()
  self.assertIsNone(self.call('/api/image-review',dict(body,choice='reset'))['review'])
 def test_wrong_latin_rejected(self):
  c=self.call('/api/challenge');self.assertFalse(self.call('/api/answer',{'challenge':c['challenge'],'mode':'latin','answer':'unknown'})['correct'])
 def test_csrf_required(self):
  with self.assertRaises(error.HTTPError) as ctx:self.call('/api/chat',{'message':'Hallo'},False)
  self.assertEqual(ctx.exception.code,403);ctx.exception.close()
 def test_other_session_cannot_answer(self):
  c=self.call('/api/challenge');self.setUp()
  with self.assertRaises(error.HTTPError) as ctx:self.call('/api/answer',{'challenge':c['challenge'],'mode':'choice','answer':'a'})
  self.assertEqual(ctx.exception.code,409);ctx.exception.close()
 def test_bootstrap_hides_names(self):
  self.assertNotIn('de',self.boot['plants'][0]);self.assertNotIn('latin',self.boot['plants'][0])
 def test_traversal(self):
  with self.assertRaises(error.HTTPError) as ctx:self.call('/images/../../app/server.py')
  self.assertEqual(ctx.exception.code,404);ctx.exception.close()
 def test_retrieval_excludes_historical_medicine(self):
  pages=[dict(title='Skript.pdf',text='Kreuzgegenständige Blätter',doc='s',page=1),dict(title='Köhlers Medizinal Buch V_1.pdf',text='Blätter '*20,doc='k',page=1)]
  self.assertEqual([p['doc'] for p in server.retrieve('Blätter',pages)],['s'])
 def test_local_sources_favour_specific_terms_and_skip_historical_books(self):
  specific=dict(title='Botanik.pdf',text='Kreuzgegenständige Blätter',doc='a',page=1)
  generic=[dict(title=f'Kurs {i}.pdf',text='Blätter '*6,doc=str(i),page=1) for i in range(10)]
  historical=dict(title='Köhlers Medizinal Buch.pdf',text='Kreuzgegenständig '*10,doc='k',page=1)
  pages=[*generic,historical,specific]
  self.assertEqual(server.local_sources('Was bedeutet kreuzgegenständig bei Blättern?',pages)[0],specific)
  self.assertEqual(server.local_sources('Quantenverschränkung',pages),[])
 def test_unconnected_tutor_is_explicit(self):
  with self.assertRaises(ValueError):server.hermes_chat({},'Hallo',[],[])
if __name__=='__main__':unittest.main()
