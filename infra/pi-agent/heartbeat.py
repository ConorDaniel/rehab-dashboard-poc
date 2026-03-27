import time
import requests
from datetime import datetime, timezone

PI_ID = "pi-p1"
PATIENT_ID = "p1"
API_URL = "http://192.168.1.57:4000/heartbeat"

HEARTBEAT_INTERVAL = 60
LAST_SEEN_FILE = "/tmp/p1_last_seen"


def get_last_seen():
    try:
        with open(LAST_SEEN_FILE, "r") as f:
            return float(f.read().strip())
    except Exception:
        return 0.0


while True:
    now = time.time()
    last_seen = get_last_seen()

    age = now - last_seen if last_seen > 0 else None

    payload = {
        "type": "heartbeat",
        "piId": PI_ID,
        "patientId": PATIENT_ID,
        "connected": True,  # heartbeat itself means Pi is alive
        "lastFrameAgeSec": round(age, 2) if age is not None else None,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    try:
        response = requests.post(API_URL, json=payload, timeout=2)
        response.raise_for_status()
        print("Heartbeat sent:", payload)
    except Exception as e:
        print("Heartbeat failed:", e)

    time.sleep(HEARTBEAT_INTERVAL)
