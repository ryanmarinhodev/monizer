import {
  IsBoolean,
  IsInt,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { IsCalendarDate } from "../../common/validators/is-calendar-date.validator";
import { IsMoneyAmount } from "../../common/validators/is-money-amount.validator";
import { SanitizeHtml } from "../../common/decorators/sanitize-html.decorator";

export class CreateMonthlyBillDto {
  @IsUUID() accountId: string;
  @IsString() @MinLength(1) @MaxLength(100) @SanitizeHtml() name: string;
  @IsMoneyAmount(4) @Min(0.0001) @Max(999999999999) amount: number;
  @IsCalendarDate() firstDueDate: string;
}
export class MonthlyBillRevisionDto {
  @IsString() @Length(64, 64) revision: string;
}
export class MonthlyBillAmountDto extends MonthlyBillRevisionDto {
  @IsMoneyAmount(4) @Min(0.0001) @Max(999999999999) amount: number;
}
export class MonthlyBillReserveDto extends MonthlyBillRevisionDto {
  @IsBoolean() reserved: boolean;
}
export class MonthlyBillPaymentDto extends MonthlyBillAmountDto {
  @IsCalendarDate() paymentDate: string;
}
export class MonthlyBudgetRevisionDto {
  @IsInt() @Min(0) @Max(2147483646) revision: number;
}
export class MonthlyBudgetDto extends MonthlyBudgetRevisionDto {
  @IsMoneyAmount(4) @Min(0) @Max(999999999999) amount: number;
}
