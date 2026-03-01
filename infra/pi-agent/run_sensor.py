import asyncio
import math
import time
from device_model import DeviceModel

TARGET_MAC = "E1:B7:EA:2D:8A:AE"

last_print = 0

def handle_data(device):
    global last_print

    gx = device.get("AsX")
    gy = device.get("AsY")
    gz = device.get("AsZ")

    if not all(isinstance(v, (int, float)) for v in [gx, gy, gz]):
        return

    now = time.time()
    if now - last_print < 0.25:  # 4 Hz
        return
    last_print = now

    gmag = math.sqrt(gx*gx + gy*gy + gz*gz)
    state = "MOVING" if gmag > 8 else "REST"

    print(f"Gx:{gx:7.2f}  Gy:{gy:7.2f}  Gz:{gz:7.2f}  |  Gmag:{gmag:7.2f}  {state}")

async def main():
    dm = DeviceModel("WitSensor", TARGET_MAC, handle_data)
    await dm.openDevice()

if __name__ == "__main__":
    asyncio.run(main())
