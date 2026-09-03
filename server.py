import os
import platform
import subprocess
import urllib.parse
from http.server import HTTPServer, BaseHTTPRequestHandler

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

class SSEPingHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        
        # Servir index.html na raiz
        if parsed.path in ["/", "/index.html"]:
            file_path = os.path.join(BASE_DIR, "index.html")
            if os.path.exists(file_path):
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                with open(file_path, "rb") as f:
                    self.wfile.write(f.read())
            else:
                self.send_response(404)
                self.end_headers()
            return
            
        # Servir arquivos estáticos (CSS, JS)
        if parsed.path.startswith("/css/") or parsed.path.startswith("/js/"):
            # Remover barra inicial para juntar corretamente com BASE_DIR
            relative_path = parsed.path.lstrip("/")
            file_path = os.path.join(BASE_DIR, relative_path)
            if os.path.exists(file_path):
                self.send_response(200)
                if parsed.path.endswith(".css"):
                    self.send_header("Content-Type", "text/css; charset=utf-8")
                elif parsed.path.endswith(".js"):
                    self.send_header("Content-Type", "application/javascript; charset=utf-8")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                with open(file_path, "rb") as f:
                    self.wfile.write(f.read())
            else:
                self.send_response(404)
                self.end_headers()
            return

        # Healthcheck para interface checar status do backend
        if parsed.path == "/api/status" or parsed.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(b'{"status":"online","service":"play-ipam-ping-engine","version":"2026.1"}')
            return

        if parsed.path == "/api/ping":
            query = urllib.parse.parse_qs(parsed.query)
            ip = query.get("ip", [""])[0].strip()
            count = query.get("count", ["4"])[0]

            if not ip:
                self.send_response(400)
                self.send_header("Access-Control-Allow-Origin", "*")
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
                # errors="replace" previne travamentos com os acentos do CMD do Windows em PT-BR
                proc = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1,
                    errors="replace" 
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
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()

if __name__ == "__main__":
    port = 5555
    server = HTTPServer(("0.0.0.0", port), SSEPingHandler)
    print(f"[+] Servidor Play IPAM ativo na porta {port} (http://127.0.0.1:{port})")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[!] Encerrando servidor.")
        server.server_close()