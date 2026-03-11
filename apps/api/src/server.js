require("dotenv").config();

const Hapi = require("@hapi/hapi");
const { db } = require("./firestore");
const { registerHeartbeatRoutes } = require("./systemcheck/heartbeat");

const init = async () => {
  const server = Hapi.server({
    port: process.env.PORT || 4000,
    host: "0.0.0.0",
    routes: {
      cors: { origin: ["*"] },
    },
  });

  registerHeartbeatRoutes(server);

  server.route({
    method: "GET",
    path: "/health",
    handler: () => ({ status: "ok" }),
  });

  server.route({
    method: "GET",
    path: "/patients",
    handler: async () => {
      const snapshot = await db().collection("patients").get();
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    },
  });

  server.route({
    method: "GET",
    path: "/patients/{id}/dashboard",
    handler: async (request, h) => {
      const { id } = request.params;

      const patientRef = db().collection("patients").doc(id);
      const patientSnap = await patientRef.get();

      if (!patientSnap.exists) {
        return h.response({ message: "Patient not found" }).code(404);
      }

      const patient = patientSnap.data();

      return {
        patientId: id,
        patientName: patient.name,
        room: patient.room,
        bed: patient.bed,
        lastUpdated: patient.dashboard?.lastUpdated ?? null,
        metrics: patient.dashboard?.metrics ?? [],
        sensor: patient.sensor ?? null,
      };
    },
  });

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

      // Persist only stable state changes for now
      if (type === "state_change") {
        if (!state || !timestamp) {
          return h
            .response({ message: "state and timestamp are required for state_change" })
            .code(400);
        }

        await patientRef.collection("sensorEvents").add({
          type,
          state,
          timestamp,
          gmag: typeof gmag === "number" ? gmag : null,
          createdAt: new Date().toISOString(),
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

        return h.response({ ok: true, persisted: "state_change" }).code(201);
      }

      // Accept samples but do not persist them yet
      if (type === "sample") {
        return { ok: true, persisted: false, ignoredType: "sample" };
      }

      return h
        .response({ message: `Unsupported telemetry type: ${type}` })
        .code(400);
    },
  });

  await server.start();
  console.log("API running on", server.info.uri);
};

init().catch((err) => {
  console.error(err);
  process.exit(1);
});