require("dotenv").config();
const Hapi = require("@hapi/hapi");

const init = async () => {
  const server = Hapi.server({
    port: process.env.PORT || 4000,
    host: "0.0.0.0",
    routes: {
      cors: { origin: ["*"] }
    }
  });

  server.route({
    method: "GET",
    path: "/health",
    handler: () => ({ status: "ok" })
  });

  server.route({
    method: "GET",
    path: "/patients",
    handler: () => {
      return [
        { id: "p1", name: "Mariam", room: "1", bed: "Bed 1" },
        { id: "p2", name: "Geraldine", room: "1", bed: "Bed 2" },
        { id: "p3", name: "Mary", room: "1", bed: "Bed 3" },
        { id: "p4", name: "Eimear", room: "1", bed: "Bed 4" }
      ];
    }
  });

  await server.start();
  console.log("API running on", server.info.uri);
};

init().catch((err) => {
  console.error(err);
  process.exit(1);
});
