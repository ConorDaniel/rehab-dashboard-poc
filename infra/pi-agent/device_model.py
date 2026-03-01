# coding:UTF-8
import time
import struct
import asyncio
from bleak import BleakClient


# DDevice instance
class DeviceModel:
    # region
    deviceName = "我的设备"  # 设备名称 Device name
    deviceData = {}  # 设备数据字典 Device Data Dictionary
    isOpen = False  # 设备是否开启 Is the device open
    TempBytes = []  # 临时数组 Temporary array

    def __init__(self, deviceName, mac, callback_method):
        print("初始化设备模型")
        # 设备名称（自定义） Device Name
        self.deviceName = deviceName
        self.mac = mac
        self.client = None
        self.writer_characteristic = None
        self.isOpen = False
        self.callback_method = callback_method
        self.deviceData = {}

    # region 获取设备数据 Obtain device data
    def set(self, key, value):
        """Set device data."""
        self.deviceData[key] = value

    def get(self, key):
        """Get device data."""
        return self.deviceData.get(key, None)

    def remove(self, key):
        """Remove device data."""
        if key in self.deviceData:
            del self.deviceData[key]

    # endregion

    async def openDevice(self):
        """
        Open a connection to the device.
        """
        print("Opening device......")
        async with BleakClient(self.mac) as client:
            self.client = client
            self.isOpen = True
            print("Connected to device")

            # Set up notifications
            target_service_uuid = "0000ffe5-0000-1000-8000-00805f9a34fb"
            target_characteristic_uuid_read = "0000ffe4-0000-1000-8000-00805f9a34fb"
            notify_characteristic = None

            for service in client.services:
                if service.uuid == target_service_uuid:
                    for characteristic in service.characteristics:
                        if characteristic.uuid == target_characteristic_uuid_read:
                            notify_characteristic = characteristic
                            break
            if notify_characteristic:
                await client.start_notify(notify_characteristic.uuid, self.onDataReceived)
                print("Notification started")
                try:
                    while self.isOpen:
                        await asyncio.sleep(100)  # Adjust polling interval here
                except asyncio.CancelledError:
                    pass
                finally:
                    await client.stop_notify(notify_characteristic.uuid)
            else:
                print("No matching characteristics found")

    def closeDevice(self):
        """Close the device."""
        self.isOpen = False
        print("The device is turned off")

    # region 数据解析 data analysis
    def onDataReceived(self, sender, data):
        """
        Handle data received from the device.
        """
        tempdata = bytes.fromhex(data.hex())
        for var in tempdata:
            self.TempBytes.append(var)
            if len(self.TempBytes) == 2 and (self.TempBytes[0] != 0x55 or self.TempBytes[1] != 0x61):
                del self.TempBytes[0]
                continue
            if len(self.TempBytes) == 20:
                self.processData(self.TempBytes[2:])
                self.TempBytes.clear()

    def processData(self, Bytes):
        """
        Parse received data.
        """
        Ax = self.getSignInt16(Bytes[1] << 8 | Bytes[0]) / 32768 * 16
        Ay = self.getSignInt16(Bytes[3] << 8 | Bytes[2]) / 32768 * 16
        Az = self.getSignInt16(Bytes[5] << 8 | Bytes[4]) / 32768 * 16
        Gx = self.getSignInt16(Bytes[7] << 8 | Bytes[6]) / 32768 * 2000
        Gy = self.getSignInt16(Bytes[9] << 8 | Bytes[8]) / 32768 * 2000
        Gz = self.getSignInt16(Bytes[11] << 8 | Bytes[10]) / 32768 * 2000
        AngX = self.getSignInt16(Bytes[13] << 8 | Bytes[12]) / 32768 * 180
        AngY = self.getSignInt16(Bytes[15] << 8 | Bytes[14]) / 32768 * 180
        AngZ = self.getSignInt16(Bytes[17] << 8 | Bytes[16]) / 32768 * 180
        self.set("AccX", round(Ax, 3))
        self.set("AccY", round(Ay, 3))
        self.set("AccZ", round(Az, 3))
        self.set("AsX", round(Gx, 3))
        self.set("AsY", round(Gy, 3))
        self.set("AsZ", round(Gz, 3))
        self.set("AngX", round(AngX, 3))
        self.set("AngY", round(AngY, 3))
        self.set("AngZ", round(AngZ, 3))
        self.callback_method(self)

    @staticmethod
    def getSignInt16(num):
        """
        Get a signed int16 value.
        """
        if num >= pow(2, 15):
            num -= pow(2, 16)
        return num

    # endregion
