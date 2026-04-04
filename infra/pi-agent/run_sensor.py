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

# Increased HZ to catch state changes faster, 
# but we will throttle the POST calls specifically.
PRINT_RATE_HZ = 5 

# Hysteresis thresholds
# Since your rest is '10', we set REST_THRESHOLD to 12.0
MOVING_THRESHOLD = 20.0
REST_THRESHOLD = 12.0

REST_HEARTBEAT_SECONDS = 10
MOVING_SAMPLE_RATE_SECONDS = 2.0  # Only send a 'sample' every 2s while moving

LAST_SEEN_FILE = "/tmp/p1_last_seen"

# =========================

_last_tick = 0.0
_last_seen_write = 0.0

_current_state = None
_last_sample_sent_time = 0.0


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def post(payload: dict) -> None:
    """Synchronous POST with a tight timeout to prevent long hangs."""
    try:
        # Reduced timeout to 1.5s so we don't fall too far behind reality
        response = requests.post(PRIMARY_API_URL, json=payload, timeout=1.5)
        response.raise_for_status()
        print(f"POST ok -> {payload.get('type')} ({payload.get('state')})")
    except Exception as e:
        print(f"POST failed: {e}")


def handle_data(device):
    global _last_tick, _last_seen_write
    global _current_state, _last_sample_sent_time

    gx = device.get("AsX")
    gy = device.get("AsY")
    gz = device.get("AsZ")

    if not all(isinstance(v, (int, float)) for v in (gx, gy, gz)):
        return

    now = time.time()

    # 1. Heartbeat file update (Non-blocking)
    if now - _last_seen_write > 0.2:
        try:
            with open(LAST_SEEN_FILE, "w") as f:
                f.write(str(now))
        except:
            pass
        _last_seen_write = now

    # 2. Throttle the sensor processing loop
    if now - _last_tick < 1.0 / PRINT_RATE_HZ:
        return
    _last_tick = now

    # 3. Calculate Magnitude
    gmag = math.sqrt(gx * gx + gy * gy + gz * gz)

    # 4. Hysteresis Logic
    # If Gmag is 10 at rest, and threshold is 12, this will now correctly trigger REST.
    if _current_state is None:
        new_state = "MOVING" if gmag > MOVING_THRESHOLD else "REST"
    elif _current_state == "REST":
        new_state = "MOVING" if gmag > MOVING_THRESHOLD else "REST"
    else:  # currently MOVING
        new_state = "REST" if gmag < REST_THRESHOLD else "MOVING"

    # 5. Handle State Change (Highest Priority)
    if _current_state is None or new_state != _current_state:
        old_state = _current_state
        _current_state = new_state
        print(f"!!! STATE CHANGE: {old_state} -> {_current_state} (Gmag: {gmag:.2f})")

        post({
            "type": "state_change",
            "piId": PI_ID,
            "patientId": PATIENT_ID,
            "state": _current_state,
            "gmag": gmag,
            "timestamp": utc_now_iso(),
        })
        # Force a sample to be sent immediately after a state change
        _last_sample_sent_time = 0 

    # 6. Sample Reporting Logic (Throttled to prevent network lag)
    send_sample = False
    
    if _current_state == "MOVING":
        # Only send a 'moving' update every 2 seconds
        if (now - _last_sample_sent_time) >= MOVING_SAMPLE_RATE_SECONDS:
            send_sample = True
    elif _current_state == "REST":
        # Only send a 'rest' heartbeat every 10 seconds
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
            # Ensure handle_data is passed correctly
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