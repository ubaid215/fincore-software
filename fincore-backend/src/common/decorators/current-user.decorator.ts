// src/common/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload, OrgJwtPayload } from '../types/jwt-payload.type';

/**
 * Extracts the authenticated user from the request.
 * Returns OrgJwtPayload when org context is present, JwtPayload otherwise.
 *
 * @example
 *   getProfile(@CurrentUser() user: JwtPayload) { ... }
 *   createInvoice(@CurrentUser() user: OrgJwtPayload) { ... }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload | OrgJwtPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
