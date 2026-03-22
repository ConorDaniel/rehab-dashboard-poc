import type { Patient } from "../types/patient";

type PatientCardProps = {
  patient: Patient;
  onOpenDashboard?: (id: string) => void;
};

function getSensorLabel(patient: Patient): string {
  if (!patient.sensor) return "No sensor data";

  if (patient.sensor.deviceStatus === "offline") {
    return "Sensor offline";
  }

  if (patient.sensor.currentState === "REST") {
    return "At rest";
  }

  if (patient.sensor.currentState === "MOVING") {
    return "Moving";
  }

  return "Sensor status unknown";
}

function getSensorClass(patient: Patient): string {
  if (!patient.sensor) return "patient-card__status patient-card__status--unknown";

  if (patient.sensor.deviceStatus === "offline") {
    return "patient-card__status patient-card__status--offline";
  }

  if (patient.sensor.currentState === "REST") {
    return "patient-card__status patient-card__status--rest";
  }

  if (patient.sensor.currentState === "MOVING") {
    return "patient-card__status patient-card__status--moving";
  }

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
        backgroundColor: connected ? "green" : "red",
        marginLeft: 6,
        verticalAlign: "middle",
      }}
    />
  );
}

export default function PatientCard({
  patient,
  onOpenDashboard,
}: PatientCardProps) {
  const today = patient.todayMetrics;

  const piConnected = patient.sensor?.deviceStatus === "online";
  const sensorConnected = !!patient.sensor;
  const displayHeartRate =
    today?.heartRate ?? today?.restingHeartRate ?? null;

  return (
    <div className="patient-card">
      <div
        style={{
          width: "100%",
          height: 120,
          borderRadius: 12,
          background: "#e5e7eb",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 12,
          fontSize: 14,
          color: "#6b7280",
          fontWeight: 600,
        }}
      >
        Patient photo
      </div>

      <div className="patient-card__name">{patient.name}</div>
      <div className="patient-card__meta">Room {patient.room}</div>
      <div className="patient-card__meta">{patient.bed}</div>

      <div className={getSensorClass(patient)}>
        {getSensorLabel(patient)}
      </div>

      <div className="patient-card__meta" style={{ marginTop: 10 }}>
        Sensor connected:
        <StatusDot connected={sensorConnected} />
      </div>

      <div className="patient-card__meta">
        Pi connected:
        <StatusDot connected={piConnected} />
      </div>

      <div className="patient-card__meta" style={{ marginTop: 12 }}>
        Today’s Activity
      </div>

      <div className="patient-card__meta">
        Steps: {today?.steps ?? 0}
      </div>

      <div className="patient-card__meta">
        ♥ Heart rate: {displayHeartRate ?? "—"}
        {displayHeartRate ? " bpm" : ""}
      </div>

      <div className="patient-card__meta">
        Sedentary activity mins: {today?.sedentaryMinutes ?? 0}
      </div>

      <div className="patient-card__meta">
        Light activity mins: {today?.lightlyActiveMinutes ?? 0}
      </div>

      <div className="patient-card__meta">
        Moderate activity mins: {today?.fairlyActiveMinutes ?? 0}
      </div>

      <div className="patient-card__meta">
        High activity mins: {today?.veryActiveMinutes ?? 0}
      </div>

      <div className="patient-card__hint">
        Click below to view trends and patient dashboard.
      </div>

      <div className="patient-card__footer">
        <button
          type="button"
          className="patient-card__button"
          onClick={() => onOpenDashboard?.(patient.id)}
        >
          Open dashboard
        </button>
      </div>
    </div>
  );
}