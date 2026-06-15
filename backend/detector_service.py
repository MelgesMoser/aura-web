from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
import signal
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import cv2
from ultralytics import YOLO


BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = Path(os.getenv("AURA_MODEL_PATH", BASE_DIR / "yolov8n.pt"))
CAMERA_INDEX = int(os.getenv("AURA_CAMERA_INDEX", "0"))
LIMIT = int(os.getenv("AURA_QUEUE_LIMIT", "8"))
CONFIDENCE = float(os.getenv("AURA_CONFIDENCE", "0.35"))
HOST = os.getenv("AURA_BACKEND_HOST", "127.0.0.1")
PORT = int(os.getenv("AURA_BACKEND_PORT", "8000"))


class PersonCounter:
    def __init__(self, model_path: Path, camera_index: int, limit: int, confidence: float):
        self.model_path = model_path
        self.camera_index = camera_index
        self.limit = limit
        self.confidence = confidence
        self.lock = threading.Lock()
        self.stop_event = threading.Event()
        self.camera = None
        self.model = None
        self.state = {
            "peopleCount": 0,
            "limit": limit,
            "status": "INICIANDO",
            "cameraOnline": False,
            "updatedAt": None,
            "error": None,
        }

    def start(self):
        thread = threading.Thread(target=self._loop, name="aura-person-counter", daemon=True)
        thread.start()
        return thread

    def snapshot(self):
        with self.lock:
            return dict(self.state)

    def update_limit(self, limit: int):
        with self.lock:
            self.limit = limit
            self.state["limit"] = limit
            self.state["status"] = self._status_for(self.state["peopleCount"])

    def stop(self):
        self.stop_event.set()
        if self.camera is not None:
            self.camera.release()

    def _set_state(self, **values):
        with self.lock:
            self.state.update(values)

    def _status_for(self, people_count: int):
        return "FILA CHEIA" if people_count >= self.limit else "PODE LIBERAR"

    def _loop(self):
        try:
            if not self.model_path.exists():
                raise FileNotFoundError(f"Modelo nao encontrado: {self.model_path}")

            self.model = YOLO(str(self.model_path))
            self.camera = cv2.VideoCapture(self.camera_index)

            if not self.camera.isOpened():
                raise RuntimeError("Nao foi possivel acessar a camera.")

            self._set_state(cameraOnline=True, error=None, status="PODE LIBERAR")

            while not self.stop_event.is_set():
                success, frame = self.camera.read()
                if not success:
                    self._set_state(cameraOnline=False, error="Falha ao ler frame da camera.")
                    time.sleep(1)
                    continue

                results = self.model(frame, verbose=False, conf=self.confidence)
                people_count = 0

                for result in results:
                    for box in result.boxes:
                        class_id = int(box.cls[0])
                        if class_id == 0:
                            people_count += 1

                self._set_state(
                    peopleCount=people_count,
                    limit=self.limit,
                    status=self._status_for(people_count),
                    cameraOnline=True,
                    updatedAt=datetime.now(timezone.utc).isoformat(),
                    error=None,
                )
                time.sleep(0.35)
        except Exception as exc:
            self._set_state(cameraOnline=False, status="ERRO", error=str(exc))
        finally:
            if self.camera is not None:
                self.camera.release()


counter = PersonCounter(MODEL_PATH, CAMERA_INDEX, LIMIT, CONFIDENCE)


class AuraHandler(BaseHTTPRequestHandler):
    def _send_json(self, payload, status=200):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._send_json({"ok": True})

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/health":
            self._send_json({"ok": True, "service": "aura-detector"})
            return
        if path == "/count":
            self._send_json(counter.snapshot())
            return
        self._send_json({"error": "Rota nao encontrada."}, 404)

    def do_POST(self):
        path = urlparse(self.path).path
        if path != "/config":
            self._send_json({"error": "Rota nao encontrada."}, 404)
            return

        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b"{}"
        try:
            payload = json.loads(raw.decode("utf-8"))
            limit = int(payload.get("limit"))
            if limit < 1:
                raise ValueError("O limite precisa ser maior que zero.")
            counter.update_limit(limit)
            self._send_json(counter.snapshot())
        except Exception as exc:
            self._send_json({"error": str(exc)}, 400)

    def log_message(self, format, *args):
        return


def shutdown(*_):
    counter.stop()
    raise KeyboardInterrupt


if __name__ == "__main__":
    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)
    counter.start()
    server = ThreadingHTTPServer((HOST, PORT), AuraHandler)
    print(f"Aura detector rodando em http://{HOST}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        counter.stop()
        server.server_close()
