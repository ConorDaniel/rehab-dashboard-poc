require("dotenv").config();

const Hapi = require("@hapi/hapi");
const { registerHeartbeatRoutes } = require("./systemcheck/heartbeat");
// const { startPiPing } = require("./systemcheck/piPing");

const { registerPatientRoutes } = require("./routes/patients");
const { registerFitbitRoutes } = require("./routes/fitbit");
const { registerTelemetryRoutes } = require("./routes/telemetry");
const { syncAllFitbitsOnStartup } = require("./services/fitbit/fitbit-sync");

const init = async () => {
  const server = Hapi.server({
    port: process.env.PORT || 4000,
    host: "0.0.0.0",
    routes: {
      cors: { origin: ["*"] },
    },
  });

  registerHeartbeatRoutes(server);
  registerPatientRoutes(server);
  registerFitbitRoutes(server);
  registerTelemetryRoutes(server);

  server.route({
    method: "GET",
    path: "/health",
    handler: () => ({ status: "ok" }),
  });

  await server.start();
  console.log("API running on", server.info.uri);

  // startPiPing();

  syncAllFitbitsOnStartup().catch((err) => {
    console.error("Startup Fitbit sync crashed:", err.message);
  });
};

init().catch((err) => {
  console.error(err);
  process.exit(1);
});