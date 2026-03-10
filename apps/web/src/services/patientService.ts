import type { Patient } from "../types/patient";
import type { PatientDashboard } from "../types/patientDashboard";

export async function fetchPatients(): Promise<Patient[]> {
  const res = await fetch("/patients");

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function fetchPatientDashboard(
  id: string
): Promise<PatientDashboard> {
  const res = await fetch(`/patients/${id}/dashboard`);

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  return await res.json();
}