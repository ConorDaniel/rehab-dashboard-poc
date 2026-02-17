require("dotenv").config();
const Hapi = require("@hapi/hapi");

const init = async () => {
  const server = Hapi.server({
    port: process.env.PORT || 4000,
    host: "localhost",
    routes: {
      cors: { origin: ["*"] }
    }
  });

  server.route({
    method: "GET",
    path: "/health",
    handler: () => ({ status: "ok" })
  });

  await server.start();
  console.log("API running on", server.info.uri);
};

init().catch((err) => {
  console.error(err);
  process.exit(1);
});
