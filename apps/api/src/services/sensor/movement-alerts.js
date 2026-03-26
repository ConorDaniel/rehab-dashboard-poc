const axios = require("axios");

const REST_MIN_MS = 30 * 1000;   // demo value: 30 seconds
const MOVING_MIN_MS = 10 * 1000; // demo value: 10 seconds

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

  const description = `Movement after rest: patient ${patientId}, device ${piId}, time ${new Date().toISOString()}`;

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

async function evaluateMovementAlert({
  patientRef,
  previousSensor,
  patientId,
  piId,
  state,
  timestamp,
  eventMs,
}) {
  const prevState = previousSensor.currentState || null;
  const prevLastChangedAtMs = previousSensor.lastChangedAt
    ? Date.parse(previousSensor.lastChangedAt)
    : null;

  const prevRestQualified = previousSensor.restQualified || false;
  const prevMovementStartedAtMs = previousSensor.movementStartedAtMs || null;
  const prevAlertSent = previousSensor.alertSent || false;

  console.log("evaluateMovementAlert", {
    patientId,
    prevState,
    incomingState: state,
    prevLastChangedAtMs,
    prevRestQualified,
    prevMovementStartedAtMs,
    prevAlertSent,
    eventMs,
  });

  if (state !== "REST" && state !== "MOVING") return;

  // =========================
  // REST LOGIC
  // =========================
  if (state === "REST") {
    // First entry into REST: clear previous movement episode immediately
    if (prevState !== "REST") {
      await patientRef.set(
  {
    sensor: {
      restQualified: false,
      movementStartedAt: null,
      movementStartedAtMs: null,
      alertSent: false,
      alertSentAt: null,
      alertActive: false,
    },
  },
      { merge: true }
    );

      console.log(`Entered REST for ${patientId} — cycle reset`);
      return;
    }

    // Continuing REST: check if REST duration has reached threshold
    const restStartMs = prevLastChangedAtMs ?? eventMs;
    const restDurationMs = eventMs - restStartMs;

    console.log("REST duration check", {
      patientId,
      restStartMs,
      restDurationMs,
      REST_MIN_MS,
      prevRestQualified,
    });

    if (restDurationMs >= REST_MIN_MS && !prevRestQualified) {
      await patientRef.set(
        {
          sensor: {
            restQualified: true,
          },
        },
        { merge: true }
      );

      console.log(`REST qualified for ${patientId}`);
    }

    return;
  }

  // =========================
  // MOVING LOGIC
  // =========================
  if (state === "MOVING") {
    if (!prevRestQualified) {
      console.log(`MOVING ignored for ${patientId}: REST not yet qualified`);
      return;
    }

    // First qualifying MOVING message after REST
    if (prevState !== "MOVING" || !prevMovementStartedAtMs) {
      await patientRef.set(
        {
          sensor: {
            movementStartedAt: timestamp,
            movementStartedAtMs: eventMs,
          },
        },
        { merge: true }
      );

      console.log(`Qualified MOVING episode started for ${patientId}`);
      return;
    }

    // Continuing MOVING: check duration
    const movingDurationMs = eventMs - prevMovementStartedAtMs;

    console.log("MOVING duration check", {
      patientId,
      movingDurationMs,
      MOVING_MIN_MS,
      prevAlertSent,
    });

    if (movingDurationMs >= MOVING_MIN_MS && !prevAlertSent) {
      await sendBlynkAlert(patientId, piId);

      await patientRef.set(
  {
    sensor: {
      alertSent: true,
      alertSentAt: new Date().toISOString(),
      alertActive: true,
    },
  },
    { merge: true }
  );

      console.log(`Alert completed for ${patientId}`);
    }
  }
}

module.exports = {
  evaluateMovementAlert,
  sendBlynkAlert,
};