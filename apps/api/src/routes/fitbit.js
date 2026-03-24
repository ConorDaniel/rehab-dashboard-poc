const { syncFitbitForPatient } = require("../services/fitbit/fitbit-sync");

function registerFitbitRoutes(server) {
  server.route({
    method: "POST",
    path: "/patients/{id}/fitbit/sync",
    handler: async (request, h) => {
      const { id } = request.params;

      try {
        const result = await syncFitbitForPatient(id);
        return { ok: true, ...result };
      } catch (error) {
        console.error("Fitbit sync error:", error.message);
        return h.response({ error: error.message }).code(500);
      }
    },
  });

  server.route({
    method: "GET",
    path: "/callback",
    handler: async (request, h) => {
      const { code, error } = request.query;

      if (error) {
        return h.response({ error }).code(400);
      }

      if (!code) {
        return h.response({ message: "Missing code" }).code(400);
      }

      return { ok: true, code };
    },
  });
}

module.exports = { registerFitbitRoutes };