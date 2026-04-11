// src/modules/auth/strategies/jwt.strategy.ts
//
// FIX: Original checked `isActive` (boolean) — new schema uses UserStatus enum.
//      Now checks user.status === 'ACTIVE'.
//      Payload now returns OrgJwtPayload shape when orgId claim is present,
//      so downstream guards read role/plan/apps from token — no extra DB hits.
//
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Algorithm } from 'jsonwebtoken';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { JwtPayload, OrgJwtPayload } from '../../../common/types/jwt-payload.type';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    const algorithm = config.get<string>('auth.jwtAlgorithm', 'RS256') as Algorithm;
    const publicKey = config.get<string>('auth.jwtPublicKey');

    if (!publicKey) {
      throw new Error('Missing required config: auth.jwtPublicKey');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: publicKey,
      algorithms: [algorithm],
    });
  }

  /**
   * Called by Passport after the JWT signature is verified.
   * Validates the user still exists and is ACTIVE.
   * Returns the full payload — attached to request.user by Passport.
   *
   * NOTE: We do ONE DB hit here (user status check) and embed everything
   *       else in the token so guards downstream make zero DB calls.
   */
  async validate(
    payload: JwtPayload & Partial<OrgJwtPayload>,
  ): Promise<JwtPayload | OrgJwtPayload> {
    // Fetch only status — cheapest possible query
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, status: true },
    });

    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    // FIX: Check UserStatus enum, not boolean isActive
    if (user.status !== UserStatus.ACTIVE) {
      const messages: Record<string, string> = {
        UNVERIFIED: 'Email not verified. Check your inbox.',
        SUSPENDED: 'Account suspended. Contact support.',
        DELETED: 'Account no longer exists.',
      };
      throw new UnauthorizedException(messages[user.status] ?? 'Account inactive');
    }

    // If token carries org context, return full OrgJwtPayload
    // so RolesGuard and FeatureFlagGuard need no DB calls
    if (payload.orgId && payload.role && payload.plan && payload.apps) {
      return {
        sub: payload.sub,
        email: payload.email,
        status: payload.status,
        orgId: payload.orgId,
        role: payload.role,
        plan: payload.plan,
        apps: payload.apps,
        mfaVerified: (payload as any).mfaVerified ?? false,
      } as OrgJwtPayload & { mfaVerified: boolean };
    }

    // Bare user token (pre org-selection)
    return {
      sub: payload.sub,
      email: payload.email,
      status: payload.status,
    } as JwtPayload;
  }
}
