import { IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class StateQueryDto {
  @IsOptional() @IsString() @MinLength(1) source_id?: string;
  @IsIn(["summary", "pending", "exceptions"]) view!: "summary" | "pending" | "exceptions";
}
