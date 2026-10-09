export function StatusBadge({ status }: { status: string }) {
  const tone = ["ACCEPTED", "ACKED", "COMPLETED", "ONLINE"].includes(status) ? "good"
    : ["PENDING_REFERENCE", "NOT_READY", "HEARTBEAT", "CONNECTING"].includes(status) ? "warn"
      : ["DUPLICATE", "ALREADY_ACKED", "DISABLED"].includes(status) ? "neutral" : "bad";
  return <span className={`status-badge ${tone}`}><i />{status.replaceAll("_", " ")}</span>;
}
