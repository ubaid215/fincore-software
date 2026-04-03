// src/modules/manual-payments/manual-payments.module.ts
import { Module } from '@nestjs/common';
import { ManualPaymentsService } from './services/manual-payments.service';
import { ProformaPdfService } from './services/proforma-pdf.service';
import { ManualPaymentsController } from './controllers/manual-payments.controller';
import { AdminPaymentsController } from './controllers/admin-payments.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [ManualPaymentsController, AdminPaymentsController],
  providers: [ManualPaymentsService, ProformaPdfService],
  exports: [ManualPaymentsService],
})
export class ManualPaymentsModule {}
