import { z } from "zod";

export const stateSummarySchema = z.object({
  net_total: z.number(), processed_events: z.number(), pending_ack: z.number(),
  unresolved: z.number(), duplicates: z.number(), conflicts: z.number(),
  rejected_submissions: z.number(),
});

export const eventResultSchema = z.object({
  event_id: z.string().nullable(),
  status: z.enum(["ACCEPTED", "DUPLICATE", "CONFLICT", "PENDING_REFERENCE", "REJECTED"]),
  message: z.string(),
});
export const eventResponseSchema = z.object({ results: z.array(eventResultSchema) });

export const stateRowSchema = z.object({
  id: z.string(), event_id: z.string().nullable(), source_id: z.string().nullable(),
  type: z.string().nullable(), quantity: z.number().nullable(), target_event_id: z.string().nullable(),
  event_time: z.string().nullable(), received_at: z.string(), status: z.string(), reason: z.string().nullable(),
  acknowledged_at: z.string().nullable().optional(),
});

export const acknowledgementResponseSchema = z.object({
  results: z.array(z.object({
    event_id: z.string(), status: z.enum(["ACKED", "ALREADY_ACKED", "NOT_READY", "NOT_FOUND"]), message: z.string(),
  })),
});

export const mqttStatusSchema = z.object({
  enabled: z.boolean(), connected: z.boolean(), subscribed: z.boolean(), broker_url: z.string(),
  candidate_id: z.string(), client_id: z.string().nullable(),
  topics: z.object({ challenge: z.string(), response: z.string(), status: z.string() }),
  last_connected_at: z.string().nullable(), last_heartbeat_at: z.string().nullable(), reconnect_attempts: z.number(),
  last_challenge_id: z.string().nullable(), last_challenge_at: z.string().nullable(),
  last_response_status: z.string().nullable(), last_error: z.string().nullable(),
  challenge_counts: z.object({ completed: z.number(), failed: z.number(), total: z.number(), unpublished: z.number() }),
});
