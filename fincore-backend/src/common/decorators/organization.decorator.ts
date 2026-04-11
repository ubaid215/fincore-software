// src/common/decorators/organization.decorator.ts
import { createParamDecorator, ExecutionContext, BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { SetMetadata } from '@nestjs/common';
import { AppKey } from '@prisma/client';

// ─── OrgId param decorator ────────────────────────────────────────────────────
/**
 * Extracts X-Organization-Id header from the request.
 * Throws BadRequestException if header is missing.
 *
 * @example
 *   getInvoices(@OrgId() orgId: string) { ... }
 */
export const OrgId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<Request>();
  const orgId = request.headers['x-organization-id'] as string | undefined;
  if (!orgId) {
    throw new BadRequestException('Missing required header: X-Organization-Id');
  }
  return orgId;
});

// ─── RequireApp metadata decorator ───────────────────────────────────────────
export const REQUIRE_APP_KEY = 'requireApp';

/**
 * Marks a route as requiring a specific app to be enabled for the org.
 * Enforced by FeatureFlagGuard which reads OrgAppAccess from the JWT payload.
 *
 * @example
 *   @RequireApp(AppKey.PAYROLL)
 *   createPayrollRun(...) { ... }
 */
export const RequireApp = (app: AppKey) => SetMetadata(REQUIRE_APP_KEY, app);