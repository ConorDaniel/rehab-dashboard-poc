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

export default function PatientCard({
  patient,
  onOpenDashboard,
}: PatientCardProps) {
  return (
    <div className="patient-card">
      <div className="patient-card__name">{patient.name}</div>

      <div className="patient-card__meta">Room {patient.room}</div>
      <div className="patient-card__meta">{patient.bed}</div>

      <div className={getSensorClass(patient)}>
        {getSensorLabel(patient)}
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