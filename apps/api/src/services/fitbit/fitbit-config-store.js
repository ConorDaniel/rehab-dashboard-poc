const { db } = require("../../firestore");

async function getPatientFitbitConfig(patientId) {
  const patientRef = db().collection("patients").doc(patientId);
  const patientSnap = await patientRef.get();

  if (!patientSnap.exists) return null;

  const patient = patientSnap.data();
  return patient.fitbit || null;
}

module.exports = { getPatientFitbitConfig };