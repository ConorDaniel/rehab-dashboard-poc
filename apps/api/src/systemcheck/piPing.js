const axios = require("axios");
const { db } = require("../firestore");

const PI_PING_INTERVAL_MS = 5000;

function startPiPing() {
  setInterval(async () => {
    try {
      const snapshot = await db().collection("devices").get();

      for (const doc of snapshot.docs) {
        const device = doc.data();

        const { piId, ipAddress } = device;

        if (!piId || !ipAddress) {
          console.log(`Skipping device with missing piId or ipAddress`);
          continue;
        }

        const pingUrl = `http://${ipAddress}:5001/ping`;
        const nowIso = new Date().toISOString();

        try {
          const res = await axios.get(pingUrl, { timeout: 2000 });

          console.log(`Pi reachable: ${piId}`, res.data);

          await db().collection("devices").doc(piId).set(
            {
              lastPingAt: nowIso,
              deviceStatus: "online",
              updatedAt: nowIso,
            },
            { merge: true }
          );
        } catch (err) {
          console.log(`Pi unreachable: ${piId}`);

          await db().collection("devices").doc(piId).set(
            {
              deviceStatus: "offline",
              updatedAt: nowIso,
            },
            { merge: true }
          );
        }
      }
    } catch (err) {
      console.error("Pi ping loop error:", err.message);
    }
  }, PI_PING_INTERVAL_MS);
}

module.exports = { startPiPing };