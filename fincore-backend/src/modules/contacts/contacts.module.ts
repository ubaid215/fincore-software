// src/modules/contacts/contacts.module.ts
import { Module } from '@nestjs/common';
import { ContactsController } from './controllers/contacts.controller';
import { ContactsService } from './services/contacts.service';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [SubscriptionsModule, NotificationsModule],
  controllers: [ContactsController],
  providers: [ContactsService],
  exports: [ContactsService], // used by InvoicingModule, ExpensesModule, etc.
})
export class ContactsModule {}
