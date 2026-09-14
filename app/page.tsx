'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AccountMenu } from './components/AccountMenu';
import { AuthScreen } from './components/AuthScreen';
import { EmptyState } from './components/EmptyState';
import { MetricCard } from './components/MetricCard';
import { PipelineCanvas } from './components/PipelineCanvas';
import type { DashboardState, IceStreamUser, QualityRule, Snapshot } from './types';

const API_URL = process.env.NEXT_PUBLIC_ICESTREAM_API ?? 'http://localhost:8000';
const WS_URL = API_URL.replace(/^http/, 'ws') + '/ws';

const initialDashboard: DashboardState = {
  event: 'initial',
  running: true,
  circuit: 'closed',
  pipeline_status: 'connecting',
  metrics: { events_seen: 0, accepted: 0, quarantined: 0, quality_score: 100, error_rate: 0, throughput: 0, window_size: 0 },
  top_failures: [],
  incidents: [],
  snapshots: [],
  timestamp: '',
};

const fallbackRules: QualityRule[] = [
  { id: 'DQ-001', name: 'Tax is present', field: 'tax_amount', severity: 'critical', description: 'Checkout events must contain a calculated tax amount.' },
  { id: 'DQ-002', name: 'Tax is plausible', field: 'tax_amount', severity: 'critical', description: 'Tax must be non-negative and no more than 35% of subtotal.' },
  { id: 'DQ-003', name: 'Schema is governed', field: 'schema_version', severity: 'critical', description: 'Only the approved checkout.v1 contract may enter serving.' },
  { id: 'DQ-004', name: 'Currency is supported', field: 'currency', severity: 'warning', description: 'Currency must use a configured settlement code.' },
  { id: 'DQ-005', name: 'Subtotal is bounded', field: 'subtotal', severity: 'critical', description: 'Subtotal must remain inside the operational ceiling.' },
  { id: 'DQ-006', name: 'Region is known', field: 'region', severity: 'warning', description: 'Region must map to the governed sales hierarchy.' },
];

