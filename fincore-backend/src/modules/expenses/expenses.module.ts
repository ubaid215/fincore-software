/**
 * src/modules/expenses/expenses.module.ts
 * Sprint: S3 · Week 7–8
 */

import { Module } from '@nestjs/common';
import { ExpensesService } from './services/expenses.service';
import { ReceiptsService } from './services/receipts.service';
import { ExpensesController } from './controllers/expenses.controller';
import { GeneralLedgerModule } from '../general-ledger/general-ledger.module';

@Module({
  imports: [GeneralLedgerModule], // for GL posting
  providers: [ExpensesService, ReceiptsService],
  controllers: [ExpensesController],
  exports: [ExpensesService],
})
export class ExpensesModule {}

/*
 * Sprint S3 · Expenses Module · Week 7–8
 * Depends on: GeneralLedgerModule (for postToGL), PrismaModule (global)
 */
