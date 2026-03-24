const { db } = require("../firestore");
const {
  shouldTriggerMovementAlert,
  scheduleMovementAlert,
  clearPendingAlert,
} = require("../services/sensor/movement-alerts");

function registerTelemetryRoutes(server) {
  server.route({
    method: "POST",
    path: "/telemetry",
    options: {
      payload: {
        parse: true,
        output: "data",
        allow: "application/json",
      },
    },
    handler: async (request, h) => {
      try {
        const payload = request.payload;
        console.log("Telemetry received:", payload);

        const { type, piId, patientId, state, timestamp, gmag } = payload;

        if (!type || !piId || !patientId) {
          return h
            .response({ message: "type, piId and patientId are required" })
            .code(400);
        }

        if (!timestamp) {
          return h
            .response({ message: "timestamp is required" })
            .code(400);
        }

        const eventMs = Date.parse(timestamp);

        if (Number.isNaN(eventMs)) {
          return h
            .response({ message: "timestamp must be a valid ISO date string" })
            .code(400);
        }

        const patientRef = db().collection("patients").doc(patientId);
        const patientSnap = await patientRef.get();

        if (!patientSnap.exists) {
          return h.response({ message: "Patient not found" }).code(404);
        }

        const nowIso = new Date().toISOString();

        // Update telemetry freshness for ANY telemetry received
        await db().collection("devices").doc(piId).set(
          {
            piId,
            patientId,
            lastTelemetryAt: timestamp,
            updatedAt: nowIso,
          },
          { merge: true }
        );

        await patientRef.set(
          {
            sensor: {
              lastSeenAt: timestamp,
              lastGmag: typeof gmag === "number" ? gmag : null,
            },
          },
          { merge: true }
        );

        // Ignore samples after refreshing telemetry freshness
        if (type === "sample") {
          return { ok: true, persisted: false, ignoredType: "sample" };
        }

        if (type !== "state_change") {
          return h
            .response({ message: `Unsupported telemetry type: ${type}` })
            .code(400);
        }

        if (!state) {
          return h
            .response({
              message: "state is required for state_change",
            })
            .code(400);
        }

        // Get previous event BEFORE writing the new one
        const previousEventSnap = await patientRef
          .collection("sensorEvents")
          .orderBy("timestampMs", "desc")
          .limit(1)
          .get();

        const previousEvent = previousEventSnap.empty
          ? null
          : previousEventSnap.docs[0].data();

        console.log(`Writing sensor event for ${patientId}: ${state}`);

        // 1. Write event to patient history
        await patientRef.collection("sensorEvents").add({
          type: "state_change",
          state,
          stateStartedAt: timestamp,
          stateStartedAtMs: eventMs,
          timestamp,
          timestampMs: eventMs,
          gmag: typeof gmag === "number" ? gmag : null,
          createdAt: nowIso,
        });

        // 2. Update patient summary
        await patientRef.set(
          {
            sensor: {
              currentState: state,
              lastChangedAt: timestamp,
              lastSeenAt: timestamp,
              lastGmag: typeof gmag === "number" ? gmag : null,
            },
          },
          { merge: true }
        );

        // 3. Alert logic for POC
        if (state === "REST") {
          clearPendingAlert(patientId);
        }

        if (shouldTriggerMovementAlert(previousEvent, state)) {
          console.log(
            `Alert rule met for ${patientId}: moving after rest; scheduling confirmation`
          );
          scheduleMovementAlert({ patientId, piId });
        } else if (state === "MOVING") {
          console.log(
            `No alert scheduled for ${patientId}: previous state was not long enough REST`
          );
        }

        console.log(`Firestore updated for ${patientId} via ${piId}: ${state}`);

        return h.response({ ok: true, persisted: "state_change" }).code(201);
      } catch (error) {
        console.error("Telemetry error:", error.message);
        return h.response({ error: error.message }).code(500);
      }
    },
  });
}

module.exports = { registerTelemetryRoutes };