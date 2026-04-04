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

PRINT_RATE_HZ = 2

# Hysteresis thresholds
MOVING_THRESHOLD = 20
REST_THRESHOLD = 8

REST_HEARTBEAT_SECONDS = 10

LAST_SEEN_FILE = "/tmp/p1_last_seen"

# =========================

_last_tick = 0.0
_last_seen_write = 0.0

_current_state = None
_last_rest_sample_sent = 0.0


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def post(payload: dict) -> None:
    try:
        response = requests.post(PRIMARY_API_URL, json=payload, timeout=1)
        response.raise_for_status()
        print(f"POST ok -> {PRIMARY_API_URL}")
    except Exception as e:
        print(f"POST failed -> {PRIMARY_API_URL}: {e}")


def handle_data(device):
    global _last_tick, _last_seen_write
    global _current_state, _last_rest_sample_sent

    gx = device.get("AsX")
    gy = device.get("AsY")
    gz = device.get("AsZ")

    if not all(isinstance(v, (int, float)) for v in (gx, gy, gz)):
        return

    now = time.time()

    # heartbeat file update
    if now - _last_seen_write > 0.2:
        try:
            with open(LAST_SEEN_FILE, "w") as f:
                f.write(str(now))
        except Exception as e:
            print("last_seen write failed:", e)
        _last_seen_write = now

    # throttle loop
    if now - _last_tick < 1.0 / PRINT_RATE_HZ:
        return
    _last_tick = now

    gmag = math.sqrt(gx * gx + gy * gy + gz * gz)

    # ===== HYSTERESIS STATE LOGIC =====
    if _current_state is None:
        instant_state = "MOVING" if gmag > MOVING_THRESHOLD else "REST"

    elif _current_state == "REST":
        instant_state = "MOVING" if gmag > MOVING_THRESHOLD else "REST"

    else:  # currently MOVING
        instant_state = "REST" if gmag < REST_THRESHOLD else "MOVING"

    print(
        f"Gx:{gx:7.2f}  Gy:{gy:7.2f}  Gz:{gz:7.2f}  |  "
        f"Gmag:{gmag:7.2f}  state:{instant_state}"
    )

    # ===== STATE CHANGE =====
    if _current_state is None or instant_state != _current_state:
        _current_state = instant_state

        print(f"STATE CHANGE → {_current_state}")

        post({
            "type": "state_change",
            "piId": PI_ID,
            "patientId": PATIENT_ID,
            "state": _current_state,
            "gmag": gmag,
            "timestamp": utc_now_iso(),
        })

        # reset REST timing so we send one immediate sample
        if _current_state == "REST":
            _last_rest_sample_sent = 0.0

    # ===== SAMPLE LOGIC =====
    send_sample = False

    if _current_state == "MOVING":
        send_sample = True

    elif _current_state == "REST":
        if _last_rest_sample_sent == 0.0 or (now - _last_rest_sample_sent) >= REST_HEARTBEAT_SECONDS:
            send_sample = True

    if send_sample:
        post({
            "type": "sample",
            "piId": PI_ID,
            "patientId": PATIENT_ID,
            "state": _current_state,
            "gmag": gmag,
            "timestamp": utc_now_iso(),
        })

        if _current_state == "REST":
            _last_rest_sample_sent = now


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
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nStopped by user")