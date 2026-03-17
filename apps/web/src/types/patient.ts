export type Patient = {
  id: string;
  name: string;
  room: string;
  bed: string;
  sensor?: {
    currentState?: string;
    lastChangedAt?: string;
    lastHeartbeatAt?: string;
    connected?: boolean;
    deviceStatus?: string;
    lastFrameAgeSec?: number;
  };
};