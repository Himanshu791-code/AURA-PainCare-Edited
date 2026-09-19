"""
AURA-PainCare: AI Silent-Pain & Distress Monitor
Local Server Launcher & Medical HUD Host
"""

import os
import sys
import webbrowser
import socketserver
import http.server
from pathlib import Path

PORT = 8000
HOST = "127.0.0.1"

# Set root directory to aura_paincare folder
BASE_DIR = Path(__file__).resolve().parent.parent
os.chdir(BASE_DIR)

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Enable CORS and disable caching for live evaluation
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

    def log_message(self, format, *args):
        # Clean logging
        sys.stdout.write(f"[AURA-PainCare Server] {self.address_string()} - {args[0]} {args[1]}\n")
        sys.stdout.flush()

def start_server():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer((HOST, PORT), CustomHTTPRequestHandler) as httpd:
        url = f"http://{HOST}:{PORT}/index.html"
        print("=" * 70)
        print("🩺 AURA-PainCare: AI Silent-Pain & Distress Monitoring System")
        print("   Zero-Hardware Pure Software Clinical Prototype")
        print("=" * 70)
        print(f"[*] Local Hospital HUD Server running at: {url}")
        print("[*] Opening your browser automatically...")
        print("[*] Press Ctrl + C to stop server.")
        print("=" * 70)

        # Automatically open default browser
        webbrowser.open(url)

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n[!] Server shutting down safely. Clinical session ended.")
            httpd.shutdown()

if __name__ == "__main__":
    start_server()
