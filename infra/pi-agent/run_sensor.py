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

# Sensor check / terminal print frequency
PRINT_RATE_HZ = 5

# Hysteresis thresholds
MOVING_THRESHOLD = 20.0
REST_THRESHOLD = 12.0

# Sample posting frequency
MOVING_SAMPLE_RATE_SECONDS = 2.0
REST_HEARTBEAT_SECONDS = 10.0

LAST_SEEN_FILE = "/tmp/p1_last_seen"

# =========================

_last_tick = 0.0
_last_seen_write = 0.0

_current_state = None
_last_sample_sent_time = 0.0


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def post(payload: dict) -> None:
    try:
        response = requests.post(PRIMARY_API_URL, json=payload, timeout=1.0)
        response.raise_for_status()
        print(f"POST ok -> {payload.get('type')} ({payload.get('state')})")
    except Exception as e:
        print(f"POST failed -> {e}")


def handle_data(device):
    global _last_tick, _last_seen_write
    global _current_state, _last_sample_sent_time

    gx = device.get("AsX")
    gy = device.get("AsY")
    gz = device.get("AsZ")

    if not all(isinstance(v, (int, float)) for v in (gx, gy, gz)):
        return

    now = time.time()

    # update heartbeat file
    if now - _last_seen_write > 0.2:
        try:
            with open(LAST_SEEN_FILE, "w") as f:
                f.write(str(now))
        except Exception:
            pass
        _last_seen_write = now

    # throttle sensor processing / terminal output
    if now - _last_tick < 1.0 / PRINT_RATE_HZ:
        return
    _last_tick = now

    # calculate gyro magnitude
    gmag = math.sqrt(gx * gx + gy * gy + gz * gz)

    # hysteresis state logic
    if _current_state is None:
        new_state = "MOVING" if gmag > MOVING_THRESHOLD else "REST"
    elif _current_state == "REST":
        new_state = "MOVING" if gmag > MOVING_THRESHOLD else "REST"
    else:  # currently MOVING
        new_state = "REST" if gmag < REST_THRESHOLD else "MOVING"

    # apply state change immediately
    if _current_state is None or new_state != _current_state:
        old_state = _current_state
        _current_state = new_state

        print(f"STATE CHANGE → {old_state} -> {_current_state}  (Gmag: {gmag:.2f})")

        post({
            "type": "state_change",
            "piId": PI_ID,
            "patientId": PATIENT_ID,
            "state": _current_state,
            "gmag": gmag,
            "timestamp": utc_now_iso(),
        })

        # force an immediate sample after a state change
        _last_sample_sent_time = 0.0

    # print live sensor readings and current state
    print(
        f"Gx:{gx:7.2f}  Gy:{gy:7.2f}  Gz:{gz:7.2f}  |  "
        f"Gmag:{gmag:7.2f}  state:{_current_state}"
    )

    # sample posting logic
    send_sample = False

    if _current_state == "MOVING":
        if (now - _last_sample_sent_time) >= MOVING_SAMPLE_RATE_SECONDS:
            send_sample = True

    elif _current_state == "REST":
        if (now - _last_sample_sent_time) >= REST_HEARTBEAT_SECONDS:
            send_sample = True

    if send_sample:
        _last_sample_sent_time = now
        post({
            "type": "sample",
            "piId": PI_ID,
            "patientId": PATIENT_ID,
            "state": _current_state,
            "gmag": gmag,
            "timestamp": utc_now_iso(),
        })


async def main():
    while True:
        try:
            print(f"Connecting to BLE sensor {TARGET_MAC}...")
            dm = DeviceModel("WitSensor", TARGET_MAC, handle_data)
            await dm.openDevice()
        except Exception as e:
            print(f"BLE Error: {e}")
            await asyncio.sleep(5)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nExit.")