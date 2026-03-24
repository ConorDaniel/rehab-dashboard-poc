const axios = require("axios");

const REST_MIN_MS = 10 * 1000;       // 10 seconds for demo
const MOVING_CONFIRM_MS = 10 * 1000; // 10 seconds for demo

const pendingAlerts = new Map();

async function sendBlynkAlert(patientId, piId) {
  const server = process.env.BLYNK_SERVER;
  const token = process.env.BLYNK_DEVICE_TOKEN;
  const eventCode = process.env.BLYNK_EVENT_CODE || "movement_after_rest";

  console.log("sendBlynkAlert called", {
    patientId,
    piId,
    server,
    hasToken: !!token,
    eventCode,
  });

  if (!server || !token) {
    console.log("Blynk not configured: missing BLYNK_SERVER or BLYNK_DEVICE_TOKEN");
    return;
  }

  const description = `Movement after rest: patient ${patientId}, device ${piId}`;

  const response = await axios.get(`https://${server}/external/api/logEvent`, {
    params: {
      token,
      code: eventCode,
      description,
    },
    timeout: 5000,
  });

  console.log("Blynk response status:", response.status);
  console.log(`Blynk alert sent for patient ${patientId} via ${piId}`);
}

function clearPendingAlert(patientId) {
  const existing = pendingAlerts.get(patientId);
  if (existing) {
    console.log(`Clearing pending alert for ${patientId}`);
    clearTimeout(existing);
    pendingAlerts.delete(patientId);
  }
}

function scheduleMovementAlert({ patientId, piId }) {
  clearPendingAlert(patientId);

  console.log(
    `Scheduling Blynk alert for ${patientId} in ${MOVING_CONFIRM_MS}ms`
  );

  const timeoutId = setTimeout(async () => {
    try {
      console.log(`Timer fired for ${patientId}`);
      await sendBlynkAlert(patientId, piId);
    } catch (error) {
      const message =
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        error.message;
      console.error("Failed to send Blynk alert:", message);
    } finally {
      pendingAlerts.delete(patientId);
    }
  }, MOVING_CONFIRM_MS);

  pendingAlerts.set(patientId, timeoutId);
}

function shouldTriggerMovementAlert(previousEvent, currentState) {
  const restStartMs = previousEvent?.timestampMs ?? previousEvent?.stateStartedAtMs;
  const restDurationMs = restStartMs ? Date.now() - restStartMs : null;

  console.log("Alert check", {
    previousState: previousEvent?.state,
    currentState,
    restStartMs,
    restDurationMs,
    REST_MIN_MS,
  });

  if (!previousEvent) return false;
  if (currentState !== "MOVING") return false;
  if (previousEvent.state !== "REST") return false;
  if (!restStartMs) return false;

  return restDurationMs >= REST_MIN_MS;
}

module.exports = {
  shouldTriggerMovementAlert,
  scheduleMovementAlert,
  clearPendingAlert,
};