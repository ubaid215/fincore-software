import { Module } from '@nestjs/common';
import { PlatformAdminController } from './controllers/platform-admin.controller';
import { PlatformAdminService } from './services/platform-admin.service';

@Module({
  controllers: [PlatformAdminController],
  providers: [PlatformAdminService],
  exports: [PlatformAdminService],
})
export class PlatformAdminModule {}
