/**
 * src/modules/bank-reconciliation/bank-reconciliation.module.ts
 * Sprint: S3 · Week 7–8
 */

import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { BankReconciliationService } from './services/bank-reconciliation.service';
import { AutoMatchService } from './services/auto-match.service';
import { BankReconciliationController } from './controllers/bank-reconciliation.controller';

@Module({
  imports: [
    // Memory storage — no temp files written to disk
    MulterModule.register({ dest: undefined }),
  ],
  providers: [BankReconciliationService, AutoMatchService],
  controllers: [BankReconciliationController],
  exports: [BankReconciliationService],
})
export class BankReconciliationModule {}

/*
 * Sprint S3 · Bank Reconciliation Module · Week 7–8
 * Depends on: PrismaModule (global), AWS S3
 * Parsers: CSV, OFX, QFX — all pure functions imported directly by service
 */
