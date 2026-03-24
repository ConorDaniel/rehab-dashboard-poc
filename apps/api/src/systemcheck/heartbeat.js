const { db } = require("../firestore");

const lastSeen = new Map();

function registerHeartbeatRoutes(server) {
  server.route({
    method: "POST",
    path: "/heartbeat",
    handler: async (request, h) => {
      console.log("Heartbeat received:", request.payload);

      const { piId, patientId, connected, timestamp, lastFrameAgeSec } = request.payload;

      if (!piId || !patientId) {
        return h.response({ message: "piId and patientId required" }).code(400);
      }

      const nowIso = new Date().toISOString();

      // In-memory status by device
      lastSeen.set(piId, {
        piId,
        patientId,
        connected: connected ?? false,
        timestamp: Date.now(),
      });

      try {
        const patientRef = db().collection("patients").doc(patientId);
        const patientSnap = await patientRef.get();

        if (!patientSnap.exists) {
          return h.response({ message: "Patient not found" }).code(404);
        }

        const deviceRef = db().collection("devices").doc(piId);

        // 1. Write operational device status to devices/{piId}
        await deviceRef.set(
          {
            piId,
            patientId,
            connected: connected ?? false,
            deviceStatus: connected ? "online" : "offline",
            lastHeartbeatAt: timestamp || nowIso,
            lastFrameAgeSec: lastFrameAgeSec ?? null,
            updatedAt: nowIso,
          },
          { merge: true }
        );

        // 2. Mirror key fields to patient sensor summary
        await patientRef.set(
          {
            piId,
            sensor: {
              lastHeartbeatAt: timestamp || nowIso,
              connected: connected ?? false,
              lastFrameAgeSec: lastFrameAgeSec ?? null,
              deviceStatus: connected ? "online" : "offline",
            },
          },
          { merge: true }
        );
      } catch (err) {
        console.error("Heartbeat persistence error:", err);
      }

      return { ok: true };
    },
  });

  server.route({
    method: "GET",
    path: "/heartbeat",
    handler: () => {
      const now = Date.now();
      const status = [];

      for (const [piId, data] of lastSeen.entries()) {
        const age = Math.floor((now - data.timestamp) / 1000);

        status.push({
          piId,
          patientId: data.patientId,
          connected: data.connected,
          secondsSinceLastHeartbeat: age,
        });
      }

      return status;
    },
  });
}

module.exports = { registerHeartbeatRoutes };