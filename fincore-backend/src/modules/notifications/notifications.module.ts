// src/modules/notifications/notifications.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './services/notifications.service';
import { NotificationsGateway } from './gateway/notifications.gateway';
import { EmailProcessor } from './processors/email.processor';
import { AuthModule } from '../auth/auth.module'; // JwtService for socket auth

@Module({
  imports: [
    AuthModule, // provides JwtService for gateway token verification
    BullModule.registerQueueAsync({
      name: 'email',
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('redis.host', 'localhost'),
          port: configService.get<number>('redis.port', 6379),
          password: configService.get<string>('redis.password'),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [NotificationsService, NotificationsGateway, EmailProcessor],
  exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}
