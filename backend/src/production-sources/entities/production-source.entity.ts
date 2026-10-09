import { Column, CreateDateColumn, Entity, PrimaryColumn } from "typeorm";

@Entity("production_sources")
export class ProductionSourceEntity {
  @PrimaryColumn({ name: "source_id", type: "varchar", length: 120 })
  sourceId!: string;

  @Column({ name: "display_name", type: "varchar", length: 200 })
  displayName!: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
