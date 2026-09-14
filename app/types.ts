export type Incident = {
  incident_id: number;
  opened_at: string;
  resolved_at: string | null;
  rule_id: string;
  title: string;
  reason: string;
  severity: string;
  status: 'open' | 'resolved';
};

export type Snapshot = {
  snapshot_id: number;
  created_at: string;
  event_count: number;
  watermark: string;
};

export type DashboardState = {
  event: string;
  running: boolean;
  circuit: 'open' | 'closed';
  pipeline_status: 'connecting' | 'streaming' | 'quarantined' | 'paused';
  metrics: {
    events_seen: number;
    accepted: number;
    quarantined: number;
    quality_score: number;
    error_rate: number;
    throughput: number;
    window_size: number;
  };
  top_failures: { rule_id: string; count: number }[];
  incidents: Incident[];
  snapshots: Snapshot[];
  timestamp: string;
  note?: string;
};

export type QualityRule = {
  id: string;
  name: string;
  field: string;
  description: string;
  severity: string;
};

export type IceStreamUser = {
  username: string;
  user_id: string;
  display_name: string;
};
