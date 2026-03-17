require("dotenv").config();

const Hapi = require("@hapi/hapi");
const { db } = require("./firestore");
const { registerHeartbeatRoutes } = require("./systemcheck/heartbeat");
const { startPiPing } = require("./systemcheck/piPing");

const { getPatientFitbitConfig } = require("./services/fitbit/fitbit-config-store");
const {
  getStepsIntradayToday,
  getHeartRateIntradayToday,
} = require("./services/fitbit/fitbit-client");
const { refreshAccessToken } = require("./services/fitbit/fitbit-auth");

function sumSteps(stepDataset) {
  return (stepDataset || []).reduce((sum, item) => {
    return sum + (Number(item.value) || 0);
  }, 0);
}

function latestHeartRate(hrDataset) {
  if (!hrDataset || hrDataset.length === 0) return null;
  const last = hrDataset[hrDataset.length - 1];
  return Number(last.value) || null;
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
      return snapshot.docs.map((doc) => {
        const data = doc.data();

        // do not expose tokens
        const safeFitbit = data.fitbit
          ? {
              connected: data.fitbit.connected ?? false,
              fitbitUserId: data.fitbit.fitbitUserId ?? null,
              expiresAt: data.fitbit.expiresAt ?? null,
              lastSyncAt: data.fitbit.lastSyncAt ?? null,
              lastRefreshAt: data.fitbit.lastRefreshAt ?? null,
            }
          : null;

        return {
          id: doc.id,
          ...data,
          fitbit: safeFitbit,
        };
      });
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

      return {
        patientId: id,
        patientName: patient.name,
        room: patient.room,
        bed: patient.bed,
        lastUpdated: patient.dashboard?.lastUpdated ?? null,
        metrics: patient.dashboard?.metrics ?? [],
        sensor: patient.sensor ?? null,
      };
    },
  });

  server.route({
    method: "GET",
    path: "/patients/{id}/fitbit/test-steps",
    handler: async (request, h) => {
      const { id } = request.params;

      try {
        const fitbitConfig = await getPatientFitbitConfig(id);

        if (!fitbitConfig || !fitbitConfig.connected) {
          return h
            .response({ message: "Fitbit not configured for this patient" })
            .code(404);
        }

        const accessToken = await refreshAccessToken(
          id,
          fitbitConfig.refreshToken
        );

        const data = await getStepsIntradayToday(accessToken);
        const stepsData = data["activities-steps-intraday"]?.dataset || [];

        return {
          patientId: id,
          points: stepsData.length,
          sample: stepsData.slice(0, 5),
        };
      } catch (error) {
        console.error("Fitbit test error:", error.message);
        return h.response({ error: error.message }).code(500);
      }
    },
  });

  server.route({
    method: "POST",
    path: "/patients/{id}/fitbit/sync",
    handler: async (request, h) => {
      const { id } = request.params;

      try {
        const patientRef = db().collection("patients").doc(id);
        const patientSnap = await patientRef.get();

        if (!patientSnap.exists) {
          return h.response({ message: "Patient not found" }).code(404);
        }

        const fitbitConfig = await getPatientFitbitConfig(id);

        if (!fitbitConfig || !fitbitConfig.connected) {
          return h
            .response({ message: "Fitbit not configured for this patient" })
            .code(404);
        }

        const accessToken = await refreshAccessToken(
          id,
          fitbitConfig.refreshToken
        );

        const today = new Date().toISOString().slice(0, 10);

        const stepsResponse = await getStepsIntradayToday(accessToken);
        const stepDataset =
          stepsResponse["activities-steps-intraday"]?.dataset || [];
        const totalSteps = sumSteps(stepDataset);

        let currentHeartRate = null;
        let heartDataset = [];
        let heartError = null;

        try {
          const heartResponse = await getHeartRateIntradayToday(accessToken);
          heartDataset =
            heartResponse["activities-heart-intraday"]?.dataset || [];
          currentHeartRate = latestHeartRate(heartDataset);
        } catch (err) {
          heartError = err.message;
          console.error("Heart rate fetch failed:", err.message);
        }

        const metric = {
          date: today,
          steps: totalSteps,
          heartRate: currentHeartRate,
        };

        await patientRef.set(
          {
            dashboard: {
              lastUpdated: new Date().toISOString(),
              metrics: [metric],
            },
            fitbit: {
              lastSyncAt: new Date().toISOString(),
            },
          },
          { merge: true }
        );

        return {
          ok: true,
          patientId: id,
          written: metric,
          stepPoints: stepDataset.length,
          heartPoints: heartDataset.length,
          heartError,
        };
      } catch (error) {
        console.error("Fitbit sync error:", error.message);
        return h.response({ error: error.message }).code(500);
      }
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

      if (type === "state_change") {
        if (!state || !timestamp) {
          return h
            .response({
              message: "state and timestamp are required for state_change",
            })
            .code(400);
        }

        const stateStartedAt = timestamp;
        const stateStartedAtMs = Date.parse(timestamp);

        if (Number.isNaN(stateStartedAtMs)) {
          return h
            .response({ message: "timestamp must be a valid ISO date string" })
            .code(400);
        }

        await patientRef.collection("sensorEvents").add({
          type: "state_change",
          state,
          stateStartedAt,
          stateStartedAtMs,
          timestamp,
          gmag: typeof gmag === "number" ? gmag : null,
          createdAt: new Date().toISOString(),
        });

        await patientRef.set(
          {
            sensor: {
              currentState: state,
              lastChangedAt: stateStartedAt,
              lastSeenAt: stateStartedAt,
              lastGmag: typeof gmag === "number" ? gmag : null,
            },
          },
          { merge: true }
        );

        return h.response({ ok: true, persisted: "state_change" }).code(201);
      }

      if (type === "sample") {
        return { ok: true, persisted: false, ignoredType: "sample" };
      }

      return h
        .response({ message: `Unsupported telemetry type: ${type}` })
        .code(400);
    },
  });

  await server.start();
  console.log("API running on", server.info.uri);

  startPiPing();
};

init().catch((err) => {
  console.error(err);
  process.exit(1);
});