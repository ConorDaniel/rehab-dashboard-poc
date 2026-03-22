require("dotenv").config();

const { db } = require("./src/firestore");
const { getPatientFitbitConfig } = require("./src/services/fitbit/fitbit-config-store");
const { refreshAccessToken } = require("./src/services/fitbit/fitbit-auth");

async function fetchDay(accessToken, date) {
  const res = await fetch(
    `https://api.fitbit.com/1/user/-/activities/date/${date}.json`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Fitbit error ${res.status}: ${text}`);
  }

  return res.json();
}

function getLastNDates(n) {
  const dates = [];
  const today = new Date();

  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }

  return dates;
}

async function run(patientId) {
  console.log("Backfilling for:", patientId);

  const config = await getPatientFitbitConfig(patientId);
  if (!config?.connected) {
    throw new Error("Fitbit not connected");
  }

  const accessToken = await refreshAccessToken(
    patientId,
    config.refreshToken
  );

  const dates = getLastNDates(30);

  for (const date of dates) {
    try {
      const data = await fetchDay(accessToken, date);
      const summary = data.summary || {};

      const metric = {
        date,
        steps: Number(summary.steps) || 0,
        sedentaryMinutes: Number(summary.sedentaryMinutes) || 0,
        lightlyActiveMinutes: Number(summary.lightlyActiveMinutes) || 0,
        fairlyActiveMinutes: Number(summary.fairlyActiveMinutes) || 0,
        veryActiveMinutes: Number(summary.veryActiveMinutes) || 0,
        updatedAt: new Date().toISOString(),
      };

      await db()
        .collection("patients")
        .doc(patientId)
        .collection("dailyMetrics")
        .doc(date)
        .set(metric, { merge: true });

      console.log("✔", date, metric.steps);
    } catch (err) {
      console.log("✖", date, err.message);
    }
  }

  console.log("Done!");
}

const patientId = process.argv[2];
if (!patientId) {
  console.log("Usage: node backfill-direct.js p1");
  process.exit(1);
}

run(patientId);