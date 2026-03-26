require("dotenv").config();

const fetch = require("node-fetch");
const { db } = require("./src/firestore");
const { getPatientFitbitConfig } = require("./src/services/fitbit/fitbit-config-store");
const { refreshAccessToken } = require("./src/services/fitbit/fitbit-auth");

async function fetchActivityDay(accessToken, date) {
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
    throw new Error(`Activity error ${res.status}: ${text}`);
  }

  return res.json();
}

async function fetchHeartDay(accessToken, date) {
  const res = await fetch(
    `https://api.fitbit.com/1/user/-/activities/heart/date/${date}/1d.json`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Heart error ${res.status}: ${text}`);
  }

  return res.json();
}

function extractRestingHeartRate(data) {
  return data?.["activities-heart"]?.[0]?.value?.restingHeartRate ?? null;
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
      // 🔹 Fetch activity + heart in parallel
      const [activityData, heartData] = await Promise.all([
        fetchActivityDay(accessToken, date),
        fetchHeartDay(accessToken, date),
      ]);

      const summary = activityData.summary || {};
      const restingHeartRate = extractRestingHeartRate(heartData);

      const metric = {
        date,
        steps: Number(summary.steps) || 0,
        heartRate: restingHeartRate,
        restingHeartRate,
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

      console.log("✔", date, {
        steps: metric.steps,
        hr: metric.restingHeartRate,
      });
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