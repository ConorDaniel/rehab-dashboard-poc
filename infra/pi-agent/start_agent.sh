#!/bin/bash

echo "Starting Pi Agent..."

cd /home/conor/ProjectSETU/FinalProject/rehab-dashboard-poc/infra/pi-agent || exit 1

echo "Ensuring Bluetooth is powered on..."
rfkill unblock bluetooth
bluetoothctl power on

echo "Waiting for Bluetooth to be ready..."
sleep 10

/home/conor/ProjectSETU/FinalProject/rehab-dashboard-poc/.venv/bin/python pi_ping_server.py &
/home/conor/ProjectSETU/FinalProject/rehab-dashboard-poc/.venv/bin/python run_sensor.py &
/home/conor/ProjectSETU/FinalProject/rehab-dashboard-poc/.venv/bin/python heartbeat.py &

wait
