require("dotenv").config();

const { registerHeartbeatRoutes } = require("./systemcheck/heartbeat");

const Hapi = require("@hapi/hapi");
const { db } = require("./firestore");

const init = async () => {
  const server = Hapi.server({
    port: process.env.PORT || 4000,
    host: "0.0.0.0",
    routes: {
      cors: { origin: ["*"] }
    }
  });

  registerHeartbeatRoutes(server);

  server.route({
    method: "GET",
    path: "/health",
    handler: () => ({ status: "ok" })
  });

  server.route({
    method: "GET",
    path: "/patients",
    handler: async () => {
      const snapshot = await db().collection("patients").get();
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    }
  });

  server.route({
    method: "POST",
    path: "/telemetry",
    handler: (request, h) => {
      console.log("Telemetry received:", request.payload);
      return { ok: true };
    }
  });

  await server.start();
  console.log("API running on", server.info.uri);
};

init().catch((err) => {
  console.error(err);
  process.exit(1);
});