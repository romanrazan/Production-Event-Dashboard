import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * COUNT quantity is validated as a positive JavaScript safe integer, which exceeds PostgreSQL integer.
 * Widening to bigint keeps every valid quantity storable instead of surfacing a database error.
 */
export class WidenQuantityAndAuditIndexes1791600000000 implements MigrationInterface {
  name = "WidenQuantityAndAuditIndexes1791600000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE production_events ALTER COLUMN quantity TYPE bigint;
      ALTER TABLE production_events ADD CONSTRAINT ck_production_event_quantity_safe
        CHECK (quantity IS NULL OR quantity <= 9007199254740991);
      CREATE INDEX idx_submission_attempts_challenge ON submission_attempts(challenge_id) WHERE challenge_id IS NOT NULL;
      CREATE INDEX idx_mqtt_challenges_unpublished ON mqtt_challenges(received_at) WHERE published_at IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_mqtt_challenges_unpublished;
      DROP INDEX IF EXISTS idx_submission_attempts_challenge;
      ALTER TABLE production_events DROP CONSTRAINT IF EXISTS ck_production_event_quantity_safe;
      ALTER TABLE production_events ALTER COLUMN quantity TYPE integer;
    `);
  }
}
