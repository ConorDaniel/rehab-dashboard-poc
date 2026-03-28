const { db } = require("../firestore");
const { getSensorSummary } = require("../services/sensor/sensor-summary");

function registerPatientRoutes(server) {
  server.route({
    method: "GET",
    path: "/patients",
    handler: async () => {
      const snapshot = await db().collection("patients").get();

      const patients = await Promise.all(
        snapshot.docs.map(async (doc) => {
          const data = doc.data();
          const piId = data.piId ?? null;

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

          let device = null;
          if (piId) {
            const deviceSnap = await db().collection("devices").doc(piId).get();
            device = deviceSnap.exists ? deviceSnap.data() : null;
          }

          return {
            id: doc.id,
            name: data.name,
            room: data.room,
            bed: data.bed,
            pictureUrl: data.pictureUrl || null,
            piId,
            wardId: data.wardId ?? null,
            hospitalId: data.hospitalId ?? null,
            sensor: data.sensor ?? null,
            device,
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
    path: "/patients/{id}/sensor-summary",
    handler: async (request, h) => {
      const { id } = request.params;
      const hours = Number(request.query.hours || 24);

      const patientRef = db().collection("patients").doc(id);
      const patientSnap = await patientRef.get();

      if (!patientSnap.exists) {
        return h.response({ message: "Patient not found" }).code(404);
      }

      try {
        const summary = await getSensorSummary(id, hours);
        return summary;
      } catch (error) {
        console.error("Sensor summary error:", error.message);
        return h.response({ error: error.message }).code(500);
      }
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
      const piId = patient.piId ?? null;

      let device = null;
      if (piId) {
        const deviceSnap = await db().collection("devices").doc(piId).get();
        device = deviceSnap.exists ? deviceSnap.data() : null;
      }

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
        piId,
        lastUpdated: patient.dashboard?.lastUpdated ?? null,
        sensor: patient.sensor ?? null,
        device,
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

      const patient = patientSnap.data();
      const piId = patient.piId ?? null;

      let device = null;
      if (piId) {
        const deviceSnap = await db().collection("devices").doc(piId).get();
        device = deviceSnap.exists ? deviceSnap.data() : null;
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
        piId,
        days,
        device,
        metrics,
      };
    },
  });
}

module.exports = { registerPatientRoutes };