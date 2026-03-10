import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchPatientDashboard } from "../services/patientService";
import type { PatientDashboard } from "../types/patientDashboard";

export default function PatientDashboardPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [dashboard, setDashboard] = useState<PatientDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    fetchPatientDashboard(id)
      .then((data) => {
        setDashboard(data);
        setError(null);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
      });
  }, [id]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__inner">
          <div>
            <div className="app-title">Patient Dashboard</div>
            <div className="app-subtitle">
              {dashboard
                ? `${dashboard.patientName} • Room ${dashboard.room} • ${dashboard.bed}`
                : `Patient ID: ${id}`}
            </div>
          </div>

          <button
            type="button"
            className="patient-card__button"
            onClick={() => navigate("/")}
          >
            Back to ward
          </button>
        </div>
      </header>

      <main className="app-main">
        {error && <div className="status status--error">Error: {error}</div>}

        {!error && !dashboard && (
          <div className="status">Loading patient dashboard…</div>
        )}

        {dashboard && (
          <div className="dashboard-layout">
            <section className="dashboard-panel">
              <h2 className="dashboard-panel__title">Patient Summary</h2>
              <p className="dashboard-panel__text">
                Last updated:{" "}
                {dashboard.lastUpdated
                  ? new Date(dashboard.lastUpdated).toLocaleString()
                  : "Not available"}
              </p>
            </section>

            <section className="dashboard-panel">
              <h2 className="dashboard-panel__title">Steps — Last 7 Days</h2>
              <div className="metric-list">
                {dashboard.metrics.map((day) => (
                  <div key={day.date} className="metric-row">
                    <span>{day.date}</span>
                    <strong>{day.steps} steps</strong>
                  </div>
                ))}
              </div>
            </section>

            <section className="dashboard-panel">
              <h2 className="dashboard-panel__title">Heart Rate — Last 7 Days</h2>
              <div className="metric-list">
                {dashboard.metrics.map((day) => (
                  <div key={day.date} className="metric-row">
                    <span>{day.date}</span>
                    <strong>{day.heartRate} bpm</strong>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}