// src/modules/redis/redis.module.ts
import { Global, Module } from '@nestjs/common';
import { RedisModule } from '@nestjs-modules/ioredis';
import { ConfigService } from '@nestjs/config';

@Global()
@Module({
  imports: [
    RedisModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'single',
        options: {
          host: configService.get<string>('redis.host', 'localhost'),
          port: configService.get<number>('redis.port', 6379),
          password: configService.get<string>('redis.password'),
          db: configService.get<number>('redis.db', 0),
          retryStrategy: (times: number) => {
            const delay = Math.min(times * 100, 3000);
            return delay;
          },
        },
      }),
    }),
  ],
  exports: [RedisModule],
})
export class GlobalRedisModule {}
