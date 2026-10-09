import { api } from "@/lib/api/client";
import { acknowledgementResponseSchema, eventResponseSchema, mqttStatusSchema, stateRowSchema, stateSummarySchema } from "@/schemas/production";

const sourceParams = (sourceId?: string) => sourceId ? { source_id: sourceId } : {};

export async function getSummary(sourceId?: string, signal?: AbortSignal) {
  const { data } = await api.get("/state", { params: { view: "summary", ...sourceParams(sourceId) }, signal });
  return stateSummarySchema.parse(data);
}
export async function getPending(sourceId?: string, signal?: AbortSignal) {
  const { data } = await api.get("/state", { params: { view: "pending", ...sourceParams(sourceId) }, signal });
  return stateRowSchema.array().parse(data);
}
export async function getExceptions(sourceId?: string, signal?: AbortSignal) {
  const { data } = await api.get("/state", { params: { view: "exceptions", ...sourceParams(sourceId) }, signal });
  return stateRowSchema.array().parse(data);
}
export async function getMqttStatus(signal?: AbortSignal) {
  const { data } = await api.get("/mqtt/status", { signal });
  return mqttStatusSchema.parse(data);
}
export async function submitEvents(payload: unknown) {
  const { data } = await api.post("/events", payload);
  return eventResponseSchema.parse(data);
}
export async function acknowledgeEvents(eventIds: string[]) {
  const { data } = await api.post("/ack", { event_ids: eventIds });
  return acknowledgementResponseSchema.parse(data);
}
