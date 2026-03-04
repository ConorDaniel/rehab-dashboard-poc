import asyncio
import json
import math
import time
from typing import Dict, Any, Optional
CONNECT_LOCK = asyncio.Lock()


import requests
from device_model import DeviceModel

STATE_THRESHOLD = 8.0          # same as your PoC
MIN_POST_INTERVAL = 2.0        # seconds (heartbeat while steady)
POST_TIMEOUT = 2.0             # seconds

# Per-patient tracking
_last_state: Dict[str, Optional[str]] = {}
_last_post_time: Dict[str, float] = {}
_queues: Dict[str, asyncio.Queue] = {}

def gyro_mag(gx: float, gy: float, gz: float) -> float:
    return math.sqrt(gx*gx + gy*gy + gz*gz)

def make_handler(patient_id: str):
    """
    This is called VERY frequently by device_model.
    Keep it fast: compute state and enqueue only if needed.
    """
    def handle_data(device):
        gx = device.get("AsX")
        gy = device.get("AsY")
        gz = device.get("AsZ")

        if not all(isinstance(v, (int, float)) for v in (gx, gy, gz)):
            return

        gmag = gyro_mag(gx, gy, gz)
        state = "MOVING" if gmag > STATE_THRESHOLD else "REST"

        now = time.time()
        prev = _last_state.get(patient_id)
        last_post = _last_post_time.get(patient_id, 0.0)

        # Only send if state changed OR periodic heartbeat interval passed
        should_send = (prev != state) or ((now - last_post) >= MIN_POST_INTERVAL)
        if not should_send:
            return

        _last_state[patient_id] = state
        _last_post_time[patient_id] = now

        # enqueue payload
        payload = {
            "patientId": patient_id,
            "state": state,
            "gmag": round(gmag, 2),
            "deviceTs": now
        }
        try:
            _queues[patient_id].put_nowait(payload)
        except asyncio.QueueFull:
            # drop if overwhelmed (shouldn't happen with our throttling)
            pass

    return handle_data

async def sender_loop(patient_id: str, api_base: str, token: str):
    """
    Async loop that POSTs payloads to Hapi.
    Uses requests in a thread so we don't block the asyncio loop.
    """
    url = f"{api_base}/telemetry"
    headers = {"x-pi-token": token}

    while True:
        payload = await _queues[patient_id].get()

        def _post():
            return requests.post(url, json=payload, headers=headers, timeout=POST_TIMEOUT)

        try:
            res = await asyncio.to_thread(_post)
            if res.status_code != 200:
                print(f"[{patient_id}] POST {res.status_code}: {res.text[:120]}")
        except Exception as e:
            print(f"[{patient_id}] POST failed: {e}")

async def connect_one(patient_id: str, mac: str):
    while True:
        try:
            dm = DeviceModel(patient_id, mac, make_handler(patient_id))

            # LOCK ONLY THE CONNECT PHASE
            async with CONNECT_LOCK:
                print(f"[{patient_id}] connecting...")
                await asyncio.sleep(0.5)  # small delay helps BlueZ
                connect_task = asyncio.create_task(dm.openDevice())

            # Now streaming happens WITHOUT lock
            await connect_task

        except Exception as e:
            print(f"[{patient_id}] connect error: {e} (retrying in 3s)")

        await asyncio.sleep(3)

async def main():
    with open("config.json", "r") as f:
        cfg: Dict[str, Any] = json.load(f)

    api_base = cfg["apiBaseUrl"].rstrip("/")
    token = cfg["piToken"]
    sensors = cfg["sensors"]

    # init queues
    for s in sensors:
        pid = s["patientId"]
        _queues[pid] = asyncio.Queue(maxsize=10)
        _last_state[pid] = None
        _last_post_time[pid] = 0.0

    tasks = []

    # start sender loops
    for s in sensors:
        pid = s["patientId"]
        tasks.append(asyncio.create_task(sender_loop(pid, api_base, token)))

    # start BLE connections
    for s in sensors:
        pid = s["patientId"]
        mac = s["mac"]
        tasks.append(asyncio.create_task(connect_one(pid, mac)))

    print("Multi-sensor runner started.")
    await asyncio.gather(*tasks)

if __name__ == "__main__":
    asyncio.run(main())
