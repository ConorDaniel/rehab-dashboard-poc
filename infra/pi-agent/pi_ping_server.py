from http.server import BaseHTTPRequestHandler, HTTPServer
from datetime import datetime

HOST = "0.0.0.0"
PORT = 5001

class PingHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/ping":
            print(f"[{datetime.now().isoformat()}] Ping received from backend")

            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status":"ok"}')
        else:
            self.send_response(404)
            self.end_headers()

if __name__ == "__main__":
    server = HTTPServer((HOST, PORT), PingHandler)
    print(f"Pi ping server running on {HOST}:{PORT}")
    server.serve_forever()
