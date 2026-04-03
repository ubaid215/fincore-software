/**
 * src/modules/subscriptions/subscriptions.module.ts
 *
 * Subscriptions module.
 *
 * NOTE: This module does NOT import FeatureFlagsModule to avoid circular deps.
 * FeatureFlagsModule imports SubscriptionsModule (one-way dependency).
 * Cache invalidation is done directly via Redis inside SubscriptionsService.
 *
 * Sprint: S4 · Week 9–10
 */

import { Module } from '@nestjs/common';
import { SubscriptionsService } from './services/subscriptions.service';
import { SubscriptionsController } from './controllers/subscriptions.controller';

@Module({
  providers: [SubscriptionsService],
  controllers: [SubscriptionsController],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}

/*
 * Sprint S4 · Subscriptions Module · Week 9–10
 * Depends on: PrismaModule (global), IoRedisModule (global via AppModule)
 * @Cron on SubscriptionsService requires ScheduleModule.forRoot() in AppModule.
 * Owned by: Billing team
 */
