import { ApiProperty } from "@nestjs/swagger";
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsString } from "class-validator";

export class AcknowledgeEventsDto {
  @ApiProperty({ example: ["EV-101", "EV-102"] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  event_ids!: string[];
}
