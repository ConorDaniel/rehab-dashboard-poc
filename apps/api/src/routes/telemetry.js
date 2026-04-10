const { db } = require("../firestore");
const { evaluateMovementAlert } = require("../services/sensor/movement-alerts");

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
          return h.response({ message: "timestamp is required" }).code(400);
        }

        const eventMs = Date.parse(timestamp);

        if (Number.isNaN(eventMs)) {
          return h
            .response({ message: "timestamp must be a valid ISO date string" })
            .code(400);
        }

        if (type !== "sample" && type !== "state_change") {
          return h
            .response({ message: `Unsupported telemetry type: ${type}` })
            .code(400);
        }

        if (!state) {
          return h
            .response({ message: "state is required for telemetry" })
            .code(400);
        }

        const patientRef = db().collection("patients").doc(patientId);
        const patientSnap = await patientRef.get();

        if (!patientSnap.exists) {
          return h.response({ message: "Patient not found" }).code(404);
        }

        const previousSensor = patientSnap.data().sensor || {};
        const nowIso = new Date().toISOString();

        await db().collection("devices").doc(piId).set(
          {
            piId,
            patientId,
            lastTelemetryAt: timestamp,
            updatedAt: nowIso,
          },
          { merge: true }
        );

        if (type === "sample") {
          await patientRef.set(
            {
              sensor: {
                lastSeenAt: timestamp,
                lastGmag: typeof gmag === "number" ? gmag : null,
              },
            },
            { merge: true }
          );
        }

        if (type === "state_change") {
          console.log(`Writing sensor event for ${patientId}: ${state}`);

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
        }

        await evaluateMovementAlert({
          patientRef,
          previousSensor,
          patientId,
          piId,
          state,
          timestamp,
          eventMs,
        });

        console.log(
          `Telemetry processed for ${patientId} via ${piId}: ${type} ${state}`
        );

        return h.response({ ok: true, processed: type }).code(201);
      } catch (error) {
        console.error("Telemetry error:", error.message);
        return h.response({ error: error.message }).code(500);
      }
    },
  });
}

module.exports = { registerTelemetryRoutes };