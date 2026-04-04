import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error(
        'DATABASE_URL environment variable is not set. ' +
          'Ensure your .env file is loaded before PrismaService is instantiated.',
      );
    }

    super({
      adapter: new PrismaPg({ connectionString }),
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
    ] as const;

    for (const t of tables) {
      await (this[t] as { deleteMany: () => Promise<unknown> }).deleteMany();
    }
  }
}
