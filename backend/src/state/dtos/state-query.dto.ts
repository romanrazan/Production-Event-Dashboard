import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class StateQueryDto {
  @IsOptional() @IsString() @MinLength(1) source_id?: string;
  @IsIn(["summary", "pending", "exceptions"]) view!: "summary" | "pending" | "exceptions";
}

/** Swagger schema for view=summary (seven metrics). */
export class StateSummaryDto {
  @ApiProperty() net_total!: number;
  @ApiProperty() processed_events!: number;
  @ApiProperty() pending_ack!: number;
  @ApiProperty() unresolved!: number;
  @ApiProperty() duplicates!: number;
  @ApiProperty() conflicts!: number;
  @ApiProperty({ description: "Stored submission attempts classified REJECTED (filtered by attempted source_id)" })
  rejected_submissions!: number;
}
