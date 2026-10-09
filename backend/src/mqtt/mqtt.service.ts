import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";
import { runWithRetry } from "../database/transaction";
import { canonicalJson } from "../production-events/domain/normalization";
import { ProductionEventsService } from "../production-events/production-events.service";
import { ClockService } from "../shared/clock.service";
import { StateService } from "../state/state.service";
import { MqttRepository } from "./mqtt.repository";
import { validateChallenge } from "./protocol/challenge-validation";
import { MqttErrorCode, MqttFailedResponse, MqttResponse } from "./protocol/mqtt-contracts";

export interface HandledChallenge {
  /** Primary key in mqtt_challenges, or null when the response was not persisted (conflict). */
  storageId: string | null;
  response: MqttResponse;
  replayed: boolean;
}

export interface UnpublishedResponse { storageId: string; payload: string }

@Injectable()
export class MqttService {
  readonly candidateId = process.env.MQTT_CANDIDATE_ID ?? "07";

  constructor(
    private readonly dataSource: DataSource,
    private readonly repository: MqttRepository,
    private readonly events: ProductionEventsService,
    private readonly state: StateService,
    private readonly clock: ClockService,
  ) {}

  /**
   * Validates, processes and persists one challenge atomically. Event effects, their
   * submission attempts and the exact serialized response commit in ONE transaction, so a
   * crash can never leave processed events without a stored response (or vice versa).
   * The caller publishes only after this resolves, i.e. after commit.
   */
  async handleMqttChallenge(raw: unknown): Promise<HandledChallenge> {
    const body = raw === undefined ? null : raw;
    const digest = createHash("sha256").update(canonicalJson(body)).digest("hex");
    const suppliedId = body && typeof body === "object" && !Array.isArray(body)
      && typeof (body as Record<string, unknown>).challenge_id === "string"
      && ((body as Record<string, unknown>).challenge_id as string).trim() !== ""
      ? ((body as Record<string, unknown>).challenge_id as string) : null;
    const storageId = (suppliedId ?? `INVALID-${digest.slice(0, 32)}`).slice(0, 180);
    return runWithRetry(this.dataSource, (manager) => this.handleInTransaction(body, storageId, digest, manager));
  }

  private async handleInTransaction(
    raw: unknown,
    storageId: string,
    digest: string,
    manager: EntityManager,
  ): Promise<HandledChallenge> {
    // Serializes concurrent duplicate deliveries of the same challenge_id; the primary key is the final guard.
    await this.repository.lockChallenge(storageId, manager);
    const existing = await this.repository.find(storageId, manager);
    if (existing) {
      if (existing.requestDigest !== digest) {
        // The original challenge, its effects and its response stay untouched.
        return { storageId: null, response: this.failed(storageId, "CHALLENGE_CONFLICT", "challenge_id was already used with a different body"), replayed: false };
      }
      if (!existing.responsePayload) throw new Error("Stored challenge is missing its response payload");
      // Replay precedence: an identical, already handled challenge returns its original response
      // (same processed_at and state snapshot) even if it has expired since.
      return { storageId, response: JSON.parse(existing.responsePayload) as MqttResponse, replayed: true };
    }

    const validation = validateChallenge(raw, this.candidateId, this.clock.now());
    if (!validation.ok) {
      const response = this.failed(validation.challengeId, validation.code, validation.message);
      await this.persistNew(storageId, digest, raw, response, "FAILED", manager);
      return { storageId, response, replayed: false };
    }

    const results = await this.events.processBatch(
      validation.value.events,
      { transport: "MQTT", challengeId: validation.value.challenge_id },
      manager,
    );
    const processedAt = this.clock.now();
    const response: MqttResponse = {
      protocol_version: "1.0",
      candidate_id: this.candidateId,
      challenge_id: validation.value.challenge_id,
      status: "COMPLETED",
      processed_at: processedAt.toISOString(),
      results,
      state: await this.state.getSummary(undefined, manager),
    };
    await this.persistNew(storageId, digest, raw, response, "COMPLETED", manager, processedAt);
    return { storageId, response, replayed: false };
  }

  /** Response for an infrastructure failure. Not persisted, so a redelivery can be processed normally. */
  internalError(raw: unknown, message = "Challenge could not be processed"): MqttFailedResponse {
    const challengeId = raw && typeof raw === "object" && !Array.isArray(raw)
      && typeof (raw as Record<string, unknown>).challenge_id === "string"
      ? ((raw as Record<string, unknown>).challenge_id as string) : null;
    return this.failed(challengeId, "INTERNAL_ERROR", message);
  }

  private failed(challengeId: string | null, errorCode: MqttErrorCode, message: string): MqttFailedResponse {
    return {
      protocol_version: "1.0",
      candidate_id: this.candidateId,
      challenge_id: challengeId,
      status: "FAILED",
      processed_at: this.clock.now().toISOString(),
      error_code: errorCode,
      message,
    };
  }

  private async persistNew(
    challengeId: string,
    digest: string,
    raw: unknown,
    response: MqttResponse,
    status: "COMPLETED" | "FAILED",
    manager: EntityManager,
    processedAt = this.clock.now(),
  ) {
    await this.repository.create(
      {
        challengeId,
        requestDigest: digest,
        requestPayload: raw,
        responsePayload: JSON.stringify(response),
        status,
        processedAt,
        publishAttemptedAt: null,
        publishedAt: null,
        publishError: null,
      },
      manager,
    );
  }

  /** Records the outcome of a publish attempt; a failure leaves published_at NULL for a later retry. */
  async recordPublish(storageId: string | null, error?: string): Promise<void> {
    if (!storageId) return;
    await this.dataSource.transaction(async (manager) => {
      await this.repository.recordPublish(storageId, this.clock.now(), error ?? null, manager);
    });
  }

  /** Stored responses whose publication has not been confirmed by the broker yet. */
  unpublishedResponses(limit = 50): Promise<UnpublishedResponse[]> {
    return this.dataSource.transaction((manager) => this.repository.unpublished(limit, manager));
  }

  getChallengeCounts() {
    return this.dataSource.transaction((manager) => this.repository.challengeCounts(manager));
  }
}
