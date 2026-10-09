import { Radio, Server, Wifi, WifiOff } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { MqttStatus } from "@/types/production";

const formatTime = (value: string | null) => value ? new Date(value).toLocaleString() : null;

/** Displays the backend worker's own report; nothing here is inferred or simulated by the browser. */
export function MqttStatusPanel({ status }: { status: MqttStatus }) {
  const connection = !status.enabled ? "DISABLED" : status.connected ? (status.subscribed ? "ONLINE" : "CONNECTING") : "OFFLINE";
  return <section className="panel mqtt-panel" id="mqtt" aria-label="MQTT worker status">
    <div className="panel-heading"><div><span className="section-kicker">DEVICE INTEGRATION</span><h2>MQTT worker</h2></div>{status.connected ? <Wifi size={20} /> : <WifiOff size={20} />}</div>
    <div className="mqtt-connection">
      <div className={`signal-orb ${status.connected ? "online" : ""}`}><Radio size={22} /></div>
      <div><StatusBadge status={connection} /><p title={status.broker_url}>{status.enabled ? status.broker_url : "Enable with MQTT_ENABLED=true"}</p></div>
    </div>
    <dl className="detail-list">
      <div><dt>Candidate ID</dt><dd><code>{status.candidate_id}</code></dd></div>
      <div><dt>Client</dt><dd title={status.client_id ?? undefined}>{status.client_id ?? "Not started"}</dd></div>
      <div><dt>Challenge topic</dt><dd title={status.topics.challenge}><code>{status.topics.challenge}</code><small>QoS 1 · retain off</small></dd></div>
      <div><dt>Connected since</dt><dd>{formatTime(status.last_connected_at) ?? "Never"}<small>{status.reconnect_attempts ? `${status.reconnect_attempts} reconnect attempt${status.reconnect_attempts === 1 ? "" : "s"}` : "No reconnects"}</small></dd></div>
      <div><dt>Last heartbeat</dt><dd>{formatTime(status.last_heartbeat_at) ?? "—"}</dd></div>
      <div><dt>Last challenge</dt><dd><code>{status.last_challenge_id ?? "None"}</code><small>{formatTime(status.last_challenge_at) ?? "No challenge received since startup"}</small></dd></div>
      <div><dt>Last response</dt><dd>{status.last_response_status ? <StatusBadge status={status.last_response_status} /> : "—"}</dd></div>
    </dl>
    <div className="challenge-counts">
      <div><strong>{status.challenge_counts.total}</strong><span>Total</span></div>
      <div><strong>{status.challenge_counts.completed}</strong><span>Completed</span></div>
      <div><strong>{status.challenge_counts.failed}</strong><span>Failed</span></div>
      <div><strong>{status.challenge_counts.unpublished}</strong><span>Unpublished</span></div>
    </div>
    {status.last_error && <div className="alert error"><Server size={15} /> {status.last_error}</div>}
  </section>;
}
