import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  fetchPatientDashboard,
  fetchPatientTrends,
} from "../services/patientService";
import type { PatientDashboard } from "../types/patientDashboard";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export default function PatientDashboardPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [dashboard, setDashboard] = useState<PatientDashboard | null>(null);
  const [days, setDays] = useState(7);
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

  useEffect(() => {
    if (!id) return;

    fetchPatientTrends(id, days)
      .then((data) => {
        setDashboard((prev) =>
          prev
            ? { ...prev, metrics: data.metrics }
            : null
        );
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
      });
  }, [id, days]);

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
              <p className="dashboard-panel__text">
                Sensor state: {dashboard.sensor?.currentState ?? "Unknown"}
              </p>
              <p className="dashboard-panel__text">
                Pi status: {dashboard.sensor?.deviceStatus ?? "Unknown"}
              </p>
            </section>

            <section className="dashboard-panel">
              <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                {[7, 14, 21, 30].map((value) => (
                  <button
                    key={value}
                    type="button"
                    className="patient-card__button"
                    onClick={() => setDays(value)}
                  >
                    Last {value} days
                  </button>
                ))}
              </div>

              <h2 className="dashboard-panel__title">Steps Trend</h2>

              <div style={{ width: "100%", height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={dashboard.metrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="steps" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="dashboard-panel">
              <h2 className="dashboard-panel__title">Activity Summary</h2>
              <div className="metric-list">
                {dashboard.metrics.map((day) => (
                  <div key={day.date} className="metric-row">
                    <span>{day.date}</span>
                    <strong>
                      Steps {day.steps} • Sed {day.sedentaryMinutes ?? 0} • Light{" "}
                      {day.lightlyActiveMinutes ?? 0} • Fair{" "}
                      {day.fairlyActiveMinutes ?? 0} • Very{" "}
                      {day.veryActiveMinutes ?? 0}
                    </strong>
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