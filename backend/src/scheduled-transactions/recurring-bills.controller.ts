import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Request,
  UseGuards,
  ParseUUIDPipe,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ParseCalendarDatePipe } from "../common/pipes/parse-calendar-date.pipe";
import { RecurringBillsReadService } from "./recurring-bills-read.service";
import { RecurringBillsCommandService } from "./recurring-bills-command.service";
import { RecurringBillBudgetService } from "./recurring-bill-budget.service";
import {
  CreateMonthlyBillDto,
  MonthlyBillAmountDto,
  MonthlyBillPaymentDto,
  MonthlyBillReserveDto,
  MonthlyBudgetDto,
  MonthlyBudgetRevisionDto,
} from "./dto/recurring-bills.dto";

@ApiTags("Recurring Bills")
@ApiBearerAuth()
@UseGuards(AuthGuard("jwt"))
@Controller("recurring-bills")
export class RecurringBillsController {
  constructor(
    private readonly read: RecurringBillsReadService,
    private readonly commands: RecurringBillsCommandService,
    private readonly budgets: RecurringBillBudgetService,
  ) {}

  @Get("months/:month")
  month(@Request() req, @Param("month", ParseCalendarDatePipe) month: string) {
    return this.read.month(req.user.id, month);
  }
  @Post()
  create(@Request() req, @Body() dto: CreateMonthlyBillDto) {
    return this.commands.create(req.user.id, dto);
  }

  @Post(":id/adopt")
  adopt(@Request() req, @Param("id", ParseUUIDPipe) id: string) {
    return this.commands.adopt(req.user.id, id);
  }

  @Patch(":id/occurrences/:date/amount")
  amount(
    @Request() req,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("date", ParseCalendarDatePipe) date: string,
    @Body() dto: MonthlyBillAmountDto,
  ) {
    return this.commands.amount(req.user.id, id, date, dto);
  }

  @Patch(":id/occurrences/:date/reservation")
  reserve(
    @Request() req,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("date", ParseCalendarDatePipe) date: string,
    @Body() dto: MonthlyBillReserveDto,
  ) {
    return this.commands.reserve(req.user.id, id, date, dto);
  }

  @Post(":id/occurrences/:date/payment")
  pay(
    @Request() req,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("date", ParseCalendarDatePipe) date: string,
    @Body() dto: MonthlyBillPaymentDto,
  ) {
    return this.commands.pay(req.user.id, id, date, dto);
  }

  @Put("months/:month/budget")
  budget(
    @Request() req,
    @Param("month", ParseCalendarDatePipe) month: string,
    @Body() dto: MonthlyBudgetDto,
  ) {
    return this.budgets.save(req.user.id, month, dto.amount, dto.revision);
  }
  @Post("months/:month/budget/remove")
  removeBudget(
    @Request() req,
    @Param("month", ParseCalendarDatePipe) month: string,
    @Body() dto: MonthlyBudgetRevisionDto,
  ) {
    return this.budgets.save(req.user.id, month, null, dto.revision);
  }
}
