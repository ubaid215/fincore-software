// src/modules/auth/strategies/google.strategy.ts
//
// Google OAuth 2.0 strategy using passport-google-oauth20.
// Flow: /auth/google → Google consent → /auth/google/callback → JWT issued.
// If email matches existing account → links GoogleId.
// If no account → auto-creates one (status = ACTIVE, no password).
//
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';
import { UserStatus } from '@prisma/client';

export interface GoogleUser {
  id: string; // User.id (our DB)
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  isNewUser: boolean; // true if auto-created — triggers onboarding redirect
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      clientID: config.getOrThrow<string>('auth.googleClientId'),
      clientSecret: config.getOrThrow<string>('auth.googleClientSecret'),
      callbackURL: config.getOrThrow<string>('auth.googleCallbackUrl'),
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    try {
      const email = profile.emails?.[0]?.value;
      const firstName = profile.name?.givenName ?? '';
      const lastName = profile.name?.familyName ?? '';
      const avatarUrl = profile.photos?.[0]?.value ?? null;
      const googleId = profile.id;

      if (!email) {
        return done(new Error('No email from Google'), undefined);
      }

      // ── 1. Try finding by googleId (returning user, same browser) ────────
      let user = await this.prisma.user.findFirst({
        where: { googleId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          status: true,
        },
      });

      // ── 2. Try finding by email (existing account, first Google login) ───
      if (!user) {
        const byEmail = await this.prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            status: true,
          },
        });

        if (byEmail) {
          // Link Google to existing account
          await this.prisma.user.update({
            where: { id: byEmail.id },
            data: {
              googleId,
              // Also upsert OAuthAccount row for multi-provider future
              oauthAccounts: {
                upsert: {
                  where: {
                    provider_providerUserId: { provider: 'google', providerUserId: googleId },
                  },
                  create: {
                    provider: 'google',
                    providerUserId: googleId,
                    accessToken,
                    refreshToken,
                  },
                  update: { accessToken, refreshToken },
                },
              },
            },
          });
          user = byEmail;
        }
      }

      let isNewUser = false;

      // ── 3. Auto-create account ────────────────────────────────────────────
      if (!user) {
        const created = await this.prisma.user.create({
          data: {
            email,
            firstName,
            lastName,
            avatarUrl,
            googleId,
            status: UserStatus.ACTIVE, // Google-verified email = auto-active
            emailVerifiedAt: new Date(),
            oauthAccounts: {
              create: {
                provider: 'google',
                providerUserId: googleId,
                accessToken,
                refreshToken,
              },
            },
          },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            status: true,
          },
        });
        user = created;
        isNewUser = true;
      }

      const googleUser: GoogleUser = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        isNewUser,
      };

      done(null, googleUser);
    } catch (err) {
      done(err as Error, undefined);
    }
  }
}
