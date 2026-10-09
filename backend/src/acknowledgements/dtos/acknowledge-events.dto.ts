import { ApiProperty } from "@nestjs/swagger";
import { ArrayNotEmpty, IsArray, IsString } from "class-validator";

export class AcknowledgeEventsDto {
  @ApiProperty({ example: ["EV-101", "EV-102"] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  event_ids!: string[];
}
