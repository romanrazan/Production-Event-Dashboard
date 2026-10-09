import { Injectable } from "@nestjs/common";
import { EntityManager } from "typeorm";
import { MqttChallengeEntity } from "./entities/mqtt-challenge.entity";

@Injectable()
export class MqttRepository {
  async lockChallenge(challengeId: string, manager: EntityManager): Promise<void> {
    await manager.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`mqtt-challenge:${challengeId}`]);
  }

  find(challengeId: string, manager: EntityManager) {
    return manager.getRepository(MqttChallengeEntity).findOneBy({ challengeId });
  }

  create(values: Partial<MqttChallengeEntity>, manager: EntityManager) {
    return manager.save(MqttChallengeEntity, manager.create(MqttChallengeEntity, values));
  }

  save(challenge: MqttChallengeEntity, manager: EntityManager) {
    return manager.save(MqttChallengeEntity, challenge);
  }

  async challengeCounts(manager: EntityManager): Promise<{ completed: number; failed: number; total: number }> {
    const rows = await manager.query(`SELECT COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status='COMPLETED')::int AS completed,
      COUNT(*) FILTER (WHERE status='FAILED')::int AS failed FROM mqtt_challenges`) as Array<{ completed: number; failed: number; total: number }>;
    return rows[0] ?? { completed: 0, failed: 0, total: 0 };
  }
}
