from http.server import BaseHTTPRequestHandler, HTTPServer
import json
class H(BaseHTTPRequestHandler):
    def _r(self):
        n=int(self.headers.get('content-length') or 0); body=self.rfile.read(n) if n else b''
        out={"ok":True,"protocolVersion":"v1","echo":body[:200].decode('utf8','ignore')}
        b=json.dumps(out).encode(); self.send_response(200)
        self.send_header('content-type','application/json'); self.send_header('content-length',str(len(b)))
        self.end_headers(); self.wfile.write(b)
    do_GET=_r; do_POST=_r
    def log_message(self,*a): print(*a, flush=True)
HTTPServer(('127.0.0.1',8098),H).serve_forever()
