const { db } = require("../firestore");

const lastSeen = new Map();

function registerHeartbeatRoutes(server) {

  server.route({
    method: "POST",
    path: "/heartbeat",
    handler: async (request, h) => {
      console.log("Heartbeat received:", request.payload);

      const { patientId, connected, timestamp, lastFrameAgeSec } = request.payload;

      if (!patientId) {
        return h.response({ message: "patientId required" }).code(400);
      }

      // Update in-memory map (existing behaviour)
      lastSeen.set(patientId, {
        connected,
        timestamp: Date.now()
      });

      try {

        const patientRef = db().collection("patients").doc(patientId);
        const snap = await patientRef.get();

        if (!snap.exists) {
          return h.response({ message: "Patient not found" }).code(404);
        }

        await patientRef.set(
          {
            sensor: {
              lastHeartbeatAt: timestamp || new Date().toISOString(),
              connected: connected ?? false,
              lastFrameAgeSec: lastFrameAgeSec ?? null,
              deviceStatus: connected ? "online" : "offline"
            }
          },
          { merge: true }
        );

      } catch (err) {
        console.error("Heartbeat persistence error:", err);
      }

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