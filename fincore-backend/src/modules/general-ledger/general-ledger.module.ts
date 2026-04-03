// src/modules/general-ledger/general-ledger.module.ts
import { Module } from '@nestjs/common';
import { GeneralLedgerService } from './services/general-ledger.service';
import { JournalEntriesController } from './controllers/journal-entries.controller';
import { ChartOfAccountsModule } from '../chart-of-accounts/chart-of-accounts.module';

@Module({
  imports: [ChartOfAccountsModule],
  providers: [GeneralLedgerService],
  controllers: [JournalEntriesController],
  exports: [GeneralLedgerService],
})
export class GeneralLedgerModule {}
