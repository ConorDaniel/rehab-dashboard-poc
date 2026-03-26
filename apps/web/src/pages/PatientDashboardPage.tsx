import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  fetchPatientDashboard,
  fetchPatientTrends,
  fetchSensorSummary,
} from "../services/patientService";
import type { PatientDashboard, SensorSummary } from "../types/patientDashboard";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";

function MovementDonut({
  movingPercent,
  atRestPercent,
}: {
  movingPercent: number;
  atRestPercent: number;
}) {
  const size = 260;
  const stroke = 30;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const clampedMoving = Math.max(0, Math.min(100, movingPercent));
  const movingLength = (clampedMoving / 100) * circumference;

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 620,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#22c55e"
              strokeWidth={stroke}
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#f97316"
              strokeWidth={stroke}
              strokeDasharray={`${movingLength} ${circumference}`}
              strokeDashoffset={0}
              strokeLinecap="butt"
            />
          </g>

          <text
            x="50%"
            y="46%"
            textAnchor="middle"
            fontSize="18"
            fontWeight="700"
            fill="#111827"
          >
            24 Hours
          </text>
          <text
            x="50%"
            y="56%"
            textAnchor="middle"
            fontSize="14"
            fill="#6b7280"
          >
            Movement
          </text>
        </svg>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 30,
            marginTop: 10,
            flexWrap: "wrap",
            fontWeight: 600,
          }}
        >
          <span style={{ color: "#22c55e" }}>
            ● At Rest: {atRestPercent}%
          </span>
          <span style={{ color: "#f97316" }}>
            ● Moving: {movingPercent}%
          </span>
        </div>
      </div>
    </div>
  );
}

export default function PatientDashboardPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [dashboard, setDashboard] = useState<PatientDashboard | null>(null);
  const [sensorSummary, setSensorSummary] = useState<SensorSummary | null>(null);
  const [days, setDays] = useState(7);
  const [error, setError] = useState<string | null>(null);
  const [sensorError, setSensorError] = useState<string | null>(null);

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
        setError(null);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
      });
  }, [id, days]);

  useEffect(() => {
    if (!id) return;

    fetchSensorSummary(id, 24)
      .then((data) => {
        setSensorSummary(data);
        setSensorError(null);
      })
      .catch((e: unknown) => {
        setSensorError(e instanceof Error ? e.message : String(e));
      });
  }, [id]);

  const latestDay =
    dashboard?.metrics && dashboard.metrics.length > 0
      ? dashboard.metrics[dashboard.metrics.length - 1]
      : null;

  const activityRows = latestDay
    ? [
        { label: "Sedentary activity", value: latestDay.sedentaryMinutes ?? 0 },
        { label: "Light activity", value: latestDay.lightlyActiveMinutes ?? 0 },
        { label: "Moderate activity", value: latestDay.fairlyActiveMinutes ?? 0 },
        { label: "High activity", value: latestDay.veryActiveMinutes ?? 0 },
      ]
    : [];

  const maxActivityValue =
    activityRows.length > 0
      ? Math.max(...activityRows.map((row) => row.value), 1)
      : 1;

  const movementMinutesData = sensorSummary
    ? [
        { name: "Moving", minutes: sensorSummary.minutes.moving },
        { name: "At Rest", minutes: sensorSummary.minutes.atRest },
        { name: "No Signal", minutes: sensorSummary.minutes.noSignal },
      ]
    : [];

  const donutValues = useMemo(() => {
    return {
      moving: sensorSummary?.percentages.moving ?? 0,
      atRest: sensorSummary?.percentages.atRest ?? 0,
    };
  }, [sensorSummary]);

  const heartRateData = useMemo(() => {
    return (dashboard?.metrics ?? []).map((metric) => ({
      ...metric,
      displayHeartRate: metric.heartRate ?? metric.restingHeartRate ?? null,
    }));
  }, [dashboard]);

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
              <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
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
              <h2 className="dashboard-panel__title">Heart Rate Trend</h2>

              <div style={{ width: "100%", height: 260 }}>
                <ResponsiveContainer>
                  <LineChart data={heartRateData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip
                      formatter={(value: number | null) =>
                        value == null ? "No data" : `${value} bpm`
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="displayHeartRate"
                      stroke="#dc2626"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="dashboard-panel">
              <h2 className="dashboard-panel__title">
                Movement over last 24 Hours
              </h2>

              {sensorError && (
                <p className="dashboard-panel__text">Error: {sensorError}</p>
              )}

              {!sensorSummary && !sensorError && (
                <p className="dashboard-panel__text">
                  Loading movement summary...
                </p>
              )}

              {sensorSummary && (
                <MovementDonut
                  movingPercent={donutValues.moving}
                  atRestPercent={donutValues.atRest}
                />
              )}
            </section>

            <section className="dashboard-panel">
              <h2 className="dashboard-panel__title">
                Movement Minutes over last 24 Hours
              </h2>

              {sensorError && (
                <p className="dashboard-panel__text">Error: {sensorError}</p>
              )}

              {!sensorSummary && !sensorError && (
                <p className="dashboard-panel__text">
                  Loading movement minutes...
                </p>
              )}

              {sensorSummary && (
                <div style={{ width: "100%", height: 280 }}>
                  <ResponsiveContainer>
                    <BarChart data={movementMinutesData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value: number) => `${value} mins`} />
                      <Bar dataKey="minutes" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
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