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
API_URL = "http://192.168.1.57:4000/telemetry"

PRINT_RATE_HZ = 4
MOVEMENT_THRESHOLD = 8

STATE_CHANGE_PERSIST_SECONDS = 3

# NEW: instead of silence, send low-frequency heartbeat
REST_HEARTBEAT_SECONDS = 10

# Heartbeat helper file (read by heartbeat.py)
LAST_SEEN_FILE = "/tmp/p1_last_seen"

# =========================

_last_tick = 0.0
_last_seen_write = 0.0

# State tracking
_raw_state = None
_raw_state_since = 0.0

_stable_state = None
_stable_state_since = 0.0

# NEW
_last_rest_sample_sent = 0.0


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def post(payload: dict) -> None:
    try:
        requests.post(API_URL, json=payload, timeout=2)
    except Exception as e:
        print("POST failed:", e)


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

    # Update heartbeat marker (used by heartbeat.py)
    if now - _last_seen_write > 0.2:
        try:
            with open(LAST_SEEN_FILE, "w") as f:
                f.write(str(now))
        except Exception as e:
            print("last_seen write failed:", e)
        _last_seen_write = now

    # Downsample processing
    if now - _last_tick < 1.0 / PRINT_RATE_HZ:
        return
    _last_tick = now

    gmag = math.sqrt(gx * gx + gy * gy + gz * gz)
    instant_state = "MOVING" if gmag > MOVEMENT_THRESHOLD else "REST"

    print(
        f"Gx:{gx:7.2f}  Gy:{gy:7.2f}  Gz:{gz:7.2f}  |  "
        f"Gmag:{gmag:7.2f}  {instant_state}"
    )

    # Initialise raw state
    if _raw_state is None:
        _raw_state = instant_state
        _raw_state_since = now

    # Detect raw state change
    if instant_state != _raw_state:
        _raw_state = instant_state
        _raw_state_since = now

    # Initialise stable state
    if _stable_state is None:
        _stable_state = _raw_state
        _stable_state_since = now

        post({
            "type": "state_change",
            "piId": PI_ID,
            "patientId": PATIENT_ID,
            "state": _stable_state,
            "gmag": gmag,
            "timestamp": utc_now_iso(),
        })
        return

    # Promote raw → stable
    if (
        _raw_state != _stable_state
        and (now - _raw_state_since) >= STATE_CHANGE_PERSIST_SECONDS
    ):
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

    # =========================
    # SAMPLE LOGIC (FIXED)
    # =========================

    send_sample = False

    if _stable_state == "MOVING":
        # send regularly when moving
        send_sample = True

    elif _stable_state == "REST":
        # send heartbeat sample every N seconds
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
