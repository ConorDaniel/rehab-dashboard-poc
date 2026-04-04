import asyncio
import math
import time
import requests
from datetime import datetime, timezone
from device_model import DeviceModel

# =========================
# CONFIGURATION
# =========================

TARGET_MAC = "E1:B7:EA:2D:8A:AE"
PI_ID = "pi-p1"
PATIENT_ID = "p1"

PRIMARY_API_URL = "https://rehab-dashboard-poc.onrender.com/telemetry"
FALLBACK_API_URL = "http://192.168.1.57:4000/telemetry"

PRINT_RATE_HZ = 4
MOVEMENT_THRESHOLD = 8

# 🔹 Separate debounce timings
MOVING_PERSIST_SECONDS = 2.0
REST_PERSIST_SECONDS = 1.0

REST_HEARTBEAT_SECONDS = 10

LAST_SEEN_FILE = "/tmp/p1_last_seen"

# =========================

_last_tick = 0.0
_last_seen_write = 0.0

_raw_state = None
_raw_state_since = 0.0

_stable_state = None
_stable_state_since = 0.0

_last_rest_sample_sent = 0.0


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def post(payload: dict) -> None:
    urls = [PRIMARY_API_URL, FALLBACK_API_URL]

    for url in urls:
        try:
            response = requests.post(url, json=payload, timeout=3)
            response.raise_for_status()
            print(f"POST ok -> {url}")
            return
        except Exception as e:
            print(f"POST failed -> {url}: {e}")

    print("POST failed on both primary and fallback URLs.")


def get_required_persist_seconds(candidate_state: str) -> float:
    return REST_PERSIST_SECONDS if candidate_state == "REST" else MOVING_PERSIST_SECONDS


def handle_data(device):
    global _last_tick, _last_seen_write
    global _raw_state, _raw_state_since
    global _stable_state, _stable_state_since
    global _last_rest_sample_sent

    gx = device.get("AsX")
    gy = device.get("AsY")
    gz = device.get("AsZ")

    if not all(isinstance(v, (int, float)) for v in (gx, gy, gz)):
        return

    now = time.time()

    if now - _last_seen_write > 0.2:
        try:
            with open(LAST_SEEN_FILE, "w") as f:
                f.write(str(now))
        except Exception as e:
            print("last_seen write failed:", e)
        _last_seen_write = now

    if now - _last_tick < 1.0 / PRINT_RATE_HZ:
        return
    _last_tick = now

    gmag = math.sqrt(gx * gx + gy * gy + gz * gz)
    instant_state = "MOVING" if gmag > MOVEMENT_THRESHOLD else "REST"

    print(
        f"Gx:{gx:7.2f}  Gy:{gy:7.2f}  Gz:{gz:7.2f}  |  "
        f"Gmag:{gmag:7.2f}  instant:{instant_state}  stable:{_stable_state}"
    )

    # Raw state tracking
    if _raw_state is None:
        _raw_state = instant_state
        _raw_state_since = now
    elif instant_state != _raw_state:
        _raw_state = instant_state
        _raw_state_since = now

    # Initial stable state
    if _stable_state is None:
        _stable_state = _raw_state
        _stable_state_since = now

        print(f"INITIAL STATE → {_stable_state}")

        post({
            "type": "state_change",
            "piId": PI_ID,
            "patientId": PATIENT_ID,
            "state": _stable_state,
            "gmag": gmag,
            "timestamp": utc_now_iso(),
        })
        return

    # Promote raw → stable with asymmetric debounce
    if _raw_state != _stable_state:
        required = get_required_persist_seconds(_raw_state)

        if (now - _raw_state_since) >= required:
            _stable_state = _raw_state
            _stable_state_since = now

            print(f"STATE CHANGE → {_stable_state}")

            post({
                "type": "state_change",
                "piId": PI_ID,
                "patientId": PATIENT_ID,
                "state": _stable_state,
                "gmag": gmag,
                "timestamp": utc_now_iso(),
            })

            # 🔹 Immediate REST sample (fixes perceived lag)
            if _stable_state == "REST":
                _last_rest_sample_sent = now
                post({
                    "type": "sample",
                    "piId": PI_ID,
                    "patientId": PATIENT_ID,
                    "state": _stable_state,
                    "gmag": gmag,
                    "timestamp": utc_now_iso(),
                })
                return

    send_sample = False

    if _stable_state == "MOVING":
        send_sample = True

    elif _stable_state == "REST":
        if (now - _last_rest_sample_sent) >= REST_HEARTBEAT_SECONDS:
            send_sample = True
            _last_rest_sample_sent = now

    if send_sample:
        post({
            "type": "sample",
            "piId": PI_ID,
            "patientId": PATIENT_ID,
            "state": _stable_state,
            "gmag": gmag,
            "timestamp": utc_now_iso(),
        })


async def main():
    while True:
        try:
            print("Attempting to connect to BLE sensor...")
            dm = DeviceModel("WitSensor", TARGET_MAC, handle_data)
            await dm.openDevice()
        except Exception as e:
            print("BLE connection failed:", e)
            print("Retrying in 5 seconds...\n")
            await asyncio.sleep(5)


if __name__ == "__main__":
    asyncio.run(main())