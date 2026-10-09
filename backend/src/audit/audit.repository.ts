import { Injectable } from "@nestjs/common";
import { EntityManager } from "typeorm";
import { EventResultStatus, SubmissionTransport } from "../shared/contracts";
import { SubmissionAttemptEntity } from "./entities/submission-attempt.entity";

export interface AttemptInput {
  eventId: string | null;
  sourceId: string | null;
  classification: EventResultStatus;
  error: string | null;
  rawPayload: unknown;
  normalizedPayload: Record<string, unknown> | null;
  transport: SubmissionTransport;
  challengeId: string | null;
}

@Injectable()
export class AuditRepository {
  async create(input: AttemptInput, manager: EntityManager): Promise<SubmissionAttemptEntity> {
    return manager.save(SubmissionAttemptEntity, manager.create(SubmissionAttemptEntity, input));
  }
}
