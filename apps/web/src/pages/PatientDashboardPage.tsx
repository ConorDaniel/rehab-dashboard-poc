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
          prev ? { ...prev, metrics: data.metrics } : null
        );
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
      });
  }, [id, days]);

  const latestDay =
    dashboard?.metrics && dashboard.metrics.length > 0
      ? dashboard.metrics[dashboard.metrics.length - 1]
      : null;

  const activityRows = latestDay
    ? [
        {
          label: "Sedentary activity",
          value: latestDay.sedentaryMinutes ?? 0,
        },
        {
          label: "Light activity",
          value: latestDay.lightlyActiveMinutes ?? 0,
        },
        {
          label: "Moderate activity",
          value: latestDay.fairlyActiveMinutes ?? 0,
        },
        {
          label: "High activity",
          value: latestDay.veryActiveMinutes ?? 0,
        },
      ]
    : [];

  const maxActivityValue =
    activityRows.length > 0
      ? Math.max(...activityRows.map((row) => row.value), 1)
      : 1;

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
              <h2 className="dashboard-panel__title">Today’s Activity</h2>

              {!latestDay && (
                <p className="dashboard-panel__text">No activity data available.</p>
              )}

              {latestDay && (
                <div style={{ display: "grid", gap: "16px" }}>
                  {activityRows.map((row) => {
                    const widthPercent = (row.value / maxActivityValue) * 100;

                    return (
                      <div key={row.label}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: 6,
                            fontSize: 14,
                            fontWeight: 600,
                            color: "#374151",
                          }}
                        >
                          <span>{row.label}</span>
                          <span>{row.value} mins</span>
                        </div>

                        <div
                          style={{
                            width: "100%",
                            height: 14,
                            background: "#e5e7eb",
                            borderRadius: 999,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${widthPercent}%`,
                              height: "100%",
                              background: "#3b82f6",
                              borderRadius: 999,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}