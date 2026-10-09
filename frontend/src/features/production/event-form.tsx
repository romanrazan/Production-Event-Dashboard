"use client";

import { Braces, Send, Sparkles } from "lucide-react";
import { FormEvent, useRef, useState } from "react";
import { apiErrorMessage } from "@/lib/api/client";
import { submitEvents } from "@/services/production";
import { EventResult } from "@/types/production";
import { StatusBadge } from "@/components/status-badge";

const countExample = { source_id: "LINE-01", event_id: "EV-101", type: "COUNT", quantity: 5, target_event_id: null, event_time: "2026-10-09T10:30:00Z" };
const correctionExample = { source_id: "LINE-01", event_id: "EV-VOID-101", type: "VOID", quantity: null, target_event_id: "EV-101", event_time: "2026-10-09T10:31:00Z" };
const voidFirstExample = [
  { source_id: "LINE-02", event_id: "EV-VOID-201", type: "VOID", quantity: null, target_event_id: "EV-201", event_time: "2026-10-09T10:40:00Z" },
  { source_id: "LINE-02", event_id: "EV-201", type: "COUNT", quantity: 12, target_event_id: null, event_time: "2026-10-09T10:39:00Z" },
];
const mixedExample = [
  { source_id: "LINE-03", event_id: "EV-301", type: "COUNT", quantity: 4, target_event_id: null, event_time: "2026-10-09T11:00:00+06:00" },
  { source_id: "LINE-03", event_id: "EV-302", type: "COUNT", quantity: "5", target_event_id: null, event_time: "2026-10-09T11:01:00Z" },
  42,
  { source_id: "LINE-03", event_id: "EV-303", type: "VOID", quantity: null, target_event_id: "EV-303", event_time: "2026-10-09T11:02:00Z" },
];

export function EventForm({ onComplete }: { onComplete: () => void }) {
  const [value, setValue] = useState(JSON.stringify(countExample, null, 2));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<EventResult[] | null>(null);
  // A ref guard blocks a second submit fired before React re-renders with busy=true.
  const inFlight = useRef(false);

  const fill = (payload: unknown) => { setValue(JSON.stringify(payload, null, 2)); setError(null); setResults(null); };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (inFlight.current) return;
    let payload: unknown;
    try {
      payload = JSON.parse(value);
    } catch (reason) {
      setError(`Invalid JSON: ${reason instanceof Error ? reason.message : "parse error"}`); return;
    }
    if (!payload || typeof payload !== "object") { setError("Use one JSON event object or an array of events"); return; }
    inFlight.current = true;
    setBusy(true); setError(null);
    try { const response = await submitEvents(payload); setResults(response.results); onComplete(); }
    catch (reason) { setError(apiErrorMessage(reason)); }
    finally { inFlight.current = false; setBusy(false); }
  };

  return <section className="panel event-panel" id="events">
    <div className="panel-heading"><div><span className="section-kicker">MANUAL INGESTION</span><h2>Submit production events</h2></div><Braces size={20} /></div>
    <div className="example-actions">
      <button type="button" className="chip" onClick={() => fill(countExample)}><Sparkles size={13} /> COUNT example</button>
      <button type="button" className="chip" onClick={() => fill(correctionExample)}>VOID example</button>
      <button type="button" className="chip" onClick={() => fill(voidFirstExample)}>VOID before COUNT</button>
      <button type="button" className="chip" onClick={() => fill(mixedExample)}>Mixed valid / invalid</button>
    </div>
    <form onSubmit={submit}>
      <label htmlFor="event-json">Event JSON</label>
      <textarea id="event-json" disabled={busy} spellCheck={false} value={value} onChange={(event) => setValue(event.target.value)} aria-describedby="json-help" />
      <div className="form-foot"><small id="json-help">One object or an ordered array. Backend decisions remain authoritative.</small><button className="primary" disabled={busy} type="submit"><Send size={15} />{busy ? "Submitting…" : "Process events"}</button></div>
    </form>
    {error && <div className="alert error" role="alert">{error}</div>}
    {results && <div className="results" aria-live="polite">
      <div className="results-head"><strong>Submission results</strong><span>{results.length} item{results.length === 1 ? "" : "s"}</span></div>
      {results.length === 0 ? <p className="empty compact">Empty batch accepted; no events processed.</p> : results.map((result, index) => <div className="result-row" key={`${result.event_id ?? "invalid"}-${index}`}>
        <span className="order">{index + 1}</span><code>{result.event_id ?? "No event ID"}</code><StatusBadge status={result.status} /><small>{result.message}</small>
      </div>)}
    </div>}
  </section>;
}
