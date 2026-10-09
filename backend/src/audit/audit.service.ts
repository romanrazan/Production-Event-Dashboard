import { Injectable } from "@nestjs/common";
import { EntityManager } from "typeorm";
import { AttemptInput, AuditRepository } from "./audit.repository";

@Injectable()
export class AuditService {
  constructor(private readonly attempts: AuditRepository) {}
  record(input: AttemptInput, manager: EntityManager) {
    return this.attempts.create(input, manager);
  }
}
