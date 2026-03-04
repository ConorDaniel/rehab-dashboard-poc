const lastSeen = new Map();

function registerHeartbeatRoutes(server) {

  server.route({
    method: "POST",
    path: "/heartbeat",
    handler: (request, h) => {
        console.log("Heartbeat received:", request.payload);

      const { patientId, connected } = request.payload;

      lastSeen.set(patientId, {
        connected,
        timestamp: Date.now()
      });

      return { ok: true };
    }
  });

  server.route({
    method: "GET",
    path: "/heartbeat",
    handler: () => {

      const now = Date.now();

      const status = [];

      for (const [patientId, data] of lastSeen.entries()) {

        const age = Math.floor((now - data.timestamp) / 1000);

        status.push({
          patientId,
          connected: data.connected,
          secondsSinceLastHeartbeat: age
        });

      }

      return status;
    }
  });

}

module.exports = { registerHeartbeatRoutes };