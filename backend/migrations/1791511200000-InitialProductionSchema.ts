import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialProductionSchema1791511200000 implements MigrationInterface {
  name = "InitialProductionSchema1791511200000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE production_sources (
        source_id varchar(120) PRIMARY KEY,
        display_name varchar(200) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE production_events (
        id bigserial PRIMARY KEY,
        event_id varchar(160) NOT NULL,
        source_id varchar(120) NOT NULL REFERENCES production_sources(source_id),
        type varchar(10) NOT NULL CHECK (type IN ('COUNT','VOID')),
        quantity integer NULL,
        target_event_id varchar(160) NULL,
        event_time timestamptz NOT NULL,
        received_at timestamptz NOT NULL DEFAULT now(),
        status varchar(30) NOT NULL CHECK (status IN ('ACCEPTED','PENDING_REFERENCE','REJECTED')),
        reason text NULL,
        normalized_payload jsonb NOT NULL,
        payload_fingerprint char(64) NOT NULL,
        raw_payload jsonb NOT NULL,
        reversed_by_event_id varchar(160) NULL,
        completed_at timestamptz NULL,
        acknowledged_at timestamptz NULL,
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_production_events_event_id UNIQUE (event_id),
        CONSTRAINT ck_production_event_shape CHECK (
          (type = 'COUNT' AND quantity > 0 AND target_event_id IS NULL)
          OR (type = 'VOID' AND quantity IS NULL AND target_event_id IS NOT NULL)
        )
      );
      CREATE UNIQUE INDEX uq_production_events_reversed_by
        ON production_events(reversed_by_event_id) WHERE reversed_by_event_id IS NOT NULL;
      CREATE UNIQUE INDEX uq_successful_void_target
        ON production_events(target_event_id) WHERE type = 'VOID' AND status = 'ACCEPTED';
      CREATE INDEX idx_production_events_target ON production_events(target_event_id);
      CREATE INDEX idx_production_events_source_status ON production_events(source_id, status);
      CREATE TABLE submission_attempts (
        id bigserial PRIMARY KEY,
        event_id varchar(160) NULL,
        source_id varchar(120) NULL,
        classification varchar(30) NOT NULL CHECK (classification IN ('ACCEPTED','DUPLICATE','CONFLICT','PENDING_REFERENCE','REJECTED')),
        error text NULL,
        raw_payload jsonb NOT NULL,
        normalized_payload jsonb NULL,
        transport varchar(10) NOT NULL CHECK (transport IN ('REST','MQTT')),
        challenge_id varchar(180) NULL,
        received_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_submission_attempts_event ON submission_attempts(event_id);
      CREATE INDEX idx_submission_attempts_source_class ON submission_attempts(source_id, classification);
      CREATE TABLE mqtt_challenges (
        challenge_id varchar(180) PRIMARY KEY,
        request_digest char(64) NOT NULL,
        request_payload jsonb NOT NULL,
        response_payload text NULL,
        status varchar(20) NOT NULL CHECK (status IN ('PROCESSING','COMPLETED','FAILED')),
        received_at timestamptz NOT NULL DEFAULT now(),
        processed_at timestamptz NULL,
        publish_attempted_at timestamptz NULL,
        published_at timestamptz NULL,
        publish_error text NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE IF EXISTS mqtt_challenges, submission_attempts, production_events, production_sources CASCADE");
  }
}
