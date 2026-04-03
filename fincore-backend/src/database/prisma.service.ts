import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('✅ Database connected');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('cleanDatabase() only allowed in test environment');
    }
    const tables = [
      'auditLog',
      'manualPayment',
      'subscription',
      'bankTransaction',
      'bankStatement',
      'receipt',
      'expenseLine',
      'expense',
      'invoicePayment',
      'invoiceLineItem',
      'invoice',
      'journalLine',
      'journalEntry',
      'fiscalPeriod',
      'account',
      'invite',
      'refreshToken',
      'userOrganization',
      'plan',
      'organization',
      'user',
    ];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    for (const t of tables) await (this as any)[t].deleteMany();
  }
}
