import time
import requests
from datetime import datetime, timezone

PI_ID = "pi-p1"
PATIENT_ID = "p1"

PRIMARY_API_URL = "https://rehab-dashboard-poc.onrender.com/heartbeat"
FALLBACK_API_URL = "http://192.168.1.57:4000/heartbeat"

HEARTBEAT_INTERVAL = 60
LAST_SEEN_FILE = "/tmp/p1_last_seen"


def get_last_seen():
    try:
        with open(LAST_SEEN_FILE, "r") as f:
            return float(f.read().strip())
    except Exception:
        return 0.0


def post(payload):
    urls = [PRIMARY_API_URL, FALLBACK_API_URL]

    for url in urls:
        try:
            response = requests.post(url, json=payload, timeout=5)
            response.raise_for_status()
            print(f"Heartbeat sent → {url}")
            return
        except Exception as e:
            print(f"Heartbeat failed → {url}: {e}")

    print("Heartbeat failed on both endpoints.")


while True:
    now = time.time()
    last_seen = get_last_seen()

    age = now - last_seen if last_seen > 0 else None

    payload = {
        "type": "heartbeat",
        "piId": PI_ID,
        "patientId": PATIENT_ID,
        "connected": True,
        "lastFrameAgeSec": round(age, 2) if age is not None else None,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    post(payload)

    time.sleep(HEARTBEAT_INTERVAL)