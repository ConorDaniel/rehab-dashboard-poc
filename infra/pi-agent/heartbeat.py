import time
import requests
from datetime import datetime, timezone

PATIENT_ID = "p1"
API_URL = "http://192.168.1.57:4000/heartbeat"

HEARTBEAT_INTERVAL = 60
DISCONNECT_THRESHOLD = 10

LAST_SEEN_FILE = "/tmp/p1_last_seen"


def get_last_seen():
    try:
        with open(LAST_SEEN_FILE) as f:
            return float(f.read().strip())
    except:
        return 0


while True:

    now = time.time()
    last_seen = get_last_seen()

    age = now - last_seen
    connected = age < DISCONNECT_THRESHOLD

    payload = {
        "type": "heartbeat",
        "patientId": PATIENT_ID,
        "connected": connected,
        "lastFrameAgeSec": round(age, 2),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

    try:
        requests.post(API_URL, json=payload, timeout=2)
        print("Heartbeat sent:", payload)
    except Exception as e:
        print("Heartbeat failed:", e)

    time.sleep(HEARTBEAT_INTERVAL)
