/* eslint-disable @typescript-eslint/no-require-imports */
// src/main.ts
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import helmet from 'helmet';
import compression = require('compression');
import cookieParser = require('cookie-parser');
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Use Winston logger piped from WinstonModule (registered in AppModule)
    bufferLogs: true,
  });

  const config = app.get(ConfigService);

  // ── Security middleware ─────────────────────────────────────────────────
  app.use(helmet());
  app.use(compression());

  // FIX 17: cookie-parser — required for HttpOnly refresh token cookie
  app.use(cookieParser());

  // FIX 19: CORS origins as string[]
  const rawOrigins = config.get<string>('app.corsOrigins', 'http://localhost:3001');
  const origins = rawOrigins.split(',').map((o) => o.trim());
  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Organization-Id', // FIX 21: allow org header
    ],
  });

  // ── Versioning ──────────────────────────────────────────────────────────
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // ── Global pipes ────────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── Global filters & interceptors ───────────────────────────────────────
  // NOTE: Guards are registered via APP_GUARD in AppModule so they have
  // access to the full DI container (required for RolesGuard, FeatureFlagGuard).
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor(), new TransformInterceptor());

  // FIX 20: Socket.io adapter for real-time notifications
  app.useWebSocketAdapter(new IoAdapter(app));

  // FIX 21: Swagger — add X-Organization-Id header + bearer auth ──────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('FinCore API')
    .setDescription(
      'Multi-tenant Finance SaaS API. ' +
        'All tenant-scoped endpoints require X-Organization-Id header. ' +
        'Call POST /auth/select-org first to receive an org-scoped access token.',
    )
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
    .addApiKey({ type: 'apiKey', in: 'header', name: 'X-Organization-Id' }, 'org-id')
    .build();

  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig), {
    swaggerOptions: {
      persistAuthorization: true, // keeps token across page refresh
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  const port = config.get<number>('app.port', 4000);
  await app.listen(port);

  console.log(`🚀 FinCore API   → http://localhost:${port}/v1`);
  console.log(`📚 Swagger docs  → http://localhost:${port}/docs`);
  console.log(`🔌 Socket.io     → ws://localhost:${port}`);
}

void bootstrap();
