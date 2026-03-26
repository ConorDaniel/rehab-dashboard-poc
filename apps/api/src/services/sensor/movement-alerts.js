const axios = require("axios");

const REST_MIN_MS = 10 * 1000; // demo value: 10 seconds

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

function shouldTriggerMovementAlert(previousEvent, currentState, currentEventMs) {
  const restStartMs = previousEvent?.timestampMs ?? previousEvent?.stateStartedAtMs;
  const restDurationMs =
    restStartMs && currentEventMs ? currentEventMs - restStartMs : null;

  console.log("Alert check", {
    previousState: previousEvent?.state,
    currentState,
    restStartMs,
    currentEventMs,
    restDurationMs,
    REST_MIN_MS,
  });

  if (!previousEvent) return false;
  if (currentState !== "MOVING") return false;
  if (previousEvent.state !== "REST") return false;
  if (!restStartMs || !currentEventMs) return false;

  return restDurationMs >= REST_MIN_MS;
}

module.exports = {
  shouldTriggerMovementAlert,
  sendBlynkAlert,
};