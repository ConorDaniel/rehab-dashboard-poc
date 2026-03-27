import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import PatientCard from "../components/PatientCard";
import { fetchPatients } from "../services/patientService";
import type { Patient } from "../types/patient";

export default function PatientListPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    const loadPatients = async () => {
      try {
        const data = await fetchPatients();
        setPatients(data);
        setLastUpdated(new Date().toLocaleString());
        setError(null);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      }
    };

    loadPatients();

    const interval = setInterval(() => {
      loadPatients();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleOpenDashboard = (id: string) => {
    navigate(`/patient/${id}`);
  };

  const statusText = error ? "API error" : patients.length > 0 ? "Live" : "Loading";
  const statusClass = error
    ? "app-status app-status--error"
    : patients.length > 0
      ? "app-status app-status--live"
      : "app-status app-status--loading";

  return (
    <AppLayout
      title="Rehab Dashboard PoC"
      subtitle="Rehab Hospital X • Ward 1"
      statusText={statusText}
      statusClass={statusClass}
      footerLeft="Rehab Dashboard PoC"
      footerRight={lastUpdated ? `Last updated: ${lastUpdated}` : ""}
    >
      {error && <div className="status status--error">Error: {error}</div>}

      {!error && patients.length === 0 && (
        <div className="status">Loading patient cards…</div>
      )}

      {patients.length > 0 && (
        <div className="patient-grid">
          {patients.map((patient) => (
            <PatientCard
              key={patient.id}
              patient={patient}
              onOpenDashboard={handleOpenDashboard}
            />
          ))}
        </div>
      )}
    </AppLayout>
  );
}