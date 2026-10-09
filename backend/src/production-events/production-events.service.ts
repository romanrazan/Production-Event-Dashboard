import { Injectable } from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";
import { AuditService } from "../audit/audit.service";
import { ProductionSourcesService } from "../production-sources/production-sources.service";
import { ClockService } from "../shared/clock.service";
import { EventResult, EventResultStatus, SubmissionTransport } from "../shared/contracts";
import { NormalizedProductionEvent } from "./domain/model";
import { eventFingerprint } from "./domain/normalization";
import { validateEvent } from "./domain/validation";
import { ProductionEventEntity } from "./entities/production-event.entity";
import { ProductionEventsRepository } from "./production-events.repository";
import { runWithRetry } from "../database/transaction";

export interface ProcessContext {
  transport: SubmissionTransport;
  challengeId?: string;
}

@Injectable()
export class ProductionEventsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly events: ProductionEventsRepository,
    private readonly sources: ProductionSourcesService,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
  ) {}

  processBatch(items: unknown[], context: ProcessContext, manager?: EntityManager): Promise<EventResult[]> {
    if (manager) return this.processBatchInTransaction(items, context, manager);
    return runWithRetry(this.dataSource, (transaction) => this.processBatchInTransaction(items, context, transaction));
  }

  private async processBatchInTransaction(
    items: unknown[],
    context: ProcessContext,
    manager: EntityManager,
  ): Promise<EventResult[]> {
    const validations = items.map(validateEvent);
    const lockIds = validations.flatMap((item) =>
      item.ok ? [item.value.event_id, ...(item.value.target_event_id ? [item.value.target_event_id] : [])] : [],
    );
    await this.events.lockLogicalIds(lockIds, manager);
    const results: EventResult[] = [];
    for (let index = 0; index < items.length; index += 1) {
      const validation = validations[index];
      const raw = items[index];
      if (!validation) throw new Error("Missing validation result");
      if (!validation.ok) {
        await this.audit.record(
          {
            eventId: validation.eventId,
            sourceId: validation.sourceId,
            classification: "REJECTED",
            error: validation.reason,
            rawPayload: raw,
            normalizedPayload: null,
            transport: context.transport,
            challengeId: context.challengeId ?? null,
          },
          manager,
        );
        results.push({ event_id: validation.eventId, status: "REJECTED", message: validation.reason });
        continue;
      }
      results.push(await this.processEvent(validation.value, raw, context, manager));
    }
    return results;
  }

  async processEvent(
    event: NormalizedProductionEvent,
    raw: unknown,
    context: ProcessContext,
    manager: EntityManager,
  ): Promise<EventResult> {
    const fingerprint = eventFingerprint(event);
    const existing = await this.events.findByEventId(event.event_id, manager, true);
    if (existing) {
      const status: EventResultStatus = existing.payloadFingerprint === fingerprint ? "DUPLICATE" : "CONFLICT";
      const message = status === "DUPLICATE" ? "Identical event already received; no effects repeated" : "event_id already belongs to different normalized data";
      await this.recordAttempt(event, raw, status, message, context, manager);
      return { event_id: event.event_id, status, message };
    }

    await this.sources.ensure(event.source_id, manager);
    const result = event.type === "COUNT"
      ? await this.processCount(event, raw, manager)
      : await this.processVoid(event, raw, manager);
    await this.recordAttempt(event, raw, result.status, result.message, context, manager);
    return result;
  }

  private async processCount(event: NormalizedProductionEvent, raw: unknown, manager: EntityManager): Promise<EventResult> {
    const now = this.clock.now();
    const count = await this.events.create(
      {
        eventId: event.event_id,
        sourceId: event.source_id,
        type: "COUNT",
        quantity: event.quantity,
        targetEventId: null,
        eventTime: new Date(event.event_time),
        status: "ACCEPTED",
        reason: null,
        normalizedPayload: event,
        payloadFingerprint: eventFingerprint(event),
        rawPayload: raw,
        reversedByEventId: null,
        completedAt: now,
        acknowledgedAt: null,
      },
      manager,
    );
    await this.resolvePendingVoids(count, manager);
    return { event_id: event.event_id, status: "ACCEPTED", message: "COUNT processed" };
  }

  private async processVoid(event: NormalizedProductionEvent, raw: unknown, manager: EntityManager): Promise<EventResult> {
    const target = await this.events.findByEventId(event.target_event_id!, manager, true);
    const base: Partial<ProductionEventEntity> = {
      eventId: event.event_id,
      sourceId: event.source_id,
      type: "VOID",
      quantity: null,
      targetEventId: event.target_event_id,
      eventTime: new Date(event.event_time),
      normalizedPayload: event,
      payloadFingerprint: eventFingerprint(event),
      rawPayload: raw,
      reversedByEventId: null,
      acknowledgedAt: null,
    };
    let result: EventResult;
    if (!target) {
      await this.events.create({ ...base, status: "PENDING_REFERENCE", reason: "Target COUNT has not arrived", completedAt: null }, manager);
      result = { event_id: event.event_id, status: "PENDING_REFERENCE", message: "Stored until the target COUNT arrives" };
    } else {
      const rejection = this.voidRejection(target, event.source_id);
      if (rejection) {
        await this.events.create({ ...base, status: "REJECTED", reason: rejection, completedAt: null }, manager);
        result = { event_id: event.event_id, status: "REJECTED", message: rejection };
      } else {
        target.reversedByEventId = event.event_id;
        await this.events.save(target, manager);
        await this.events.create({ ...base, status: "ACCEPTED", reason: null, completedAt: this.clock.now() }, manager);
        result = { event_id: event.event_id, status: "ACCEPTED", message: "VOID applied" };
      }
    }
    await this.rejectPendingVoidsTargetingVoid(event.event_id, manager);
    return result;
  }

  /** A pending VOID whose target turns out to be a VOID can never resolve; close it with a reason. */
  private async rejectPendingVoidsTargetingVoid(voidEventId: string, manager: EntityManager): Promise<void> {
    for (const candidate of await this.events.pendingVoids(voidEventId, manager)) {
      candidate.status = "REJECTED";
      candidate.reason = "VOID target must be a COUNT";
      await this.events.save(candidate, manager);
    }
  }

  /** First stored (lowest id) same-source pending VOID wins; others are rejected with reasons. */
  async resolvePendingVoids(count: ProductionEventEntity, manager: EntityManager): Promise<void> {
    const candidates = await this.events.pendingVoids(count.eventId, manager);
    let winner: ProductionEventEntity | null = null;
    for (const candidate of candidates) {
      if (candidate.sourceId !== count.sourceId) {
        candidate.status = "REJECTED";
        candidate.reason = "VOID source_id must match the target COUNT source_id";
      } else if (!winner) {
        winner = candidate;
        candidate.status = "ACCEPTED";
        candidate.reason = null;
        candidate.completedAt = this.clock.now();
        count.reversedByEventId = candidate.eventId;
      } else {
        candidate.status = "REJECTED";
        candidate.reason = `Target COUNT was already reversed by ${winner.eventId}`;
      }
      await this.events.save(candidate, manager);
    }
    if (winner) await this.events.save(count, manager);
  }

  private voidRejection(target: ProductionEventEntity, sourceId: string): string | null {
    if (target.type !== "COUNT") return "VOID target must be a COUNT";
    if (target.sourceId !== sourceId) return "VOID source_id must match the target COUNT source_id";
    if (target.status !== "ACCEPTED") return "Target COUNT is not successfully processed";
    if (target.reversedByEventId) return `Target COUNT was already reversed by ${target.reversedByEventId}`;
    return null;
  }

  private async recordAttempt(
    event: NormalizedProductionEvent,
    raw: unknown,
    classification: EventResultStatus,
    message: string,
    context: ProcessContext,
    manager: EntityManager,
  ) {
    await this.audit.record(
      {
        eventId: event.event_id,
        sourceId: event.source_id,
        classification,
        error: classification === "ACCEPTED" || classification === "PENDING_REFERENCE" ? null : message,
        rawPayload: raw,
        normalizedPayload: event,
        transport: context.transport,
        challengeId: context.challengeId ?? null,
      },
      manager,
    );
  }
}
