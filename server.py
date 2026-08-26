import platform
import subprocess
import urllib.parse
from http.server import HTTPServer, BaseHTTPRequestHandler

class SSEPingHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/ping":
            query = urllib.parse.parse_qs(parsed.query)
            ip = query.get("ip", [""])[0].strip()
            count = query.get("count", ["4"])[0]

            if not ip:
                self.send_response(400)
                self.end_headers()
                return

            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()

            is_windows = platform.system().lower() == "windows"
            if count == "continuous":
                cmd = ["ping", "-t", ip] if is_windows else ["ping", ip]
            else:
                cmd = ["ping", "-n", count, ip] if is_windows else ["ping", "-c", count, ip]

            try:
                proc = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1,
                    universal_newlines=True
                )
                for line in iter(proc.stdout.readline, ""):
                    if line.strip():
                        self.wfile.write(f"data: {line.strip()}\n\n".encode("utf-8"))
                        self.wfile.flush()
                proc.stdout.close()
                proc.wait()
                self.wfile.write(b"data: [DONE]\n\n")
                self.wfile.flush()
            except Exception as e:
                self.wfile.write(f"data: Erro de execucao: {str(e)}\n\n".encode("utf-8"))
                self.wfile.flush()
        else:
            self.send_response(404)
            self.end_headers()

if __name__ == "__main__":
    port = 5555
    server = HTTPServer(("0.0.0.0", port), SSEPingHandler)
    print(f"[+] Servidor de Ping ativo na porta {port} (http://localhost:{port})")
    server.serve_forever()
