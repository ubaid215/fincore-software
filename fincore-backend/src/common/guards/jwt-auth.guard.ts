// src/common/guards/jwt-auth.guard.ts
//
// FIX: Original was fine structurally but the strategy it calls (jwt.strategy.ts)
//      only checked `isActive` (boolean) — the new schema uses UserStatus enum.
//      The strategy is updated separately; this guard is otherwise unchanged.
//      Added handleRequest override to produce cleaner error messages.
//
import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    return super.canActivate(context);
  }

  // Override to intercept Passport errors and produce consistent JSON shape.
  handleRequest<T>(err: any, user: T, info: any): T {
    if (err || !user) {
      const message =
        info?.name === 'TokenExpiredError'
          ? 'Access token expired — please refresh'
          : (info?.message ?? err?.message ?? 'Unauthorized');
      throw new UnauthorizedException(message);
    }
    return user;
  }
}
