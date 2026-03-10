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

  // Heartbeat routes live in src/systemcheck/heartbeat.js
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
    handler: (request, h) => {
      console.log("Telemetry received:", request.payload);
      return { ok: true };
    },
  });

  await server.start();
  console.log("API running on", server.info.uri);
};

init().catch((err) => {
  console.error(err);
  process.exit(1);
});