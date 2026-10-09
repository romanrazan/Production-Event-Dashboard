import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";
import { EventResultStatus, SubmissionTransport } from "../../shared/contracts";

@Entity("submission_attempts")
@Index("idx_submission_attempts_event", ["eventId"])
@Index("idx_submission_attempts_source_class", ["sourceId", "classification"])
export class SubmissionAttemptEntity {
  @PrimaryGeneratedColumn({ type: "bigint" }) id!: string;
  @Column({ name: "event_id", type: "varchar", length: 160, nullable: true }) eventId!: string | null;
  @Column({ name: "source_id", type: "varchar", length: 120, nullable: true }) sourceId!: string | null;
  @Column({ type: "varchar", length: 30 }) classification!: EventResultStatus;
  @Column({ type: "text", nullable: true }) error!: string | null;
  @Column({ name: "raw_payload", type: "jsonb" }) rawPayload!: unknown;
  @Column({ name: "normalized_payload", type: "jsonb", nullable: true }) normalizedPayload!: Record<string, unknown> | null;
  @Column({ type: "varchar", length: 10 }) transport!: SubmissionTransport;
  @Column({ name: "challenge_id", type: "varchar", length: 180, nullable: true }) challengeId!: string | null;
  @CreateDateColumn({ name: "received_at", type: "timestamptz" }) receivedAt!: Date;
}
