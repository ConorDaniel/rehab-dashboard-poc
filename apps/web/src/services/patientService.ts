import type { Patient } from "../types/patient";
import type { PatientDashboard, SensorSummary } from "../types/patientDashboard";

const API_URL = import.meta.env.VITE_API_URL;

export async function fetchPatientTrends(id: string, days: number) {
  const response = await fetch(`${API_URL}/patients/${id}/trends?days=${days}`);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

export async function fetchPatients(): Promise<Patient[]> {
  const res = await fetch(`${API_URL}/patients`);

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function fetchSensorSummary(
  patientId: string,
  hours = 24
): Promise<SensorSummary> {
  const response = await fetch(
    `${API_URL}/patients/${patientId}/sensor-summary?hours=${hours}`
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

export async function fetchPatientDashboard(
  id: string
): Promise<PatientDashboard> {
  const res = await fetch(`${API_URL}/patients/${id}/dashboard`);

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  return await res.json();
}