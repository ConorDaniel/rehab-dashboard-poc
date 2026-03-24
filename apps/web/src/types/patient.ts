export type Patient = {
  id: string;
  name: string;
  room: string;
  bed: string;
  piId?: string | null;

  wardId?: string | null;
  hospitalId?: string | null;

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

  device?: {
    piId?: string;
    patientId?: string;
    hostname?: string;
    ipAddress?: string;

    connected?: boolean;
    deviceStatus?: string;

    lastHeartbeatAt?: string;
    lastTelemetryAt?: string;
    lastPingAt?: string;
    lastFrameAgeSec?: number;

    updatedAt?: string;
  } | null;

  fitbit?: {
    connected?: boolean;
    fitbitUserId?: string | null;
    expiresAt?: string | null;
    lastSyncAt?: string | null;
    lastRefreshAt?: string | null;
  } | null;

  todayMetrics?: {
    date: string;
    steps?: number;
    heartRate?: number | null;
    restingHeartRate?: number | null;
    sedentaryMinutes?: number;
    lightlyActiveMinutes?: number;
    fairlyActiveMinutes?: number;
    veryActiveMinutes?: number;
  } | null;
};