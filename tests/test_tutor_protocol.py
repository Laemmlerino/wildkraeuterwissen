import io,json,os,sys,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'app'))
import server
class TutorProtocol(unittest.TestCase):
 def test_context_and_bearer_are_only_sent_server_side(self):
  with tempfile.TemporaryDirectory() as tmp:
   key=Path(tmp)/'key';key.write_text('test-local-key')
   sent=[]
   def fake(req,timeout):
    sent.append((req.full_url,req.headers,json.loads(req.data)))
    if req.full_url.endswith('/api/sessions'):return io.BytesIO(b'{}')
    return io.BytesIO(b'event: assistant.delta\ndata: {"delta":"Antwort [1]"}\n\nevent: run.completed\ndata: {}\n\n')
   with patch.dict(os.environ,{'HERMES_URL':'http://127.0.0.1:9999','HERMES_KEY_FILE':str(key)}),patch.object(server.request,'urlopen',side_effect=fake):
    reply=server.hermes_chat({},'Was bedeutet das?',[dict(title='Skript.pdf',page=5,text='Kreuzgegenständige Blätter')],[dict(role='user',text='Lippenblütler')])
   self.assertEqual(reply,'Antwort [1]')
   self.assertEqual(sent[0][1]['Authorization'],'Bearer test-local-key')
   self.assertIn('Skript.pdf, PDF-Seite 5',sent[1][2]['system_message'])
   self.assertIn('Lippenblütler',sent[1][2]['message'])
   self.assertNotIn('test-local-key',reply)
 def test_incomplete_stream_is_not_presented_as_answer(self):
  with tempfile.TemporaryDirectory() as tmp:
   key=Path(tmp)/'key';key.write_text('test-local-key')
   with patch.dict(os.environ,{'HERMES_URL':'http://127.0.0.1:9999','HERMES_KEY_FILE':str(key)}),patch.object(server.request,'urlopen',side_effect=[io.BytesIO(b'{}'),io.BytesIO(b'event: assistant.delta\ndata: {"delta":"unvollstaendig"}\n\n')]):
    with self.assertRaisesRegex(ValueError,'vollständige'):server.hermes_chat({},'Frage',[],[])
if __name__=='__main__':unittest.main()
