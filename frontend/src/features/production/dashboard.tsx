"use client";

import { AlertOctagon, Database, RefreshCw, Search } from "lucide-react";
import { FormEvent, useCallback, useState } from "react";
import { Shell } from "@/components/shell";
import { usePoll } from "@/hooks/use-poll";
import { apiErrorMessage } from "@/lib/api/client";
import { getExceptions, getMqttStatus, getPending, getSummary } from "@/services/production";
import { DashboardSnapshot } from "@/types/production";
import { EventForm } from "./event-form";
import { EventsTable } from "./events-table";
import { MqttStatusPanel } from "./mqtt-status-panel";
import { SummaryCards } from "./summary-cards";

const POLL_INTERVAL_MS = 5000;

export function Dashboard() {
  const [sourceDraft, setSourceDraft] = useState("");
  const [source, setSource] = useState("");
  const load = useCallback(async (signal: AbortSignal): Promise<DashboardSnapshot> => {
    const sourceId = source || undefined;
    try {
      const [summary, pending, exceptions, mqtt] = await Promise.all([
        getSummary(sourceId, signal), getPending(sourceId, signal), getExceptions(sourceId, signal), getMqttStatus(signal),
      ]);
      return { summary, pending, exceptions, mqtt, sourceId: source };
    } catch (reason) {
      throw new Error(apiErrorMessage(reason));
    }
  }, [source]);
  const poll = usePoll(load, POLL_INTERVAL_MS);
  const filter = (event: FormEvent) => { event.preventDefault(); setSource(sourceDraft.trim()); };
  const clear = () => { setSource(""); setSourceDraft(""); };
  // A snapshot for a different filter is shown only while the new one loads, and is flagged as such.
  const snapshotMatchesFilter = poll.data?.sourceId === source;
  const stale = !!poll.error && !!poll.data;

  return <Shell>
    <section className="page-heading" id="overview">
      <div><p className="eyebrow">PRODUCTION CONTROL CENTER</p><h1>Live event operations</h1><p>Reliable counts, exception review and correction history across the factory floor.</p></div>
      <div className="heading-status">
        <span className={`live-dot ${poll.error ? "stale" : ""}`}><i />{poll.error ? (poll.data ? "STALE SNAPSHOT" : "API UNAVAILABLE") : poll.data ? "LIVE POSTGRESQL" : "CONNECTING"}</span>
        <small>{poll.lastSuccess ? `Updated ${poll.lastSuccess.toLocaleTimeString()}` : "Waiting for first snapshot…"}</small>
      </div>
    </section>
    <form className="filter-bar" onSubmit={filter}>
      <div><Search size={16} /><input aria-label="Filter by source ID" placeholder="Filter by source, e.g. LINE-01" value={sourceDraft} onChange={(event) => setSourceDraft(event.target.value)} /></div>
      <button className="secondary" type="submit">Apply filter</button>
      {source && <button className="text-button" type="button" onClick={clear}>Clear</button>}
      <span><Database size={14} />{source ? `Showing ${source}` : "All production sources"}{poll.data && !snapshotMatchesFilter ? " · loading…" : ""}</span>
    </form>
    {stale && <div className="alert stale" role="status"><strong>Refresh failed.</strong> Showing the last successful database snapshot{poll.lastSuccess ? ` from ${poll.lastSuccess.toLocaleTimeString()}` : ""}. {poll.error}<button onClick={poll.refresh}><RefreshCw size={14} /> Retry</button></div>}
    {poll.error && !poll.data && <div className="panel error-state" role="alert">
      <AlertOctagon size={28} />
      <div><strong>Production data is unavailable</strong><p>{poll.error}. No figures are shown until the backend responds; nothing is assumed to be zero.</p></div>
      <button className="secondary" onClick={poll.refresh}><RefreshCw size={14} /> Retry now</button>
    </div>}
    {poll.loading && !poll.data && !poll.error && <div className="loading-grid" aria-label="Loading production summary">{Array.from({ length: 6 }).map((_, index) => <span key={index} />)}</div>}
    {poll.data && <>
      <SummaryCards summary={poll.data.summary} stale={stale || !snapshotMatchesFilter} />
      <div className="dashboard-grid">
        <div className="main-column"><EventsTable pending={poll.data.pending} exceptions={poll.data.exceptions} onRefresh={poll.refresh} /></div>
        <div className="side-column"><EventForm onComplete={poll.refresh} /><MqttStatusPanel status={poll.data.mqtt} /></div>
      </div>
    </>}
  </Shell>;
}
