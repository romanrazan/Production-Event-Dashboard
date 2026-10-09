import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";
import { canonicalJson } from "../production-events/domain/normalization";
import { ProductionEventsService } from "../production-events/production-events.service";
import { ClockService } from "../shared/clock.service";
import { StateService } from "../state/state.service";
import { MqttRepository } from "./mqtt.repository";
import { validateChallenge } from "./protocol/challenge-validation";
import { MqttErrorCode, MqttFailedResponse, MqttResponse } from "./protocol/mqtt-contracts";

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

  async handleMqttChallenge(raw: unknown): Promise<{ response: MqttResponse; replayed: boolean }> {
    const digest = createHash("sha256").update(canonicalJson(raw)).digest("hex");
    const suppliedId = raw && typeof raw === "object" && !Array.isArray(raw) && typeof (raw as any).challenge_id === "string"
      ? String((raw as any).challenge_id) : null;
    const storageId = suppliedId || `INVALID-${digest.slice(0, 32)}`;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.dataSource.transaction("SERIALIZABLE", (manager) =>
          this.handleInTransaction(raw ?? null, storageId, digest, manager),
        );
      } catch (error) {
        const code = (error as { code?: string }).code;
        if ((code === "40001" || code === "40P01") && attempt < 2) continue;
        throw error;
      }
    }
    throw new Error("Unreachable MQTT transaction retry state");
  }

  private async handleInTransaction(
    raw: unknown,
    storageId: string,
    digest: string,
    manager: EntityManager,
  ): Promise<{ response: MqttResponse; replayed: boolean }> {
    await this.repository.lockChallenge(storageId, manager);
    const existing = await this.repository.find(storageId, manager);
    if (existing) {
      if (existing.requestDigest !== digest) {
        return { response: this.failed(storageId, "CHALLENGE_CONFLICT", "challenge_id was already used with a different body"), replayed: false };
      }
      if (!existing.responsePayload) throw new Error("Stored challenge is missing its response payload");
      return { response: JSON.parse(existing.responsePayload) as MqttResponse, replayed: true };
    }

    const validation = validateChallenge(raw, this.candidateId, this.clock.now());
    if (!validation.ok) {
      const response = this.failed(validation.challengeId, validation.code, validation.message);
      await this.persistNew(storageId, digest, raw, response, "FAILED", manager);
      return { response, replayed: false };
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
    return { response, replayed: false };
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

  async recordPublish(challengeId: string | null, error?: string): Promise<void> {
    if (!challengeId) return;
    await this.dataSource.transaction(async (manager) => {
      const challenge = await this.repository.find(challengeId, manager);
      if (!challenge) return;
      challenge.publishAttemptedAt = this.clock.now();
      challenge.publishError = error ?? null;
      if (!error) challenge.publishedAt = this.clock.now();
      await this.repository.save(challenge, manager);
    });
  }

  getChallengeCounts() {
    return this.dataSource.transaction((manager) => this.repository.challengeCounts(manager));
  }
}
