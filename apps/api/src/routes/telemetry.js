const { db } = require("../firestore");

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

        const { type, patientId, state, timestamp, gmag } = payload;

        if (!type || !patientId) {
          return h
            .response({ message: "type and patientId are required" })
            .code(400);
        }

        const patientRef = db().collection("patients").doc(patientId);
        const patientSnap = await patientRef.get();

        if (!patientSnap.exists) {
          return h.response({ message: "Patient not found" }).code(404);
        }

        if (type === "sample") {
          return { ok: true, persisted: false, ignoredType: "sample" };
        }

        if (type !== "state_change") {
          return h
            .response({ message: `Unsupported telemetry type: ${type}` })
            .code(400);
        }

        if (!state || !timestamp) {
          return h
            .response({
              message: "state and timestamp are required for state_change",
            })
            .code(400);
        }

        const eventMs = Date.parse(timestamp);

        if (Number.isNaN(eventMs)) {
          return h
            .response({ message: "timestamp must be a valid ISO date string" })
            .code(400);
        }

        const nowIso = new Date().toISOString();

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

        console.log(`Firestore updated for ${patientId}: ${state}`);

        return h.response({ ok: true, persisted: "state_change" }).code(201);
      } catch (error) {
        console.error("Telemetry error:", error.message);
        return h.response({ error: error.message }).code(500);
      }
    },
  });
}

module.exports = { registerTelemetryRoutes };