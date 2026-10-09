import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";

export type MqttChallengeStatus = "PROCESSING" | "COMPLETED" | "FAILED";

@Entity("mqtt_challenges")
export class MqttChallengeEntity {
  @PrimaryColumn({ name: "challenge_id", type: "varchar", length: 180 }) challengeId!: string;
  @Column({ name: "request_digest", type: "char", length: 64 }) requestDigest!: string;
  @Column({ name: "request_payload", type: "jsonb" }) requestPayload!: unknown;
  @Column({ name: "response_payload", type: "text", nullable: true }) responsePayload!: string | null;
  @Column({ type: "varchar", length: 20 }) status!: MqttChallengeStatus;
  @CreateDateColumn({ name: "received_at", type: "timestamptz" }) receivedAt!: Date;
  @Column({ name: "processed_at", type: "timestamptz", nullable: true }) processedAt!: Date | null;
  @Column({ name: "publish_attempted_at", type: "timestamptz", nullable: true }) publishAttemptedAt!: Date | null;
  @Column({ name: "published_at", type: "timestamptz", nullable: true }) publishedAt!: Date | null;
  @Column({ name: "publish_error", type: "text", nullable: true }) publishError!: string | null;
  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" }) updatedAt!: Date;
}
