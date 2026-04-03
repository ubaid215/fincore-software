/**
 * src/modules/feature-flags/feature-flags.module.ts
 *
 * Feature Flags module.
 *
 * @Global — FeatureFlagsService is available in every module without
 * explicit import. FeatureFlagGuard is exported for use in controllers.
 *
 * Dependency resolution (no circular imports):
 *   FeatureFlagsModule imports SubscriptionsModule
 *   SubscriptionsModule does NOT import FeatureFlagsModule
 *
 * Sprint: S4 · Week 9–10
 */

import { Global, Module } from '@nestjs/common';
import { FeatureFlagsService } from './services/feature-flags.service';
import { FeatureFlagGuard } from './guards/feature-flag.guard';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Global()
@Module({
  imports: [SubscriptionsModule], // provides SubscriptionsService
  providers: [FeatureFlagsService, FeatureFlagGuard],
  exports: [FeatureFlagsService, FeatureFlagGuard],
})
export class FeatureFlagsModule {}

/*
 * Sprint S4 · Feature Flags Module · Week 9–10
 * @Global — FeatureFlagsService injected everywhere automatically.
 * Owned by: Billing team
 */
