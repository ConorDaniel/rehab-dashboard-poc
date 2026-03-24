require("dotenv").config();

const Hapi = require("@hapi/hapi");
const { db } = require("./firestore");
const { registerHeartbeatRoutes } = require("./systemcheck/heartbeat");
const { startPiPing } = require("./systemcheck/piPing");

const { getPatientFitbitConfig } = require("./services/fitbit/fitbit-config-store");
const { getHeartRateIntradayToday } = require("./services/fitbit/fitbit-client");
const { refreshAccessToken } = require("./services/fitbit/fitbit-auth");

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

    if (!data.fitbit?.connected) {
      continue;
    }

    try {
      const result = await syncFitbitForPatient(doc.id);
      console.log(`Startup Fitbit sync ok for ${doc.id}: ${result.written.steps} steps`);
    } catch (error) {
      console.error(`Startup Fitbit sync failed for ${doc.id}:`, error.message);
    }
  }

  console.log("Fitbit startup sync finished.");
}

const init = async () => {
  const server = Hapi.server({
    port: process.env.PORT || 4000,
    host: "0.0.0.0",
    routes: {
      cors: { origin: ["*"] },
    },
  });

  registerHeartbeatRoutes(server);

  server.route({
    method: "GET",
    path: "/health",
    handler: () => ({ status: "ok" }),
  });

  server.route({
    method: "GET",
    path: "/patients",
    handler: async () => {
      const snapshot = await db().collection("patients").get();

      const patients = await Promise.all(
        snapshot.docs.map(async (doc) => {
          const data = doc.data();

          const safeFitbit = data.fitbit
            ? {
                connected: data.fitbit.connected ?? false,
                fitbitUserId: data.fitbit.fitbitUserId ?? null,
                expiresAt: data.fitbit.expiresAt ?? null,
                lastSyncAt: data.fitbit.lastSyncAt ?? null,
                lastRefreshAt: data.fitbit.lastRefreshAt ?? null,
              }
            : null;

          const metricsSnap = await db()
            .collection("patients")
            .doc(doc.id)
            .collection("dailyMetrics")
            .orderBy("date", "desc")
            .limit(1)
            .get();

          const todayMetrics = metricsSnap.empty ? null : metricsSnap.docs[0].data();

          return {
            id: doc.id,
            name: data.name,
            room: data.room,
            bed: data.bed,
            wardId: data.wardId ?? null,
            hospitalId: data.hospitalId ?? null,
            sensor: data.sensor ?? null,
            fitbit: safeFitbit,
            todayMetrics,
          };
        })
      );

      return patients;
    },
  });

  server.route({
    method: "GET",
    path: "/patients/{id}/dashboard",
    handler: async (request, h) => {
      const { id } = request.params;

      const patientRef = db().collection("patients").doc(id);
      const patientSnap = await patientRef.get();

      if (!patientSnap.exists) {
        return h.response({ message: "Patient not found" }).code(404);
      }

      const patient = patientSnap.data();

      const metricsSnap = await patientRef
        .collection("dailyMetrics")
        .orderBy("date", "desc")
        .limit(7)
        .get();

      const metrics = metricsSnap.docs
        .map((doc) => doc.data())
        .sort((a, b) => a.date.localeCompare(b.date));

      return {
        patientId: id,
        patientName: patient.name,
        room: patient.room,
        bed: patient.bed,
        lastUpdated: patient.dashboard?.lastUpdated ?? null,
        sensor: patient.sensor ?? null,
        metrics,
      };
    },
  });

  server.route({
    method: "GET",
    path: "/patients/{id}/trends",
    handler: async (request, h) => {
      const { id } = request.params;
      const days = Number(request.query.days || 7);

      const patientRef = db().collection("patients").doc(id);
      const patientSnap = await patientRef.get();

      if (!patientSnap.exists) {
        return h.response({ message: "Patient not found" }).code(404);
      }

      const metricsSnap = await patientRef
        .collection("dailyMetrics")
        .orderBy("date", "desc")
        .limit(days)
        .get();

      const metrics = metricsSnap.docs
        .map((doc) => doc.data())
        .sort((a, b) => a.date.localeCompare(b.date));

      return {
        patientId: id,
        days,
        metrics,
      };
    },
  });

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

  server.route({
    method: "POST",
    path: "/telemetry",
    options: {
      payload: {
        parse: true,
        output: "data",
        allow: "application/json",
      },
    },
    handler: async (request, h) => {
      try {
        const payload = request.payload;
        console.log("Telemetry received:", payload);

        const { type, patientId, state, timestamp, gmag } = payload;

        if (!type || !patientId) {
          return h
            .response({ message: "type and patientId are required" })
            .code(400);
        }

        const patientRef = db().collection("patients").doc(patientId);
        const patientSnap = await patientRef.get();

        if (!patientSnap.exists) {
          return h.response({ message: "Patient not found" }).code(404);
        }

        if (type === "sample") {
          return { ok: true, persisted: false, ignoredType: "sample" };
        }

        if (type !== "state_change") {
          return h
            .response({ message: `Unsupported telemetry type: ${type}` })
            .code(400);
        }

        if (!state || !timestamp) {
          return h
            .response({
              message: "state and timestamp are required for state_change",
            })
            .code(400);
        }

        const eventMs = Date.parse(timestamp);

        if (Number.isNaN(eventMs)) {
          return h
            .response({ message: "timestamp must be a valid ISO date string" })
            .code(400);
        }

        const nowIso = new Date().toISOString();

        console.log(`Writing sensor event for ${patientId}: ${state}`);

        await patientRef.collection("sensorEvents").add({
          type: "state_change",
          state,
          stateStartedAt: timestamp,
          stateStartedAtMs: eventMs,
          timestamp,
          timestampMs: eventMs,
          gmag: typeof gmag === "number" ? gmag : null,
          createdAt: nowIso,
        });

        await patientRef.set(
          {
            sensor: {
              currentState: state,
              lastChangedAt: timestamp,
              lastSeenAt: timestamp,
              lastGmag: typeof gmag === "number" ? gmag : null,
            },
          },
          { merge: true }
        );

        console.log(`Firestore updated for ${patientId}: ${state}`);

        return h.response({ ok: true, persisted: "state_change" }).code(201);
      } catch (error) {
        console.error("Telemetry error:", error.message);
        return h.response({ error: error.message }).code(500);
      }
    },
  });

  await server.start();
  console.log("API running on", server.info.uri);

  startPiPing();

  syncAllFitbitsOnStartup().catch((err) => {
    console.error("Startup Fitbit sync crashed:", err.message);
  });
};

init().catch((err) => {
  console.error(err);
  process.exit(1);
});