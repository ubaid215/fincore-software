/**
 * src/modules/feature-flags/feature-flags.module.ts
 *
 * FIX 17: @Global() REMOVED.
 *   - The common FeatureFlagGuard (app-level) is already globally registered
 *     via APP_GUARD in AppModule. Making this module @Global caused double
 *     registration with a different guard class using a different decorator.
 *   - FeatureFlagsService is exported for modules that need plan-level checks.
 *   - The plan-level FeatureFlagGuard here is NOT globally registered —
 *     add it explicitly with @UseGuards(FeatureFlagGuard) on premium routes.
 */

import { Module } from '@nestjs/common';
import { FeatureFlagsService } from './services/feature-flags.service';
import { FeatureFlagGuard } from './guards/feature-flag.guard';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [SubscriptionsModule],
  providers: [FeatureFlagsService, FeatureFlagGuard],
  exports: [FeatureFlagsService, FeatureFlagGuard],
})
export class FeatureFlagsModule {}
