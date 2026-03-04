import asyncio
import math
import time
import requests
from datetime import datetime, timezone
from device_model import DeviceModel

# =========================
# CONFIGURATION
# =========================

TARGET_MAC = "E1:B7:EA:2D:8A:AE"          # Sensor MAC
PATIENT_ID = "p1"
API_URL = "http://192.168.1.7:4000/telemetry"

PRINT_RATE_HZ = 4                         # Console + processing rate
MOVEMENT_THRESHOLD = 8                    # Gyro magnitude threshold

# Debounce / persistence rules
STATE_CHANGE_PERSIST_SECONDS = 3          # only report a new state if it lasts >= 3s
REST_SILENCE_AFTER_SECONDS = 10           # after being REST for >= 10s, stop sending samples

# Heartbeat helper file (read by heartbeat.py)
LAST_SEEN_FILE = "/tmp/p1_last_seen"

# =========================

_last_tick = 0.0
_last_seen_write = 0.0

# State tracking
_raw_state = None                         # instantaneous from threshold
_raw_state_since = 0.0                    # when instantaneous state last changed

_stable_state = None                      # debounced state
_stable_state_since = 0.0                 # when debounced state took effect

_rest_silenced = False


def post(payload: dict) -> None:
    """Best-effort POST to the local Hapi API."""
    try:
        requests.post(API_URL, json=payload, timeout=2)
    except Exception as e:
        print("POST failed:", e)


def handle_data(device):
    global _last_tick, _last_seen_write
    global _raw_state, _raw_state_since
    global _stable_state, _stable_state_since
    global _rest_silenced

    gx = device.get("AsX")
    gy = device.get("AsY")
    gz = device.get("AsZ")

    if not all(isinstance(v, (int, float)) for v in (gx, gy, gz)):
        return

    now = time.time()

    # Update "last seen" marker for heartbeat.py (write max ~5Hz)
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

    # Console output
    print(
        f"Gx:{gx:7.2f}  Gy:{gy:7.2f}  Gz:{gz:7.2f}  |  "
        f"Gmag:{gmag:7.2f}  {instant_state}"
    )

    # Track instantaneous state changes
    if _raw_state is None:
        _raw_state = instant_state
        _raw_state_since = now

    if instant_state != _raw_state:
        _raw_state = instant_state
        _raw_state_since = now

    # Promote to "stable" only if it persists long enough
    if _stable_state is None:
        _stable_state = _raw_state
        _stable_state_since = now
        _rest_silenced = (_stable_state == "REST")

        post({
            "type": "state_change",
            "patientId": PATIENT_ID,
            "state": _stable_state,
            "gmag": gmag,
            "timestamp": int(now * 1000),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        return

    # If stable differs from raw and raw has persisted >= debounce window, switch
    if _raw_state != _stable_state and (now - _raw_state_since) >= STATE_CHANGE_PERSIST_SECONDS:
        _stable_state = _raw_state
        _stable_state_since = now
        _rest_silenced = False  # any state change re-enables sending

        post({
            "type": "state_change",
            "patientId": PATIENT_ID,
            "state": _stable_state,
            "gmag": gmag,
            "timestamp": int(now * 1000),
        })

    # Decide whether to send samples
    if _stable_state == "REST":
        # If REST has persisted long enough, silence sample sending
        if (now - _stable_state_since) >= REST_SILENCE_AFTER_SECONDS:
            _rest_silenced = True

    send_samples = True
    if _stable_state == "REST" and _rest_silenced:
        send_samples = False

    if send_samples:
        post({
            "type": "sample",
            "patientId": PATIENT_ID,
            "state": _stable_state,     # debounced state
            "gmag": gmag,
            "timestamp": int(now * 1000),
        })


async def main():
    dm = DeviceModel("WitSensor", TARGET_MAC, handle_data)
    await dm.openDevice()


if __name__ == "__main__":
    asyncio.run(main())
