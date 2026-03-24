export type DailyMetric = {
  date: string;
  steps?: number;
  heartRate?: number | null;
  sedentaryMinutes?: number;
  lightlyActiveMinutes?: number;
  fairlyActiveMinutes?: number;
  veryActiveMinutes?: number;
};

export type PatientDashboard = {
  patientId: string;
  patientName: string;
  room: string;
  bed: string;
  lastUpdated?: string | null;
  sensor?: {
    currentState?: string;
    lastChangedAt?: string;
    lastHeartbeatAt?: string;
    connected?: boolean;
    deviceStatus?: string;
    lastFrameAgeSec?: number;
    lastSeenAt?: string;
    lastGmag?: number;
  } | null;
  metrics: DailyMetric[];
};

export type SensorSummary = {
  patientId: string;
  hours: number;
  windowStart: string;
  windowEnd: string;
  minutes: {
    moving: number;
    rest: number;
    noSignal: number;
    atRest: number;
  };
  percentages: {
    moving: number;
    rest: number;
    noSignal: number;
    atRest: number;
  };
};