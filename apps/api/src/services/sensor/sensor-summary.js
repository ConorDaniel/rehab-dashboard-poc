const { db } = require("../../firestore");

const NO_SIGNAL_THRESHOLD_MS = 2 * 60 * 1000;

async function getSensorSummary(patientId, hours = 24) {
  const nowMs = Date.now();
  const windowStartMs = nowMs - hours * 60 * 60 * 1000;
  const windowStartIso = new Date(windowStartMs).toISOString();
  const windowEndIso = new Date(nowMs).toISOString();

  const eventsRef = db()
    .collection("patients")
    .doc(patientId)
    .collection("sensorEvents");

  // Events inside the window
  const inWindowSnap = await eventsRef
    .where("timestampMs", ">=", windowStartMs)
    .orderBy("timestampMs", "asc")
    .get();

  const inWindowEvents = inWindowSnap.docs.map((doc) => doc.data());

  // Last event before window start
  const beforeWindowSnap = await eventsRef
    .where("timestampMs", "<", windowStartMs)
    .orderBy("timestampMs", "desc")
    .limit(1)
    .get();

  const beforeWindowEvent = beforeWindowSnap.empty
    ? null
    : beforeWindowSnap.docs[0].data();

  const events = [];

  if (beforeWindowEvent) {
    events.push(beforeWindowEvent);
  }

  events.push(...inWindowEvents);

  let movingMs = 0;
  let restMs = 0;
  let noSignalMs = 0;

  // If there is no prior state at all, treat whole window as no signal
  if (events.length === 0) {
    noSignalMs = nowMs - windowStartMs;
  } else {
    let cursorMs = windowStartMs;

    // If first event starts inside the window and we had no prior state,
    // leading gap is no signal
    if (!beforeWindowEvent && events[0].timestampMs > windowStartMs) {
      noSignalMs += events[0].timestampMs - windowStartMs;
      cursorMs = events[0].timestampMs;
    }

    for (let i = 0; i < events.length; i++) {
      const currentEvent = events[i];
      const nextEvent = events[i + 1];

      const intervalStart = Math.max(
        cursorMs,
        currentEvent.timestampMs ?? windowStartMs
      );

      const intervalEnd = nextEvent
        ? Math.min(nextEvent.timestampMs, nowMs)
        : nowMs;

      if (intervalEnd <= intervalStart) {
        cursorMs = intervalEnd;
        continue;
      }

      const intervalMs = intervalEnd - intervalStart;

      // Count only a limited period as known state; excess becomes noSignal
      const stateMs = Math.min(intervalMs, NO_SIGNAL_THRESHOLD_MS);
      const excessMs = Math.max(0, intervalMs - NO_SIGNAL_THRESHOLD_MS);

      if (currentEvent.state === "MOVING") {
        movingMs += stateMs;
      } else if (currentEvent.state === "REST") {
        restMs += stateMs;
      } else {
        noSignalMs += stateMs;
      }

      noSignalMs += excessMs;
      cursorMs = intervalEnd;
    }
  }

  const totalMs = nowMs - windowStartMs || 1;
  const atRestMs = restMs + noSignalMs;

  const minutes = {
    moving: Math.round(movingMs / 60000),
    rest: Math.round(restMs / 60000),
    noSignal: Math.round(noSignalMs / 60000),
    atRest: Math.round(atRestMs / 60000),
  };

  const percentages = {
    moving: Number(((movingMs / totalMs) * 100).toFixed(1)),
    rest: Number(((restMs / totalMs) * 100).toFixed(1)),
    noSignal: Number(((noSignalMs / totalMs) * 100).toFixed(1)),
    atRest: Number(((atRestMs / totalMs) * 100).toFixed(1)),
  };

  return {
    patientId,
    hours,
    windowStart: windowStartIso,
    windowEnd: windowEndIso,
    minutes,
    percentages,
  };
}

module.exports = { getSensorSummary };