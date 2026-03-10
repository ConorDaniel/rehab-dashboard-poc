import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PatientCard from "../components/PatientCard";
import { fetchPatients } from "../services/patientService";
import type { Patient } from "../types/patient";

export default function PatientListPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    fetchPatients()
      .then((data) => {
        setPatients(data);
        setLastUpdated(new Date().toLocaleString());
        setError(null);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
      });
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
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__inner">
          <div>
            <div className="app-title">Rehab Dashboard PoC</div>
            <div className="app-subtitle">Rehab Hospital X • Ward 1</div>
          </div>

          <div className={statusClass}>{statusText}</div>
        </div>
      </header>

      <main className="app-main">
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
      </main>

      <footer className="app-footer">
        <div className="app-footer__inner">
          <div>Rehab Dashboard PoC</div>
          <div>{lastUpdated ? `Last updated: ${lastUpdated}` : ""}</div>
        </div>
      </footer>
    </div>
  );
}