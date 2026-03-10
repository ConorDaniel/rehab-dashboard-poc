import type { Patient } from "../types/patient";

type PatientCardProps = {
  patient: Patient;
  onOpenDashboard?: (id: string) => void;
};

export default function PatientCard({
  patient,
  onOpenDashboard,
}: PatientCardProps) {
  return (
    <div className="patient-card">
      <div className="patient-card__name">{patient.name}</div>

      <div className="patient-card__meta">Room {patient.room}</div>
      <div className="patient-card__meta">{patient.bed}</div>

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