// src/modules/chart-of-accounts/chart-of-accounts.module.ts
import { Module } from '@nestjs/common';
import { AccountsService } from './services/accounts.service';
import { FiscalPeriodsService } from './services/fiscal-periods.service';
import { AccountsController } from './controllers/accounts.controller';
import { FiscalPeriodsController } from './controllers/fiscal-periods.controller';

@Module({
  providers: [AccountsService, FiscalPeriodsService],
  controllers: [AccountsController, FiscalPeriodsController],
  exports: [AccountsService, FiscalPeriodsService],
})
export class ChartOfAccountsModule {}
