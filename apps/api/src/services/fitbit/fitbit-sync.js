const { db } = require("../../firestore");
const { getPatientFitbitConfig } = require("./fitbit-config-store");
const { getHeartRateIntradayToday } = require("./fitbit-client");
const { refreshAccessToken } = require("./fitbit-auth");

function getIrishDateString() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Dublin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(new Date());
}

async function getTodayActivitySummary(accessToken) {
  const today = getIrishDateString();

  const response = await fetch(
    `https://api.fitbit.com/1/user/-/activities/date/${today}.json`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Fitbit daily activity error ${response.status}: ${errorText}`);
  }

  return response.json();
}

async function syncFitbitForPatient(id) {
  const patientRef = db().collection("patients").doc(id);
  const patientSnap = await patientRef.get();

  if (!patientSnap.exists) {
    throw new Error("Patient not found");
  }

  const fitbitConfig = await getPatientFitbitConfig(id);

  if (!fitbitConfig || !fitbitConfig.connected) {
    throw new Error("Fitbit not configured for this patient");
  }

  const accessToken = await refreshAccessToken(id, fitbitConfig.refreshToken);

  const today = getIrishDateString();
  const nowIso = new Date().toISOString();

  const activityResponse = await getTodayActivitySummary(accessToken);
  const summary = activityResponse.summary || {};

  const totalSteps = Number(summary.steps) || 0;
  const sedentaryMinutes = Number(summary.sedentaryMinutes) || 0;
  const lightlyActiveMinutes = Number(summary.lightlyActiveMinutes) || 0;
  const fairlyActiveMinutes = Number(summary.fairlyActiveMinutes) || 0;
  const veryActiveMinutes = Number(summary.veryActiveMinutes) || 0;

  let heartRate = null;
  let restingHeartRate = null;
  let heartError = null;

  try {
    const heartResponse = await getHeartRateIntradayToday(accessToken);

    restingHeartRate =
      heartResponse["activities-heart"]?.[0]?.value?.restingHeartRate ?? null;

    heartRate = restingHeartRate;
  } catch (err) {
    heartError = err.message;
    console.error(`Heart rate fetch failed for ${id}:`, err.message);
  }

  const metric = {
    date: today,
    steps: totalSteps,
    heartRate,
    restingHeartRate,
    sedentaryMinutes,
    lightlyActiveMinutes,
    fairlyActiveMinutes,
    veryActiveMinutes,
    updatedAt: nowIso,
  };

  await patientRef.set(
    {
      dashboard: {
        lastUpdated: nowIso,
        metrics: [metric],
      },
      fitbit: {
        lastSyncAt: nowIso,
      },
    },
    { merge: true }
  );

  await patientRef
    .collection("dailyMetrics")
    .doc(today)
    .set(metric, { merge: true });

  return {
    patientId: id,
    written: metric,
    heartError,
  };
}

async function syncAllFitbitsOnStartup() {
  console.log("Starting Fitbit startup sync...");

  const snapshot = await db().collection("patients").get();

  for (const doc of snapshot.docs) {
    const data = doc.data();

    if (!data.fitbit?.connected) continue;

    try {
      const result = await syncFitbitForPatient(doc.id);
      console.log(`Startup Fitbit sync ok for ${doc.id}: ${result.written.steps} steps`);
    } catch (error) {
      console.error(`Startup Fitbit sync failed for ${doc.id}:`, error.message);
    }
  }

  console.log("Fitbit startup sync finished.");
}

module.exports = {
  getIrishDateString,
  getTodayActivitySummary,
  syncFitbitForPatient,
  syncAllFitbitsOnStartup,
};