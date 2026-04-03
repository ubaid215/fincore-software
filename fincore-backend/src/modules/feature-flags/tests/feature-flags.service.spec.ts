/**
 * src/modules/feature-flags/tests/feature-flag.guard.spec.ts
 *
 * Unit tests for FeatureFlagGuard.
 * Tests HTTP 402 responses for all denial reasons.
 *
 * Sprint: S4 · Week 9–10
 */

import { HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureFlagGuard, FEATURE_KEY } from '../guards/feature-flag.guard';
import { FeatureFlagsService } from '../services/feature-flags.service';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeCtx(feature: string | undefined, orgId: string | undefined): any {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({
        headers: {
          ...(orgId ? { 'x-organization-id': orgId } : {}),
        },
      }),
    }),
  };
}

// ── Mock services ──────────────────────────────────────────────────────────

const mockReflector = {
  getAllAndOverride: jest.fn(),
};

const mockFeatureFlags = {
  checkAccess: jest.fn(),
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe('FeatureFlagGuard', () => {
  let guard: FeatureFlagGuard;
  const ORG_ID = 'org-001';

  beforeEach(() => {
    guard = new FeatureFlagGuard(
      mockReflector as unknown as Reflector,
      mockFeatureFlags as unknown as FeatureFlagsService,
    );
    jest.clearAllMocks();
  });

  // ─── No @RequiresFeature ────────────────────────────────────────────────
  describe('when no @RequiresFeature decorator is set', () => {
    it('allows the request through without calling checkAccess', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(undefined);
      const ctx = makeCtx(undefined, ORG_ID);

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(mockFeatureFlags.checkAccess).not.toHaveBeenCalled();
    });
  });

  // ─── Missing org header ────────────────────────────────────────────────
  describe('when X-Organization-Id header is missing', () => {
    it('throws HTTP 402 with MISSING_ORG_HEADER code', async () => {
      mockReflector.getAllAndOverride.mockReturnValue('invoicing');
      const ctx = makeCtx('invoicing', undefined); // no org header

      await expect(guard.canActivate(ctx)).rejects.toThrow(HttpException);

      try {
        await guard.canActivate(ctx);
      } catch (err: unknown) {
        const e = err as HttpException;
        expect(e.getStatus()).toBe(HttpStatus.PAYMENT_REQUIRED);
        const body = e.getResponse() as Record<string, unknown>;
        expect(body['code']).toBe('MISSING_ORG_HEADER');
      }
    });
  });

  // ─── Feature allowed ───────────────────────────────────────────────────
  describe('when feature is allowed', () => {
    it('returns true without throwing', async () => {
      mockReflector.getAllAndOverride.mockReturnValue('invoicing');
      mockFeatureFlags.checkAccess.mockResolvedValue({
        hasAccess: true,
        source: 'entitlement',
        globalOverride: null,
        featureKey: 'invoicing',
      });

      const result = await guard.canActivate(makeCtx('invoicing', ORG_ID));

      expect(result).toBe(true);
      expect(mockFeatureFlags.checkAccess).toHaveBeenCalledWith(ORG_ID, 'invoicing');
    });
  });

  // ─── Feature denied — all reasons ─────────────────────────────────────
  describe('when feature is denied', () => {
    async function expectHttp402(source: string, override: boolean | null = null) {
      mockReflector.getAllAndOverride.mockReturnValue('invoicing');
      mockFeatureFlags.checkAccess.mockResolvedValue({
        hasAccess: false,
        source,
        globalOverride: override,
        featureKey: 'invoicing',
      });

      try {
        await guard.canActivate(makeCtx('invoicing', ORG_ID));
        fail('Expected HttpException to be thrown');
      } catch (err: unknown) {
        const e = err as HttpException;
        expect(e.getStatus()).toBe(HttpStatus.PAYMENT_REQUIRED);
        const body = e.getResponse() as Record<string, unknown>;
        expect(body['statusCode']).toBe(402);
        expect(body['feature']).toBe('invoicing');
        return body;
      }
    }

    it('returns HTTP 402 when org has no subscription (source: no_subscription)', async () => {
      const body = await expectHttp402('no_subscription');
      expect(body['code']).toBe('FEATURE_ACCESS_DENIED');
    });

    it('returns HTTP 402 when feature is not in plan (source: entitlement, hasAccess: false)', async () => {
      const body = await expectHttp402('entitlement');
      expect(body['code']).toBe('FEATURE_ACCESS_DENIED');
    });

    it('returns HTTP 402 when a global kill-switch is active (source: global_override, override: false)', async () => {
      const body = await expectHttp402('global_override', false);
      expect(body['code']).toBe('FEATURE_ACCESS_DENIED');
      expect(body['globalOverride']).toBe(false);
    });

    it('response body includes the feature key that was denied', async () => {
      mockReflector.getAllAndOverride.mockReturnValue('financial_reports');
      mockFeatureFlags.checkAccess.mockResolvedValue({
        hasAccess: false,
        source: 'no_subscription',
        globalOverride: null,
        featureKey: 'financial_reports',
      });

      try {
        await guard.canActivate(makeCtx('financial_reports', ORG_ID));
      } catch (err: unknown) {
        const body = (err as HttpException).getResponse() as Record<string, unknown>;
        expect(body['feature']).toBe('financial_reports');
      }
    });

    it('response body includes the source of denial', async () => {
      mockReflector.getAllAndOverride.mockReturnValue('invoicing');
      mockFeatureFlags.checkAccess.mockResolvedValue({
        hasAccess: false,
        source: 'no_subscription',
        globalOverride: null,
        featureKey: 'invoicing',
      });

      try {
        await guard.canActivate(makeCtx('invoicing', ORG_ID));
      } catch (err: unknown) {
        const body = (err as HttpException).getResponse() as Record<string, unknown>;
        expect(body['source']).toBe('no_subscription');
      }
    });
  });
});

/*
 * Sprint S4 · FeatureFlagGuard Unit Tests · Week 9–10
 * 10 test cases — no decorator, missing header, allowed, all denial reasons + body shape
 */
