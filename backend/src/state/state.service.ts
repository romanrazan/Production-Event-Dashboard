import { Injectable } from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";
import { StateRepository } from "./state.repository";

@Injectable()
export class StateService {
  constructor(private readonly dataSource: DataSource, private readonly state: StateRepository) {}

  getSummary(sourceId?: string, manager?: EntityManager) {
    return manager ? this.state.summary(sourceId, manager) : this.dataSource.transaction("REPEATABLE READ", (tx) => this.state.summary(sourceId, tx));
  }
  getPending(sourceId?: string) {
    return this.dataSource.transaction("REPEATABLE READ", (tx) => this.state.pending(sourceId, tx));
  }
  getExceptions(sourceId?: string) {
    return this.dataSource.transaction("REPEATABLE READ", (tx) => this.state.exceptions(sourceId, tx));
  }
}