type Tab = 'overview' | 'incidents' | 'snapshots' | 'rules';
type AuthStatus = 'checking' | 'signed-out' | 'signed-in';

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function Home() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('checking');
  const [user, setUser] = useState<IceStreamUser | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [backendOffline, setBackendOffline] = useState(false);
  const [dashboard, setDashboard] = useState(initialDashboard);
  const [rules, setRules] = useState(fallbackRules);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [qualityHistory, setQualityHistory] = useState<number[]>([100, 100, 100, 100, 100]);
  const [inspectedSnapshot, setInspectedSnapshot] = useState<(Snapshot & { events?: unknown[] }) | null>(null);

  const applyDashboard = useCallback((next: DashboardState) => {
    setDashboard(next);
    setQualityHistory((history) => [...history.slice(-19), next.metrics.quality_score]);
  }, []);

  const expireSession = useCallback(() => {
    setUser(null);
    setAuthStatus('signed-out');
    setConnected(false);
    setDashboard(initialDashboard);
  }, []);

  const checkSession = useCallback(async () => {
    setAuthBusy(true);
    setAuthError('');
    try {
      const response = await fetch(`${API_URL}/api/auth/me`, { cache: 'no-store', credentials: 'include' });
      if (response.status === 401) {
        setBackendOffline(false);
        setAuthStatus('signed-out');
        return;
      }
      if (response.status === 404) {
        setBackendOffline(true);
        setAuthStatus('signed-out');
        setAuthError('The API is running an older version. Restart “IceStream: Start all”, then retry.');
        return;
      }
      if (!response.ok) throw new Error('The authentication service is not ready. Restart the IceStream backend, then retry.');
      const payload = await response.json() as { user: IceStreamUser };
      setBackendOffline(false);
      setUser(payload.user);
      setAuthStatus('signed-in');
    } catch (error) {
      setBackendOffline(true);
      setAuthStatus('signed-out');
      setAuthError(error instanceof TypeError
        ? 'Backend is offline. In VS Code run “IceStream: Start all”, then retry.'
        : error instanceof Error ? error.message : 'Backend connection failed. Restart IceStream, then retry.');
    } finally {
      setAuthBusy(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void checkSession(), 0);
    return () => clearTimeout(timer);
  }, [checkSession]);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/dashboard`, { cache: 'no-store', credentials: 'include' });
      if (response.status === 401) {
        expireSession();
        return;
      }
      if (!response.ok) throw new Error('Dashboard unavailable');
      applyDashboard(await response.json());
      setConnected(true);
    } catch {
      setConnected(false);
    }
  }, [applyDashboard, expireSession]);

  useEffect(() => {
    if (authStatus !== 'signed-in') return;
    let active = true;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      socket = new WebSocket(WS_URL);
      socket.onopen = () => active && setConnected(true);
      socket.onmessage = (message) => {
        if (active) applyDashboard(JSON.parse(message.data));
      };
      socket.onerror = () => active && setConnected(false);
      socket.onclose = () => {
        if (!active) return;
        setConnected(false);
        reconnectTimer = setTimeout(connect, 2200);
      };
    };

    const initialRefresh = setTimeout(refresh, 0);
    fetch(`${API_URL}/api/rules`, { credentials: 'include' })
      .then(async (response): Promise<QualityRule[]> => response.ok ? await response.json() as QualityRule[] : fallbackRules)
      .then((data) => active && setRules(data))
      .catch(() => undefined);
    connect();
    const poller = setInterval(refresh, 6000);
    return () => {
      active = false;
      clearTimeout(initialRefresh);
      clearInterval(poller);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [applyDashboard, authStatus, refresh]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const request = async (label: string, path: string, body?: object) => {
    setBusy(label);
    try {
      const response = await fetch(`${API_URL}${path}`, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'include',
      });
      if (response.status === 401) {
        expireSession();
        return;
      }
      if (!response.ok) throw new Error('Request failed');
      setToast(`${label} accepted by the control plane.`);
      await refresh();
    } catch {
      setToast('Backend is offline. Run the VS Code “IceStream: Start all” task.');
    } finally {
      setBusy(null);
    }
  };

  const inspectSnapshot = async (snapshot: Snapshot) => {
    setBusy(`snapshot-${snapshot.snapshot_id}`);
    try {
      const response = await fetch(`${API_URL}/api/time-travel/${snapshot.snapshot_id}`, { credentials: 'include' });
      if (response.status === 401) {
        expireSession();
        return;
      }
      if (!response.ok) throw new Error('Snapshot unavailable');
      setInspectedSnapshot(await response.json());
    } catch {
      setToast('Snapshot could not be read. Check the backend service.');
    } finally {
      setBusy(null);
    }
  };

  const openIncidentCount = dashboard.incidents.filter((item) => item.status === 'open').length;
  const latestEvent = useMemo(() => formatTime(dashboard.timestamp), [dashboard.timestamp]);
  const navItems: { id: Tab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'incidents', label: 'Incidents', count: openIncidentCount },
    { id: 'snapshots', label: 'Snapshots', count: dashboard.snapshots.length },
    { id: 'rules', label: 'Quality rules', count: rules.length },
  ];

  const login = async (credentials: { username: string; user_id: string; password: string }) => {
    setAuthBusy(true);
    setAuthError('');
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
        credentials: 'include',
      });
      if (response.status === 404) {
        setBackendOffline(true);
        setAuthError('The API is running an older version. Restart “IceStream: Start all”, then retry.');
        return false;
      }
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ detail: 'Sign-in failed' })) as { detail?: string };
        throw new Error(payload.detail ?? 'Sign-in failed');
      }
      const payload = await response.json() as { user: IceStreamUser };
      setBackendOffline(false);
      setUser(payload.user);
      setAuthStatus('signed-in');
      setToast(`Welcome, ${payload.user.display_name}.`);
      return true;
    } catch (error) {
      if (error instanceof TypeError) {
        setBackendOffline(true);
        setAuthError('Backend is offline. In VS Code run “IceStream: Start all”, then retry.');
      } else {
        setAuthError(error instanceof Error ? error.message : 'Sign-in failed.');
      }
      return false;
    } finally {
      setAuthBusy(false);
    }
  };

  const register = async (details: { display_name: string; username: string; user_id: string; password: string }) => {
    setAuthBusy(true);
    setAuthError('');
    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(details),
        credentials: 'include',
      });
      if (response.status === 404) {
        setBackendOffline(true);
        setAuthError('Registration needs the updated API. Restart “IceStream: Start all”, then retry.');
        return false;
      }
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ detail: 'Registration failed' })) as { detail?: string };
        throw new Error(payload.detail ?? 'Registration failed');
      }
      const payload = await response.json() as { user: IceStreamUser };
      setBackendOffline(false);
      setUser(payload.user);
      setAuthStatus('signed-in');
      setToast(`Account created. Welcome, ${payload.user.display_name}.`);
      return true;
    } catch (error) {
      if (error instanceof TypeError) {
        setBackendOffline(true);
        setAuthError('Backend is offline. In VS Code run “IceStream: Start all”, then retry.');
      } else {
        setAuthError(error instanceof Error ? error.message : 'Registration failed.');
      }
      return false;
    } finally {
      setAuthBusy(false);
    }
  };

  const logout = async () => {
    setAuthBusy(true);
    try {
      await fetch(`${API_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    } finally {
      setAuthBusy(false);
      expireSession();
      setAuthError('');
    }
  };

  if (authStatus === 'checking') return <AuthScreen checking />;
  if (authStatus === 'signed-out' || !user) return <AuthScreen busy={authBusy} error={authError} backendOffline={backendOffline} onLogin={login} onRegister={register} onRetry={checkSession} />;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">IS</span>
          <div><strong>IceStream</strong><span>Lakehouse control plane</span></div>
        </div>
        <div className="top-actions">
          <span className={`connection-pill ${connected ? 'is-live' : ''}`}><i />{connected ? 'Live service' : 'Demo preview'}</span>
          <button className="secondary-button" onClick={() => request(dashboard.running ? 'Pause stream' : 'Resume stream', `/api/simulation/${dashboard.running ? 'stop' : 'start'}`)} disabled={busy !== null}>
            {dashboard.running ? 'Pause stream' : 'Resume stream'}
          </button>
          <AccountMenu user={user} busy={authBusy} onSignOut={logout} />
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <p className="nav-label">CONTROL PLANE</p>
          <nav aria-label="IceStream sections">
            {navItems.map((item) => (
              <button key={item.id} className={activeTab === item.id ? 'active' : ''} onClick={() => setActiveTab(item.id)}>
                <span className={`nav-icon icon-${item.id}`} />{item.label}
                {item.count !== undefined && <em>{item.count}</em>}
              </button>
            ))}
          </nav>
          <div className="sidebar-foot">
            <p>DEMO PROFILE</p>
            <strong>Local adapters</strong>
            <span>Kafka · Flink · Iceberg contract</span>
          </div>
        </aside>

        <section className="content">
          <div className="content-head">
            <div><p className="eyebrow">REAL-TIME LAKEHOUSE OBSERVABILITY</p><h1>{activeTab === 'overview' ? 'Checkout telemetry' : navItems.find((item) => item.id === activeTab)?.label}</h1><p>Governed streaming data from ingestion to the serving layer.</p></div>
            <div className={`pipeline-chip status-${dashboard.pipeline_status}`}><i /><span><b>{dashboard.pipeline_status}</b><small>Updated {latestEvent}</small></span></div>
          </div>

          {activeTab === 'overview' && (
            <>
              <div className="metric-grid">
                <MetricCard label="Events observed" value={formatNumber(dashboard.metrics.events_seen)} detail={`${formatNumber(dashboard.metrics.accepted)} committed`} history={qualityHistory.map((_, index) => 28 + index * 5)} />
                <MetricCard label="Quality score" value={`${dashboard.metrics.quality_score.toFixed(1)}%`} detail={`${dashboard.metrics.window_size}-event rolling window`} tone={dashboard.metrics.quality_score > 97 ? 'good' : 'danger'} history={qualityHistory} />
                <MetricCard label="Quarantined" value={formatNumber(dashboard.metrics.quarantined)} detail="Rows protected from serving" tone={dashboard.metrics.quarantined > 0 ? 'danger' : 'default'} />
                <MetricCard label="Stream velocity" value={`${dashboard.metrics.throughput.toFixed(1)}/s`} detail="Validated events per second" />
              </div>

              <div className="overview-grid">
                <article className="panel lineage-panel">
                  <div className="panel-head"><div><p className="eyebrow">LIVE LINEAGE</p><h2>Pipeline topology</h2></div><span className="stream-label">● {dashboard.running ? 'STREAMING' : 'PAUSED'}</span></div>
                  <PipelineCanvas circuitOpen={dashboard.circuit === 'open'} running={dashboard.running} />
                  <div className="lineage-legend"><span><i className="legend-good" />Healthy path</span><span><i className="legend-watch" />Quality inspection</span><span><i className="legend-bad" />Circuit blocked</span></div>
                </article>

                <aside className="panel fault-panel">
                  <div className="panel-head"><div><p className="eyebrow">CONTROLLED TEST</p><h2>Fault injection</h2></div></div>
                  <p className="panel-copy">Introduce deterministic bad records and watch the quality gate isolate them.</p>
                  <div className="fault-list">
                    <button onClick={() => request('Null-tax burst', '/api/simulation/inject', { kind: 'null_tax', count: 8 })} disabled={busy !== null}><span>NULL</span><div><strong>Null tax burst</strong><small>Break DQ-001</small></div><b>Inject</b></button>
                    <button onClick={() => request('Schema drift', '/api/simulation/inject', { kind: 'schema_drift', count: 8 })} disabled={busy !== null}><span>V2</span><div><strong>Schema drift</strong><small>Break DQ-003</small></div><b>Inject</b></button>
                    <button onClick={() => request('Amount spike', '/api/simulation/inject', { kind: 'amount_spike', count: 8 })} disabled={busy !== null}><span>₹↑</span><div><strong>Amount spike</strong><small>Break DQ-005</small></div><b>Inject</b></button>
                  </div>
                  <div className={`breaker-box ${dashboard.circuit === 'open' ? 'breaker-open' : ''}`}>
                    <div><span className="breaker-light" /><p><small>CIRCUIT BREAKER</small><strong>{dashboard.circuit}</strong></p></div>
                    {dashboard.circuit === 'open' && <button onClick={() => request('Manual reset', '/api/circuit/reset')} disabled={busy !== null}>Reset</button>}
                  </div>
                </aside>
              </div>

              <div className="lower-grid">
                <article className="panel incidents-panel">
                  <div className="panel-head"><div><p className="eyebrow">OPERATIONS</p><h2>Recent incidents</h2></div><button className="text-button" onClick={() => setActiveTab('incidents')}>View all →</button></div>
                  {dashboard.incidents.length === 0 ? <EmptyState title="No incidents detected" detail="The serving path is inside all quality thresholds." /> : <IncidentTable incidents={dashboard.incidents.slice(0, 4)} />}
                </article>
                <article className="panel snapshot-panel">
                  <div className="panel-head"><div><p className="eyebrow">TIME TRAVEL</p><h2>Lakehouse snapshots</h2></div><button className="text-button" onClick={() => setActiveTab('snapshots')}>Explore →</button></div>
                  {dashboard.snapshots.length === 0 ? <EmptyState title="First snapshot pending" detail="A snapshot is committed after 24 accepted events." /> : <SnapshotList snapshots={dashboard.snapshots.slice(0, 3)} onInspect={inspectSnapshot} busy={busy} />}
                </article>
              </div>
            </>
          )}

          {activeTab === 'incidents' && <article className="panel page-panel">{dashboard.incidents.length === 0 ? <EmptyState title="Incident log is clean" detail="Use controlled fault injection to validate circuit-breaker behavior." /> : <IncidentTable incidents={dashboard.incidents} />}</article>}

          {activeTab === 'snapshots' && <article className="panel page-panel"><div className="snapshot-layout"><SnapshotList snapshots={dashboard.snapshots} onInspect={inspectSnapshot} busy={busy} /><div className="snapshot-inspector">{inspectedSnapshot ? <><p className="eyebrow">SNAPSHOT #{inspectedSnapshot.snapshot_id}</p><h2>{formatNumber(inspectedSnapshot.event_count)} committed events</h2><p>Watermark {formatTime(inspectedSnapshot.watermark)}</p><div className="code-window"><span>Immutable sample rows</span><pre>{JSON.stringify(inspectedSnapshot.events?.slice(0, 2) ?? [], null, 2)}</pre></div></> : <EmptyState title="Select a snapshot" detail="Inspect an immutable view of the serving table at that watermark." />}</div></div></article>}

          {activeTab === 'rules' && <div className="rules-grid">{rules.map((rule) => <article className="panel rule-card" key={rule.id}><div><span>{rule.id}</span><em className={`severity-${rule.severity}`}>{rule.severity}</em></div><h2>{rule.name}</h2><code>{rule.field}</code><p>{rule.description}</p><small>ACTIVE ASSERTION</small></article>)}</div>}
        </section>
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}

function IncidentTable({ incidents }: { incidents: DashboardState['incidents'] }) {
  return <div className="table-wrap"><table><thead><tr><th>Status</th><th>Rule</th><th>Incident</th><th>Opened</th></tr></thead><tbody>{incidents.map((incident) => <tr key={incident.incident_id}><td><span className={`incident-status status-${incident.status}`}>{incident.status}</span></td><td><code>{incident.rule_id}</code></td><td><strong>{incident.title}</strong><small>{incident.reason}</small></td><td>{formatTime(incident.opened_at)}</td></tr>)}</tbody></table></div>;
}

function SnapshotList({ snapshots, onInspect, busy }: { snapshots: Snapshot[]; onInspect: (snapshot: Snapshot) => void; busy: string | null }) {
  if (snapshots.length === 0) return <EmptyState title="No snapshots yet" detail="Keep the stream running until accepted records are committed." />;
  return <div className="snapshot-list">{snapshots.map((snapshot) => <button key={snapshot.snapshot_id} onClick={() => onInspect(snapshot)} disabled={busy !== null}><span>#{snapshot.snapshot_id}</span><div><strong>{formatNumber(snapshot.event_count)} events</strong><small>{formatTime(snapshot.created_at)} · immutable</small></div><b>Inspect →</b></button>)}</div>;
}
