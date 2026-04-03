// src/modules/financial-reports/financial-reports.module.ts
import { Module } from '@nestjs/common';
import { ReportsController } from './controllers/reports.controller';
import { BalanceSheetService } from './services/balance-sheet.service';
import { ProfitLossService } from './services/profit-loss.service';
import { TrialBalanceService } from './services/trial-balance.service';
import { CashFlowService } from './services/cash-flow.service';
import { ReportExportService } from './services/report-export.service';

@Module({
  controllers: [ReportsController],
  providers: [
    BalanceSheetService,
    ProfitLossService,
    TrialBalanceService,
    CashFlowService,
    ReportExportService,
  ],
  exports: [BalanceSheetService, ProfitLossService, TrialBalanceService, CashFlowService],
})
export class FinancialReportsModule {}
