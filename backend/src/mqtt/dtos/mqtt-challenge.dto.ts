import { ApiProperty } from "@nestjs/swagger";

export class MqttChallengeDto {
  @ApiProperty({ example: "1.0" }) protocol_version!: string;
  @ApiProperty({ example: "07" }) candidate_id!: string;
  @ApiProperty({ example: "CH-001" }) challenge_id!: string;
  @ApiProperty({ example: "PROCESS_EVENTS" }) command!: string;
  @ApiProperty() sent_at!: string;
  @ApiProperty() expires_at!: string;
  @ApiProperty({ type: [Object] }) events!: unknown[];
}
