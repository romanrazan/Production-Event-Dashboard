import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { LogicalEventStatus, ProductionEventType } from "../domain/model";

@Entity("production_events")
@Index("uq_production_events_event_id", ["eventId"], { unique: true })
@Index("idx_production_events_target", ["targetEventId"])
@Index("idx_production_events_source_status", ["sourceId", "status"])
export class ProductionEventEntity {
  @PrimaryGeneratedColumn({ type: "bigint" }) id!: string;
  @Column({ name: "event_id", type: "varchar", length: 160 }) eventId!: string;
  @Column({ name: "source_id", type: "varchar", length: 120 }) sourceId!: string;
  @Column({ type: "varchar", length: 10 }) type!: ProductionEventType;
  @Column({ type: "integer", nullable: true }) quantity!: number | null;
  @Column({ name: "target_event_id", type: "varchar", length: 160, nullable: true }) targetEventId!: string | null;
  @Column({ name: "event_time", type: "timestamptz" }) eventTime!: Date;
  @CreateDateColumn({ name: "received_at", type: "timestamptz" }) receivedAt!: Date;
  @Column({ type: "varchar", length: 30 }) status!: LogicalEventStatus;
  @Column({ type: "text", nullable: true }) reason!: string | null;
  @Column({ name: "normalized_payload", type: "jsonb" }) normalizedPayload!: Record<string, unknown>;
  @Column({ name: "payload_fingerprint", type: "char", length: 64 }) payloadFingerprint!: string;
  @Column({ name: "raw_payload", type: "jsonb" }) rawPayload!: unknown;
  @Column({ name: "reversed_by_event_id", type: "varchar", length: 160, nullable: true }) reversedByEventId!: string | null;
  @Column({ name: "completed_at", type: "timestamptz", nullable: true }) completedAt!: Date | null;
  @Column({ name: "acknowledged_at", type: "timestamptz", nullable: true }) acknowledgedAt!: Date | null;
  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" }) updatedAt!: Date;
}
