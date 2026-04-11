// src/modules/auth/auth.module.ts

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms';

import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { EmailService } from './services/email.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { PrismaModule } from '../../database/prisma.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const algorithm = config.get<string>('auth.jwtAlgorithm', 'RS256');
        const privateKey = config.getOrThrow<string>('auth.jwtPrivateKey');
        const expiresIn = config.get<string>('auth.jwtExpiresIn', '15m') as StringValue;

        return {
          privateKey,
          signOptions: {
            algorithm: algorithm as any,
            expiresIn,
          },
        };
      },
    }),

    PrismaModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, EmailService, JwtStrategy, GoogleStrategy],
  exports: [AuthService, JwtModule, EmailService],
})
export class AuthModule {}
