// src/common/middleware/tenant-context.middleware.ts
//
// NestJS HTTP middleware (not Prisma middleware).
// Runs at the start of every request, reads the authenticated user
// from request.user (set by JwtAuthGuard/Passport) and the org header,
// then calls prisma.setTenantContext() so the Prisma middleware has the
// right organizationId for every DB query in that request.
//
// Register globally in AppModule:
//   configure(consumer: MiddlewareConsumer) {
//     consumer.apply(TenantContextMiddleware).forRoutes('*');
//   }

import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../database/prisma.service';
import { OrgJwtPayload, isOrgPayload } from '../types/jwt-payload.type';

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const user = req.user as OrgJwtPayload | undefined;

    // If the request carries an org-scoped JWT, use its orgId claim.
    // Otherwise fall back to the X-Organization-Id header (for API key auth).
    const organizationId =
      (user && isOrgPayload(user) ? user.orgId : null) ??
      (req.headers['x-organization-id'] as string | undefined) ??
      null;

    const userId = user?.sub ?? null;

    this.prisma.setTenantContext({ organizationId, userId });

    next();
  }
}
