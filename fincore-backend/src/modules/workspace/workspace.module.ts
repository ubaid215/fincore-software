// src/modules/workspace/workspace.module.ts
import { Module } from '@nestjs/common';
import { OrganizationsService } from './services/organizations.service';
import { InvitesService } from './services/invites.service';
import { OrganizationsController } from './controllers/organizations.controller';
import { InvitesController } from './controllers/invites.controller';
import { AuthModule } from '../auth/auth.module'; // exports EmailService

@Module({
  imports: [AuthModule], // EmailService for invite emails
  providers: [OrganizationsService, InvitesService],
  controllers: [OrganizationsController, InvitesController],
  exports: [OrganizationsService],
})
export class WorkspaceModule {}
