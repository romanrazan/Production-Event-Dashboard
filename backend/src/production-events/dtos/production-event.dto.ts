import { ApiProperty } from "@nestjs/swagger";

export class ProductionEventDto {
  @ApiProperty({ example: "LINE-01" }) source_id!: string;
  @ApiProperty({ example: "EV-101" }) event_id!: string;
  @ApiProperty({ enum: ["COUNT", "VOID"] }) type!: "COUNT" | "VOID";
  @ApiProperty({ nullable: true, example: 5 }) quantity?: number | null;
  @ApiProperty({ nullable: true, example: null }) target_event_id?: string | null;
  @ApiProperty({ example: "2026-10-09T10:30:00Z" }) event_time!: string;
}
