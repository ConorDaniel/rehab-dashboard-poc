const axios = require("axios");

const PI_PING_URL = "http://192.168.1.29:5001/ping";
const PI_PING_INTERVAL_MS = 5000;

function startPiPing() {
  setInterval(async () => {
    try {
      const res = await axios.get(PI_PING_URL, { timeout: 2000 });
      console.log("✅ Pi reachable:", res.data);
    } catch (err) {
      console.log("❌ Pi unreachable");
    }
  }, PI_PING_INTERVAL_MS);
}

module.exports = { startPiPing };