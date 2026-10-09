import { AlertTriangle, CheckCheck, CircleDotDashed, Copy, Gauge, Layers3 } from "lucide-react";
import { StateSummary } from "@/types/production";

const metrics = [
  { key: "net_total", label: "Net production", hint: "COUNT minus applied VOID", icon: Gauge, accent: true },
  { key: "processed_events", label: "Processed events", hint: "Completed COUNT and VOID", icon: Layers3, accent: false },
  { key: "pending_ack", label: "Awaiting review", hint: "Completed, not acknowledged", icon: CheckCheck, accent: false },
  { key: "unresolved", label: "Unresolved refs", hint: "VOID waiting for COUNT", icon: CircleDotDashed, accent: false },
  { key: "duplicates", label: "Duplicate attempts", hint: "Retried identical payloads", icon: Copy, accent: false },
  { key: "conflicts", label: "Conflicts", hint: "Reused ID, changed payload", icon: AlertTriangle, accent: false },
] as const;

export function SummaryCards({ summary, stale = false }: { summary: StateSummary; stale?: boolean }) {
  return <section className={`stats-grid ${stale ? "is-stale" : ""}`} aria-label="Production summary" aria-busy={stale}>
    {metrics.map(({ key, label, hint, icon: Icon, accent }) => <article className={`metric ${accent ? "accent" : ""}`} key={key}>
      <div className="metric-head"><span>{label}</span><Icon size={17} /></div>
      <strong>{summary[key].toLocaleString()}</strong>
      <small>{hint}</small>
    </article>)}
  </section>;
}
