import type { Patient } from "../types/patient";
import { useNavigate } from "react-router-dom";

type PatientCardProps = {
  patient: Patient;
  onOpenDashboard?: (id: string) => void;
};

function getSensorLabel(patient: Patient): string {
  if (!patient.sensor) return "No sensor data";

  if (patient.sensor.currentState === "REST") return "At rest";
  if (patient.sensor.currentState === "MOVING") return "Moving";

  return "Sensor status unknown";
}

function getSensorClass(patient: Patient): string {
  if (!patient.sensor) return "patient-card__status patient-card__status--unknown";

  if (patient.sensor.currentState === "REST")
    return "patient-card__status patient-card__status--rest";

  if (patient.sensor.currentState === "MOVING")
    return "patient-card__status patient-card__status--moving";

  return "patient-card__status patient-card__status--unknown";
}

function StatusDot({ connected }: { connected: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 10,
        height: 10,
        borderRadius: "50%",
        backgroundColor: connected ? "#16a34a" : "#dc2626",
        marginLeft: 8,
        verticalAlign: "middle",
      }}
    />
  );
}

function formatActivityDate(date?: string): string {
  if (!date) return "No date";

  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;

  return parsed.toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getCardBackground(sensorConnected: boolean, alertActive: boolean): string {
  if (alertActive) return "#eff6ff";
  return sensorConnected ? "#dcfce7" : "#fee2e2";
}

function isRecentIsoTime(isoString?: string | null, maxAgeMs = 15000): boolean {
  if (!isoString) return false;

  const parsed = new Date(isoString).getTime();
  if (Number.isNaN(parsed)) return false;

  return Date.now() - parsed < maxAgeMs;
}

export default function PatientCard({
  patient,
  onOpenDashboard,
}: PatientCardProps) {
  const navigate = useNavigate();
  const today = patient.todayMetrics;

  const sensorConnected = isRecentIsoTime(patient.device?.lastTelemetryAt, 15000);
  const piConnected = isRecentIsoTime(patient.device?.lastHeartbeatAt, 75000);

  const displayHeartRate =
    today?.heartRate ?? today?.restingHeartRate ?? null;

  const alertActive = !!patient.sensor?.alertActive;

  const cardBackground = getCardBackground(sensorConnected, alertActive);

  return (
    <div
      className={`patient-card ${alertActive ? "patient-card--alert" : ""}`}
      style={{ background: cardBackground }}
    >
      {alertActive && <div className="patient-card__alert-badge">ALERT</div>}

      <div
        className="patient-card__name"
        style={{ textAlign: "center", marginBottom: 6 }}
      >
        {patient.name}
      </div>

      <div
        style={{
          textAlign: "center",
          marginBottom: 14,
          fontSize: 14,
          color: "#374151",
          fontWeight: 500,
        }}
      >
        Room {patient.room} · <span aria-hidden="true">🛏️</span> {patient.bed}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          marginBottom: 14,
        }}
      >
        <div style={{ flex: 1 }}>
          <div className={getSensorClass(patient)} style={{ marginBottom: 12 }}>
            {getSensorLabel(patient)}
          </div>

          <div className="patient-card__meta" style={{ marginBottom: 8 }}>
            Sensor connected
            <StatusDot connected={sensorConnected} />
          </div>

          <div className="patient-card__meta" style={{ marginBottom: 8 }}>
            Pi connected
            <StatusDot connected={piConnected} />
          </div>

          {alertActive && (
            <div className="patient-card__alert-text">
              Movement after rest
            </div>
          )}
        </div>

        <div
          style={{
            width: 92,
            height: 112,
            borderRadius: 12,
            background: "#e5e7eb",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            color: "#6b7280",
            fontWeight: 600,
            flexShrink: 0,
            overflow: "hidden",
          }}
        >
          Headshot
        </div>
      </div>

      <div
        style={{
          textAlign: "center",
          fontWeight: 700,
          fontSize: 15,
          marginTop: 10,
          marginBottom: 10,
        }}
      >
        Activity Today · {formatActivityDate(today?.date)}
      </div>

      <div
        className="patient-card__meta"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
          fontWeight: 600,
        }}
      >
        <span aria-hidden="true" style={{ fontSize: 18 }}>👣</span>
        <span>Steps: {today?.steps ?? 0}</span>
      </div>

      <div
        className="patient-card__meta"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
          fontWeight: 600,
        }}
      >
        <span aria-hidden="true" style={{ fontSize: 18, color: "#dc2626" }}>
          ♥
        </span>
        <span>
          Heart rate: {displayHeartRate ?? "—"}
          {displayHeartRate ? " bpm" : ""}
        </span>
      </div>

      <div className="patient-card__hint">
        Click below to view trends and patient dashboard.
      </div>

      <div
        className="patient-card__footer"
        style={{ display: "flex", flexDirection: "column", gap: 6 }}
      >
        <button
          type="button"
          className="patient-card__button"
          onClick={() => onOpenDashboard?.(patient.id)}
        >
          Open dashboard
        </button>

        {patient.id === "p1" && (
          <button
            type="button"
            className="patient-card__button"
            onClick={() => navigate("/rag")}
          >
            RAG Prototype
          </button>
        )}
      </div>
    </div>
  );
}