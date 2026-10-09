"use client";

import { CheckCheck, ChevronDown, ChevronRight, Inbox, RefreshCw } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { apiErrorMessage } from "@/lib/api/client";
import { acknowledgeEvents } from "@/services/production";
import { AcknowledgementResult, StateRow } from "@/types/production";

type View = "pending" | "exceptions";

const formatTime = (value: string | null | undefined) => value ? new Date(value).toLocaleString() : "—";

function RowDetails({ row }: { row: StateRow }) {
  const fields: Array<[string, string]> = [
    ["Event ID", row.event_id ?? "— (not usable)"],
    ["Source", row.source_id ?? "— (not usable)"],
    ["Type", row.type ?? "—"],
    ["Quantity", row.quantity === null ? "—" : String(row.quantity)],
    ["Target event", row.target_event_id ?? "—"],
    ["Event time (device)", formatTime(row.event_time)],
    ["Received (server)", formatTime(row.received_at)],
    ["Status", row.status],
    ["Reason", row.reason ?? "—"],
    ["Record", row.id],
  ];
  return <dl className="row-details">{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}

export function EventsTable({ pending, exceptions, onRefresh }: { pending: StateRow[]; exceptions: StateRow[]; onRefresh: () => void }) {
  const [view, setView] = useState<View>("pending");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ackResults, setAckResults] = useState<AcknowledgementResult[] | null>(null);
  const rows = view === "pending" ? pending : exceptions;

  // Selection is intersected with the latest Pending snapshot during render, so rows that were
  // acknowledged elsewhere (or filtered out) silently drop out without an extra effect.
  const pendingIds = useMemo(() => new Set(pending.flatMap((row) => row.event_id ? [row.event_id] : [])), [pending]);
  const effectiveSelection = useMemo(() => [...selected].filter((id) => pendingIds.has(id)), [selected, pendingIds]);
  const allSelected = pendingIds.size > 0 && effectiveSelection.length === pendingIds.size;

  const toggle = (id: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(pendingIds));
  const switchView = (next: View) => { setView(next); setExpanded(null); };

  const acknowledge = async () => {
    if (!effectiveSelection.length || busy) return;
    setBusy(true); setError(null);
    try {
      const result = await acknowledgeEvents(effectiveSelection);
      setAckResults(result.results);
      setSelected(new Set());
      onRefresh();
    } catch (reason) {
      setError(apiErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  const columns = view === "pending" ? 7 : 6;

  return <section className="panel table-panel" aria-label="Pending and exception events">
    <div className="table-toolbar">
      <div className="tab-list" role="tablist">
        <button className={view === "pending" ? "active" : ""} onClick={() => switchView("pending")} role="tab" aria-selected={view === "pending"}>Pending <b>{pending.length}</b></button>
        <button className={view === "exceptions" ? "active" : ""} onClick={() => switchView("exceptions")} role="tab" aria-selected={view === "exceptions"}>Exceptions <b>{exceptions.length}</b></button>
      </div>
      <div className="toolbar-actions">
        <button className="icon-button" onClick={onRefresh} title="Refresh" aria-label="Refresh"><RefreshCw size={15} /></button>
        {view === "pending" && <button className="primary compact-button" disabled={!effectiveSelection.length || busy} onClick={acknowledge}>
          <CheckCheck size={15} />{busy ? "Acknowledging…" : `Acknowledge ${effectiveSelection.length || ""}`}
        </button>}
      </div>
    </div>
    {error && <div className="alert error table-alert" role="alert">{error}</div>}
    {ackResults && <div className="inline-results" aria-live="polite">
      <strong>Last acknowledgement</strong>
      {ackResults.map((result, index) => <span key={`${result.event_id}-${index}`} title={result.message}><code>{result.event_id}</code> <StatusBadge status={result.status} /></span>)}
      <button className="text-button" onClick={() => setAckResults(null)}>Dismiss</button>
    </div>}
    {!rows.length ? <div className="empty"><Inbox size={30} /><strong>{view === "pending" ? "Review queue is clear" : "No exceptions recorded"}</strong><span>{view === "pending" ? "Completed COUNT and VOID events awaiting acknowledgement appear here." : "Unresolved references, rejected and conflicting submissions appear here with reasons."}</span></div> : <div className="table-scroll"><table>
      <thead><tr>
        {view === "pending" && <th className="check-col"><input type="checkbox" aria-label="Select all pending events" checked={allSelected} onChange={toggleAll} /></th>}
        <th className="expand-col"><span className="sr-only">Details</span></th>
        <th>Event</th><th>Source / type</th><th>Quantity / target</th><th>Event / receipt time</th><th>Status / reason</th>
      </tr></thead>
      <tbody>{rows.map((row) => {
        const open = expanded === row.id;
        return <Fragment key={row.id}>
          <tr className={open ? "is-open" : ""}>
            {view === "pending" && <td><input aria-label={`Select ${row.event_id}`} type="checkbox" checked={!!row.event_id && effectiveSelection.includes(row.event_id)} disabled={!row.event_id} onChange={() => row.event_id && toggle(row.event_id)} /></td>}
            <td><button className="expand-button" aria-expanded={open} aria-label={`${open ? "Hide" : "Show"} details for ${row.event_id ?? "invalid submission"}`} onClick={() => setExpanded(open ? null : row.id)}>{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button></td>
            <td><code>{row.event_id ?? "—"}</code></td>
            <td><strong>{row.source_id ?? "Unknown source"}</strong><small>{row.type ?? "Malformed"}</small></td>
            <td>{row.type === "COUNT" ? <><strong>{row.quantity === null ? "—" : `+${row.quantity.toLocaleString()}`}</strong><small>pieces</small></> : row.type === "VOID" ? <><code>{row.target_event_id ?? "—"}</code><small>target event</small></> : <small>—</small>}</td>
            <td><time>{formatTime(row.event_time)}</time><small>Received {formatTime(row.received_at)}</small></td>
            <td><StatusBadge status={row.status} />{row.reason && <small className="reason">{row.reason}</small>}</td>
          </tr>
          {open && <tr className="details-row"><td colSpan={columns}><RowDetails row={row} /></td></tr>}
        </Fragment>;
      })}</tbody>
    </table></div>}
  </section>;
}
